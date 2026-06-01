import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { Worker } from "node:worker_threads";
import { huppermageCatalog } from "../src/core/catalog/index.ts";
import { createOptimizerExperimentEvaluator } from "../src/core/optimizer/index.ts";
import {
  createRustWasmOptimizerRequest,
  type RustWasmHybridSearchResumeState,
  type RustWasmOptimizerRequest,
  type RustWasmOptimizerScoredCandidate,
} from "../src/core/optimizer/rustWasmBackendTypes.ts";
import { createResources } from "../src/core/simulation/index.ts";
import type { ComboSimulationOptions, SimulatedCharacter } from "../src/core/simulation/types.ts";

type HybridSearchScenario = {
  id: string;
  duration: number;
  maxActionsPerTurn: number;
  maxPassiveCount: number;
};

type WorkerSearchResponse = {
  attempts: number;
  validCandidates: number;
  invalidCandidates: number;
  topCandidates: RustWasmOptimizerScoredCandidate[];
  metrics: Record<string, number>;
  resumeState?: RustWasmHybridSearchResumeState;
};

type SessionRow = {
  id: string;
  fingerprint: string;
  total_attempts: number;
  best_candidate_json: string | null;
};

type WorkerStateRow = {
  resume_state_json: string | null;
  attempts: number;
  valid_candidates: number;
  invalid_candidates: number;
};

const scenarios: HybridSearchScenario[] = [
  { id: "t2-a8-p2", duration: 2, maxActionsPerTurn: 8, maxPassiveCount: 2 },
  { id: "t3-a12-p3", duration: 3, maxActionsPerTurn: 12, maxPassiveCount: 3 },
  { id: "t3-full", duration: 3, maxActionsPerTurn: 12, maxPassiveCount: 6 },
];

const sessionId = readOption("--session") ?? "hupper-t3-full";
const dbPath = resolve(readOption("--db") ?? ".optimizer/rust-wasm-search.sqlite");
const scenarioId = readOption("--scenario") ?? "t3-full";
const seed = readOption("--seed") ?? "continuous";
const workerCount = readIntegerOption("--workers", Math.min(6, availableParallelism()));
const chunkSize = readIntegerOption("--chunk-size", 100_000);
const maxRounds = readIntegerOption("--max-rounds", 0);
const timeboxMs = readIntegerOption("--timebox-ms", 0);
const reset = process.argv.includes("--reset");
const scenario = scenarios.find((entry) => entry.id === scenarioId);
if (!scenario) {
  throw new Error(`Unknown scenario '${scenarioId}'. Expected one of: ${scenarios.map((entry) => entry.id).join(", ")}.`);
}

const wasmPackagePath = resolve("src/wasm/optimizer_wasm_pkg/optimizer_wasm.js");
if (!existsSync(wasmPackagePath)) {
  throw new Error("Build WASM first with `pnpm wasm:build` or `pnpm diff:rust-wasm`.");
}

const character: SimulatedCharacter = {
  id: "hybrid-benchmark-huppermage",
  className: "huppermage",
  resources: createResources({ ap: 12, mp: 6, wp: 6, bq: 500 }),
  stats: {
    level: 200,
    hitPoints: 2050,
    hitPointsPercent: 0,
    generalMastery: 1200,
    elementalMastery: { fire: 1200, water: 1200, earth: 1200, air: 1200, light: 0, neutral: 0 },
    meleeMastery: 0,
    distanceMastery: 250,
    berserkMastery: 0,
    rearMastery: 0,
    criticalMastery: 150,
    healingMastery: 0,
    damageInflictedPercent: 20,
    healsPerformedPercent: 0,
    healsReceivedPercent: 0,
    armorReceivedPercent: 0,
    armorGivenPercent: 0,
    elementalResistance: 0,
    rearResistance: 0,
    criticalResistance: 0,
    range: 0,
    willpower: 0,
    criticalHitPercent: 3,
    parry: 0,
    lock: 0,
    dodge: 0,
    initiative: 0,
    indirectDamagePercent: 0,
  },
};
const defaultActionContext: ComboSimulationOptions["defaultActionContext"] = {
  position: "face",
  rangeMode: "distance",
  isCritical: false,
  isBerserk: false,
  isBlocked: false,
};
const availablePassiveIds = huppermageCatalog
  .filter((entry) => entry.kind === "passive")
  .map((entry) => entry.id);
const baseRequest = createRustWasmOptimizerRequest({
  catalog: huppermageCatalog,
  character,
  duration: scenario.duration,
  engines: ["hybrid"],
  backend: "rustWasm",
  rustWasmOracle: "disabled",
  seed: `search-${scenario.id}-${seed}`,
  budget: { iterations: chunkSize },
  maxActionsPerTurn: scenario.maxActionsPerTurn,
  maxPassiveCount: scenario.maxPassiveCount,
  availablePassiveIds,
  defaultActionContext,
  maxCandidates: 5,
});
const fingerprint = createFingerprint({
  algorithm: "rust-wasm-resume-v1",
  scenario,
  workerCount,
  request: { ...baseRequest, iterations: 0 },
});
const oracle = createOptimizerExperimentEvaluator({
  catalog: huppermageCatalog,
  character,
  duration: scenario.duration,
  defaultActionContext,
});
const workerSource = `
  const { parentPort, workerData } = require("node:worker_threads");
  const wasm = require(workerData.wasmPackagePath);
  parentPort.postMessage(JSON.parse(wasm.run_hybrid_search_json(workerData.requestJson)));
`;

mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
createSchema(db);
if (reset) {
  resetSession(db, sessionId);
}
const session = ensureSession(db, sessionId, fingerprint);

let stopRequested = false;
process.on("SIGINT", () => {
  stopRequested = true;
});

const startedAt = performance.now();
let roundIndex = 0;
while (!stopRequested) {
  if (maxRounds > 0 && roundIndex >= maxRounds) {
    break;
  }
  if (timeboxMs > 0 && performance.now() - startedAt >= timeboxMs) {
    break;
  }

  const workerStates = readWorkerStates(db, sessionId);
  const roundStart = performance.now();
  const results = await Promise.all(Array.from({ length: workerCount }, (_, workerIndex) => {
    const resumeState = workerStates.get(workerIndex)?.resume_state_json
      ? JSON.parse(workerStates.get(workerIndex)!.resume_state_json!) as RustWasmHybridSearchResumeState
      : undefined;
    const request: RustWasmOptimizerRequest = {
      ...baseRequest,
      seed: `${baseRequest.seed}:worker:${workerIndex}`,
      iterations: chunkSize,
      resumeState,
    };
    return runWorker(request);
  }));

  const previousBest = session.best_candidate_json
    ? JSON.parse(session.best_candidate_json) as RustWasmOptimizerScoredCandidate
    : undefined;
  const topCandidates = [
    ...results.flatMap((result) => result.topCandidates),
    ...(previousBest ? [previousBest] : []),
  ].sort(compareRustCandidates).slice(0, 5);
  const oracleSummary = verifyTopCandidates(topCandidates);
  const attempts = results.reduce((total, result) => total + result.attempts, 0);
  const validCandidates = results.reduce((total, result) => total + result.validCandidates, 0);
  const invalidCandidates = results.reduce((total, result) => total + result.invalidCandidates, 0);
  const metrics = mergeMetrics(results.map((result) => result.metrics));
  const elapsedMs = performance.now() - roundStart;
  const totalAttempts = session.total_attempts + attempts;
  const bestCandidate = topCandidates[0];
  const summary = {
    session: sessionId,
    dbPath,
    scenario: scenario.id,
    backend: "rustWasmPersistent",
    seed,
    workerCount,
    chunkSize,
    round: roundIndex + 1,
    elapsedMs: round(elapsedMs),
    attemptsPerSecond: round(attempts / Math.max(0.001, elapsedMs / 1_000)),
    attempts,
    totalAttempts,
    validCandidates,
    invalidCandidates,
    validRate: round(validCandidates / Math.max(1, attempts), 4),
    score: round(bestCandidate?.score.score ?? 0),
    finalOracleCandidates: topCandidates.length,
    ...oracleSummary,
    metrics,
  };

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const [workerIndex, result] of results.entries()) {
      upsertWorkerState(db, sessionId, workerIndex, result);
    }
    updateSession(db, sessionId, totalAttempts, bestCandidate, summary);
    insertCheckpoint(db, summary);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  session.total_attempts = totalAttempts;
  session.best_candidate_json = bestCandidate ? JSON.stringify(bestCandidate) : session.best_candidate_json;
  console.log(JSON.stringify(summary));
  roundIndex += 1;
}

db.close();

