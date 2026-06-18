import type { CatalogEntry, Element } from "../core/catalog/types.ts";
import {
  type ComboOptimizationCriterion,
  type ComboOptimizerOptions,
  type ComboOptimizerResult,
  type OptimizerExperimentEngineKind,
  type OptimizerExperimentOptions,
  runOptimizerExperimentProgressive,
  runOptimizerExperiment,
} from "../core/optimizer/index.ts";
import type { ComboPlan, ResourcePool, SimulatedCharacter } from "../core/simulation/types.ts";
import { sublimationCatalog } from "../core/sublimations/index.ts";
import type { SublimationBuild } from "../core/sublimations/types.ts";
import {
  createContinuousOptimizerLaunchArgs,
  createDefaultContinuousOptimizerControls,
  streamContinuousOptimizerRun,
  type ContinuousOptimizerTargetElement,
} from "./continuousOptimizerWorkspace.ts";
import type { SetupSnapshot } from "./researchWorkspace.ts";

export type OptimizerScoreCriterionId = "totalDamage" | "elementDamage";
export type OptimizerWorkspaceSearchMethod = OptimizerExperimentEngineKind | "continuous";

export type OptimizerWorkspaceControls = {
  duration: number;
  scoreCriterion: OptimizerScoreCriterionId;
  targetElement: Exclude<Element, "light" | "neutral">;
  requireSustainableCycle: boolean;
  searchMethod: OptimizerWorkspaceSearchMethod;
  iterationBudget: number;
  beamWidth: number;
  maxResultsPerDuration: number;
};

export type OptimizerCandidateSource = Pick<ComboOptimizerResult, "plan" | "simulation" | "score" | "sustainability"> & {
  passiveIds?: string[];
  sublimationIds?: string[];
  sublimations?: SublimationBuild;
};

export type OptimizerCandidateViewModel = {
  id: string;
  duration: number;
  plan: ComboPlan;
  score: number;
  totalDamage: number;
  damagePerTurn: number;
  damagePerAp: number;
  actionCount: number;
  apSpent: number;
  passiveIds: string[];
  sublimationIds: string[];
  sublimations: SublimationBuild;
  finalResources: ResourcePool;
  damageByResolvedElement: Record<Element, number>;
  sustainable: boolean;
  sustainabilityRequired: boolean;
  source: OptimizerCandidateSource;
};

export type OptimizerLiveRunProgress = {
  batch: number;
  attempts: number;
  validCandidates: number;
  invalidCandidates: number;
  bestScore?: number;
  bestCandidate?: OptimizerCandidateViewModel;
  metrics: Record<string, number>;
  results: OptimizerCandidateViewModel[];
};

export type ContinuousVerifiedOptimizerCandidatePayload = {
  schemaVersion: 1;
  totalAttempts: number;
  rank: number;
  run: {
    sessionId: string;
    scenarioId: string;
    seed: string;
    workerCount: number;
    chunkSize: number;
    scoreCriterion: "total-damage" | "element-damage";
    targetElement: ContinuousOptimizerTargetElement | null;
    requireSustainableCycle: boolean;
  };
  candidate: OptimizerCandidateSource;
};

type OptimizerRunStreamPayload = {
  schemaVersion: 1;
  attempts: number;
  validCandidates: number;
  invalidCandidates: number;
  topCandidates: OptimizerCandidateSource[];
  metrics: Record<string, number>;
};

export type OptimizerCandidateSpellIcon = {
  spellId: string;
  label: string;
};

export type OptimizerCandidateSpellIconRow = {
  turn: number;
  icons: OptimizerCandidateSpellIcon[];
};

export type BuilderHandoff = {
  setupSnapshotId: string;
  character: SimulatedCharacter;
  plan: ComboPlan;
};

export type DurationGroupedResults = Record<number, OptimizerCandidateViewModel[]>;

