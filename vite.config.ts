import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { Worker } from "node:worker_threads";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import {
  createOptimizerExperimentEvaluator,
  type OptimizerExperimentCandidate,
  type OptimizerExperimentOptions,
} from "./src/core/optimizer/index.ts";
import {
  createRustWasmOptimizerRequest,
  type RustWasmHybridSearchResumeState,
  type RustWasmOptimizerRequest,
  type RustWasmOptimizerScoredCandidate,
} from "./src/core/optimizer/rustWasmBackendTypes.ts";

const optimizerSessionsApiPrefix = "/api/optimizer-sessions";
const optimizerRunsStreamApiPath = "/api/optimizer-runs/stream";
const continuousOptimizerStreamApiPath = "/api/continuous-optimizer/stream";
const researchWorkspaceApiPath = "/api/research-workspace";
const optimizerSearchDatabasePath = resolve(process.env.WAKFU_OPTIMIZER_DB ?? ".optimizer/rust-wasm-search.sqlite");
const optimizerWasmPackagePath = resolve("src/wasm/optimizer_wasm_pkg/optimizer_wasm.js");
const optimizerWorkerSource = `
  const { parentPort, workerData } = require("node:worker_threads");
  const wasm = require(workerData.wasmPackagePath);
  parentPort.postMessage(JSON.parse(wasm.run_hybrid_search_json(workerData.requestJson)));
`;

export default defineConfig({
  plugins: [optimizerSessionsSqliteApi(), react()],
});

function optimizerSessionsSqliteApi(): Plugin {
  return {
    name: "wakfu-optimizer-sessions-sqlite-api",
    configureServer(server) {
      useOptimizerApiMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      useOptimizerApiMiddleware(server.middlewares);
    },
  };
}

type MiddlewareStack = {
  use: (
    handler: (request: IncomingMessage, response: ServerResponse, next: () => void) => void | Promise<void>,
  ) => void;
};

function useOptimizerApiMiddleware(middlewares: MiddlewareStack): void {
  middlewares.use(async (request, response, next) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    if (
      !requestUrl.pathname.startsWith(optimizerSessionsApiPrefix)
      && requestUrl.pathname !== researchWorkspaceApiPath
      && requestUrl.pathname !== optimizerRunsStreamApiPath
      && requestUrl.pathname !== continuousOptimizerStreamApiPath
    ) {
      next();
      return;
    }

    try {
      if (request.method === "GET" && requestUrl.pathname === researchWorkspaceApiPath) {
        sendJson(response, 200, { schemaVersion: 1, workspace: readResearchWorkspace() });
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === optimizerRunsStreamApiPath) {
        const body = await readJsonBody(request);
        await streamRustWasmOptimizerRun(request, response, body);
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === continuousOptimizerStreamApiPath) {
        const body = await readJsonBody(request);
        await streamContinuousOptimizerRun(request, response, body);
        return;
      }

      if (request.method === "PUT" && requestUrl.pathname === researchWorkspaceApiPath) {
        const body = await readJsonBody(request);
        const workspace = body && typeof body === "object" && "workspace" in body
          ? (body as { workspace: unknown }).workspace
          : undefined;
        if (!workspace || typeof workspace !== "object") {
          sendJson(response, 400, { error: "Missing research workspace." });
          return;
        }

        writeResearchWorkspace(workspace);
        sendJson(response, 204, null);
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === optimizerSessionsApiPrefix) {
        sendJson(response, 200, { schemaVersion: 1, sessions: readOptimizerSessions() });
        return;
      }

      if (request.method === "PUT" && requestUrl.pathname.startsWith(`${optimizerSessionsApiPrefix}/`)) {
        const setupId = decodeURIComponent(requestUrl.pathname.slice(optimizerSessionsApiPrefix.length + 1));
        if (!setupId) {
          sendJson(response, 400, { error: "Missing setup id." });
          return;
        }

        const body = await readJsonBody(request);
        const session = body && typeof body === "object" && "session" in body
          ? (body as { session: unknown }).session
          : undefined;
        if (!session || typeof session !== "object") {
          sendJson(response, 400, { error: "Missing optimizer session." });
          return;
        }

        writeOptimizerSession(setupId, session);
        sendJson(response, 204, null);
        return;
      }

      sendJson(response, 405, { error: "Unsupported optimizer session API method." });
    } catch (error) {
      if (response.headersSent) {
        response.end();
        return;
      }

      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Unexpected optimizer session API error.",
      });
    }
  });
}

