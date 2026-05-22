import type { Effect, Element, Rune, StatModifierEffect } from "../catalog/types.ts";
import { computeRawDamage, resolveActionContext, roundDamage } from "./damage.ts";
import { addResource, cloneResources, payCost } from "./resources.ts";
import { findSpell, validateSpellAction } from "./validation.ts";
import type {
  ActionContext,
  ActionResult,
  AppliedEffect,
  BaseStats,
  ClassTurnState,
  HuppermageHeart,
  HuppermageRuneState,
  HuppermageWaterHeartSpellKind,
  SimulationOptions,
  SimulationResult,
  TurnState,
} from "./types.ts";

const RUNE_APPLICATION_ORDER: Rune[] = ["incandescent", "aquatic", "telluric", "aerial"];
const SAUVEGARDE_RUNIQUE_PASSIVE_ID = "sauvegarde-runique";
const EXTENSION_DES_SENS_PASSIVE_ID = "extension-des-sens";

export function simulateTurn(options: SimulationOptions): SimulationResult {
  let state = createInitialTurnState(options.character);

  for (const [actionIndex, action] of options.sequence.actions.entries()) {
    const spell = findSpell(options.catalog, action.spellId);
    const violation = validateSpellAction({
      spell,
      spellId: action.spellId,
      actionIndex,
      state,
    }) ?? validateHuppermageClassAction(spell, action, actionIndex, state);

    if (violation || !spell) {
      return {
        valid: false,
        sequence: options.sequence,
        totalDamage: state.totalDamage,
        finalState: state,
        breakdown: state.actionLog,
        violations: violation ? [violation] : [],
      };
    }

    const resourceBefore = cloneResources(state.remainingResources);
    const classStateBefore = cloneClassState(state.classState);
    let nextResources = payCost(state.remainingResources, spell.cost);
    let nextStats = cloneStats(state.currentStats);
    let nextClassState = cloneClassState(state.classState);
    const actionContext = resolveActionContext({
      ...options.defaultActionContext,
      ...action.context,
    });
    const appliedEffects: AppliedEffect[] = [];
    let actionDamage = 0;

    for (const effect of spell.effects) {
      const effectApplication = applySupportedEffect(effect, nextStats, nextResources, actionContext);
      nextResources = effectApplication.resources;
      nextStats = effectApplication.stats;
      actionDamage = roundDamage(actionDamage + effectApplication.damage);
      appliedEffects.push(...effectApplication.appliedEffects);
    }

    const extensionApplication = applyExtensionDesSens(spell, nextClassState, nextResources);
    nextResources = extensionApplication.resources;
    nextClassState = extensionApplication.classState;
    appliedEffects.push(...extensionApplication.appliedEffects);

    const generatedRune = getGeneratedRuneFromElement(spell.element);
    if (generatedRune) {
      const previousHuppermageState = getHuppermageState(nextClassState);
      const before = previousHuppermageState.runes.active[generatedRune];
      nextClassState = {
        ...nextClassState,
        huppermage: {
          ...previousHuppermageState,
          runes: {
            active: {
              ...previousHuppermageState.runes.active,
              [generatedRune]: true,
            },
            lastGeneratedRune: generatedRune,
          },
        },
      };
      appliedEffects.push({
        type: "runeGenerated",
        rune: generatedRune,
        before,
        after: true,
        source: "elementalSpellCast",
      });
    }

    const feuFolletApplication = applyFeuFolletAction(spell, action, nextClassState);
    nextClassState = feuFolletApplication.classState;
    appliedEffects.push(...feuFolletApplication.appliedEffects);

    const actionResult: ActionResult = {
      actionIndex,
      spellId: spell.id,
      spellName: spell.name,
      damage: actionDamage,
      resourceBefore,
      resourceAfter: cloneResources(nextResources),
      classStateBefore,
      classStateAfter: cloneClassState(nextClassState),
      appliedEffects,
    };

    state = {
      remainingResources: nextResources,
      classState: nextClassState,
      currentStats: nextStats,
      castsBySpellId: {
        ...state.castsBySpellId,
        [spell.id]: (state.castsBySpellId[spell.id] ?? 0) + 1,
      },
      totalDamage: roundDamage(state.totalDamage + actionDamage),
      actionLog: [...state.actionLog, actionResult],
    };
  }

  return {
    valid: true,
    sequence: options.sequence,
    totalDamage: state.totalDamage,
    finalState: state,
    breakdown: state.actionLog,
    violations: [],
  };
}