export function createDefaultOptimizerControls(): OptimizerWorkspaceControls {
  return {
    duration: 1,
    scoreCriterion: "totalDamage",
    targetElement: "fire",
    requireSustainableCycle: false,
    searchMethod: "hybrid",
    iterationBudget: 1_000,
    beamWidth: 40,
    maxResultsPerDuration: 10,
  };
}

export function normalizeOptimizerControls(controls: OptimizerWorkspaceControls): OptimizerWorkspaceControls {
  const searchMethod = normalizeOptimizerSearchMethod(controls.searchMethod);
  const minIterations = searchMethod === "continuous" ? 1_000_000 : 10;
  return {
    ...controls,
    searchMethod,
    duration: clampInteger(controls.duration, 1, 3),
    iterationBudget: clampInteger(controls.iterationBudget, minIterations, 1_000_000_000),
    beamWidth: clampInteger(controls.beamWidth, 1, 200),
    maxResultsPerDuration: clampInteger(controls.maxResultsPerDuration, 1, 50),
  };
}

export function createOptimizerOptionsForSetup(
  setup: SetupSnapshot,
  catalog: CatalogEntry[],
  controls: OptimizerWorkspaceControls,
  duration: number,
): ComboOptimizerOptions {
  const normalizedControls = normalizeOptimizerControls(controls);
  const criterion: ComboOptimizationCriterion = normalizedControls.scoreCriterion === "totalDamage"
    ? { type: "totalDamage" }
    : { type: "elementDamage", element: normalizedControls.targetElement };

  return {
    catalog,
    character: setup.character,
    maxTurns: clampInteger(duration, 1, 3),
    exactTurnCount: clampInteger(duration, 1, 3),
    beamWidth: normalizedControls.beamWidth,
    requireSustainableCycle: normalizedControls.requireSustainableCycle,
    criterion,
    defaultActionContext: setup.defaultActionContext,
  };
}

export function createOptimizerExperimentOptionsForSetup(
  setup: SetupSnapshot,
  catalog: CatalogEntry[],
  controls: OptimizerWorkspaceControls,
): OptimizerExperimentOptions {
  const normalizedControls = normalizeOptimizerControls(controls);
  const experimentEngine = normalizedControls.searchMethod === "continuous" ? "hybrid" : normalizedControls.searchMethod;
  const criterion = createOptimizationCriterion(normalizedControls);

  return {
    catalog,
    character: setup.character,
    duration: normalizedControls.duration,
    engines: [experimentEngine],
    budget: { iterations: normalizedControls.iterationBudget },
    maxCandidates: normalizedControls.maxResultsPerDuration,
    maxPassiveCount: getSetupPassiveLimit(setup),
    availablePassiveIds: catalog.filter((entry) => entry.kind === "passive").map((entry) => entry.id),
    maxSublimationCount: 12,
    availableSublimationIds: sublimationCatalog
      .filter((entry) => entry.supportStatus === "supported")
      .map((entry) => entry.id),
    maxActionsPerTurn: 12,
    criterion,
    requireSustainableCycle: normalizedControls.requireSustainableCycle,
    defaultActionContext: setup.defaultActionContext,
  };
}

export function groupOptimizerResultsByDuration(
  setup: SetupSnapshot,
  catalog: CatalogEntry[],
  controls: OptimizerWorkspaceControls,
): DurationGroupedResults {
  const normalizedControls = normalizeOptimizerControls(controls);
  const duration = normalizedControls.duration;

  return {
    [duration]: runOptimizerForControls(setup, catalog, normalizedControls),
  };
}

