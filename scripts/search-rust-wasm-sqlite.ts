import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { Worker } from "node:worker_threads";
import { huppermageCatalog } from "../src/core/catalog/index.ts";
import {
  evaluateSustainableCycle,
  scoreComboSimulation,
} from "../src/core/optimizer/comboOptimizer.ts";
import { createOptimizerExperimentEvaluator } from "../src/core/optimizer/index.ts";
import {
  createRustWasmOptimizerRequest,
  type RustWasmHybridSearchResumeState,
  type RustWasmOptimizerCandidateInput,
  type RustWasmOptimizerRequest,
  type RustWasmOptimizerScoredCandidate,
  type RustWasmSeedCandidateEvaluation,
} from "../src/core/optimizer/rustWasmBackendTypes.ts";
import { createResources } from "../src/core/simulation/index.ts";
import type { ComboSimulationOptions, SimulatedCharacter } from "../src/core/simulation/types.ts";
import { sublimationCatalog } from "../src/core/sublimations/index.ts";
import {
  createContinuousReuseStrategyPolicy,
  filterAndRankContinuousReuseTrialOptions,
  type ContinuousReusePolicyMode,
  type ContinuousReuseStrategyPolicy,
} from "./continuous-reuse-policy.ts";
import {
  type ContinuousSearchCandidateEvidence,
  type ContinuousSearchMotifEvidence,
  type ContinuousSearchReuseStrategyEvidence,
  createContinuousSearchSchema,
  ensureContinuousSearchSession,
  listContinuousSearchCandidateEvidence,
  listContinuousSearchMotifEvidence,
  listContinuousSearchReuseStrategyEvidence,
  recordContinuousSearchCandidate,
  recordContinuousSearchCheckpoint,
  recordContinuousSearchMotif,
  recordContinuousSearchReuseTrial,
  resetContinuousSearchSession,
} from "./continuous-search-store.ts";