function createInitialTurnState(character: SimulationOptions["character"]): TurnState {
  return {
    remainingResources: cloneResources(character.resources),
    classState: createClassState(character),
    currentStats: cloneStats(character.stats),
    castsBySpellId: {},
    totalDamage: 0,
    actionLog: [],
  };
}

function createClassState(character: SimulationOptions["character"]): ClassTurnState {
  if (character.className !== "huppermage") {
    return {};
  }

  return {
    huppermage: {
      runes: createHuppermageRuneState(
        character.classState?.huppermage?.runes,
        character.classState?.huppermage?.lastGeneratedRune,
      ),
      feuFolletsActive: character.classState?.huppermage?.feuFolletsActive ?? 0,
      feuFolletStoredRunes: normalizeFeuFolletStoredRunes(
        character.classState?.huppermage?.feuFolletsActive ?? 0,
        character.classState?.huppermage?.feuFolletStoredRunes,
      ),
      activePassives: character.classState?.huppermage?.activePassives ?? [],
      activeHeart: character.classState?.huppermage?.activeHeart ?? null,
      waterHeartLastSpellKind: character.classState?.huppermage?.waterHeartLastSpellKind ?? null,
    },
  };
}

function createHuppermageRuneState(
  runes: Partial<Record<Rune, boolean>> = {},
  lastGeneratedRune: Rune | null = null,
): HuppermageRuneState {
  return {
    active: {
      incandescent: runes.incandescent ?? false,
      aquatic: runes.aquatic ?? false,
      telluric: runes.telluric ?? false,
      aerial: runes.aerial ?? false,
    },
    lastGeneratedRune,
  };
}

function getHuppermageState(classState: ClassTurnState): NonNullable<ClassTurnState["huppermage"]> {
  return classState.huppermage ?? {
    runes: createHuppermageRuneState(),
    feuFolletsActive: 0,
    feuFolletStoredRunes: [],
    activePassives: [],
    activeHeart: null,
    waterHeartLastSpellKind: null,
  };
}

function cloneClassState(classState: ClassTurnState): ClassTurnState {
  return {
    huppermage: classState.huppermage
        ? {
          runes: cloneHuppermageRuneState(classState.huppermage.runes),
          feuFolletsActive: classState.huppermage.feuFolletsActive,
          feuFolletStoredRunes: classState.huppermage.feuFolletStoredRunes.map((storedRunes) => [...storedRunes]),
          activePassives: [...classState.huppermage.activePassives],
          activeHeart: classState.huppermage.activeHeart,
          waterHeartLastSpellKind: classState.huppermage.waterHeartLastSpellKind,
        }
      : undefined,
  };
}

function cloneHuppermageRuneState(runes: HuppermageRuneState): HuppermageRuneState {
  return {
    active: { ...runes.active },
    lastGeneratedRune: runes.lastGeneratedRune,
  };
}

function getGeneratedRuneFromElement(element: Element | undefined): Rune | undefined {
  if (element === "fire") {
    return "incandescent";
  }

  if (element === "water") {
    return "aquatic";
  }

  if (element === "earth") {
    return "telluric";
  }

  if (element === "air") {
    return "aerial";
  }

  return undefined;
}

function validateHuppermageClassAction(
  spell: ReturnType<typeof findSpell>,
  action: SimulationOptions["sequence"]["actions"][number],
  actionIndex: number,
  state: TurnState,
) {
  if (!spell || !isFeuFolletSpell(spell) || action.target?.kind !== "feuFollet") {
    return undefined;
  }

  const feuFolletsActive = getHuppermageState(state.classState).feuFolletsActive;
  if (feuFolletsActive <= 0) {
    return {
      type: "invalidClassStateAction" as const,
      actionIndex,
      spellId: spell.id,
      message: `Spell '${spell.id}' cannot recover a Feu-Follet because none is active.`,
      source: spell.metadata.sources[0],
    };
  }

  return undefined;
}