export function runOptimizerForControls(
  setup: SetupSnapshot,
  catalog: CatalogEntry[],
  controls: OptimizerWorkspaceControls,
): OptimizerCandidateViewModel[] {
  const normalizedControls = normalizeOptimizerControls(controls);
  if (normalizedControls.searchMethod === "continuous") {
    return [];
  }
  const duration = normalizedControls.duration;
  const experiment = runOptimizerExperiment(createOptimizerExperimentOptionsForSetup(setup, catalog, normalizedControls));
  const engineResult = experiment.engineResults[0];

  return (engineResult?.topCandidates ?? [])
    .filter((result) => result.plan.turns.length === duration)
    .slice(0, normalizedControls.maxResultsPerDuration)
    .map((result) => createOptimizerResultViewModel({ duration, result }));
}

export async function runOptimizerForControlsLive(
  setup: SetupSnapshot,
  catalog: CatalogEntry[],
  controls: OptimizerWorkspaceControls,
  onProgress: (progress: OptimizerLiveRunProgress) => void,
  signal?: AbortSignal,
): Promise<OptimizerCandidateViewModel[]> {
  const normalizedControls = normalizeOptimizerControls(controls);
  if (normalizedControls.searchMethod === "continuous") {
    return runContinuousOptimizerForControlsLive(setup, normalizedControls, onProgress, signal);
  }
  if (normalizedControls.searchMethod === "hybrid") {
    try {
      return await runRustWasmOptimizerForControlsLive(setup, catalog, normalizedControls, onProgress, signal);
    } catch (error) {
      if (!isUnavailableOptimizerStreamError(error)) {
        throw error;
      }

      return runLocalOptimizerForControlsLive(setup, catalog, normalizedControls, onProgress, signal);
    }
  }
  if (normalizedControls.searchMethod === "genetic") {
    return runGeneticOptimizerForControlsLive(setup, catalog, normalizedControls, onProgress, signal);
  }

  return runLocalOptimizerForControlsLive(setup, catalog, normalizedControls, onProgress, signal);
}

async function runLocalOptimizerForControlsLive(
  setup: SetupSnapshot,
  catalog: CatalogEntry[],
  controls: OptimizerWorkspaceControls,
  onProgress: (progress: OptimizerLiveRunProgress) => void,
  signal?: AbortSignal,
): Promise<OptimizerCandidateViewModel[]> {
  const normalizedControls = normalizeOptimizerControls(controls);
  const batchSize = Math.min(200, Math.max(10, Math.floor(normalizedControls.iterationBudget / 10)));
  const totalBatches = Math.ceil(normalizedControls.iterationBudget / batchSize);
  const candidates = new Map<string, OptimizerCandidateViewModel>();
  let attempts = 0;
  let validCandidates = 0;
  let invalidCandidates = 0;
  let bestScore: number | undefined;
  let bestCandidate: OptimizerCandidateViewModel | undefined;
  let latestMetrics: Record<string, number> = {};

  for (let batch = 0; batch < totalBatches; batch += 1) {
    if (signal?.aborted) {
      break;
    }
    const iterations = Math.min(batchSize, normalizedControls.iterationBudget - attempts);
    const batchControls = {
      ...normalizedControls,
      iterationBudget: iterations,
    };
    const batchOptions = {
      ...createOptimizerExperimentOptionsForSetup(setup, catalog, batchControls),
      seed: `${normalizedControls.searchMethod}:${normalizedControls.duration}:${normalizedControls.targetElement}:${batch}`,
    };
    const experiment = runOptimizerExperiment(batchOptions);
    const engineResult = experiment.engineResults[0];
    attempts += engineResult?.attempts ?? 0;
    validCandidates += engineResult?.validCandidates ?? 0;
    invalidCandidates += engineResult?.invalidCandidates ?? 0;
    latestMetrics = {
      ...(engineResult?.metrics ?? {}),
      generation: batch + 1,
      generations: totalBatches,
    };

    for (const candidate of engineResult?.topCandidates ?? []) {
      const viewModel = createOptimizerResultViewModel({ duration: normalizedControls.duration, result: candidate });
      candidates.set(viewModel.id, viewModel);
    }

    const results = rankOptimizerCandidateViewModels([...candidates.values()]).slice(0, normalizedControls.maxResultsPerDuration);
    bestCandidate = results[0];
    bestScore = bestCandidate?.score;
    onProgress({
      batch: batch + 1,
      attempts,
      validCandidates,
      invalidCandidates,
      bestScore,
      bestCandidate,
      metrics: latestMetrics,
      results,
    });
    await waitForUiFrame();
  }

  return rankOptimizerCandidateViewModels([...candidates.values()]).slice(0, normalizedControls.maxResultsPerDuration);
}

