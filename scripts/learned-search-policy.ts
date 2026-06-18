import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

export type LearnedPolicyDatasetKind = "candidate" | "reuseTrial" | "checkpoint" | "motif" | "boundary";
export type LearnedPolicySplit = "train" | "test";
export type LearnedPolicySplitKey = "session" | "seed" | "scenario";

export type LearnedPolicyCandidateFeatures = {
  actionCount: number;
  turnCount: number;
  passiveCount: number;
  sublimationCount: number;
  spellPrefix: string[];
  spellHistogram: Record<string, number>;
};

export type LearnedPolicyLabels = {
  valid: boolean | null;
  resultScore: number | null;
  sourceScore: number | null;
  scoreDelta: number | null;
  improvedGlobalBest: boolean;
  useful: boolean;
  violationCategory: string | null;
};

export type LearnedPolicyDatasetRow = {
  id: string;
  kind: LearnedPolicyDatasetKind;
  split: LearnedPolicySplit;
  groupKey: string;
  sessionId: string;
  scenarioId: string;
  setupHash: string;
  seed: string;
  attempt: number | null;
  sourceKind: string;
  sourceRef: string | null;
  sourceCandidateId: number | null;
  strategy: string | null;
  handcraftedOrder: number;
  features: LearnedPolicyCandidateFeatures | null;
  labels: LearnedPolicyLabels;
};

export type LearnedPolicyDatasetOptions = {
  splitKey?: LearnedPolicySplitKey;
  testRatio?: number;
  testModulo?: number;
  testRemainder?: number;
};

export type LearnedPolicyEvaluationOptions = {
  topK?: number;
};

export type LearnedPolicyMetricSet = {
  policy: string;
  totalRows: number;
  selectedRows: number;
  topK: number;
  topKAverageScoreDelta: number | null;
  topKValidityRate: number | null;
  topKInvalidSelectionRate: number | null;
  globalBestRecall: number | null;
  usefulRate: number | null;
};

export type LearnedPolicyEvaluationSummary = {
  rows: number;
  trainRows: number;
  testRows: number;
  proposalRows: number;
  topK: number;
  handcrafted: LearnedPolicyMetricSet;
  strategyBaseline: LearnedPolicyMetricSet;
  lift: {
    topKAverageScoreDelta: number | null;
    topKValidityRate: number | null;
    globalBestRecall: number | null;
    usefulRate: number | null;
  };
  strategyScores: Record<string, number>;
};

const handcraftedStrategyOrder = new Map([
  ["rotate-turn-actions", 0],
  ["swap-last-turn-actions", 1],
  ["move-last-action-earlier", 2],
  ["move-first-action-later", 3],
]);

export function exportLearnedPolicyDataset(
  database: DatabaseSync,
  options: LearnedPolicyDatasetOptions = {},
): LearnedPolicyDatasetRow[] {
  const splitOptions = normalizeDatasetOptions(options);
  const sessions = listContinuousSessions(database);
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const rows = [
    ...exportCandidateRows(database, sessionById, splitOptions),
    ...exportReuseTrialRows(database, sessionById, splitOptions),
    ...exportCheckpointRows(database, sessionById, splitOptions),
    ...exportMotifRows(database, sessionById, splitOptions),
    ...exportBoundaryRows(database, sessionById, splitOptions),
  ];
  return rows.sort((left, right) =>
    left.sessionId.localeCompare(right.sessionId)
    || (left.attempt ?? 0) - (right.attempt ?? 0)
    || left.kind.localeCompare(right.kind)
    || left.id.localeCompare(right.id)
  );
}