type HybridSearchScenario = {
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
  seedCandidateEvaluations?: RustWasmSeedCandidateEvaluation[];
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

type ReuseTrialCandidate = {
  sourceCandidateId: number;
  strategy: string;
  sourceLabel: string;
  candidate: RustWasmOptimizerCandidateInput;
  sourceScore: number;
};

type MotifSeedCandidate = {
  motifId: number;
  motifKey: string;
  sourceLabel: string;
  candidate: RustWasmOptimizerCandidateInput;
  bestScore: number;
};

const scenarios: HybridSearchScenario[] = [
  { id: "t2-a8-p2", duration: 2, maxActionsPerTurn: 8, maxPassiveCount: 2, maxSublimationCount: 12 },
  { id: "t3-a12-p3", duration: 3, maxActionsPerTurn: 12, maxPassiveCount: 3, maxSublimationCount: 12 },
  { id: "t3-full", duration: 3, maxActionsPerTurn: 12, maxPassiveCount: 6, maxSublimationCount: 12 },
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
const reuseTrialsEnabled = process.argv.includes("--reuse-trials");
const reuseTrialsPerWorker = readIntegerOption("--reuse-trials-per-worker", 1);
const reusePolicyMode = readReusePolicyMode(readOption("--reuse-policy") ?? "adaptive");
const reusePolicyMinEvaluated = readIntegerOption("--reuse-policy-min-evaluated", 3);
const motifSeedsEnabled = process.argv.includes("--motif-seeds");
const motifSeedsPerWorker = readIntegerOption("--motif-seeds-per-worker", 1);
const resourceAwareFreshChance = readOptionalNumberOption("--resource-aware-fresh-chance");
const contextualAdjacentSwapsEnabled = process.argv.includes("--contextual-adjacent-swaps");
const learnedLoadoutPriorEnabled = process.argv.includes("--learned-loadout-prior");
const learnedActionSetPriorEnabled = process.argv.includes("--learned-action-set-prior");
const plateauOrderChainNeighborsEnabled = process.argv.includes("--plateau-order-chain-neighbors");
const plateauTriggerRounds = readNonNegativeIntegerOption("--plateau-trigger-rounds", 3);
const scoreCriterion = readScoreCriterion(readOption("--score-criterion") ?? "total-damage");
const targetElement = readTargetElement(readOption("--target-element") ?? "fire");
const requireSustainableCycle = process.argv.includes("--sustainable-cycle");
const scenario = scenarios.find((entry) => entry.id === scenarioId);
if (!scenario) {
  throw new Error(`Unknown scenario '${scenarioId}'. Expected one of: ${scenarios.map((entry) => entry.id).join(", ")}.`);
}
const criterion = scoreCriterion === "total-damage"
  ? { type: "totalDamage" as const }
  : { type: "elementDamage" as const, element: targetElement };

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
const learnedLoadoutPassiveIds = [
  "carnage",
  "extension-des-sens",
  "profusion-runique",
];
const learnedLoadoutSublimationIds = [
  "alternance-ii",
  "armure-lourde-ii",
  "concentration-elementaire",
  "expert-des-armes-legeres-i",
  "expert-des-armes-legeres-ii",
  "expert-des-armes-legeres-iii",
  "longueur-i",
  "longueur-ii",
  "longueur-iii",
  "puissance-brute-i",
  "puissance-brute-iii",
  "tellurisme-secondaire-iii",
];
const learnedActionSetSpellIds = [
  "coeur-de-lumiere",
  "debacle",
  "eboulement",
  "epee-de-lumiere",
  "fleche-de-lumiere",
  "flux-denergie",
  "halo-chatoyant",
  "lueur-de-laube",
  "ombres-dansantes",
  "orbes-luisants",
  "papillons-diurnes",
  "runification",
];
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
  maxSublimationCount: scenario.maxSublimationCount,
  availableSpellIds: learnedActionSetPriorEnabled ? learnedActionSetSpellIds : undefined,
  availablePassiveIds: learnedLoadoutPriorEnabled ? learnedLoadoutPassiveIds : availablePassiveIds,
  availableSublimationIds: learnedLoadoutPriorEnabled ? learnedLoadoutSublimationIds : availableSublimationIds,
  criterion,
  requireSustainableCycle,
  defaultActionContext,
  maxCandidates: 5,
});
if (resourceAwareFreshChance !== undefined) {
  baseRequest.hybridResourceAwareFreshChance = clamp(resourceAwareFreshChance, 0, 1);
}
if (contextualAdjacentSwapsEnabled) {
  baseRequest.hybridContextualAdjacentSwaps = true;
}
if (learnedLoadoutPriorEnabled) {
  baseRequest.hybridLockedLoadout = true;
}
const fingerprint = createFingerprint({
  algorithm: "rust-wasm-resume-v1",
  scenario,
  workerCount,
  request: { ...baseRequest, iterations: 0 },
  plateauOrderChainNeighbors: {
    enabled: plateauOrderChainNeighborsEnabled,
    triggerRounds: plateauTriggerRounds,
  },
});
const oracle = createOptimizerExperimentEvaluator({
  catalog: huppermageCatalog,
  character,
  duration: scenario.duration,
  criterion,
  requireSustainableCycle,
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
createContinuousSearchSchema(db);
if (reset) {
  resetSession(db, sessionId);
  resetContinuousSearchSession(db, sessionId);
}
const session = ensureSession(db, sessionId, fingerprint);
ensureContinuousSearchSession(db, {
  id: sessionId,
  fingerprint,
  scenarioId,
  setupHash: fingerprint,
  seed,
  workerCount,
});

let stopRequested = false;
process.on("SIGINT", () => {
  stopRequested = true;
});

const startedAt = performance.now();
let roundIndex = 0;
let roundsSinceGlobalBestImprovement = 0;
while (!stopRequested) {
  if (maxRounds > 0 && roundIndex >= maxRounds) {
    break;
  }
  if (timeboxMs > 0 && performance.now() - startedAt >= timeboxMs) {
    break;
  }

  const workerStates = readWorkerStates(db, sessionId);
  const previousBest = session.best_candidate_json
    ? JSON.parse(session.best_candidate_json) as RustWasmOptimizerScoredCandidate
    : undefined;
  const previousBestScore = previousBest?.score.score ?? Number.NEGATIVE_INFINITY;
  const plateauModeActive = plateauOrderChainNeighborsEnabled
    && previousBest !== undefined
    && roundsSinceGlobalBestImprovement >= plateauTriggerRounds;
  const reuseStrategyPolicy = reuseTrialsEnabled
    ? createContinuousReuseStrategyPolicy(
        listContinuousSearchReuseStrategyEvidence(db, sessionId),
        { mode: reusePolicyMode, minEvaluatedTrials: reusePolicyMinEvaluated },
      )
    : createContinuousReuseStrategyPolicy([], { mode: "off" });
  const reuseCandidateEvidence = reuseTrialsEnabled
    ? listContinuousSearchCandidateEvidence(db, sessionId, workerCount * reuseTrialsPerWorker * 4)
    : [];
  const reuseTrialCandidates = reuseTrialsEnabled
    ? createReuseTrialCandidates(
        reuseCandidateEvidence,
        workerCount * reuseTrialsPerWorker,
        scenario.maxActionsPerTurn,
        reuseStrategyPolicy,
      )
    : [];
  const motifSeedCandidates = motifSeedsEnabled
    ? createMotifSeedCandidates(
        listContinuousSearchMotifEvidence(db, sessionId, workerCount * motifSeedsPerWorker * 4),
        workerCount * motifSeedsPerWorker,
        scenario,
      )
    : [];
  const workerReuseTrialSelections = Array.from({ length: workerCount }, (_, workerIndex) =>
    selectWorkerReuseTrialCandidates(reuseTrialCandidates, workerIndex, workerCount, reuseTrialsPerWorker)
  );
  const workerMotifSeedSelections = Array.from({ length: workerCount }, (_, workerIndex) =>
    selectWorkerMotifSeedCandidates(motifSeedCandidates, workerIndex, workerCount, motifSeedsPerWorker)
  );
  const selectedReuseTrials = workerReuseTrialSelections.flatMap((selection) => selection.trials);
  const selectedMotifSeeds = workerMotifSeedSelections.flatMap((selection) => selection.seeds);
  const roundStart = performance.now();
  const results = await Promise.all(Array.from({ length: workerCount }, (_, workerIndex) => {
    const resumeState = workerStates.get(workerIndex)?.resume_state_json
      ? JSON.parse(workerStates.get(workerIndex)!.resume_state_json!) as RustWasmHybridSearchResumeState
      : undefined;
    const seedCandidates = [
      ...workerReuseTrialSelections[workerIndex].candidates,
      ...workerMotifSeedSelections[workerIndex].candidates,
    ];
    const request: RustWasmOptimizerRequest = {
      ...baseRequest,
      seed: `${baseRequest.seed}:worker:${workerIndex}`,
      iterations: chunkSize,
      hybridContextualAdjacentSwaps: contextualAdjacentSwapsEnabled,
      hybridPlateauOrderChainNeighbors: plateauModeActive,
      seedCandidates: seedCandidates.length > 0 ? seedCandidates : undefined,
      resumeState,
    };
    return runWorker(request);
  }));

  const topCandidates = [
    ...results.flatMap((result) => result.topCandidates),
    ...(previousBest ? [previousBest] : []),
  ].sort(compareRustCandidates).slice(0, 5);
  const oracleSummary = verifyTopCandidates(topCandidates);
  const attempts = results.reduce((total, result) => total + result.attempts, 0);
  const validCandidates = results.reduce((total, result) => total + result.validCandidates, 0);
  const invalidCandidates = results.reduce((total, result) => total + result.invalidCandidates, 0);
  const metrics = mergeMetrics(results.map((result) => result.metrics));
  const seedCandidateEvaluations = results.flatMap((result) => result.seedCandidateEvaluations ?? []);
  const contextualAdjacentSwapEvaluations = seedCandidateEvaluations.filter((evaluation) =>
    evaluation.sourceLabel.startsWith("neighbor:contextual-adjacent-swap:")
  );
  const plateauOrderChainEvaluations = seedCandidateEvaluations.filter((evaluation) =>
    evaluation.sourceLabel.startsWith("neighbor:plateau-order-chain:")
  );
  const reuseTrialEvaluationByLabel = new Map(
    seedCandidateEvaluations.map((evaluation) => [evaluation.sourceLabel, evaluation] as const),
  );
  const evaluatedReuseTrials = selectedReuseTrials
    .map((trial) => reuseTrialEvaluationByLabel.get(trial.sourceLabel))
    .filter((evaluation): evaluation is RustWasmSeedCandidateEvaluation => evaluation !== undefined);
  const motifSeedEvaluationByLabel = new Map(
    seedCandidateEvaluations
      .filter((evaluation) => evaluation.sourceLabel.startsWith("motif:"))
      .map((evaluation) => [evaluation.sourceLabel, evaluation] as const),
  );
  const evaluatedMotifSeeds = selectedMotifSeeds
    .map((seedCandidate) => motifSeedEvaluationByLabel.get(seedCandidate.sourceLabel))
    .filter((evaluation): evaluation is RustWasmSeedCandidateEvaluation => evaluation !== undefined);
  const elapsedMs = performance.now() - roundStart;
  const totalAttempts = session.total_attempts + attempts;
  const bestCandidate = topCandidates[0];
  const improvedGlobalBest = bestCandidate !== undefined && bestCandidate.score.score > previousBestScore;
  const verifiedCandidates = createDisplayCandidatePayloads(topCandidates, totalAttempts);
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
    resourceAwareFreshChance: baseRequest.hybridResourceAwareFreshChance ?? 0.12,
    contextualAdjacentSwapsEnabled,
    learnedLoadoutPriorEnabled,
    learnedActionSetPriorEnabled,
    plateauOrderChainNeighborsEnabled,
    plateauModeActive,
    plateauTriggerRounds,
    plateauRoundsSinceImprovement: roundsSinceGlobalBestImprovement,
    plateauGlobalBestImproved: plateauModeActive && improvedGlobalBest,
    plateauOrderChainModeIslands: metrics.hybridPlateauOrderChainNeighborMode ?? 0,
    plateauOrderChainNeighborCandidates: metrics.hybridPlateauOrderChainNeighborCandidates ?? 0,
    evaluatedPlateauOrderChainCandidates: plateauOrderChainEvaluations.length,
    validPlateauOrderChainCandidates: plateauOrderChainEvaluations.filter((evaluation) => evaluation.valid).length,
    islandImprovedPlateauOrderChainCandidates: plateauOrderChainEvaluations.filter((evaluation) =>
      evaluation.improvedIslandBest
    ).length,
    globalImprovedPlateauOrderChainCandidates: plateauOrderChainEvaluations.filter((evaluation) =>
      evaluation.score !== undefined && evaluation.score > previousBestScore
    ).length,
    scoreCriterion,
    targetElement: scoreCriterion === "element-damage" ? targetElement : null,
    requireSustainableCycle,
    effectiveMaxActionsPerTurn: baseRequest.maxActionsPerTurn,
    availableSpellCount: baseRequest.availableSpellIds.length,
    contextualAdjacentSwapNeighborCandidates: metrics.hybridContextualAdjacentSwapNeighborCandidates ?? 0,
    evaluatedContextualAdjacentSwapCandidates: contextualAdjacentSwapEvaluations.length,
    validContextualAdjacentSwapCandidates: contextualAdjacentSwapEvaluations.filter((evaluation) => evaluation.valid).length,
    islandImprovedContextualAdjacentSwapCandidates: contextualAdjacentSwapEvaluations.filter((evaluation) =>
      evaluation.improvedIslandBest === true
    ).length,
    globalImprovedContextualAdjacentSwapCandidates: contextualAdjacentSwapEvaluations.filter((evaluation) =>
      evaluation.score !== undefined && evaluation.score > previousBestScore
    ).length,
    reuseTrialsEnabled,
    reusePolicyMode: reuseStrategyPolicy.mode,
    reusePolicyMinEvaluatedTrials: reuseStrategyPolicy.minEvaluatedTrials,
    reusePolicySuppressedStrategies: reuseStrategyPolicy.suppressedStrategies,
    reuseStrategyEvidence: reuseStrategyPolicy.evidence.map(summarizeReuseStrategyEvidence),
    reuseTrialCandidates: reuseTrialCandidates.length,
    usedReuseTrialCandidates: selectedReuseTrials.length,
    evaluatedReuseTrialCandidates: evaluatedReuseTrials.length,
    validReuseTrialCandidates: evaluatedReuseTrials.filter((evaluation) => evaluation.valid).length,
    islandImprovedReuseTrialCandidates: evaluatedReuseTrials.filter((evaluation) => evaluation.improvedIslandBest === true).length,
    globalImprovedReuseTrialCandidates: evaluatedReuseTrials.filter((evaluation) =>
      evaluation.score !== undefined && evaluation.score > previousBestScore
    ).length,
    motifSeedsEnabled,
    motifSeedCandidates: motifSeedCandidates.length,
    usedMotifSeedCandidates: selectedMotifSeeds.length,
    evaluatedMotifSeedCandidates: evaluatedMotifSeeds.length,
    validMotifSeedCandidates: evaluatedMotifSeeds.filter((evaluation) => evaluation.valid).length,
    islandImprovedMotifSeedCandidates: evaluatedMotifSeeds.filter((evaluation) => evaluation.improvedIslandBest === true).length,
    globalImprovedMotifSeedCandidates: evaluatedMotifSeeds.filter((evaluation) =>
      evaluation.score !== undefined && evaluation.score > previousBestScore
    ).length,
    finalOracleCandidates: topCandidates.length,
    ...oracleSummary,
    verifiedCandidates,
    metrics,
  };
  const persistedTopCandidateIds = topCandidates.slice(0, 20).map((candidate, index) =>
    recordContinuousSearchCandidate(db, {
      sessionId,
      candidate: verifiedCandidates[index]?.candidate ?? candidate,
      score: candidate.score.score,
      valid: true,
      violationCategory: null,
      finalState: verifiedCandidates[index]?.candidate.simulation.finalState ?? null,
      descriptor: {
        passiveCount: candidate.passiveIds.length,
        sublimationCount: candidate.sublimationIds.length,
        actionCount: countActions(candidate),
        checkpointRank: index + 1,
      },
      sourceKind: "checkpoint-top",
      sourceRef: String(totalAttempts),
      attempt: totalAttempts,
    })
  );

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const [workerIndex, result] of results.entries()) {
      upsertWorkerState(db, sessionId, workerIndex, result);
    }
    const topCandidateScoreByKey = new Map(
      topCandidates
        .map((candidate) => [stableStringify(toRustWasmCandidateInput(candidate)), candidate.score.score] as const)
        .filter(([key]) => key !== stableStringify(null)),
    );
    for (const trial of selectedReuseTrials) {
      const evaluation = reuseTrialEvaluationByLabel.get(trial.sourceLabel);
      const resultScore = evaluation?.score
        ?? topCandidateScoreByKey.get(stableStringify(removeCandidateSourceLabel(trial.candidate)))
        ?? null;
      recordContinuousSearchReuseTrial(db, {
        sessionId,
        sourceCandidateId: trial.sourceCandidateId,
        strategy: trial.strategy,
        candidate: trial.candidate,
        sourceScore: trial.sourceScore,
        attempt: totalAttempts,
        resultScore,
        improvedGlobalBest: resultScore !== null && resultScore > previousBestScore,
      });
    }
    updateSession(db, sessionId, totalAttempts, bestCandidate, summary);
    insertCheckpoint(db, summary);
    recordContinuousSearchCheckpoint(db, {
      sessionId,
      totalAttempts,
      score: bestCandidate?.score.score ?? 0,
      validRate: validCandidates / Math.max(1, attempts),
      bestCandidateId: persistedTopCandidateIds[0] ?? null,
      summary,
    });
    for (const candidate of topCandidates.slice(0, 10)) {
      const motifKey = candidate.plan.turns
        .flatMap((turn) => turn.actions.map((action) => action.spellId))
        .slice(0, 4)
        .join(">");
      if (!motifKey) {
        continue;
      }
      recordContinuousSearchMotif(db, {
        sessionId,
        motifKey,
        motif: {
          spellPrefix: motifKey.split(">"),
          passiveIds: candidate.passiveIds,
          sublimationIds: candidate.sublimationIds.slice(0, 4),
        },
        supportCount: 1,
        bestScore: candidate.score.score,
        averageScore: candidate.score.score,
        rediscoveryCount: 1,
      });
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  session.total_attempts = totalAttempts;
  session.best_candidate_json = bestCandidate ? JSON.stringify(bestCandidate) : session.best_candidate_json;
  roundsSinceGlobalBestImprovement = improvedGlobalBest ? 0 : roundsSinceGlobalBestImprovement + 1;
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
  return {
    finalOracleValid,
    finalOracleInvalid,
    finalOracleMaxScoreDelta: round(maxScoreDelta),
    finalOracleMaxTotalDamageDelta: round(maxTotalDamageDelta),
  };
}

function createDisplayCandidatePayloads(
  topCandidates: RustWasmOptimizerScoredCandidate[],
  totalAttempts: number,
) {
  return topCandidates
    .map((candidate, index) => {
      const evaluation = oracle.evaluateDetailed({
        passiveIds: candidate.passiveIds,
        sublimationIds: candidate.sublimationIds,
        plan: candidate.plan,
      });
      const displayCandidate = evaluation.result ?? createReplayableCandidatePayload(candidate, evaluation);
      if (!displayCandidate) {
        return null;
      }
      return {
        schemaVersion: 1 as const,
        totalAttempts,
        rank: index + 1,
        verification: evaluation.result ? "verified" as const : "replay-invalid" as const,
        run: {
          sessionId,
          scenarioId: scenario.id,
          seed,
          workerCount,
          chunkSize,
          scoreCriterion,
          targetElement: scoreCriterion === "element-damage" ? targetElement : null,
          requireSustainableCycle,
        },
        candidate: displayCandidate,
      };
    })
    .filter((payload): payload is NonNullable<typeof payload> => payload !== null);
}

function createReplayableCandidatePayload(
  candidate: RustWasmOptimizerScoredCandidate,
  evaluation: ReturnType<typeof oracle.evaluateDetailed>,
) {
  if (!evaluation.simulation.valid) {
    return null;
  }

  const sustainability = requireSustainableCycle
    ? evaluateSustainableCycle({
        catalog: huppermageCatalog,
        character,
        plan: evaluation.normalizedCandidate.plan,
        defaultActionContext,
      })
    : {
        required: false,
        sustainable: true,
      };

  return {
    passiveIds: evaluation.normalizedCandidate.passiveIds ?? candidate.passiveIds,
    sublimationIds: evaluation.normalizedCandidate.sublimationIds ?? candidate.sublimationIds,
    plan: evaluation.normalizedCandidate.plan,
    simulation: evaluation.simulation,
    score: scoreComboSimulation(evaluation.simulation, criterion),
    sustainability,
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

function createReuseTrialCandidates(
  evidenceRows: ContinuousSearchCandidateEvidence[],
  limit: number,
  maxActionsPerTurn: number,
  policy: ContinuousReuseStrategyPolicy,
): ReuseTrialCandidate[] {
  const options: ReuseTrialCandidate[] = [];
  const seen = new Set<string>();
  for (const evidence of evidenceRows) {
    const sourceCandidate = toRustWasmCandidateInput(evidence.candidate);
    if (!sourceCandidate) {
      continue;
    }
    const sourceKey = stableStringify(sourceCandidate);
    for (const trial of mutateCandidateForReuseTrials(sourceCandidate, maxActionsPerTurn)) {
      const key = stableStringify(trial.candidate);
      if (key === sourceKey || seen.has(key)) {
        continue;
      }
      seen.add(key);
      const sourceLabel = `trial:${trial.strategy}:${evidence.id}:${createFingerprint(trial.candidate).slice(0, 12)}`;
      options.push({
        sourceCandidateId: evidence.id,
        strategy: trial.strategy,
        sourceLabel,
        candidate: { ...trial.candidate, sourceLabel },
        sourceScore: evidence.score,
      });
    }
  }
  return filterAndRankContinuousReuseTrialOptions(options, policy).slice(0, limit);
}

function createMotifSeedCandidates(
  motifRows: ContinuousSearchMotifEvidence[],
  limit: number,
  scenario: HybridSearchScenario,
): MotifSeedCandidate[] {
  const seeds: MotifSeedCandidate[] = [];
  const seen = new Set<string>();
  for (const motifRow of motifRows) {
    const seedCandidate = motifToSeedCandidate(motifRow, scenario);
    if (!seedCandidate) {
      continue;
    }
    const key = stableStringify(removeCandidateSourceLabel(seedCandidate.candidate));
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    seeds.push(seedCandidate);
    if (seeds.length >= limit) {
      break;
    }
  }
  return seeds;
}

function motifToSeedCandidate(
  motifRow: ContinuousSearchMotifEvidence,
  scenario: HybridSearchScenario,
): MotifSeedCandidate | null {
  const motif = motifRow.motif && typeof motifRow.motif === "object"
    ? motifRow.motif as Record<string, unknown>
    : {};
  const spellPrefix = Array.isArray(motif.spellPrefix)
    ? motif.spellPrefix.filter(isString)
    : motifRow.motifKey.split(">").filter(Boolean);
  const actions = spellPrefix
    .slice(0, scenario.maxActionsPerTurn)
    .map((spellId) => ({ spellId }));
  if (actions.length === 0) {
    return null;
  }
  const turns = Array.from({ length: scenario.duration }, (_, index) => ({
    actions: index === 0 ? actions : [],
  }));
  const candidate: RustWasmOptimizerCandidateInput = {
    passiveIds: Array.isArray(motif.passiveIds) ? motif.passiveIds.filter(isString).slice(0, scenario.maxPassiveCount) : [],
    sublimationIds: Array.isArray(motif.sublimationIds)
      ? motif.sublimationIds.filter(isString).slice(0, scenario.maxSublimationCount)
      : [],
    plan: { turns },
  };
  const sourceLabel = `motif:${motifRow.id}:${createFingerprint(candidate).slice(0, 12)}`;
  return {
    motifId: motifRow.id,
    motifKey: motifRow.motifKey,
    sourceLabel,
    candidate: { ...candidate, sourceLabel },
    bestScore: motifRow.bestScore,
  };
}

function mutateCandidateForReuseTrials(
  candidate: RustWasmOptimizerCandidateInput,
  maxActionsPerTurn: number,
): Array<{ strategy: string; candidate: RustWasmOptimizerCandidateInput }> {
  return [
    rotateTurnActions(candidate),
    swapLastTurnActions(candidate),
    moveLastActionEarlier(candidate, maxActionsPerTurn),
    moveFirstActionLater(candidate, maxActionsPerTurn),
  ].filter((trial): trial is { strategy: string; candidate: RustWasmOptimizerCandidateInput } => trial !== null);
}

function rotateTurnActions(candidate: RustWasmOptimizerCandidateInput): { strategy: string; candidate: RustWasmOptimizerCandidateInput } | null {
  const next = cloneCandidateInput(candidate);
  const turn = next.plan.turns.find((entry) => entry.actions.length > 1);
  if (!turn) {
    return null;
  }
  const [firstAction] = turn.actions.splice(0, 1);
  turn.actions.push(firstAction);
  return { strategy: "rotate-turn-actions", candidate: next };
}

function swapLastTurnActions(candidate: RustWasmOptimizerCandidateInput): { strategy: string; candidate: RustWasmOptimizerCandidateInput } | null {
  const next = cloneCandidateInput(candidate);
  const turn = next.plan.turns.find((entry) => entry.actions.length > 1);
  if (!turn) {
    return null;
  }
  const lastIndex = turn.actions.length - 1;
  [turn.actions[lastIndex - 1], turn.actions[lastIndex]] = [turn.actions[lastIndex], turn.actions[lastIndex - 1]];
  return { strategy: "swap-last-turn-actions", candidate: next };
}

function moveLastActionEarlier(
  candidate: RustWasmOptimizerCandidateInput,
  maxActionsPerTurn: number,
): { strategy: string; candidate: RustWasmOptimizerCandidateInput } | null {
  const next = cloneCandidateInput(candidate);
  for (let index = 1; index < next.plan.turns.length; index += 1) {
    const sourceTurn = next.plan.turns[index];
    const targetTurn = next.plan.turns[index - 1];
    if (sourceTurn.actions.length === 0 || targetTurn.actions.length >= maxActionsPerTurn) {
      continue;
    }
    const action = sourceTurn.actions.pop();
    if (!action) {
      continue;
    }
    targetTurn.actions.push(action);
    return { strategy: "move-last-action-earlier", candidate: next };
  }
  return null;
}

function moveFirstActionLater(
  candidate: RustWasmOptimizerCandidateInput,
  maxActionsPerTurn: number,
): { strategy: string; candidate: RustWasmOptimizerCandidateInput } | null {
  const next = cloneCandidateInput(candidate);
  for (let index = 0; index < next.plan.turns.length - 1; index += 1) {
    const sourceTurn = next.plan.turns[index];
    const targetTurn = next.plan.turns[index + 1];
    if (sourceTurn.actions.length === 0 || targetTurn.actions.length >= maxActionsPerTurn) {
      continue;
    }
    const [action] = sourceTurn.actions.splice(0, 1);
    targetTurn.actions.unshift(action);
    return { strategy: "move-first-action-later", candidate: next };
  }
  return null;
}

function cloneCandidateInput(candidate: RustWasmOptimizerCandidateInput): RustWasmOptimizerCandidateInput {
  return JSON.parse(JSON.stringify(candidate)) as RustWasmOptimizerCandidateInput;
}

function selectWorkerReuseTrialCandidates(
  trials: ReuseTrialCandidate[],
  workerIndex: number,
  workerCount: number,
  limit: number,
): { trials: ReuseTrialCandidate[]; candidates: RustWasmOptimizerCandidateInput[] } {
  const selected: ReuseTrialCandidate[] = [];
  const seen = new Set<string>();
  for (let index = workerIndex; index < trials.length && selected.length < limit; index += workerCount) {
    addReuseTrialCandidate(selected, seen, trials[index]);
  }
  for (const trial of trials) {
    if (selected.length >= limit) {
      break;
    }
    addReuseTrialCandidate(selected, seen, trial);
  }
  return {
    trials: selected,
    candidates: selected.map((trial) => trial.candidate),
  };
}

function selectWorkerMotifSeedCandidates(
  seeds: MotifSeedCandidate[],
  workerIndex: number,
  workerCount: number,
  limit: number,
): { seeds: MotifSeedCandidate[]; candidates: RustWasmOptimizerCandidateInput[] } {
  const selected: MotifSeedCandidate[] = [];
  const seen = new Set<string>();
  for (let index = workerIndex; index < seeds.length && selected.length < limit; index += workerCount) {
    addMotifSeedCandidate(selected, seen, seeds[index]);
  }
  for (const seedCandidate of seeds) {
    if (selected.length >= limit) {
      break;
    }
    addMotifSeedCandidate(selected, seen, seedCandidate);
  }
  return {
    seeds: selected,
    candidates: selected.map((seedCandidate) => seedCandidate.candidate),
  };
}

function addMotifSeedCandidate(
  selected: MotifSeedCandidate[],
  seen: Set<string>,
  seedCandidate: MotifSeedCandidate,
): void {
  const key = stableStringify(removeCandidateSourceLabel(seedCandidate.candidate));
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  selected.push(seedCandidate);
}

function addReuseTrialCandidate(
  selected: ReuseTrialCandidate[],
  seen: Set<string>,
  trial: ReuseTrialCandidate,
): void {
  const key = stableStringify(trial.candidate);
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  selected.push(trial);
}

function removeCandidateSourceLabel(candidate: RustWasmOptimizerCandidateInput): RustWasmOptimizerCandidateInput {
  return {
    passiveIds: candidate.passiveIds,
    sublimationIds: candidate.sublimationIds,
    plan: candidate.plan,
  };
}

function toRustWasmCandidateInput(candidate: unknown): RustWasmOptimizerCandidateInput | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const record = candidate as Record<string, unknown>;
  if (!record.plan || typeof record.plan !== "object") {
    return null;
  }
  return {
    passiveIds: Array.isArray(record.passiveIds) ? record.passiveIds.filter(isString) : [],
    sublimationIds: Array.isArray(record.sublimationIds) ? record.sublimationIds.filter(isString) : [],
    plan: record.plan as RustWasmOptimizerCandidateInput["plan"],
  };
}

function isString(value: unknown): value is string {
  return typeof value === "string";
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

function readNonNegativeIntegerOption(name: string, fallback: number): number {
  const value = readOption(name);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readOptionalNumberOption(name: string): number | undefined {
  const value = readOption(name);
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readReusePolicyMode(value: string): ContinuousReusePolicyMode {
  if (value === "off" || value === "adaptive") {
    return value;
  }
  throw new Error(`Unknown --reuse-policy '${value}'. Expected 'adaptive' or 'off'.`);
}

function readScoreCriterion(value: string): "total-damage" | "element-damage" {
  if (value === "total-damage" || value === "element-damage") {
    return value;
  }
  throw new Error(`Unknown --score-criterion '${value}'. Expected 'total-damage' or 'element-damage'.`);
}

function readTargetElement(value: string): "fire" | "water" | "earth" | "air" {
  if (value === "fire" || value === "water" || value === "earth" || value === "air") {
    return value;
  }
  throw new Error(`Unknown --target-element '${value}'. Expected 'fire', 'water', 'earth', or 'air'.`);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function summarizeReuseStrategyEvidence(evidence: ContinuousSearchReuseStrategyEvidence): ContinuousSearchReuseStrategyEvidence {
  return {
    ...evidence,
    averageScoreDelta: evidence.averageScoreDelta === null ? null : round(evidence.averageScoreDelta),
    bestScoreDelta: evidence.bestScoreDelta === null ? null : round(evidence.bestScoreDelta),
  };
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}