function isUnavailableOptimizerStreamError(error: unknown): boolean {
  return error instanceof Error && error.message === "Optimizer stream failed with status 404.";
}

async function runRustWasmOptimizerForControlsLive(
  setup: SetupSnapshot,
  catalog: CatalogEntry[],
  controls: OptimizerWorkspaceControls,
  onProgress: (progress: OptimizerLiveRunProgress) => void,
  signal?: AbortSignal,
): Promise<OptimizerCandidateViewModel[]> {
  const normalizedControls = normalizeOptimizerControls(controls);
  const candidates = new Map<string, OptimizerCandidateViewModel>();
  let latestResults: OptimizerCandidateViewModel[] = [];
  let progressBatch = 0;

  await streamOptimizerRun({
    options: {
      ...createOptimizerExperimentOptionsForSetup(setup, catalog, normalizedControls),
      backend: "rustWasm",
      rustWasmOracle: "finalTopCandidates",
      seed: `${normalizedControls.searchMethod}:${normalizedControls.duration}:${normalizedControls.targetElement}`,
    },
    progressIntervalMs: 500,
    signal,
    onProgress: (payload) => {
      progressBatch += 1;
      for (const candidate of payload.topCandidates) {
        const viewModel = createOptimizerResultViewModel({
          duration: normalizedControls.duration,
          result: candidate,
        });
        candidates.set(viewModel.id, viewModel);
      }

      latestResults = rankOptimizerCandidateViewModels([...candidates.values()]).slice(0, normalizedControls.maxResultsPerDuration);
      onProgress({
        batch: progressBatch,
        attempts: payload.attempts,
        validCandidates: payload.validCandidates,
        invalidCandidates: payload.invalidCandidates,
        bestScore: latestResults[0]?.score,
        bestCandidate: latestResults[0],
        metrics: {
          ...payload.metrics,
          backend: 1,
        },
        results: latestResults,
      });
    },
  });

  return latestResults;
}

