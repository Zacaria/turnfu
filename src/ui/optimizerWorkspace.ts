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
import type { SetupSnapshot } from "./researchWorkspace.ts";

export type OptimizerScoreCriterionId = "totalDamage" | "elementDamage";

export type OptimizerWorkspaceControls = {
  duration: number;
  scoreCriterion: OptimizerScoreCriterionId;
  targetElement: Exclude<Element, "light" | "neutral">;
  requireSustainableCycle: boolean;
  searchMethod: OptimizerExperimentEngineKind;
  iterationBudget: number;
  beamWidth: number;
  maxResultsPerDuration: number;
};

export type OptimizerCandidateSource = Pick<ComboOptimizerResult, "plan" | "simulation" | "score" | "sustainability"> & {
  passiveIds?: string[];
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
  return {
    ...controls,
    duration: clampInteger(controls.duration, 1, 3),
    iterationBudget: clampInteger(controls.iterationBudget, 10, 1_000_000),
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
  const criterion = createOptimizationCriterion(normalizedControls);

  return {
    catalog,
    character: setup.character,
    duration: normalizedControls.duration,
    engines: [normalizedControls.searchMethod],
    budget: { iterations: normalizedControls.iterationBudget },
    maxCandidates: normalizedControls.maxResultsPerDuration,
    maxPassiveCount: getSetupPassiveLimit(setup),
    availablePassiveIds: catalog.filter((entry) => entry.kind === "passive").map((entry) => entry.id),
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
  if (normalizedControls.searchMethod === "genetic" || normalizedControls.searchMethod === "hybrid") {
    return runGeneticOptimizerForControlsLive(setup, catalog, normalizedControls, onProgress, signal);
  }

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

  const experiment = await runOptimizerExperimentProgressive({
    ...createOptimizerExperimentOptionsForSetup(setup, catalog, normalizedControls),
    seed: `${normalizedControls.searchMethod}:${normalizedControls.duration}:${normalizedControls.targetElement}`,
    progressInterval: Math.min(200, Math.max(10, Math.floor(normalizedControls.iterationBudget / 10))),
    signal,
    onProgress: (progress) => {
      for (const candidate of progress.topCandidates) {
        const viewModel = createOptimizerResultViewModel({ duration: normalizedControls.duration, result: candidate });
        candidates.set(viewModel.id, viewModel);
      }

      latestResults = rankOptimizerCandidateViewModels([...candidates.values()]).slice(0, normalizedControls.maxResultsPerDuration);
      onProgress({
        batch: Math.max(1, Math.ceil(progress.attempts / Math.max(1, Math.floor(normalizedControls.iterationBudget / 10)))),
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
    id: createOptimizerCandidateId(result.plan, result.passiveIds ?? []),
    duration,
    plan: result.plan,
    score: result.score.score,
    totalDamage,
    damagePerTurn,
    damagePerAp,
    actionCount,
    apSpent,
    passiveIds: result.passiveIds ?? [],
    finalResources: result.simulation.finalState.remainingResources,
    damageByResolvedElement: result.score.damageByResolvedElement,
    sustainable: result.sustainability.sustainable,
    sustainabilityRequired: result.sustainability.required,
    source: result,
  };
}

export function createOptimizerCandidateId(plan: ComboPlan, passiveIds: string[] = []): string {
  const passiveKey = [...passiveIds].sort().join("+");
  return passiveKey ? `${passiveKey}::${serializePlan(plan)}` : serializePlan(plan);
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
    methodLabels[normalizedControls.searchMethod],
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
    character: candidate.passiveIds.length > 0
      ? {
        ...setup.character,
        classState: {
          ...setup.character.classState,
          huppermage: {
            ...setup.character.classState?.huppermage,
            activePassives: [...candidate.passiveIds],
          },
        },
      }
      : setup.character,
    plan: candidate.plan,
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

function createOptimizationCriterion(controls: OptimizerWorkspaceControls): ComboOptimizationCriterion {
  return controls.scoreCriterion === "totalDamage"
    ? { type: "totalDamage" }
    : { type: "elementDamage", element: controls.targetElement };
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