export function evaluateLearnedPolicyDataset(
  rows: LearnedPolicyDatasetRow[],
  options: LearnedPolicyEvaluationOptions = {},
): LearnedPolicyEvaluationSummary {
  const topK = Math.max(1, options.topK ?? 10);
  const proposalRows = rows.filter(isEvaluatedProposalRow);
  const trainRows = proposalRows.filter((row) => row.split === "train");
  const testRows = proposalRows.filter((row) => row.split === "test");
  const evaluationRows = testRows.length > 0 ? testRows : proposalRows;
  const strategyScores = learnStrategyScores(trainRows.length > 0 ? trainRows : proposalRows);
  const handcrafted = scorePolicy(
    "handcrafted",
    evaluationRows,
    topK,
    (row) => -row.handcraftedOrder + ((row.labels.sourceScore ?? 0) / 1_000_000),
  );
  const strategyBaseline = scorePolicy(
    "strategy-baseline",
    evaluationRows,
    topK,
    (row) => (row.strategy ? strategyScores[row.strategy] ?? 0 : 0) + ((row.labels.sourceScore ?? 0) / 10_000_000),
  );

  return {
    rows: rows.length,
    trainRows: proposalRows.filter((row) => row.split === "train").length,
    testRows: proposalRows.filter((row) => row.split === "test").length,
    proposalRows: proposalRows.length,
    topK,
    handcrafted,
    strategyBaseline,
    lift: {
      topKAverageScoreDelta: subtractNullable(strategyBaseline.topKAverageScoreDelta, handcrafted.topKAverageScoreDelta),
      topKValidityRate: subtractNullable(strategyBaseline.topKValidityRate, handcrafted.topKValidityRate),
      globalBestRecall: subtractNullable(strategyBaseline.globalBestRecall, handcrafted.globalBestRecall),
      usefulRate: subtractNullable(strategyBaseline.usefulRate, handcrafted.usefulRate),
    },
    strategyScores,
  };
}

export function serializeLearnedPolicyDataset(rows: LearnedPolicyDatasetRow[]): string {
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

export function parseLearnedPolicyDataset(content: string): LearnedPolicyDatasetRow[] {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as LearnedPolicyDatasetRow);
}

type ContinuousSessionRow = {
  id: string;
  scenarioId: string;
  setupHash: string;
  seed: string;
};

type NormalizedDatasetOptions = Required<LearnedPolicyDatasetOptions>;

type ScoredRow = LearnedPolicyDatasetRow & {
  labels: LearnedPolicyLabels & {
    resultScore: number;
    scoreDelta: number;
  };
};

function listContinuousSessions(database: DatabaseSync): ContinuousSessionRow[] {
  const rows = database.prepare(`
    SELECT id, scenario_id, setup_hash, seed
    FROM continuous_sessions
    ORDER BY id ASC
  `).all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    scenarioId: String(row.scenario_id),
    setupHash: String(row.setup_hash),
    seed: String(row.seed),
  }));
}

function exportCandidateRows(
  database: DatabaseSync,
  sessionById: Map<string, ContinuousSessionRow>,
  options: NormalizedDatasetOptions,
): LearnedPolicyDatasetRow[] {
  const rows = database.prepare(`
    SELECT id, session_id, candidate_json, score, valid, violation_category,
           descriptor_json, source_kind, source_ref, attempt
    FROM continuous_candidate_evaluations
    ORDER BY session_id ASC, attempt ASC, id ASC
  `).all() as Record<string, unknown>[];
  return rows.flatMap((row) => {
    const session = sessionById.get(String(row.session_id));
    if (!session) {
      return [];
    }
    const candidate = parseJsonOrNull(row.candidate_json);
    const descriptor = parseJsonOrNull(row.descriptor_json);
    const valid = Number(row.valid) === 1;
    const violationCategory = row.violation_category === null
      ? readDescriptorViolationCategory(descriptor)
      : String(row.violation_category);
    const attempt = Number(row.attempt);
    return [createDatasetRow({
      id: `candidate:${row.id}`,
      kind: "candidate",
      session,
      options,
      attempt,
      sourceKind: String(row.source_kind),
      sourceRef: row.source_ref === null ? null : String(row.source_ref),
      sourceCandidateId: null,
      strategy: null,
      handcraftedOrder: Number(row.id),
      features: extractCandidateFeatures(candidate),
      labels: {
        valid,
        resultScore: Number(row.score),
        sourceScore: null,
        scoreDelta: null,
        improvedGlobalBest: false,
        useful: valid,
        violationCategory,
      },
    })];
  });
}