function applyFeuFolletAction(
  spell: ReturnType<typeof findSpell>,
  action: SimulationOptions["sequence"]["actions"][number],
  classState: ClassTurnState,
): { classState: ClassTurnState; appliedEffects: AppliedEffect[] } {
  if (!spell || !isFeuFolletSpell(spell)) {
    return { classState, appliedEffects: [] };
  }

  const targetKind = action.target?.kind;
  if (targetKind !== "emptyCell" && targetKind !== "feuFollet") {
    return { classState, appliedEffects: [] };
  }

  const previousHuppermageState = getHuppermageState(classState);
  const before = previousHuppermageState.feuFolletsActive;
  const after = targetKind === "emptyCell" ? before + 1 : Math.max(0, before - 1);
  const operation = targetKind === "emptyCell" ? "placed" : "recovered";
  const appliedEffects: AppliedEffect[] = [
    {
      type: "feuFolletChanged",
      operation,
      before,
      after,
      source: "huppermageClassMechanic",
    },
  ];

  let runes = previousHuppermageState.runes;
  let feuFolletStoredRunes = [...previousHuppermageState.feuFolletStoredRunes.map((storedRunes) => [...storedRunes])];

  if (targetKind === "emptyCell") {
    const storedRunes = getSauvegardeRuniqueStoredRunes(previousHuppermageState);
    feuFolletStoredRunes = [...feuFolletStoredRunes, storedRunes];
    if (storedRunes.length > 0) {
      appliedEffects.push({
        type: "feuFolletRunesStored",
        runes: storedRunes,
        source: "sauvegardeRuniquePassive",
      });
    }
  }

  if (targetKind === "feuFollet") {
    const [recoveredRunes = [], ...remainingStoredRunes] = feuFolletStoredRunes;
    feuFolletStoredRunes = remainingStoredRunes;
    if (recoveredRunes.length > 0) {
      const lastGeneratedRuneBefore = runes.lastGeneratedRune;
      runes = applyRecoveredRunes(runes, recoveredRunes);
      appliedEffects.push({
        type: "feuFolletRunesRecovered",
        runes: sortRunesForApplication(recoveredRunes),
        lastGeneratedRuneBefore,
        lastGeneratedRuneAfter: runes.lastGeneratedRune,
        source: "sauvegardeRuniquePassive",
      });
    }
  }

  return {
    classState: {
      ...classState,
      huppermage: {
        ...previousHuppermageState,
        runes,
        feuFolletsActive: after,
        feuFolletStoredRunes,
      },
    },
    appliedEffects,
  };
}

function isFeuFolletSpell(spell: NonNullable<ReturnType<typeof findSpell>>): boolean {
  return spell.id === "feu-follet" || spell.tags.includes("feu-follet");
}

function normalizeFeuFolletStoredRunes(feuFolletsActive: number, storedRunes: Rune[][] = []): Rune[][] {
  return Array.from({ length: feuFolletsActive }, (_, index) => storedRunes[index] ? [...storedRunes[index]] : []);
}

function getSauvegardeRuniqueStoredRunes(huppermageState: NonNullable<ClassTurnState["huppermage"]>): Rune[] {
  if (!huppermageState.activePassives.includes(SAUVEGARDE_RUNIQUE_PASSIVE_ID)) {
    return [];
  }

  const activeRunes = RUNE_APPLICATION_ORDER.filter((rune) => huppermageState.runes.active[rune]);
  if (activeRunes.length !== 1) {
    return [];
  }

  return RUNE_APPLICATION_ORDER.filter((rune) => rune !== activeRunes[0]);
}