async function runGeneticOptimizerForControlsLive(
  setup: SetupSnapshot,
  catalog: CatalogEntry[],
  controls: OptimizerWorkspaceControls,
  onProgress: (progress: OptimizerLiveRunProgress) => void,
  signal?: AbortSignal,
): Promise<OptimizerCandidateViewModel[]> {
  const normalizedControls = normalizeOptimizerControls(controls);
  const candidates = new Map<string, OptimizerCandidateViewModel>();
  let latestResults: OptimizerCandidateViewModel[] = [];
  const uiProgressInterval = Math.max(1, Math.floor(normalizedControls.iterationBudget / 200));
  let nextUiProgressAttempt = 0;
  let reportedUiProgress = false;

  function shouldReportUiProgress(attempts: number): boolean {
    const isFinalProgress = attempts >= normalizedControls.iterationBudget || signal?.aborted;
    if (!reportedUiProgress || attempts >= nextUiProgressAttempt || isFinalProgress) {
      reportedUiProgress = true;
      nextUiProgressAttempt = Math.min(
        normalizedControls.iterationBudget,
        Math.max(nextUiProgressAttempt + uiProgressInterval, attempts + uiProgressInterval),
      );
      return true;
    }

    return false;
  }

  const experiment = await runOptimizerExperimentProgressive({
    ...createOptimizerExperimentOptionsForSetup(setup, catalog, normalizedControls),
    seed: `${normalizedControls.searchMethod}:${normalizedControls.duration}:${normalizedControls.targetElement}`,
    progressInterval: uiProgressInterval,
    signal,
    onProgress: (progress) => {
      for (const candidate of progress.topCandidates) {
        const viewModel = createOptimizerResultViewModel({ duration: normalizedControls.duration, result: candidate });
        candidates.set(viewModel.id, viewModel);
      }

      if (!shouldReportUiProgress(progress.attempts)) {
        return;
      }

      latestResults = rankOptimizerCandidateViewModels([...candidates.values()]).slice(0, normalizedControls.maxResultsPerDuration);
      onProgress({
        batch: Math.max(1, Math.ceil(progress.attempts / uiProgressInterval)),
        attempts: progress.attempts,
        validCandidates: progress.validCandidates,
        invalidCandidates: progress.invalidCandidates,
        bestScore: latestResults[0]?.score,
        bestCandidate: latestResults[0],
        metrics: progress.metrics,
        results: latestResults,
      });
    },
    yieldProgress: waitForUiFrame,
  });

  const engineResult = experiment.engineResults[0];
  for (const candidate of engineResult?.topCandidates ?? []) {
    const viewModel = createOptimizerResultViewModel({ duration: normalizedControls.duration, result: candidate });
    candidates.set(viewModel.id, viewModel);
  }

  latestResults = rankOptimizerCandidateViewModels([...candidates.values()]).slice(0, normalizedControls.maxResultsPerDuration);
  return latestResults;
}

async function runContinuousOptimizerForControlsLive(
  setup: SetupSnapshot,
  controls: OptimizerWorkspaceControls,
  onProgress: (progress: OptimizerLiveRunProgress) => void,
  signal?: AbortSignal,
): Promise<OptimizerCandidateViewModel[]> {
  const normalizedControls = normalizeOptimizerControls(controls);
  const continuousControls = createContinuousControlsForOptimizerRun(setup, normalizedControls);
  const candidates = new Map<string, OptimizerCandidateViewModel>();
  let latestResults: OptimizerCandidateViewModel[] = [];
  let progressBatch = 0;
  let latestAttempts = 0;
  let latestValidCandidates = 0;
  let latestInvalidCandidates = 0;
  let latestCheckpointScore: number | undefined;

  await streamContinuousOptimizerRun({
    args: createContinuousOptimizerLaunchArgs(continuousControls),
    signal,
    onProgress: (payload) => {
      progressBatch += 1;
      latestAttempts = payload.totalAttempts;
      latestCheckpointScore = payload.score;
      latestValidCandidates = payload.validCandidates ?? Math.round(payload.totalAttempts * payload.validRate);
      latestInvalidCandidates = payload.invalidCandidates ?? Math.max(0, payload.totalAttempts - latestValidCandidates);
      reportContinuousProgress();
    },
    onCandidate: (payload) => {
      const viewModel = createOptimizerResultViewModelFromContinuousCandidate(payload, normalizedControls.duration);
      if (!viewModel) {
        return;
      }
      candidates.set(viewModel.id, viewModel);
      latestResults = rankOptimizerCandidateViewModels([...candidates.values()]).slice(0, normalizedControls.maxResultsPerDuration);
      reportContinuousProgress();
    },
  });

  return latestResults;

  function reportContinuousProgress(): void {
    onProgress({
      batch: Math.max(1, progressBatch),
      attempts: latestAttempts,
      validCandidates: latestValidCandidates,
      invalidCandidates: latestInvalidCandidates,
      bestScore: latestResults[0]?.score ?? latestCheckpointScore,
      bestCandidate: latestResults[0],
      metrics: {
        continuous: 1,
        targetAttempts: normalizedControls.iterationBudget,
      },
      results: latestResults,
    });
  }
}