function exportReuseTrialRows(
  database: DatabaseSync,
  sessionById: Map<string, ContinuousSessionRow>,
  options: NormalizedDatasetOptions,
): LearnedPolicyDatasetRow[] {
  const rows = database.prepare(`
    SELECT id, session_id, source_candidate_id, strategy, candidate_json,
           source_score, attempt, result_score, improved_global_best
    FROM continuous_reuse_trials
    ORDER BY session_id ASC, attempt ASC, id ASC
  `).all() as Record<string, unknown>[];
  return rows.flatMap((row) => {
    const session = sessionById.get(String(row.session_id));
    if (!session) {
      return [];
    }
    const candidate = parseJsonOrNull(row.candidate_json);
    const strategy = String(row.strategy);
    const sourceScore = row.source_score === null ? null : Number(row.source_score);
    const resultScore = row.result_score === null ? null : Number(row.result_score);
    const scoreDelta = sourceScore === null || resultScore === null ? null : resultScore - sourceScore;
    const improvedGlobalBest = Number(row.improved_global_best) === 1;
    return [createDatasetRow({
      id: `reuseTrial:${row.id}`,
      kind: "reuseTrial",
      session,
      options,
      attempt: Number(row.attempt),
      sourceKind: "reuse-trial",
      sourceRef: strategy,
      sourceCandidateId: row.source_candidate_id === null ? null : Number(row.source_candidate_id),
      strategy,
      handcraftedOrder: getHandcraftedOrder(strategy, Number(row.id)),
      features: extractCandidateFeatures(candidate),
      labels: {
        valid: resultScore === null ? null : true,
        resultScore,
        sourceScore,
        scoreDelta,
        improvedGlobalBest,
        useful: resultScore !== null && (improvedGlobalBest || (scoreDelta ?? 0) > 0),
        violationCategory: resultScore === null ? "notScoredOrInvalid" : null,
      },
    })];
  });
}

function exportCheckpointRows(
  database: DatabaseSync,
  sessionById: Map<string, ContinuousSessionRow>,
  options: NormalizedDatasetOptions,
): LearnedPolicyDatasetRow[] {
  const rows = database.prepare(`
    SELECT id, session_id, total_attempts, score, valid_rate, best_candidate_id
    FROM continuous_checkpoints
    ORDER BY session_id ASC, total_attempts ASC, id ASC
  `).all() as Record<string, unknown>[];
  return rows.flatMap((row) => {
    const session = sessionById.get(String(row.session_id));
    if (!session) {
      return [];
    }
    return [createDatasetRow({
      id: `checkpoint:${row.id}`,
      kind: "checkpoint",
      session,
      options,
      attempt: Number(row.total_attempts),
      sourceKind: "checkpoint",
      sourceRef: row.best_candidate_id === null ? null : String(row.best_candidate_id),
      sourceCandidateId: row.best_candidate_id === null ? null : Number(row.best_candidate_id),
      strategy: null,
      handcraftedOrder: Number(row.id),
      features: null,
      labels: {
        valid: Number(row.valid_rate) > 0,
        resultScore: Number(row.score),
        sourceScore: null,
        scoreDelta: null,
        improvedGlobalBest: true,
        useful: true,
        violationCategory: null,
      },
    })];
  });
}

function exportMotifRows(
  database: DatabaseSync,
  sessionById: Map<string, ContinuousSessionRow>,
  options: NormalizedDatasetOptions,
): LearnedPolicyDatasetRow[] {
  const rows = database.prepare(`
    SELECT id, session_id, motif_key, motif_json, support_count, best_score,
           average_score, confidence
    FROM continuous_motifs
    ORDER BY session_id ASC, best_score DESC, id ASC
  `).all() as Record<string, unknown>[];
  return rows.flatMap((row) => {
    const session = sessionById.get(String(row.session_id));
    if (!session) {
      return [];
    }
    return [createDatasetRow({
      id: `motif:${row.id}`,
      kind: "motif",
      session,
      options,
      attempt: null,
      sourceKind: "motif",
      sourceRef: String(row.motif_key),
      sourceCandidateId: null,
      strategy: null,
      handcraftedOrder: Number(row.id),
      features: extractMotifFeatures(parseJsonOrNull(row.motif_json), String(row.motif_key)),
      labels: {
        valid: Number(row.support_count) > 0,
        resultScore: Number(row.best_score),
        sourceScore: Number(row.average_score),
        scoreDelta: Number(row.best_score) - Number(row.average_score),
        improvedGlobalBest: false,
        useful: Number(row.confidence) >= 0.5,
        violationCategory: null,
      },
    })];
  });
}

