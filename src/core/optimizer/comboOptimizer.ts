import type { CatalogEntry, Element } from "../catalog/types.ts";
import { simulateCombo } from "../simulation/comboSimulator.ts";
import { roundDamage } from "../simulation/damage.ts";
import type {
  Action,
  BaseStats,
  ClassTurnState,
  ComboPlan,
  ComboSimulationOptions,
  ComboSimulationResult,
  SimulatedCharacter,
  TurnState,
} from "../simulation/types.ts";

export type ComboOptimizationCriterion =
  | { type: "totalDamage" }
  | { type: "elementDamage"; element: Element };

export type ComboOptimizerOptions = {
  catalog: CatalogEntry[];
  character: SimulatedCharacter;
  maxTurns: number;
  maxActionsPerTurn: number;
  availableSpellIds?: string[];
  beamWidth?: number;
  maxCandidates?: number;
  requireSustainableCycle?: boolean;
  criterion?: ComboOptimizationCriterion;
  defaultActionContext?: ComboSimulationOptions["defaultActionContext"];
};

export type ComboScoreBreakdown = {
  score: number;
  totalDamage: number;
  damageByResolvedElement: Record<Element, number>;
};

export type ComboSustainability = {
  required: boolean;
  sustainable: boolean;
  replay?: ComboSimulationResult;
  reason?: string;
};

export type ComboOptimizerResult = {
  plan: ComboPlan;
  simulation: ComboSimulationResult;
  score: ComboScoreBreakdown;
  sustainability: ComboSustainability;
};

export type SustainableCycleOptions = {
  catalog: CatalogEntry[];
  character: SimulatedCharacter;
  plan: ComboPlan;
  defaultActionContext?: ComboSimulationOptions["defaultActionContext"];
};

export function scoreComboSimulation(
  simulation: ComboSimulationResult,
  criterion: ComboOptimizationCriterion = { type: "totalDamage" },
): ComboScoreBreakdown {
  const damageByResolvedElement = createElementDamageRecord();

  for (const turn of simulation.turns) {
    for (const action of turn.result.breakdown) {
      for (const effect of action.appliedEffects) {
        if (effect.type !== "damage") {
          continue;
        }

        damageByResolvedElement[effect.resolvedElement] = roundDamage(
          damageByResolvedElement[effect.resolvedElement] + effect.amount,
        );
      }
    }
  }

  const totalDamage = simulation.totalDamage;
  const score = criterion.type === "totalDamage"
    ? totalDamage
    : damageByResolvedElement[criterion.element];

  return {
    score,
    totalDamage,
    damageByResolvedElement,
  };
}

export function optimizeCombo(options: ComboOptimizerOptions): ComboOptimizerResult[] {
  const results: ComboOptimizerResult[] = [];

  for (const plan of generateCandidatePlans(options)) {
    const simulation = simulateCombo({
      catalog: options.catalog,
      character: options.character,
      combo: plan,
      defaultActionContext: options.defaultActionContext,
    });

    if (!simulation.valid) {
      continue;
    }

    const sustainability = options.requireSustainableCycle
      ? evaluateSustainableCycle({
        catalog: options.catalog,
        character: options.character,
        plan,
        defaultActionContext: options.defaultActionContext,
      })
      : {
        required: false,
        sustainable: true,
      };

    if (!sustainability.sustainable) {
      continue;
    }

    results.push({
      plan,
      simulation,
      score: scoreComboSimulation(simulation, options.criterion),
      sustainability,
    });
  }

  const ranked = results.sort(compareOptimizerResults);
  return ranked.slice(0, options.maxCandidates ?? options.beamWidth ?? ranked.length);
}

export function evaluateSustainableCycle(options: SustainableCycleOptions): ComboSustainability {
  const firstRun = simulateCombo({
    catalog: options.catalog,
    character: options.character,
    combo: options.plan,
    defaultActionContext: options.defaultActionContext,
  });

  if (!firstRun.valid) {
    return {
      required: true,
      sustainable: false,
      replay: firstRun,
      reason: "initialRunInvalid",
    };
  }

  const replayCharacter = createReplayCharacter(options.character, firstRun.finalState);
  const replayInitialResources = replayCharacter.resources;
  const replay = simulateCombo({
    catalog: options.catalog,
    character: replayCharacter,
    combo: options.plan,
    defaultActionContext: options.defaultActionContext,
  });

  if (!replay.valid) {
    return {
      required: true,
      sustainable: false,
      replay,
      reason: "replayInvalid",
    };
  }

  const replayFinalResources = replay.finalState.remainingResources;
  if (replayFinalResources.wp < replayInitialResources.wp || replayFinalResources.bq < replayInitialResources.bq) {
    return {
      required: true,
      sustainable: false,
      replay,
      reason: "replayResourceDebt",
    };
  }

  return {
    required: true,
    sustainable: true,
    replay,
  };
}