export function createOptimizerResultViewModel({
  duration,
  result,
}: {
  duration: number;
  result: OptimizerCandidateSource;
}): OptimizerCandidateViewModel {
  const actionCount = countPlanActions(result.plan);
  const apSpent = computeApSpent(result);
  const totalDamage = result.score.totalDamage;
  const damagePerTurn = roundMetric(totalDamage / Math.max(1, duration));
  const damagePerAp = roundMetric(totalDamage / Math.max(1, apSpent));

  return {
    id: createOptimizerCandidateId(result.plan, result.passiveIds ?? [], result.sublimationIds ?? []),
    duration,
    plan: result.plan,
    score: result.score.score,
    totalDamage,
    damagePerTurn,
    damagePerAp,
    actionCount,
    apSpent,
    passiveIds: result.passiveIds ?? [],
    sublimationIds: result.sublimationIds ?? [],
    sublimations: result.sublimations ?? createCandidateSublimationBuild(result.sublimationIds ?? []),
    finalResources: result.simulation.finalState.remainingResources,
    damageByResolvedElement: result.score.damageByResolvedElement,
    sustainable: result.sustainability.sustainable,
    sustainabilityRequired: result.sustainability.required,
    source: result,
  };
}

export function createOptimizerResultViewModelFromContinuousCandidate(
  payload: unknown,
  fallbackDuration?: number,
): OptimizerCandidateViewModel | null {
  if (!isContinuousVerifiedOptimizerCandidatePayload(payload)) {
    return null;
  }

  return createOptimizerResultViewModel({
    duration: fallbackDuration ?? payload.candidate.plan.turns.length,
    result: payload.candidate,
  });
}

export function createOptimizerCandidateId(plan: ComboPlan, passiveIds: string[] = [], sublimationIds: string[] = []): string {
  const passiveKey = [...passiveIds].sort().join("+");
  const sublimationKey = [...sublimationIds].sort().join("+");
  const setupKey = [passiveKey, sublimationKey].filter(Boolean).join("::");
  return setupKey ? `${setupKey}::${serializePlan(plan)}` : serializePlan(plan);
}

export function summarizeOptimizerControls(controls: OptimizerWorkspaceControls): string {
  const normalizedControls = normalizeOptimizerControls(controls);
  const durationSummary = `${normalizedControls.duration}T`;
  const scoringSummary = normalizedControls.scoreCriterion === "totalDamage"
    ? "dégâts totaux"
    : `dégâts ${elementLabels[normalizedControls.targetElement]}`;
  const cycleSummary = normalizedControls.requireSustainableCycle ? "cycle soutenable" : "cycle libre";

  return [
    durationSummary,
    scoringSummary,
    cycleSummary,
    optimizerMethodLabels[normalizedControls.searchMethod],
    `${normalizedControls.iterationBudget} essais`,
    `${normalizedControls.maxResultsPerDuration} résultats`,
  ].join(" · ");
}

export function createSavedComboName(candidate: OptimizerCandidateViewModel): string {
  return `${candidate.duration}T · ${candidate.totalDamage} dégâts · ${candidate.damagePerTurn}/tour`;
}

export function createOptimizerCandidateSpellIconRows(plan: ComboPlan, catalog: CatalogEntry[]): OptimizerCandidateSpellIconRow[] {
  const catalogNamesById = new Map(catalog.map((entry) => [entry.id, entry.name]));

  return [0, 1, 2].map((turnIndex) => ({
    turn: turnIndex + 1,
    icons: (plan.turns[turnIndex]?.actions ?? []).map((action) => ({
      spellId: action.spellId,
      label: catalogNamesById.get(action.spellId) ?? action.spellId,
    })),
  }));
}

export function createPinnedCandidateComparison(candidates: OptimizerCandidateViewModel[]): OptimizerCandidateViewModel[] {
  return candidates;
}

export function togglePinnedCandidate(
  pinnedIds: string[],
  candidate: OptimizerCandidateViewModel,
): string[] {
  return pinnedIds.includes(candidate.id)
    ? pinnedIds.filter((id) => id !== candidate.id)
    : [...pinnedIds, candidate.id];
}