type OptimizerRunStreamRequest = {
  options?: OptimizerExperimentOptions;
  progressIntervalMs?: number;
  workerCount?: number;
};

type ContinuousOptimizerStreamRequest = {
  args?: string[];
};

type OptimizerWorkerSearchResponse = {
  attempts: number;
  validCandidates: number;
  invalidCandidates: number;
  topCandidates: RustWasmOptimizerScoredCandidate[];
  metrics: Record<string, number>;
  resumeState?: RustWasmHybridSearchResumeState;
};

async function streamContinuousOptimizerRun(
  request: IncomingMessage,
  response: ServerResponse,
  body: unknown,
): Promise<void> {
  const payload = body as ContinuousOptimizerStreamRequest | null;
  const rawArgs = Array.isArray(payload?.args) ? payload.args : [];
  const args = Array.isArray(payload?.args)
    ? rawArgs.filter((arg): arg is string => typeof arg === "string")
    : [];
  if (args.length !== rawArgs.length) {
    sendJson(response, 400, { error: "Continuous optimizer args must be strings." });
    return;
  }

  response.statusCode = 200;
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders?.();

  const child = spawn(process.execPath, [
    "--experimental-strip-types",
    "scripts/search-rust-wasm-sqlite.ts",
    "--",
    ...args,
  ], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdoutBuffer = "";
  let stderrBuffer = "";
  const recentProcessLogs: string[] = [];
  let closed = false;
  const runStartedAt = performance.now();

  const stopChild = () => {
    if (!closed && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }
  };

  request.on("aborted", stopChild);
  response.on("close", stopChild);

  sendSse(response, "started", {
    command: "node",
    args: ["--experimental-strip-types", "scripts/search-rust-wasm-sqlite.ts", "--", ...args],
  });
  if (!args.includes("--reset")) {
    sendContinuousOptimizerResumeEvents(response, args);
  }
  const heartbeat = setInterval(() => {
    if (!closed) {
      sendSse(response, "heartbeat", {
        elapsedMs: Math.round(performance.now() - runStartedAt),
      });
    }
  }, 2_000);
  heartbeat.unref?.();

  child.stdout.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString("utf8");
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }
      try {
        sendContinuousOptimizerSummaryEvents(response, JSON.parse(trimmed) as unknown);
      } catch {
        sendSse(response, "log", { stream: "stdout", line: trimmed });
      }
    }
  });

  child.stderr.on("data", (chunk: Buffer) => {
    stderrBuffer += chunk.toString("utf8");
    const lines = stderrBuffer.split(/\r?\n/);
    stderrBuffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        recentProcessLogs.push(`stderr: ${trimmed}`);
        recentProcessLogs.splice(0, Math.max(0, recentProcessLogs.length - 8));
        sendSse(response, "log", { stream: "stderr", line: trimmed });
      }
    }
  });

  await new Promise<void>((resolveStream) => {
    child.once("error", (error) => {
      closed = true;
      clearInterval(heartbeat);
      sendSse(response, "error", { error: error.message });
      resolveStream();
    });
    child.once("close", (code, signal) => {
      closed = true;
      clearInterval(heartbeat);
      if (stdoutBuffer.trim().length > 0) {
        try {
          sendContinuousOptimizerSummaryEvents(response, JSON.parse(stdoutBuffer.trim()) as unknown);
        } catch {
          sendSse(response, "log", { stream: "stdout", line: stdoutBuffer.trim() });
        }
      }
      if (stderrBuffer.trim().length > 0) {
        recentProcessLogs.push(`stderr: ${stderrBuffer.trim()}`);
        recentProcessLogs.splice(0, Math.max(0, recentProcessLogs.length - 8));
        sendSse(response, "log", { stream: "stderr", line: stderrBuffer.trim() });
      }
      if (code === 0) {
        sendSse(response, "complete", { code });
      } else if (signal === "SIGTERM") {
        sendSse(response, "stopped", { signal });
      } else {
        sendSse(response, "error", {
          error: formatContinuousProcessError(
            `Continuous optimizer exited with code ${code ?? "unknown"}.`,
            recentProcessLogs,
          ),
          code,
          signal,
        });
      }
      resolveStream();
    });
  });

  response.end();
}