function createElementDamageRecord(): Record<Element, number> {
  return {
    fire: 0,
    water: 0,
    earth: 0,
    air: 0,
    light: 0,
    neutral: 0,
  };
}

function generateCandidatePlans(options: ComboOptimizerOptions): ComboPlan[] {
  const maxTurns = clampInteger(options.maxTurns, 1, 3);
  const maxActionsPerTurn = clampInteger(options.maxActionsPerTurn, 1, 12);
  const turnPlans = generateTurnPlans(getSearchSpellIds(options), maxActionsPerTurn);
  const plans: ComboPlan[] = [];

  for (let turnCount = 1; turnCount <= maxTurns; turnCount += 1) {
    for (const turns of combineTurnPlans(turnPlans, turnCount)) {
      plans.push({ turns });
    }
  }

  return plans;
}

function generateTurnPlans(spellIds: string[], maxActionsPerTurn: number): Array<{ actions: Action[] }> {
  const plans: Array<{ actions: Action[] }> = [];

  for (let actionCount = 1; actionCount <= maxActionsPerTurn; actionCount += 1) {
    for (const actions of combineActions(spellIds, actionCount)) {
      plans.push({ actions });
    }
  }

  return plans;
}

function combineTurnPlans(turnPlans: Array<{ actions: Action[] }>, turnCount: number): Array<Array<{ actions: Action[] }>> {
  if (turnCount === 0) {
    return [[]];
  }

  const tails = combineTurnPlans(turnPlans, turnCount - 1);
  return turnPlans.flatMap((turnPlan) => tails.map((tail) => [cloneTurnPlan(turnPlan), ...tail.map(cloneTurnPlan)]));
}

function combineActions(spellIds: string[], actionCount: number): Action[][] {
  if (actionCount === 0) {
    return [[]];
  }

  const tails = combineActions(spellIds, actionCount - 1);
  return spellIds.flatMap((spellId) => tails.map((tail) => [{ spellId }, ...tail]));
}

function getSearchSpellIds(options: ComboOptimizerOptions): string[] {
  const spellIds = options.availableSpellIds
    ?? options.catalog.filter((entry) => entry.kind === "spell").map((entry) => entry.id);

  return [...new Set(spellIds)].sort();
}

function cloneTurnPlan(turnPlan: { actions: Action[] }): { actions: Action[] } {
  return {
    actions: turnPlan.actions.map((action) => ({ ...action })),
  };
}

function compareOptimizerResults(left: ComboOptimizerResult, right: ComboOptimizerResult): number {
  const scoreDifference = right.score.score - left.score.score;
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return serializePlan(left.plan).localeCompare(serializePlan(right.plan));
}

function serializePlan(plan: ComboPlan): string {
  return plan.turns.map((turn) => turn.actions.map((action) => action.spellId).join(",")).join("|");
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}

function createReplayCharacter(baseCharacter: SimulatedCharacter, previousFinalState: TurnState): SimulatedCharacter {
  const previousResources = previousFinalState.remainingResources;
  return {
    ...baseCharacter,
    resources: {
      ...baseCharacter.resources,
      ap: baseCharacter.resources.ap,
      mp: baseCharacter.resources.mp,
      wp: previousResources.wp,
      bq: previousResources.bq,
    },
    stats: cloneStats(baseCharacter.stats),
    classState: createReplayClassState(previousFinalState.classState),
  };
}

function createReplayClassState(previousClassState: ClassTurnState): SimulatedCharacter["classState"] {
  if (!previousClassState.huppermage) {
    return undefined;
  }

  const huppermage = previousClassState.huppermage;
  return {
    huppermage: {
      runes: { ...huppermage.runes.active },
      lastGeneratedRune: huppermage.runes.lastGeneratedRune,
      runeApGainsThisTurn: {
        incandescent: false,
        aquatic: false,
        telluric: false,
        aerial: false,
      },
      abundanceLevel: huppermage.abundanceLevel,
      feuFolletsActive: huppermage.feuFolletsActive,
      feuFolletStoredRunes: huppermage.feuFolletStoredRunes.map((storedRunes) => [...storedRunes]),
      feuFolletStoredLastRunes: [...huppermage.feuFolletStoredLastRunes],
      temporaryUnlockedSpellElement: huppermage.temporaryUnlockedSpellElement,
      usedSpellIds: [...huppermage.usedSpellIds],
      activePassives: [...huppermage.activePassives],
      activeHeart: null,
      waterHeartLastSpellKind: null,
      bqMax: huppermage.bqMax,
      storedBq: huppermage.storedBq,
      haloChatoyantMarks: huppermage.haloChatoyantMarks,
      deckSpellLimit: huppermage.deckSpellLimit,
      passiveLimit: huppermage.passiveLimit,
    },
  };
}

function cloneStats(stats: BaseStats): BaseStats {
  return {
    ...stats,
    elementalMastery: { ...stats.elementalMastery },
  };
}