export function getPinnedCandidates(
  groups: DurationGroupedResults,
  pinnedIds: string[],
): OptimizerCandidateViewModel[] {
  const pinnedIdSet = new Set(pinnedIds);
  return Object.values(groups).flat().filter((candidate) => pinnedIdSet.has(candidate.id));
}

export function openCandidateInBuilder(setup: SetupSnapshot, candidate: OptimizerCandidateViewModel): BuilderHandoff {
  return {
    setupSnapshotId: setup.id,
    character: candidate.passiveIds.length > 0 || candidate.sublimationIds.length > 0
      ? {
        ...setup.character,
        sublimations: candidate.sublimations,
        classState: {
          ...setup.character.classState,
          huppermage: {
            ...setup.character.classState?.huppermage,
            activePassives: candidate.passiveIds.length > 0
              ? [...candidate.passiveIds]
              : [...(setup.character.classState?.huppermage?.activePassives ?? [])],
          },
        },
      }
      : setup.character,
    plan: candidate.plan,
  };
}

function createCandidateSublimationBuild(sublimationIds: string[]): SublimationBuild {
  return {
    selections: sublimationIds.map((sublimationId) => ({ sublimationId })),
    hpAssumption: "normal",
    nearbyAlliesAssumption: "unspecified",
    contactEnemiesAssumption: "unspecified",
  };
}

function computeApSpent(result: ComboOptimizerResult): number {
  const spent = result.simulation.turns.reduce((total, turn) => {
    const spentThisTurn = turn.result.breakdown.reduce((turnTotal, action) => (
      turnTotal + Math.max(0, action.resourceBefore.ap - action.resourceAfter.ap)
    ), 0);
    return total + spentThisTurn;
  }, 0);

  return spent > 0 ? spent : countPlanActions(result.plan);
}

function countPlanActions(plan: ComboPlan): number {
  return plan.turns.reduce((total, turn) => total + turn.actions.length, 0);
}

function serializePlan(plan: ComboPlan): string {
  return plan.turns.map((turn) => turn.actions.map((action) => action.spellId).join(",")).join("|");
}

const elementLabels: Record<Exclude<Element, "light" | "neutral">, string> = {
  fire: "feu",
  water: "eau",
  earth: "terre",
  air: "air",
};

const methodLabels: Record<OptimizerExperimentEngineKind, string> = {
  random: "baseline aléatoire",
  mcts: "MCTS",
  novelty: "novelty search",
  annealing: "recuit",
  genetic: "génétique",
  hybrid: "hybride",
};

const optimizerMethodLabels: Record<OptimizerWorkspaceSearchMethod, string> = {
  ...methodLabels,
  continuous: "continuous",
};

function createOptimizationCriterion(controls: OptimizerWorkspaceControls): ComboOptimizationCriterion {
  return controls.scoreCriterion === "totalDamage"
    ? { type: "totalDamage" }
    : { type: "elementDamage", element: controls.targetElement };
}

function normalizeOptimizerSearchMethod(method: OptimizerWorkspaceSearchMethod): OptimizerWorkspaceSearchMethod {
  return method === "continuous"
    || method === "genetic"
    || method === "mcts"
    || method === "novelty"
    || method === "annealing"
    || method === "random"
    ? method
    : "hybrid";
}

function createContinuousControlsForOptimizerRun(
  setup: SetupSnapshot,
  controls: OptimizerWorkspaceControls,
) {
  const defaults = createDefaultContinuousOptimizerControls();
  const workerCount = defaults.workerCount;
  const chunkSize = defaults.chunkSize;
  const targetRounds = Math.max(1, Math.ceil(controls.iterationBudget / Math.max(1, workerCount * chunkSize)));

  return {
    ...defaults,
    sessionId: createContinuousOptimizerSessionId(setup, controls),
    scenarioId: createContinuousScenarioId(controls),
    workerCount,
    chunkSize,
    qualityPreset: "validated-contextual" as const,
    scoreCriterion: controls.scoreCriterion === "elementDamage" ? "element-damage" as const : "total-damage" as const,
    targetElement: controls.targetElement,
    requireSustainableCycle: controls.requireSustainableCycle,
    maxRounds: targetRounds,
  };
}

