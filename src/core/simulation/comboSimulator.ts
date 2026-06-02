import type {
  BaseStats,
  ClassTurnState,
  ComboSimulationOptions,
  ComboSimulationResult,
  ResourcePool,
  SimulatedCharacter,
  TurnState,
} from "./types.ts";
import { simulateTurn } from "./simulator.ts";
import { computeActiveInitialSublimationResourceDelta } from "./sublimationResourceDeltas.ts";

export function simulateCombo(options: ComboSimulationOptions): ComboSimulationResult {
  const turns = [];
  let turnCharacter = cloneCharacter(options.character);
  let totalDamage = 0;
  let finalState: TurnState | undefined;

  for (const [turnIndex, turn] of options.combo.turns.entries()) {
    const result = simulateTurn({
      catalog: options.catalog,
      character: turnCharacter,
      sequence: { actions: turn.actions },
      defaultActionContext: options.defaultActionContext,
      includeTurnEnd: true,
    });

    turns.push({
      turnIndex,
      initialCharacter: cloneCharacter(turnCharacter),
      result,
    });
    totalDamage = roundComboDamage(totalDamage + result.totalDamage);
    finalState = result.finalState;

    if (!result.valid) {
      return {
        valid: false,
        combo: options.combo,
        turns,
        totalDamage,
        finalState,
        violations: result.violations.map((violation) => ({ ...violation, turnIndex })),
      };
    }

    turnCharacter = createNextTurnCharacter(options.character, result.finalState);
  }

  const emptyResult = turns.length === 0
    ? simulateTurn({
      catalog: options.catalog,
      character: options.character,
      sequence: { actions: [] },
      defaultActionContext: options.defaultActionContext,
      includeTurnEnd: false,
    })
    : undefined;

  return {
    valid: true,
    combo: options.combo,
    turns,
    totalDamage,
    finalState: finalState ?? emptyResult!.finalState,
    violations: [],
  };
}

function createNextTurnCharacter(baseCharacter: SimulatedCharacter, previousFinalState: TurnState): SimulatedCharacter {
  const previousResources = previousFinalState.remainingResources;
  const resources: ResourcePool = {
    ...baseCharacter.resources,
    ap: baseCharacter.resources.ap + (previousFinalState.resourceCarryover.ap ?? 0),
    mp: baseCharacter.resources.mp + (previousFinalState.resourceCarryover.mp ?? 0),
    wp: previousResources.wp - computeActiveInitialSublimationResourceDelta(baseCharacter, "wp"),
    bq: previousResources.bq,
  };

  return {
    ...baseCharacter,
    resources,
    stats: cloneStats(baseCharacter.stats),
    sublimationElementalCarryover: { ...previousFinalState.sublimationElementalCarryover },
    sublimationSpellCountCarryover: cloneSpellCountCarryover(previousFinalState.sublimationSpellCountCarryover),
    sublimationAlternancePreviousElement: previousFinalState.sublimationAlternancePreviousElement,
    sublimationSpentResourcesThisTurn: {},
    classState: createNextClassState(previousFinalState),
  };
}

function createNextClassState(previousFinalState: TurnState): SimulatedCharacter["classState"] {
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

function cloneCharacter(character: SimulatedCharacter): SimulatedCharacter {
  const huppermage = character.classState?.huppermage;
  return {
    ...character,
    resources: { ...character.resources },
    stats: cloneStats(character.stats),
    sublimations: character.sublimations
      ? {
        ...character.sublimations,
        selections: character.sublimations.selections.map((selection) => ({ ...selection })),
      }
      : undefined,
    sublimationElementalCarryover: character.sublimationElementalCarryover
      ? { ...character.sublimationElementalCarryover }
      : undefined,
    sublimationSpellCountCarryover: character.sublimationSpellCountCarryover
      ? cloneSpellCountCarryover(character.sublimationSpellCountCarryover)
      : undefined,
    sublimationAlternancePreviousElement: character.sublimationAlternancePreviousElement ?? undefined,
    sublimationSpentResourcesThisTurn: character.sublimationSpentResourcesThisTurn
      ? { ...character.sublimationSpentResourcesThisTurn }
      : undefined,
    classState: huppermage
      ? {
        huppermage: {
          ...huppermage,
          runes: huppermage.runes ? { ...huppermage.runes } : undefined,
          runeApGainsThisTurn: huppermage.runeApGainsThisTurn ? { ...huppermage.runeApGainsThisTurn } : undefined,
          feuFolletStoredRunes: huppermage.feuFolletStoredRunes?.map((storedRunes) => [...storedRunes]),
          feuFolletStoredLastRunes: huppermage.feuFolletStoredLastRunes ? [...huppermage.feuFolletStoredLastRunes] : undefined,
          usedSpellIds: huppermage.usedSpellIds ? [...huppermage.usedSpellIds] : undefined,
          activePassives: huppermage.activePassives ? [...huppermage.activePassives] : undefined,
          cooldownsBySpellId: huppermage.cooldownsBySpellId ? { ...huppermage.cooldownsBySpellId } : undefined,
        },
      }
      : character.classState,
  };
}

function cloneSpellCountCarryover(
  carryover: NonNullable<SimulatedCharacter["sublimationSpellCountCarryover"]>,
): NonNullable<SimulatedCharacter["sublimationSpellCountCarryover"]> {
  return Object.fromEntries(
    Object.entries(carryover).map(([familyId, state]) => [familyId, { ...state }]),
  );
}

function cloneStats(stats: BaseStats): BaseStats {
  return {
    ...stats,
    elementalMastery: { ...stats.elementalMastery },
  };
}

function roundComboDamage(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
