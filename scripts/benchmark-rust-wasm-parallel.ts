import { availableParallelism } from "node:os";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { Worker } from "node:worker_threads";
import { huppermageCatalog } from "../src/core/catalog/index.ts";
import { createOptimizerExperimentEvaluator } from "../src/core/optimizer/index.ts";
import {
  createRustWasmOptimizerRequest,
  type RustWasmOptimizerRequest,
  type RustWasmOptimizerScoredCandidate,
} from "../src/core/optimizer/rustWasmBackendTypes.ts";
import { createResources } from "../src/core/simulation/index.ts";
import type { ComboSimulationOptions, SimulatedCharacter } from "../src/core/simulation/types.ts";
import { sublimationCatalog } from "../src/core/sublimations/index.ts";

type HybridBenchmarkScenario = {
  id: string;
  duration: number;
  maxActionsPerTurn: number;
  maxPassiveCount: number;
  maxSublimationCount: number;
};

type WorkerSearchResponse = {
  attempts: number;
  validCandidates: number;
  invalidCandidates: number;
  topCandidates: RustWasmOptimizerScoredCandidate[];
  metrics: Record<string, number>;
  workerMemoryUsage?: NodeJS.MemoryUsage;
};

const scenarios: HybridBenchmarkScenario[] = [
  { id: "t2-a8-p2", duration: 2, maxActionsPerTurn: 8, maxPassiveCount: 2, maxSublimationCount: 12 },
  { id: "t3-a12-p3", duration: 3, maxActionsPerTurn: 12, maxPassiveCount: 3, maxSublimationCount: 12 },
  { id: "t3-full", duration: 3, maxActionsPerTurn: 12, maxPassiveCount: 6, maxSublimationCount: 12 },
];

const scenarioId = readOption("--scenario") ?? "t3-full";
const budget = readIntegerOption("--budget", 1_000_000);
const seed = readOption("--seed") ?? "smoke";
const workerCount = readIntegerOption("--workers", Math.min(6, availableParallelism()));
const timeboxMs = readIntegerOption("--timebox-ms", 0);
const chunkSize = readIntegerOption("--chunk-size", 100_000);
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
const availableSublimationIds = sublimationCatalog
  .filter((entry) => entry.supportStatus === "supported")
  .map((entry) => entry.id);
const baseRequest = createRustWasmOptimizerRequest({
  catalog: huppermageCatalog,
  character,
  duration: scenario.duration,
  engines: ["hybrid"],
  backend: "rustWasm",
  rustWasmOracle: "disabled",
  seed: `bench-${scenario.id}-${seed}`,
  budget: { iterations: budget },
  maxActionsPerTurn: scenario.maxActionsPerTurn,
  maxPassiveCount: scenario.maxPassiveCount,
  maxSublimationCount: scenario.maxSublimationCount,
  availablePassiveIds,
  availableSublimationIds,
  defaultActionContext,
  maxCandidates: 5,
});

const workerSource = `
  const { parentPort, workerData } = require("node:worker_threads");
  const wasm = require(workerData.wasmPackagePath);
  const response = JSON.parse(wasm.run_hybrid_search_json(workerData.requestJson));
  response.workerMemoryUsage = process.memoryUsage();
  parentPort.postMessage(response);
`;
const start = performance.now();
const results = timeboxMs > 0
  ? await runTimeboxedWorkers()
  : await runFixedBudgetWorkers();
const elapsedMs = performance.now() - start;
const attempts = results.reduce((total, result) => total + result.attempts, 0);
const validCandidates = results.reduce((total, result) => total + result.validCandidates, 0);
const invalidCandidates = results.reduce((total, result) => total + result.invalidCandidates, 0);
const metrics = mergeMetrics(results.map((result) => result.metrics));
const workerMemoryUsages = results
  .map((result) => result.workerMemoryUsage)
  .filter((usage): usage is NodeJS.MemoryUsage => usage !== undefined);
const peakWorkerRssBytes = Math.max(0, ...workerMemoryUsages.map((usage) => usage.rss));
const totalWorkerRssBytes = workerMemoryUsages.reduce((total, usage) => total + usage.rss, 0);
const topCandidates = results
  .flatMap((result) => result.topCandidates)
  .sort(compareRustCandidates)
  .slice(0, 5);
const oracle = createOptimizerExperimentEvaluator({
  catalog: huppermageCatalog,
  character,
  duration: scenario.duration,
  defaultActionContext,
});
let finalOracleValid = 0;
let finalOracleInvalid = 0;
let maxScoreDelta = 0;
let maxTotalDamageDelta = 0;
for (const candidate of topCandidates) {
  const evaluation = oracle.evaluateDetailed({
    passiveIds: candidate.passiveIds,
    sublimationIds: candidate.sublimationIds,
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

console.log(JSON.stringify({
  scenario: scenario.id,
  backend: "rustWasmParallel",
  budget,
  seed,
  workerCount,
  ...(timeboxMs > 0 ? { timeboxMs, chunkSize, completedBudget: attempts } : {}),
  elapsedMs: round(elapsedMs),
  attemptsPerSecond: round(attempts / Math.max(0.001, elapsedMs / 1_000)),
  score: round(topCandidates[0]?.score.score ?? 0),
  attempts,
  admittedIndividuals: validCandidates,
  fabricationAttempts: attempts,
  uniqueFabricationProposals: attempts,
  duplicateFabricationProposals: 0,
  discardedProposals: invalidCandidates,
  finalOracleCandidates: topCandidates.length,
  finalOracleValid,
  finalOracleInvalid,
  finalOracleMaxScoreDelta: round(maxScoreDelta),
  finalOracleMaxTotalDamageDelta: round(maxTotalDamageDelta),
  memory: {
    parentRssMb: round(process.memoryUsage().rss / 1024 / 1024),
    peakWorkerRssMb: round(peakWorkerRssBytes / 1024 / 1024),
    averageWorkerRssMb: round((totalWorkerRssBytes / Math.max(1, workerMemoryUsages.length)) / 1024 / 1024),
    sampledWorkers: workerMemoryUsages.length,
  },
  metrics,
}));

async function runFixedBudgetWorkers(): Promise<WorkerSearchResponse[]> {
  const baseIterations = Math.floor(budget / workerCount);
  const remainder = budget % workerCount;
  return Promise.all(Array.from({ length: workerCount }, (_, workerIndex) => runWorker({
    ...baseRequest,
    seed: `${baseRequest.seed}:parallel:${workerIndex}`,
    iterations: baseIterations + (workerIndex < remainder ? 1 : 0),
  })));
}

async function runTimeboxedWorkers(): Promise<WorkerSearchResponse[]> {
  const results: WorkerSearchResponse[] = [];
  let scheduledAttempts = 0;
  let roundIndex = 0;

  while (scheduledAttempts < budget && performance.now() - start < timeboxMs) {
    const requests: RustWasmOptimizerRequest[] = [];
    for (let workerIndex = 0; workerIndex < workerCount && scheduledAttempts < budget; workerIndex += 1) {
      const iterations = Math.min(chunkSize, budget - scheduledAttempts);
      scheduledAttempts += iterations;
      requests.push({
        ...baseRequest,
        seed: `${baseRequest.seed}:parallel:${roundIndex}:${workerIndex}`,
        iterations,
      });
    }
    results.push(...await Promise.all(requests.map(runWorker)));
    roundIndex += 1;
  }

  return results;
}

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