function createContinuousOptimizerSessionId(setup: SetupSnapshot, controls: OptimizerWorkspaceControls): string {
  const scoreKey = controls.scoreCriterion === "elementDamage" ? controls.targetElement : "total";
  const cycleKey = controls.requireSustainableCycle ? "sustainable" : "free";
  return `optimizer-${setup.id}-${controls.duration}t-${scoreKey}-${cycleKey}`;
}

function createContinuousScenarioId(controls: OptimizerWorkspaceControls): "t2-a8-p2" | "t3-full" {
  return controls.duration <= 2 ? "t2-a8-p2" : "t3-full";
}

function isContinuousVerifiedOptimizerCandidatePayload(
  value: unknown,
): value is ContinuousVerifiedOptimizerCandidatePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const candidate = record.candidate as Partial<OptimizerCandidateSource> | undefined;
  return record.schemaVersion === 1
    && typeof record.totalAttempts === "number"
    && typeof record.rank === "number"
    && Boolean(record.run && typeof record.run === "object")
    && Boolean(candidate?.plan && candidate.simulation && candidate.score && candidate.sustainability);
}

function getSetupPassiveLimit(setup: SetupSnapshot): number {
  return setup.character.classState?.huppermage?.passiveLimit ?? 6;
}

function rankOptimizerCandidateViewModels(candidates: OptimizerCandidateViewModel[]): OptimizerCandidateViewModel[] {
  return candidates.sort((left, right) => {
    const scoreDifference = right.score - left.score;
    if (scoreDifference !== 0) {
      return scoreDifference;
    }
    const passiveCountDifference = left.passiveIds.length - right.passiveIds.length;
    if (passiveCountDifference !== 0) {
      return passiveCountDifference;
    }
    return left.id.localeCompare(right.id);
  });
}

async function streamOptimizerRun({
  onProgress,
  options,
  progressIntervalMs,
  signal,
}: {
  onProgress: (payload: OptimizerRunStreamPayload) => void;
  options: OptimizerExperimentOptions;
  progressIntervalMs: number;
  signal?: AbortSignal;
}): Promise<void> {
  const response = await fetch("/api/optimizer-runs/stream", {
    body: JSON.stringify({ options, progressIntervalMs }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal,
  });
  if (!response.ok) {
    throw new Error(await readOptimizerStreamError(response));
  }
  if (!response.body) {
    throw new Error("Optimizer stream response is missing a readable body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const eventChunk of events) {
      const event = parseServerSentEvent(eventChunk);
      if (!event) {
        continue;
      }
      if (event.event === "error") {
        const parsed = JSON.parse(event.data) as { error?: string };
        throw new Error(parsed.error ?? "Optimizer stream failed.");
      }
      if (event.event === "progress" || event.event === "complete") {
        onProgress(JSON.parse(event.data) as OptimizerRunStreamPayload);
      }
    }
  }
}

function parseServerSentEvent(chunk: string): { event: string; data: string } | null {
  let event = "message";
  const data: string[] = [];
  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      data.push(line.slice("data:".length).trimStart());
    }
  }

  return data.length > 0 ? { event, data: data.join("\n") } : null;
}

async function readOptimizerStreamError(response: Response): Promise<string> {
  try {
    const parsed = await response.json() as { error?: string };
    return parsed.error ?? `Optimizer stream failed with status ${response.status}.`;
  } catch {
    return `Optimizer stream failed with status ${response.status}.`;
  }
}

function waitForUiFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}
