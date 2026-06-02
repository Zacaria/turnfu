import type { CatalogEntry, Element } from "../catalog/types.ts";
import { simulateCombo } from "../simulation/comboSimulator.ts";
import { roundDamage } from "../simulation/damage.ts";
import { computeActiveInitialSublimationResourceDelta } from "../simulation/sublimationResourceDeltas.ts";
import type {
  Action,
  ActionResult,
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
  maxActionsPerTurn?: number;
  exactTurnCount?: number;
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

export function scoreSustainableComboSimulation(
  simulation: ComboSimulationResult,
  character: SimulatedCharacter,
  criterion: ComboOptimizationCriterion = { type: "totalDamage" },
): ComboScoreBreakdown {
  const baseScore = scoreComboSimulation(simulation, criterion);
  const finalResources = simulation.finalState.remainingResources;
  const bqRatio = clampRatio(finalResources.bq / 1_000);
  const initialWp = character.resources.wp;
  const wpRatio = initialWp > 0 ? clampRatio(finalResources.wp / initialWp) : 0;
  const multiplier = 1 + 0.08 * bqRatio + 0.04 * wpRatio;

  return {
    ...baseScore,
    score: roundDamage(baseScore.score * multiplier),
  };
}

export function optimizeCombo(options: ComboOptimizerOptions): ComboOptimizerResult[] {
  if (options.beamWidth && options.beamWidth > 0) {
    const ranked = optimizeComboWithBeamSearch(options);
    return ranked.slice(0, options.maxCandidates ?? options.beamWidth ?? ranked.length);
  }

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
      score: options.requireSustainableCycle
        ? scoreSustainableComboSimulation(simulation, options.character, options.criterion)
        : scoreComboSimulation(simulation, options.criterion),
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
  const minTurns = options.exactTurnCount ? clampInteger(options.exactTurnCount, 1, 3) : 1;
  const turnLimit = options.exactTurnCount ? minTurns : maxTurns;
  const maxActionsPerTurn = clampInteger(options.maxActionsPerTurn ?? 12, 1, 12);
  const turnPlans = generateTurnPlans(getSearchActions(options), maxActionsPerTurn);
  const plans: ComboPlan[] = [];

  for (let turnCount = minTurns; turnCount <= turnLimit; turnCount += 1) {
    for (const turns of combineTurnPlans(turnPlans, turnCount)) {
      plans.push({ turns });
    }
  }

  return plans;
}

type BeamSearchEntry = {
  plan: ComboPlan;
  result: ComboOptimizerResult;
  seenStateKeys: Set<string>;
};

function optimizeComboWithBeamSearch(options: ComboOptimizerOptions): ComboOptimizerResult[] {
  const targetTurnCount = clampInteger(options.exactTurnCount ?? options.maxTurns, 1, 3);
  const maxActionsPerTurn = options.maxActionsPerTurn ? clampInteger(options.maxActionsPerTurn, 1, 12) : undefined;
  const beamWidth = clampInteger(options.beamWidth ?? 1, 1, 500);
  const searchActions = getSearchActions(options);
  const completed = new Map<string, ComboOptimizerResult>();
  let frontier: BeamSearchEntry[] = [];

  for (const action of searchActions) {
    const plan = { turns: [{ actions: [cloneAction(action)] }] };
    const entry = createBeamEntry(options, plan, new Set());
    if (!entry) {
      continue;
    }
    addCompletedCandidate(completed, options, entry.plan, targetTurnCount);
    frontier.push(entry);
  }

  frontier = rankBeamEntries(frontier).slice(0, beamWidth);

  while (frontier.length > 0) {
    const nextFrontier: BeamSearchEntry[] = [];

    for (const entry of frontier) {
      const currentTurn = entry.plan.turns.at(-1);
      if (!currentTurn) {
        continue;
      }

      if (currentTurn.actions.length > 0 && entry.plan.turns.length < targetTurnCount) {
        nextFrontier.push({
          plan: {
            turns: [
              ...entry.plan.turns.map(cloneTurnPlan),
              { actions: [] },
            ],
          },
          result: entry.result,
          seenStateKeys: new Set(entry.seenStateKeys),
        });
      }

      if (maxActionsPerTurn !== undefined && currentTurn.actions.length >= maxActionsPerTurn) {
        continue;
      }

      for (const action of searchActions) {
        const plan = appendActionToPlan(entry.plan, cloneAction(action));
        const nextEntry = createBeamEntry(options, plan, entry.seenStateKeys);
        if (!nextEntry) {
          continue;
        }

        addCompletedCandidate(completed, options, nextEntry.plan, targetTurnCount);
        nextFrontier.push(nextEntry);
      }
    }

    frontier = rankBeamEntries(dedupeBeamEntries(nextFrontier)).slice(0, beamWidth);
  }

  return [...completed.values()].sort(compareOptimizerResults);
}

function createOptimizerResult(options: ComboOptimizerOptions, plan: ComboPlan): ComboOptimizerResult | null {
  const simulation = simulateValidCombo(options, plan);
  if (!simulation) {
    return null;
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
    return null;
  }

  return {
    plan,
    simulation,
    score: options.requireSustainableCycle
      ? scoreSustainableComboSimulation(simulation, options.character, options.criterion)
      : scoreComboSimulation(simulation, options.criterion),
    sustainability,
  };
}

function createScoredOptimizerResult(options: ComboOptimizerOptions, plan: ComboPlan): ComboOptimizerResult | null {
  const simulation = simulateValidCombo(options, plan);
  if (!simulation) {
    return null;
  }

  return {
    plan,
    simulation,
    score: scoreComboSimulation(simulation, options.criterion),
    sustainability: {
      required: false,
      sustainable: true,
    },
  };
}

function createBeamEntry(
  options: ComboOptimizerOptions,
  plan: ComboPlan,
  previousStateKeys: Set<string>,
): BeamSearchEntry | null {
  const candidate = createScoredOptimizerResult(options, plan);
  if (!candidate) {
    return null;
  }

  const action = getLastActionResult(candidate.simulation);
  if (!action) {
    return null;
  }

  const turnIndex = plan.turns.length - 1;
  const beforeStateKey = createActionStateKey(action, turnIndex, "before");
  const afterStateKey = createActionStateKey(action, turnIndex, "after");
  const seenStateKeys = new Set(previousStateKeys);
  if (seenStateKeys.size === 0) {
    seenStateKeys.add(beforeStateKey);
  }

  if (action.damage === 0 && beforeStateKey === afterStateKey) {
    return null;
  }

  if (
    action.damage === 0
    && computeActionResourceUse(action) === 0
    && hasAlreadyCastSpellInCurrentTurn(plan, action.spellId)
  ) {
    return null;
  }

  if (seenStateKeys.has(afterStateKey)) {
    return null;
  }

  return {
    plan: candidate.plan,
    result: candidate,
    seenStateKeys: new Set([...seenStateKeys, afterStateKey]),
  };
}

function simulateValidCombo(options: ComboOptimizerOptions, plan: ComboPlan): ComboSimulationResult | null {
  const simulation = simulateCombo({
    catalog: options.catalog,
    character: options.character,
    combo: plan,
    defaultActionContext: options.defaultActionContext,
  });

  return simulation.valid ? simulation : null;
}

function addCompletedCandidate(
  completed: Map<string, ComboOptimizerResult>,
  options: ComboOptimizerOptions,
  plan: ComboPlan,
  targetTurnCount: number,
) {
  if (plan.turns.length !== targetTurnCount) {
    return;
  }

  if (plan.turns.some((turn) => turn.actions.length === 0)) {
    return;
  }

  const candidate = createOptimizerResult(options, plan);
  if (!candidate) {
    return;
  }

  completed.set(serializePlan(candidate.plan), candidate);
}

function appendActionToPlan(plan: ComboPlan, action: Action): ComboPlan {
  return {
    turns: plan.turns.map((turn, index) => index === plan.turns.length - 1
      ? { actions: [...turn.actions.map(cloneAction), cloneAction(action)] }
      : cloneTurnPlan(turn)),
  };
}

function rankBeamEntries(entries: BeamSearchEntry[]): BeamSearchEntry[] {
  return entries.sort((left, right) => compareOptimizerResults(left.result, right.result));
}

function dedupeBeamEntries(entries: BeamSearchEntry[]): BeamSearchEntry[] {
  const entriesByPlan = new Map<string, BeamSearchEntry>();
  for (const entry of entries) {
    entriesByPlan.set(serializePlan(entry.plan), entry);
  }
  return [...entriesByPlan.values()];
}

function hasAlreadyCastSpellInCurrentTurn(plan: ComboPlan, spellId: string): boolean {
  const currentTurn = plan.turns.at(-1);
  if (!currentTurn) {
    return false;
  }

  return currentTurn.actions.slice(0, -1).some((action) => action.spellId === spellId);
}

function getLastActionResult(simulation: ComboSimulationResult): ActionResult | undefined {
  return simulation.turns.at(-1)?.result.breakdown.at(-1);
}

function createActionStateKey(action: ActionResult, turnIndex: number, side: "before" | "after"): string {
  return JSON.stringify({
    turnIndex,
    resources: side === "before" ? action.resourceBefore : action.resourceAfter,
    classState: createLoopDetectionClassState(side === "before" ? action.classStateBefore : action.classStateAfter),
    stats: side === "before" ? action.statsBefore : action.statsAfter,
  });
}

function createLoopDetectionClassState(classState: ClassTurnState): ClassTurnState {
  if (!classState.huppermage) {
    return classState;
  }

  const { usedSpellIds: _usedSpellIds, ...huppermage } = classState.huppermage;
  return {
    ...classState,
    huppermage: {
      ...huppermage,
      usedSpellIds: [],
    },
  };
}

function generateTurnPlans(searchActions: Action[], maxActionsPerTurn: number): Array<{ actions: Action[] }> {
  const plans: Array<{ actions: Action[] }> = [];

  for (let actionCount = 1; actionCount <= maxActionsPerTurn; actionCount += 1) {
    for (const actions of combineActions(searchActions, actionCount)) {
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

function combineActions(searchActions: Action[], actionCount: number): Action[][] {
  if (actionCount === 0) {
    return [[]];
  }

  const tails = combineActions(searchActions, actionCount - 1);
  return searchActions.flatMap((action) => tails.map((tail) => [cloneAction(action), ...tail.map(cloneAction)]));
}

function getSearchSpellIds(options: ComboOptimizerOptions): string[] {
  const spellIds = options.availableSpellIds
    ?? options.catalog.filter((entry) => entry.kind === "spell").map((entry) => entry.id);

  return [...new Set(spellIds)].sort();
}

function getSearchActions(options: ComboOptimizerOptions): Action[] {
  const entriesById = new Map(options.catalog.map((entry) => [entry.id, entry]));
  return getSearchSpellIds(options).flatMap((spellId) => {
    const actions: Action[] = [{ spellId }];
    const entry = entriesById.get(spellId);
    if (entry?.constraints.some((constraint) => constraint.type === "maxCastsPerTarget")) {
      actions.push({ spellId, target: { kind: "emptyCell" } });
    }
    return actions;
  });
}

function cloneTurnPlan(turnPlan: { actions: Action[] }): { actions: Action[] } {
  return {
    actions: turnPlan.actions.map(cloneAction),
  };
}

function cloneAction(action: Action): Action {
  return {
    ...action,
    target: action.target ? { ...action.target } : undefined,
    context: action.context ? { ...action.context } : undefined,
  };
}

function compareOptimizerResults(left: ComboOptimizerResult, right: ComboOptimizerResult): number {
  const scoreDifference = right.score.score - left.score.score;
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const resourceUseDifference = computeResourceUse(right) - computeResourceUse(left);
  if (resourceUseDifference !== 0) {
    return resourceUseDifference;
  }

  return serializePlan(left.plan).localeCompare(serializePlan(right.plan));
}

function computeResourceUse(result: ComboOptimizerResult): number {
  return result.simulation.turns.reduce((total, turn) => (
    total + turn.result.breakdown.reduce((turnTotal, action) => (
      turnTotal + computeActionResourceUse(action)
    ), 0)
  ), 0);
}

function computeActionResourceUse(action: ActionResult): number {
  return Math.max(0, action.resourceBefore.ap - action.resourceAfter.ap)
    + Math.max(0, action.resourceBefore.mp - action.resourceAfter.mp)
    + Math.max(0, action.resourceBefore.wp - action.resourceAfter.wp)
    + Math.max(0, action.resourceBefore.bq - action.resourceAfter.bq);
}

function serializePlan(plan: ComboPlan): string {
  return plan.turns.map((turn) => turn.actions.map(serializeAction).join(",")).join("|");
}

function serializeAction(action: Action): string {
  return action.target ? `${action.spellId}@${action.target.kind}` : action.spellId;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function createReplayCharacter(baseCharacter: SimulatedCharacter, previousFinalState: TurnState): SimulatedCharacter {
  const previousResources = previousFinalState.remainingResources;
  return {
    ...baseCharacter,
    resources: {
      ...baseCharacter.resources,
      ap: baseCharacter.resources.ap + (previousFinalState.resourceCarryover.ap ?? 0),
      mp: baseCharacter.resources.mp + (previousFinalState.resourceCarryover.mp ?? 0),
      wp: previousResources.wp - computeActiveInitialSublimationResourceDelta(baseCharacter, "wp"),
      bq: previousResources.bq,
    },
    stats: cloneStats(baseCharacter.stats),
    sublimations: baseCharacter.sublimations
      ? {
        ...baseCharacter.sublimations,
        selections: baseCharacter.sublimations.selections.map((selection) => ({ ...selection })),
      }
      : undefined,
    classState: createReplayClassState(previousFinalState),
  };
}

function createReplayClassState(previousFinalState: TurnState): SimulatedCharacter["classState"] {
  const previousClassState = previousFinalState.classState;
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
      cooldownsBySpellId: ageCooldowns(huppermage.cooldownsBySpellId, previousFinalState.castsBySpellId),
      deckSpellLimit: huppermage.deckSpellLimit,
      passiveLimit: huppermage.passiveLimit,
    },
  };
}

function ageCooldowns(cooldownsBySpellId: Record<string, number>, castsBySpellId: Record<string, number>): Record<string, number> {
  const nextCooldowns: Record<string, number> = {};

  for (const [spellId, cooldownRemaining] of Object.entries(cooldownsBySpellId)) {
    const nextCooldown = castsBySpellId[spellId] ? cooldownRemaining : cooldownRemaining - 1;
    if (nextCooldown > 0) {
      nextCooldowns[spellId] = nextCooldown;
    }
  }

  return nextCooldowns;
}

function cloneStats(stats: BaseStats): BaseStats {
  return {
    ...stats,
    elementalMastery: { ...stats.elementalMastery },
  };
}