function applyRecoveredRunes(runes: HuppermageRuneState, recoveredRunes: Rune[]): HuppermageRuneState {
  const sortedRunes = sortRunesForApplication(recoveredRunes);
  if (sortedRunes.length === 0) {
    return runes;
  }

  return {
    active: sortedRunes.reduce(
      (active, rune) => ({
        ...active,
        [rune]: true,
      }),
      { ...runes.active },
    ),
    lastGeneratedRune: sortedRunes.at(-1) ?? runes.lastGeneratedRune,
  };
}

function sortRunesForApplication(runes: Rune[]): Rune[] {
  return RUNE_APPLICATION_ORDER.filter((rune) => runes.includes(rune));
}

function applyExtensionDesSens(
  spell: NonNullable<ReturnType<typeof findSpell>>,
  classState: ClassTurnState,
  resources: TurnState["remainingResources"],
): { classState: ClassTurnState; resources: TurnState["remainingResources"]; appliedEffects: AppliedEffect[] } {
  const huppermageState = getHuppermageState(classState);
  if (!huppermageState.activePassives.includes(EXTENSION_DES_SENS_PASSIVE_ID) || !huppermageState.activeHeart) {
    return { classState, resources, appliedEffects: [] };
  }

  const apCost = spell.cost?.ap ?? 0;
  const regeneration = getExtensionDesSensRegeneration(spell, huppermageState.activeHeart, huppermageState, apCost);
  const nextHuppermageState = {
    ...huppermageState,
    waterHeartLastSpellKind: regeneration.waterHeartLastSpellKind,
  };
  const nextClassState = {
    ...classState,
    huppermage: nextHuppermageState,
  };

  if (regeneration.amount <= 0) {
    return { classState: nextClassState, resources, appliedEffects: [] };
  }

  const before = resources.bq;
  const nextResources = addResource(resources, "bq", regeneration.amount);

  return {
    classState: nextClassState,
    resources: nextResources,
    appliedEffects: [
      {
        type: "bqRegeneration",
        amount: regeneration.amount,
        before,
        after: nextResources.bq,
        source: "extensionDesSensPassive",
        heart: huppermageState.activeHeart,
        triggerCount: regeneration.triggerCount,
      },
    ],
  };
}

function getExtensionDesSensRegeneration(
  spell: NonNullable<ReturnType<typeof findSpell>>,
  heart: HuppermageHeart,
  huppermageState: NonNullable<ClassTurnState["huppermage"]>,
  apCost: number,
): { amount: number; triggerCount: number; waterHeartLastSpellKind: HuppermageWaterHeartSpellKind | null } {
  if (heart === "fire") {
    const triggerCount = isElementalSpell(spell.element) ? 1 : 0;
    return {
      amount: triggerCount * apCost * 20,
      triggerCount,
      waterHeartLastSpellKind: huppermageState.waterHeartLastSpellKind,
    };
  }

  if (heart === "earth") {
    const triggerCount = apCost > 0 ? 1 : 0;
    return {
      amount: triggerCount * apCost * 20,
      triggerCount,
      waterHeartLastSpellKind: huppermageState.waterHeartLastSpellKind,
    };
  }

  if (heart === "air") {
    const triggerCount = countMovementEvents(spell.effects, huppermageState);
    return {
      amount: triggerCount * apCost * 20,
      triggerCount,
      waterHeartLastSpellKind: huppermageState.waterHeartLastSpellKind,
    };
  }

  const currentSpellKind = getWaterHeartSpellKind(spell.element);
  const triggerCount = currentSpellKind && huppermageState.waterHeartLastSpellKind !== null
    && currentSpellKind !== huppermageState.waterHeartLastSpellKind
    ? 1
    : 0;

  return {
    amount: triggerCount * apCost * 20,
    triggerCount,
    waterHeartLastSpellKind: currentSpellKind,
  };
}

function isElementalSpell(element: Element | undefined): boolean {
  return element === "fire" || element === "water" || element === "earth" || element === "air";
}

function getWaterHeartSpellKind(element: Element | undefined): HuppermageWaterHeartSpellKind | null {
  if (element === "light") {
    return "light";
  }

  if (isElementalSpell(element)) {
    return "elemental";
  }

  return null;
}