function formatContinuousProcessError(error: string, recentLogs: string[]): string {
  const meaningfulLog = recentLogs.find((line) => line.includes("fingerprint mismatch"))
    ?? recentLogs.find((line) => line.startsWith("stderr: Error:"))
    ?? recentLogs.find((line) => line.includes("Error:"));
  const primary = meaningfulLog
    ? meaningfulLog.replace(/^stderr:\s*/, "").replace(/^Error:\s*/, "")
    : error;
  const details = [error, ...recentLogs]
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== primary && line !== `Error: ${primary}`)
    .slice(0, 8);

  return [primary, ...details].join("\n");
}

function sendContinuousOptimizerResumeEvents(response: ServerResponse, args: string[]): void {
  const sessionId = readArgValue(args, "--session");
  if (!sessionId) {
    return;
  }

  const dbPath = resolve(readArgValue(args, "--db") ?? ".optimizer/rust-wasm-search.sqlite");
  if (!existsSync(dbPath)) {
    return;
  }

  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    const summary = readContinuousOptimizerStoredSummary(db, sessionId);
    if (!summary) {
      return;
    }
    sendContinuousOptimizerSummaryEvents(
      response,
      withContinuousOptimizerStoredCandidates(db, sessionId, summary),
    );
  } catch {
    return;
  } finally {
    db.close();
  }
}

function readContinuousOptimizerStoredSummary(
  db: DatabaseSync,
  sessionId: string,
): unknown | null {
  const continuousRow = db.prepare("SELECT last_summary_json FROM continuous_sessions WHERE id = ?").get(sessionId) as
    | { last_summary_json: string | null }
    | undefined;
  if (continuousRow?.last_summary_json) {
    return JSON.parse(continuousRow.last_summary_json) as unknown;
  }

  const legacyRow = db.prepare("SELECT last_summary_json FROM sessions WHERE id = ?").get(sessionId) as
    | { last_summary_json: string | null }
    | undefined;
  return legacyRow?.last_summary_json ? JSON.parse(legacyRow.last_summary_json) as unknown : null;
}

function withContinuousOptimizerStoredCandidates(
  db: DatabaseSync,
  sessionId: string,
  summary: unknown,
): unknown {
  if (!summary || typeof summary !== "object") {
    return summary;
  }

  const record = summary as Record<string, unknown>;
  const storedCandidates = readContinuousOptimizerStoredCandidatePayloads(db, sessionId, record, 20);
  if (storedCandidates.length === 0) {
    return summary;
  }

  const summaryCandidates = Array.isArray(record.verifiedCandidates) ? record.verifiedCandidates : [];
  const byId = new Map<string, unknown>();
  for (const candidate of [...storedCandidates, ...summaryCandidates]) {
    const id = readContinuousOptimizerCandidatePayloadId(candidate);
    if (id) {
      byId.set(id, candidate);
    }
  }

  return {
    ...record,
    verifiedCandidates: [...byId.values()],
  };
}

function readContinuousOptimizerStoredCandidatePayloads(
  db: DatabaseSync,
  sessionId: string,
  summary: Record<string, unknown>,
  limit: number,
): unknown[] {
  const rows = db.prepare(`
    SELECT candidate_json, score, attempt
    FROM continuous_candidate_evaluations
    WHERE session_id = ? AND valid = 1
    ORDER BY score DESC, attempt DESC, id ASC
    LIMIT ?
  `).all(sessionId, limit) as Array<{ candidate_json: string; score: number; attempt: number }>;

  return rows
    .map((row, index) => createContinuousOptimizerCandidatePayloadFromStoredRow(row, summary, index + 1))
    .filter((payload): payload is NonNullable<typeof payload> => payload !== null);
}