function exportBoundaryRows(
  database: DatabaseSync,
  sessionById: Map<string, ContinuousSessionRow>,
  options: NormalizedDatasetOptions,
): LearnedPolicyDatasetRow[] {
  const rows = database.prepare(`
    SELECT id, session_id, candidate_id, violation_category, repair_attempted,
           repair_succeeded, repaired_candidate_id
    FROM continuous_boundary_samples
    ORDER BY session_id ASC, id ASC
  `).all() as Record<string, unknown>[];
  return rows.flatMap((row) => {
    const session = sessionById.get(String(row.session_id));
    if (!session) {
      return [];
    }
    const repaired = Number(row.repair_succeeded) === 1;
    return [createDatasetRow({
      id: `boundary:${row.id}`,
      kind: "boundary",
      session,
      options,
      attempt: null,
      sourceKind: "boundary",
      sourceRef: row.candidate_id === null ? null : String(row.candidate_id),
      sourceCandidateId: row.candidate_id === null ? null : Number(row.candidate_id),
      strategy: "repair-boundary",
      handcraftedOrder: Number(row.id),
      features: null,
      labels: {
        valid: repaired,
        resultScore: null,
        sourceScore: null,
        scoreDelta: null,
        improvedGlobalBest: false,
        useful: repaired,
        violationCategory: String(row.violation_category),
      },
    })];
  });
}

function createDatasetRow(args: {
  id: string;
  kind: LearnedPolicyDatasetKind;
  session: ContinuousSessionRow;
  options: NormalizedDatasetOptions;
  attempt: number | null;
  sourceKind: string;
  sourceRef: string | null;
  sourceCandidateId: number | null;
  strategy: string | null;
  handcraftedOrder: number;
  features: LearnedPolicyCandidateFeatures | null;
  labels: LearnedPolicyLabels;
}): LearnedPolicyDatasetRow {
  const groupKey = createSplitGroupKey(args.session, args.options.splitKey);
  return {
    id: args.id,
    kind: args.kind,
    split: assignSplit(groupKey, args.options),
    groupKey,
    sessionId: args.session.id,
    scenarioId: args.session.scenarioId,
    setupHash: args.session.setupHash,
    seed: args.session.seed,
    attempt: args.attempt,
    sourceKind: args.sourceKind,
    sourceRef: args.sourceRef,
    sourceCandidateId: args.sourceCandidateId,
    strategy: args.strategy,
    handcraftedOrder: args.handcraftedOrder,
    features: args.features,
    labels: args.labels,
  };
}

function extractCandidateFeatures(candidate: unknown): LearnedPolicyCandidateFeatures | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const record = candidate as Record<string, unknown>;
  const passiveIds = Array.isArray(record.passiveIds) ? record.passiveIds : [];
  const sublimationIds = Array.isArray(record.sublimationIds) ? record.sublimationIds : [];
  const turns = readPlanTurns(record.plan);
  const spellIds = turns.flatMap((turn) => turn.actions.map((action) => action.spellId));
  return {
    actionCount: spellIds.length,
    turnCount: turns.length,
    passiveCount: passiveIds.length,
    sublimationCount: sublimationIds.length,
    spellPrefix: spellIds.slice(0, 8),
    spellHistogram: countStrings(spellIds),
  };
}

function extractMotifFeatures(motif: unknown, motifKey: string): LearnedPolicyCandidateFeatures {
  const motifRecord = motif && typeof motif === "object" ? motif as Record<string, unknown> : {};
  const spellPrefix = Array.isArray(motifRecord.spellPrefix)
    ? motifRecord.spellPrefix.filter(isString)
    : motifKey.split(">").filter(Boolean);
  return {
    actionCount: spellPrefix.length,
    turnCount: spellPrefix.length > 0 ? 1 : 0,
    passiveCount: Array.isArray(motifRecord.passiveIds) ? motifRecord.passiveIds.length : 0,
    sublimationCount: Array.isArray(motifRecord.sublimationIds) ? motifRecord.sublimationIds.length : 0,
    spellPrefix: spellPrefix.slice(0, 8),
    spellHistogram: countStrings(spellPrefix),
  };
}