function countMovementEvents(effects: Effect[], huppermageState: NonNullable<ClassTurnState["huppermage"]>): number {
  return effects.reduce((count, effect) => {
    if (effect.type === "movement") {
      return count + 1;
    }

    if (effect.type === "conditional" && isConditionMet(effect.condition, huppermageState)) {
      return count + countMovementEvents(effect.effects, huppermageState);
    }

    if (effect.type === "trigger") {
      return count + countMovementEvents(effect.effects, huppermageState);
    }

    return count;
  }, 0);
}

function isConditionMet(
  condition: Extract<Effect, { type: "conditional" }>["condition"],
  huppermageState: NonNullable<ClassTurnState["huppermage"]>,
): boolean {
  if (condition.type === "hasRune") {
    return huppermageState.runes.active[condition.rune];
  }

  if (condition.type === "lastRune") {
    return huppermageState.runes.lastGeneratedRune === condition.rune;
  }

  if (condition.type === "exactRuneCount") {
    return RUNE_APPLICATION_ORDER.filter((rune) => huppermageState.runes.active[rune]).length === condition.count;
  }

  if (condition.type === "hasAllRunes") {
    return RUNE_APPLICATION_ORDER.every((rune) => huppermageState.runes.active[rune]);
  }

  return false;
}

function applySupportedEffect(
  effect: Effect,
  stats: SimulationOptions["character"]["stats"],
  resources: TurnState["remainingResources"],
  context: ActionContext,
): {
  resources: TurnState["remainingResources"];
  stats: BaseStats;
  damage: number;
  appliedEffects: AppliedEffect[];
} {
  if (effect.type === "damage") {
    const formula = computeRawDamage(stats, effect, context);
    return {
      resources,
      stats,
      damage: formula.result,
      appliedEffects: [
        {
          type: "damage",
          amount: formula.result,
          element: effect.element,
          source: "spellEffect",
          formula,
        },
      ],
    };
  }

  if (effect.type === "resourceDelta") {
    const before = resources[effect.resource];
    const nextResources = addResource(resources, effect.resource, effect.amount);
    return {
      resources: nextResources,
      stats,
      damage: 0,
      appliedEffects: [
        {
          type: "resourceDelta",
          resource: effect.resource,
          amount: effect.amount,
          before,
          after: nextResources[effect.resource],
          source: "spellEffect",
        },
      ],
    };
  }

  if (effect.type === "statModifier") {
    const modification = applyStatModifier(stats, effect);
    if (!modification) {
      return {
        resources,
        stats,
        damage: 0,
        appliedEffects: [],
      };
    }

    return {
      resources,
      stats: modification.stats,
      damage: 0,
      appliedEffects: [
        {
          type: "statModifier",
          stat: effect.stat,
          amount: effect.amount,
          before: modification.before,
          after: modification.after,
          source: "spellEffect",
        },
      ],
    };
  }

  return {
    resources,
    stats,
    damage: 0,
    appliedEffects: [],
  };
}

function cloneStats(stats: BaseStats): BaseStats {
  return {
    ...stats,
    elementalMastery: { ...stats.elementalMastery },
  };
}

function applyStatModifier(
  stats: BaseStats,
  effect: StatModifierEffect,
): { stats: BaseStats; before: number; after: number } | undefined {
  if (effect.target && effect.target !== "caster") {
    return undefined;
  }

  if (effect.stat === "damageInflictedPercent") {
    const before = stats.damageInflictedPercent;
    const after = before + effect.amount;
    return {
      stats: { ...stats, damageInflictedPercent: after },
      before,
      after,
    };
  }

  if (effect.stat === "healsPerformedPercent") {
    const before = stats.healsPerformedPercent ?? 0;
    const after = before + effect.amount;
    return {
      stats: { ...stats, healsPerformedPercent: after },
      before,
      after,
    };
  }

  if (effect.stat === "elementalMastery" && effect.element) {
    const before = stats.elementalMastery[effect.element] ?? 0;
    const after = before + effect.amount;
    return {
      stats: {
        ...stats,
        elementalMastery: {
          ...stats.elementalMastery,
          [effect.element]: after,
        },
      },
      before,
      after,
    };
  }

  return undefined;
}