function createContinuousOptimizerCandidatePayloadFromStoredRow(
  row: { candidate_json: string; score: number; attempt: number },
  summary: Record<string, unknown>,
  rank: number,
): unknown | null {
  const candidate = JSON.parse(row.candidate_json) as unknown;
  if (!isContinuousOptimizerDisplayCandidate(candidate)) {
    return null;
  }

  return {
    schemaVersion: 1,
    totalAttempts: Number(summary.totalAttempts ?? row.attempt),
    rank,
    run: {
      sessionId: String(summary.session ?? ""),
      scenarioId: String(summary.scenario ?? ""),
      seed: String(summary.seed ?? "continuous"),
      workerCount: Number(summary.workerCount ?? 0),
      chunkSize: Number(summary.chunkSize ?? 0),
      scoreCriterion: summary.scoreCriterion === "element-damage" ? "element-damage" : "total-damage",
      targetElement: summary.targetElement ?? null,
      requireSustainableCycle: Boolean(summary.requireSustainableCycle),
    },
    candidate,
  };
}

function isContinuousOptimizerDisplayCandidate(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return Boolean(record.plan)
    && Boolean(record.simulation)
    && Boolean(record.score)
    && Boolean(record.sustainability);
}

function readContinuousOptimizerCandidatePayloadId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const candidate = (payload as Record<string, unknown>).candidate;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const id = (candidate as Record<string, unknown>).id;
  return typeof id === "string" ? id : null;
}

function sendContinuousOptimizerSummaryEvents(response: ServerResponse, summary: unknown): void {
  if (!summary || typeof summary !== "object") {
    sendSse(response, "progress", summary);
    return;
  }

  const record = summary as Record<string, unknown>;
  const verifiedCandidates = Array.isArray(record.verifiedCandidates) ? record.verifiedCandidates : [];
  const progress = { ...record };
  delete progress.verifiedCandidates;
  sendSse(response, "progress", progress);
  for (const candidate of verifiedCandidates) {
    sendSse(response, "candidate", candidate);
  }
}

function readArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  return args[index + 1];
}

async function streamRustWasmOptimizerRun(
  request: IncomingMessage,
  response: ServerResponse,
  body: unknown,
): Promise<void> {
  const payload = body as OptimizerRunStreamRequest | null;
  const options = payload?.options;
  if (!options || typeof options !== "object") {
    sendJson(response, 400, { error: "Missing optimizer options." });
    return;
  }
  if (options.engines.length !== 1 || options.engines[0] !== "hybrid") {
    sendJson(response, 400, { error: "Rust/WASM streaming only supports the hybrid optimizer engine." });
    return;
  }

  const require = createRequire(import.meta.url);
  try {
    require.resolve(optimizerWasmPackagePath);
  } catch {
    sendJson(response, 500, { error: "Build WASM first with `pnpm wasm:build`." });
    return;
  }

  response.statusCode = 200;
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders?.();

  let cancelled = false;

  request.on("aborted", () => {
    cancelled = true;
  });

  try {
    const progressIntervalMs = clampInteger(payload?.progressIntervalMs ?? 500, 100, 5_000);
    const workerCount = clampInteger(payload?.workerCount ?? Math.min(4, availableParallelism()), 1, Math.max(1, availableParallelism()));
    const totalBudget = clampInteger(options.budget.iterations, 1, 1_000_000_000);
    const maxCandidates = clampInteger(options.maxCandidates ?? 20, 1, 50);
    const evaluator = createOptimizerExperimentEvaluator(options);
    const resumeStates: Array<RustWasmHybridSearchResumeState | undefined> = Array.from({ length: workerCount });
    const topCandidates = new Map<string, RustWasmOptimizerScoredCandidate>();
    const metrics: Record<string, number> = {};
    let attempts = 0;
    let validCandidates = 0;
    let invalidCandidates = 0;
    let nextChunkIterations = Math.max(workerCount, 10_000);
    let lastProgressAt = performance.now();

    sendSse(response, "progress", createOptimizerRunProgressPayload({
      attempts,
      validCandidates,
      invalidCandidates,
      metrics,
      topCandidates,
      evaluator,
      maxCandidates,
    }));

    while (!cancelled && attempts < totalBudget) {
      const remaining = totalBudget - attempts;
      const roundIterations = Math.min(nextChunkIterations, remaining);
      const startedAt = performance.now();
      const workerIterations = splitIterations(roundIterations, workerCount);
      const results = await Promise.all(workerIterations.map((iterations, workerIndex) => {
        if (iterations <= 0) {
          return undefined;
        }

        const rustRequest = createRustWasmOptimizerRequest({
          ...options,
          backend: "rustWasm",
          rustWasmOracle: "disabled",
          engines: ["hybrid"],
          seed: `${options.seed ?? "optimizer-ui"}:worker:${workerIndex}`,
          budget: { iterations },
          maxCandidates,
        });
        const requestWithResume: RustWasmOptimizerRequest = {
          ...rustRequest,
          resumeState: resumeStates[workerIndex],
        };
        return runRustWasmWorker(requestWithResume);
      }));

      for (const [workerIndex, result] of results.entries()) {
        if (!result) {
          continue;
        }
        resumeStates[workerIndex] = result.resumeState;
        attempts += result.attempts;
        validCandidates += result.validCandidates;
        invalidCandidates += result.invalidCandidates;
        mergeNumericMetrics(metrics, result.metrics);
        mergeTopCandidates(topCandidates, result.topCandidates, maxCandidates);
      }

      const elapsedMs = performance.now() - startedAt;
      nextChunkIterations = tuneChunkIterations(roundIterations, elapsedMs, progressIntervalMs, workerCount);

      if (performance.now() - lastProgressAt >= progressIntervalMs || attempts >= totalBudget) {
        sendSse(response, "progress", createOptimizerRunProgressPayload({
          attempts,
          validCandidates,
          invalidCandidates,
          metrics,
          topCandidates,
          evaluator,
          maxCandidates,
        }));
        lastProgressAt = performance.now();
      }
    }

    sendSse(response, "complete", createOptimizerRunProgressPayload({
      attempts,
      validCandidates,
      invalidCandidates,
      metrics,
      topCandidates,
      evaluator,
      maxCandidates,
    }));
    response.end();
  } catch (error) {
    sendSse(response, "error", {
      error: error instanceof Error ? error.message : "Unexpected optimizer stream error.",
    });
    response.end();
  }
}