function readPlanTurns(plan: unknown): Array<{ actions: Array<{ spellId: string }> }> {
  if (!plan || typeof plan !== "object") {
    return [];
  }
  const turns = (plan as Record<string, unknown>).turns;
  if (!Array.isArray(turns)) {
    return [];
  }
  return turns.map((turn) => {
    if (!turn || typeof turn !== "object") {
      return { actions: [] };
    }
    const actions = (turn as Record<string, unknown>).actions;
    if (!Array.isArray(actions)) {
      return { actions: [] };
    }
    return {
      actions: actions.flatMap((action) => {
        if (!action || typeof action !== "object") {
          return [];
        }
        const spellId = (action as Record<string, unknown>).spellId;
        return typeof spellId === "string" ? [{ spellId }] : [];
      }),
    };
  });
}

function learnStrategyScores(rows: ScoredRow[]): Record<string, number> {
  const stats = new Map<string, { count: number; scoreDelta: number; valid: number; globalBest: number; useful: number }>();
  for (const row of rows) {
    if (!row.strategy) {
      continue;
    }
    const entry = stats.get(row.strategy) ?? { count: 0, scoreDelta: 0, valid: 0, globalBest: 0, useful: 0 };
    entry.count += 1;
    entry.scoreDelta += row.labels.scoreDelta;
    entry.valid += row.labels.valid === true ? 1 : 0;
    entry.globalBest += row.labels.improvedGlobalBest ? 1 : 0;
    entry.useful += row.labels.useful ? 1 : 0;
    stats.set(row.strategy, entry);
  }
  const scores: Record<string, number> = {};
  for (const [strategy, entry] of stats) {
    const averageDelta = entry.scoreDelta / Math.max(1, entry.count);
    const validityRate = entry.valid / Math.max(1, entry.count);
    const globalBestRate = entry.globalBest / Math.max(1, entry.count);
    const usefulRate = entry.useful / Math.max(1, entry.count);
    scores[strategy] = round((averageDelta / 1_000) + (validityRate * 5) + (usefulRate * 10) + (globalBestRate * 100), 6);
  }
  return scores;
}

function scorePolicy(
  policy: string,
  rows: ScoredRow[],
  topK: number,
  scoreRow: (row: ScoredRow) => number,
): LearnedPolicyMetricSet {
  const sorted = [...rows].sort((left, right) =>
    scoreRow(right) - scoreRow(left)
    || right.labels.sourceScore - left.labels.sourceScore
    || left.handcraftedOrder - right.handcraftedOrder
    || left.id.localeCompare(right.id)
  );
  const selected = sorted.slice(0, topK);
  const globalBestTotal = rows.filter((row) => row.labels.improvedGlobalBest).length;
  return {
    policy,
    totalRows: rows.length,
    selectedRows: selected.length,
    topK,
    topKAverageScoreDelta: averageNullable(selected.map((row) => row.labels.scoreDelta)),
    topKValidityRate: selected.length === 0 ? null : selected.filter((row) => row.labels.valid === true).length / selected.length,
    topKInvalidSelectionRate: selected.length === 0 ? null : selected.filter((row) => row.labels.valid === false).length / selected.length,
    globalBestRecall: globalBestTotal === 0 ? null : selected.filter((row) => row.labels.improvedGlobalBest).length / globalBestTotal,
    usefulRate: selected.length === 0 ? null : selected.filter((row) => row.labels.useful).length / selected.length,
  };
}

function isEvaluatedProposalRow(row: LearnedPolicyDatasetRow): row is ScoredRow {
  return row.kind === "reuseTrial"
    && row.labels.resultScore !== null
    && row.labels.sourceScore !== null
    && row.labels.scoreDelta !== null;
}

