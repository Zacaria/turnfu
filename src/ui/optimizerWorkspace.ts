import type { CatalogEntry, Element } from "../core/catalog/types.ts";
import {
  type ComboOptimizationCriterion,
  type ComboOptimizerOptions,
  type ComboOptimizerResult,
  optimizeCombo,
} from "../core/optimizer/index.ts";
import type { ComboPlan, ResourcePool, SimulatedCharacter } from "../core/simulation/types.ts";
import {
  getSetupSupportedSpellIds,
  type SetupSnapshot,
} from "./researchWorkspace.ts";

export type OptimizerScoreCriterionId = "totalDamage" | "elementDamage";

export type OptimizerWorkspaceControls = {
  durations: number[];
  scoreCriterion: OptimizerScoreCriterionId;
  targetElement: Exclude<Element, "light" | "neutral">;
  requireSustainableCycle: boolean;
  beamWidth: number;
  maxResultsPerDuration: number;
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
  finalResources: ResourcePool;
  damageByResolvedElement: Record<Element, number>;
  sustainable: boolean;
  sustainabilityRequired: boolean;
  source: ComboOptimizerResult;
};

export type BuilderHandoff = {
  setupSnapshotId: string;
  character: SimulatedCharacter;
  plan: ComboPlan;
};

export type DurationGroupedResults = Record<number, OptimizerCandidateViewModel[]>;

export function createDefaultOptimizerControls(): OptimizerWorkspaceControls {
  return {
    durations: [1, 2, 3],
    scoreCriterion: "totalDamage",
    targetElement: "fire",
    requireSustainableCycle: false,
    beamWidth: 40,
    maxResultsPerDuration: 10,
  };
}

export function normalizeOptimizerControls(controls: OptimizerWorkspaceControls): OptimizerWorkspaceControls {
  const durations = [...new Set(controls.durations)]
    .map((duration) => Math.trunc(duration))
    .filter((duration) => duration >= 1 && duration <= 3)
    .sort((left, right) => left - right);

  return {
    ...controls,
    durations: durations.length > 0 ? durations : [1],
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
    availableSpellIds: getSetupSupportedSpellIds(setup, catalog),
    requireSustainableCycle: normalizedControls.requireSustainableCycle,
    criterion,
    defaultActionContext: setup.defaultActionContext,
  };
}

export function groupOptimizerResultsByDuration(
  setup: SetupSnapshot,
  catalog: CatalogEntry[],
  controls: OptimizerWorkspaceControls,
): DurationGroupedResults {
  const normalizedControls = normalizeOptimizerControls(controls);
  const groups: DurationGroupedResults = {};

  for (const duration of normalizedControls.durations) {
    const results = optimizeCombo(createOptimizerOptionsForSetup(setup, catalog, normalizedControls, duration))
      .filter((result) => result.plan.turns.length === duration)
      .slice(0, normalizedControls.maxResultsPerDuration)
      .map((result) => createOptimizerResultViewModel({ duration, result }));

    groups[duration] = results;
  }

  return groups;
}

export function createOptimizerResultViewModel({
  duration,
  result,
}: {
  duration: number;
  result: ComboOptimizerResult;
}): OptimizerCandidateViewModel {
  const actionCount = countPlanActions(result.plan);
  const apSpent = computeApSpent(result);
  const totalDamage = result.score.totalDamage;
  const damagePerTurn = roundMetric(totalDamage / Math.max(1, duration));
  const damagePerAp = roundMetric(totalDamage / Math.max(1, apSpent));

  return {
    id: createOptimizerCandidateId(result.plan),
    duration,
    plan: result.plan,
    score: result.score.score,
    totalDamage,
    damagePerTurn,
    damagePerAp,
    actionCount,
    apSpent,
    finalResources: result.simulation.finalState.remainingResources,
    damageByResolvedElement: result.score.damageByResolvedElement,
    sustainable: result.sustainability.sustainable,
    sustainabilityRequired: result.sustainability.required,
    source: result,
  };
}

export function createOptimizerCandidateId(plan: ComboPlan): string {
  return serializePlan(plan);
}

export function summarizeOptimizerControls(controls: OptimizerWorkspaceControls): string {
  const normalizedControls = normalizeOptimizerControls(controls);
  const durationSummary = normalizedControls.durations.map((duration) => `${duration}T`).join(", ");
  const scoringSummary = normalizedControls.scoreCriterion === "totalDamage"
    ? "dégâts totaux"
    : `dégâts ${elementLabels[normalizedControls.targetElement]}`;
  const cycleSummary = normalizedControls.requireSustainableCycle ? "cycle soutenable" : "cycle libre";

  return [
    durationSummary,
    scoringSummary,
    cycleSummary,
    `largeur ${normalizedControls.beamWidth}`,
    `${normalizedControls.maxResultsPerDuration} résultats`,
  ].join(" · ");
}

export function createSavedComboName(candidate: OptimizerCandidateViewModel): string {
  return `${candidate.duration}T · ${candidate.totalDamage} dégâts · ${candidate.damagePerTurn}/tour`;
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
    character: setup.character,
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

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}