function runRustWasmWorker(request: RustWasmOptimizerRequest): Promise<OptimizerWorkerSearchResponse> {
  return new Promise((resolveResult, reject) => {
    const worker = new Worker(optimizerWorkerSource, {
      eval: true,
      workerData: {
        requestJson: JSON.stringify(request),
        wasmPackagePath: optimizerWasmPackagePath,
      },
    });
    worker.once("message", (message: OptimizerWorkerSearchResponse) => resolveResult(message));
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Rust/WASM optimizer worker exited with code ${code}.`));
      }
    });
  });
}

function createOptimizerRunProgressPayload({
  attempts,
  evaluator,
  invalidCandidates,
  maxCandidates,
  metrics,
  topCandidates,
  validCandidates,
}: {
  attempts: number;
  evaluator: ReturnType<typeof createOptimizerExperimentEvaluator>;
  invalidCandidates: number;
  maxCandidates: number;
  metrics: Record<string, number>;
  topCandidates: Map<string, RustWasmOptimizerScoredCandidate>;
  validCandidates: number;
}) {
  const verifiedTopCandidates = [...topCandidates.values()]
    .sort(compareRustWasmCandidates)
    .slice(0, maxCandidates)
    .map((candidate) => evaluator.evaluate({
      passiveIds: candidate.passiveIds,
      sublimationIds: candidate.sublimationIds,
      plan: candidate.plan,
    }))
    .filter((candidate): candidate is OptimizerExperimentCandidate => Boolean(candidate))
    .sort(compareOptimizerCandidates)
    .slice(0, maxCandidates);

  return {
    schemaVersion: 1,
    attempts,
    validCandidates,
    invalidCandidates,
    topCandidates: verifiedTopCandidates,
    metrics,
  };
}

function splitIterations(total: number, workerCount: number): number[] {
  const base = Math.floor(total / workerCount);
  const remainder = total % workerCount;
  return Array.from({ length: workerCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function tuneChunkIterations(currentIterations: number, elapsedMs: number, targetMs: number, workerCount: number): number {
  if (elapsedMs <= 0) {
    return currentIterations;
  }

  const ratio = targetMs / elapsedMs;
  const tuned = Math.round(currentIterations * Math.max(0.5, Math.min(2, ratio)));
  return Math.max(workerCount, Math.min(1_000_000, tuned));
}

function mergeTopCandidates(
  target: Map<string, RustWasmOptimizerScoredCandidate>,
  candidates: RustWasmOptimizerScoredCandidate[],
  maxCandidates: number,
): void {
  for (const candidate of candidates) {
    const existing = target.get(candidate.id);
    if (!existing || compareRustWasmCandidates(candidate, existing) < 0) {
      target.set(candidate.id, candidate);
    }
  }

  const ranked = [...target.values()].sort(compareRustWasmCandidates).slice(0, Math.max(maxCandidates, 50));
  target.clear();
  for (const candidate of ranked) {
    target.set(candidate.id, candidate);
  }
}

function compareOptimizerCandidates(left: OptimizerExperimentCandidate, right: OptimizerExperimentCandidate): number {
  return compareRankedCandidateValues(left.score.score, left.passiveIds.length, left.id, right.score.score, right.passiveIds.length, right.id);
}

function compareRustWasmCandidates(left: RustWasmOptimizerScoredCandidate, right: RustWasmOptimizerScoredCandidate): number {
  return compareRankedCandidateValues(left.score.score, left.passiveIds.length, left.id, right.score.score, right.passiveIds.length, right.id);
}

function compareRankedCandidateValues(
  leftScore: number,
  leftPassiveCount: number,
  leftId: string,
  rightScore: number,
  rightPassiveCount: number,
  rightId: string,
): number {
  const scoreDifference = rightScore - leftScore;
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const passiveCountDifference = leftPassiveCount - rightPassiveCount;
  if (passiveCountDifference !== 0) {
    return passiveCountDifference;
  }

  return leftId.localeCompare(rightId);
}

function mergeNumericMetrics(target: Record<string, number>, source: Record<string, number>): void {
  for (const [key, value] of Object.entries(source)) {
    if (Number.isFinite(value)) {
      target[key] = (target[key] ?? 0) + value;
    }
  }
}

function sendSse(response: ServerResponse, event: string, data: unknown): void {
  if (response.destroyed || response.writableEnded) {
    return;
  }

  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function readResearchWorkspace(): unknown | null {
  const database = openOptimizerDatabase();
  try {
    const row = database
      .prepare("SELECT document_json FROM optimizer_ui_documents WHERE document_key = ?")
      .get("researchWorkspace") as { document_json: string } | undefined;
    return row ? JSON.parse(row.document_json) as unknown : null;
  } finally {
    database.close();
  }
}

function writeResearchWorkspace(workspace: unknown): void {
  const database = openOptimizerDatabase();
  try {
    database.prepare(`
      INSERT INTO optimizer_ui_documents (document_key, document_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(document_key) DO UPDATE SET
        document_json = excluded.document_json,
        updated_at = CURRENT_TIMESTAMP
    `).run("researchWorkspace", JSON.stringify(workspace));
  } finally {
    database.close();
  }
}

function readOptimizerSessions(): Record<string, unknown> {
  const database = openOptimizerDatabase();
  try {
    const rows = database
      .prepare("SELECT setup_id, session_json FROM optimizer_ui_sessions")
      .all() as Array<{ setup_id: string; session_json: string }>;
    return Object.fromEntries(rows.map((row) => [row.setup_id, JSON.parse(row.session_json) as unknown]));
  } finally {
    database.close();
  }
}

function writeOptimizerSession(setupId: string, session: unknown): void {
  const database = openOptimizerDatabase();
  try {
    database.prepare(`
      INSERT INTO optimizer_ui_sessions (setup_id, session_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(setup_id) DO UPDATE SET
        session_json = excluded.session_json,
        updated_at = CURRENT_TIMESTAMP
    `).run(setupId, JSON.stringify(session));
  } finally {
    database.close();
  }
}

function openOptimizerDatabase(): DatabaseSync {
  mkdirSync(dirname(optimizerSearchDatabasePath), { recursive: true });
  const database = new DatabaseSync(optimizerSearchDatabasePath);
  database.exec(`
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS optimizer_ui_sessions (
      setup_id TEXT PRIMARY KEY,
      session_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS optimizer_ui_documents (
      document_key TEXT PRIMARY KEY,
      document_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return database;
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolveRequest, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => {
      try {
        const serialized = Buffer.concat(chunks).toString("utf8");
        resolveRequest(serialized ? JSON.parse(serialized) as unknown : null);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.statusCode = statusCode;
  if (body === null) {
    response.end();
    return;
  }

  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}
