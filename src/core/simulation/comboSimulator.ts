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
    ap: baseCharacter.resources.ap,
    mp: baseCharacter.resources.mp,
    wp: previousResources.wp,
    bq: previousResources.bq,
  };

  return {
    ...baseCharacter,
    resources,
    stats: cloneStats(baseCharacter.stats),
    classState: createNextClassState(previousFinalState.classState),
  };
}

function createNextClassState(previousClassState: ClassTurnState): SimulatedCharacter["classState"] {
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

function cloneCharacter(character: SimulatedCharacter): SimulatedCharacter {
  const huppermage = character.classState?.huppermage;
  return {
    ...character,
    resources: { ...character.resources },
    stats: cloneStats(character.stats),
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
        },
      }
      : character.classState,
  };
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