function runWorker(request: RustWasmOptimizerRequest): Promise<WorkerSearchResponse> {
  return new Promise<WorkerSearchResponse>((resolveResult, reject) => {
    const worker = new Worker(workerSource, {
      eval: true,
      workerData: { wasmPackagePath, requestJson: JSON.stringify(request) },
    });
    worker.once("message", resolveResult);
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Rust/WASM worker exited with ${code}`));
      }
    });
  });
}

function createSchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      fingerprint TEXT NOT NULL,
      total_attempts INTEGER NOT NULL DEFAULT 0,
      best_score REAL,
      best_candidate_json TEXT,
      last_summary_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS worker_states (
      session_id TEXT NOT NULL,
      worker_index INTEGER NOT NULL,
      resume_state_json TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      valid_candidates INTEGER NOT NULL DEFAULT 0,
      invalid_candidates INTEGER NOT NULL DEFAULT 0,
      metrics_json TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_id, worker_index)
    );
    CREATE TABLE IF NOT EXISTS checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      total_attempts INTEGER NOT NULL,
      score REAL NOT NULL,
      summary_json TEXT NOT NULL
    );
  `);
}

function resetSession(database: DatabaseSync, id: string): void {
  database.prepare("DELETE FROM checkpoints WHERE session_id = ?").run(id);
  database.prepare("DELETE FROM worker_states WHERE session_id = ?").run(id);
  database.prepare("DELETE FROM sessions WHERE id = ?").run(id);
}

function ensureSession(database: DatabaseSync, id: string, expectedFingerprint: string): SessionRow {
  const existing = database
    .prepare("SELECT id, fingerprint, total_attempts, best_candidate_json FROM sessions WHERE id = ?")
    .get(id) as SessionRow | undefined;
  if (existing) {
    if (existing.fingerprint !== expectedFingerprint) {
      throw new Error(`Session '${id}' fingerprint mismatch. Use --reset to discard persisted search state.`);
    }
    return existing;
  }
  database
    .prepare("INSERT INTO sessions (id, fingerprint) VALUES (?, ?)")
    .run(id, expectedFingerprint);
  return { id, fingerprint: expectedFingerprint, total_attempts: 0, best_candidate_json: null };
}

function readWorkerStates(database: DatabaseSync, id: string): Map<number, WorkerStateRow> {
  const rows = database
    .prepare("SELECT worker_index, resume_state_json, attempts, valid_candidates, invalid_candidates FROM worker_states WHERE session_id = ?")
    .all(id) as Array<WorkerStateRow & { worker_index: number }>;
  return new Map(rows.map((row) => [row.worker_index, row]));
}

function upsertWorkerState(
  database: DatabaseSync,
  id: string,
  workerIndex: number,
  result: WorkerSearchResponse,
): void {
  database.prepare(`
    INSERT INTO worker_states (
      session_id, worker_index, resume_state_json, attempts, valid_candidates,
      invalid_candidates, metrics_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(session_id, worker_index) DO UPDATE SET
      resume_state_json = excluded.resume_state_json,
      attempts = worker_states.attempts + excluded.attempts,
      valid_candidates = worker_states.valid_candidates + excluded.valid_candidates,
      invalid_candidates = worker_states.invalid_candidates + excluded.invalid_candidates,
      metrics_json = excluded.metrics_json,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    id,
    workerIndex,
    result.resumeState ? JSON.stringify(result.resumeState) : null,
    result.attempts,
    result.validCandidates,
    result.invalidCandidates,
    JSON.stringify(result.metrics),
  );
}

function updateSession(
  database: DatabaseSync,
  id: string,
  totalAttempts: number,
  bestCandidate: RustWasmOptimizerScoredCandidate | undefined,
  summary: unknown,
): void {
  database.prepare(`
    UPDATE sessions
    SET total_attempts = ?,
        best_score = ?,
        best_candidate_json = ?,
        last_summary_json = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    totalAttempts,
    bestCandidate?.score.score ?? null,
    bestCandidate ? JSON.stringify(bestCandidate) : null,
    JSON.stringify(summary),
    id,
  );
}

function insertCheckpoint(database: DatabaseSync, summary: { session: string; totalAttempts: number; score: number }): void {
  database
    .prepare("INSERT INTO checkpoints (session_id, total_attempts, score, summary_json) VALUES (?, ?, ?, ?)")
    .run(summary.session, summary.totalAttempts, summary.score, JSON.stringify(summary));
}

function verifyTopCandidates(topCandidates: RustWasmOptimizerScoredCandidate[]): {
  finalOracleValid: number;
  finalOracleInvalid: number;
  finalOracleMaxScoreDelta: number;
  finalOracleMaxTotalDamageDelta: number;
} {
  let finalOracleValid = 0;
  let finalOracleInvalid = 0;
  let maxScoreDelta = 0;
  let maxTotalDamageDelta = 0;
  for (const candidate of topCandidates) {
    const evaluation = oracle.evaluateDetailed({
      passiveIds: candidate.passiveIds,
      plan: candidate.plan,
    });
    if (!evaluation.result) {
      finalOracleInvalid += 1;
      continue;
    }
    finalOracleValid += 1;
    maxScoreDelta = Math.max(maxScoreDelta, Math.abs(candidate.score.score - evaluation.result.score.score));
    maxTotalDamageDelta = Math.max(maxTotalDamageDelta, Math.abs(candidate.score.totalDamage - evaluation.result.score.totalDamage));
  }
  return {
    finalOracleValid,
    finalOracleInvalid,
    finalOracleMaxScoreDelta: round(maxScoreDelta),
    finalOracleMaxTotalDamageDelta: round(maxTotalDamageDelta),
  };
}

function compareRustCandidates(
  left: RustWasmOptimizerScoredCandidate,
  right: RustWasmOptimizerScoredCandidate,
): number {
  return right.score.score - left.score.score
    || left.passiveIds.length - right.passiveIds.length
    || countActions(left) - countActions(right)
    || left.id.localeCompare(right.id);
}

function countActions(candidate: RustWasmOptimizerScoredCandidate): number {
  return candidate.plan.turns.reduce((total, turn) => total + turn.actions.length, 0);
}

function mergeMetrics(metricSets: Array<Record<string, number>>): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const metrics of metricSets) {
    for (const [key, value] of Object.entries(metrics)) {
      if (Number.isFinite(value)) {
        merged[key] = (merged[key] ?? 0) + value;
      }
    }
  }
  return merged;
}

function createFingerprint(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readIntegerOption(name: string, fallback: number): number {
  const value = readOption(name);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}