function normalizeDatasetOptions(options: LearnedPolicyDatasetOptions): NormalizedDatasetOptions {
  const testRatio = options.testRatio ?? 0.2;
  const testModulo = options.testModulo ?? Math.max(2, Math.round(1 / Math.max(0.01, Math.min(0.9, testRatio))));
  return {
    splitKey: options.splitKey ?? "session",
    testRatio,
    testModulo,
    testRemainder: options.testRemainder ?? 0,
  };
}

function createSplitGroupKey(session: ContinuousSessionRow, splitKey: LearnedPolicySplitKey): string {
  if (splitKey === "seed") {
    return `${session.scenarioId}:${session.seed}`;
  }
  if (splitKey === "scenario") {
    return session.scenarioId;
  }
  return session.id;
}

function assignSplit(groupKey: string, options: NormalizedDatasetOptions): LearnedPolicySplit {
  const hash = createHash("sha256").update(groupKey).digest();
  const value = hash.readUInt32BE(0);
  return value % options.testModulo === options.testRemainder ? "test" : "train";
}

function getHandcraftedOrder(strategy: string, id: number): number {
  return (handcraftedStrategyOrder.get(strategy) ?? 100) * 1_000_000 + id;
}

function countStrings(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function readDescriptorViolationCategory(descriptor: unknown): string | null {
  if (!descriptor || typeof descriptor !== "object") {
    return null;
  }
  const violation = (descriptor as Record<string, unknown>).violation;
  if (!violation || typeof violation !== "object") {
    return null;
  }
  const category = (violation as Record<string, unknown>).category;
  return typeof category === "string" ? category : null;
}

function parseJsonOrNull(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function averageNullable(values: Array<number | null>): number | null {
  const numbers = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (numbers.length === 0) {
    return null;
  }
  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

function subtractNullable(right: number | null, left: number | null): number | null {
  if (right === null || left === null) {
    return null;
  }
  return right - left;
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readNumberOption(name: string, fallback: number): number {
  const value = readOption(name);
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readSplitKey(value: string): LearnedPolicySplitKey {
  if (value === "session" || value === "seed" || value === "scenario") {
    return value;
  }
  throw new Error(`Unknown --split-key '${value}'. Expected session, seed, or scenario.`);
}

function runCli(): void {
  const command = process.argv[2];
  if (command !== "export" && command !== "evaluate") {
    throw new Error("Usage: learned-search-policy.ts <export|evaluate> --db <path> [--out <path>] [--dataset <path>] [--top-k 10]");
  }

  const datasetPath = readOption("--dataset");
  const dbPath = readOption("--db");
  let rows: LearnedPolicyDatasetRow[];
  if (datasetPath) {
    rows = parseLearnedPolicyDataset(readFileSync(resolve(datasetPath), "utf8"));
  } else {
    if (!dbPath) {
      throw new Error("Expected --db <path> when --dataset is not provided.");
    }
    const database = new DatabaseSync(resolve(dbPath));
    try {
      rows = exportLearnedPolicyDataset(database, {
        splitKey: readSplitKey(readOption("--split-key") ?? "session"),
        testRatio: readNumberOption("--test-ratio", 0.2),
        testModulo: readNumberOption("--test-modulo", 5),
        testRemainder: readNumberOption("--test-remainder", 0),
      });
    } finally {
      database.close();
    }
  }

  const outPath = readOption("--out");
  if (command === "export") {
    const content = serializeLearnedPolicyDataset(rows);
    if (outPath) {
      const resolvedOut = resolve(outPath);
      mkdirSync(dirname(resolvedOut), { recursive: true });
      writeFileSync(resolvedOut, content);
      console.log(JSON.stringify({ rows: rows.length, outPath: resolvedOut }));
    } else {
      process.stdout.write(content);
    }
    return;
  }

  const summary = evaluateLearnedPolicyDataset(rows, { topK: readNumberOption("--top-k", 10) });
  if (outPath) {
    const resolvedOut = resolve(outPath);
    mkdirSync(dirname(resolvedOut), { recursive: true });
    writeFileSync(resolvedOut, `${JSON.stringify(summary, null, 2)}\n`);
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url && existsSync(process.argv[1])) {
  runCli();
}
