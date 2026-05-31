import type { CatalogEntry, DamageEffect, Effect, Element, Resource, Rune, SpellCost, StatModifierEffect } from "../catalog/types.ts";
import { validateSublimationBuild } from "../sublimations/validation.ts";
import { computeRawDamage, resolveActionContext, resolveDamageElement, roundDamage } from "./damage.ts";
import {
  addResource,
  cloneResources,
  deriveHuppermageBqFromWp,
  getCostAmount,
  huppermageBqPerWp,
  payCost,
} from "./resources.ts";
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
import type { EffectiveSublimationStack, SublimationCatalogEntry, SublimationEffect } from "../sublimations/types.ts";

const RUNE_APPLICATION_ORDER: Rune[] = ["incandescent", "aquatic", "telluric", "aerial"];
const SAUVEGARDE_RUNIQUE_PASSIVE_ID = "sauvegarde-runique";
const EXTENSION_DES_SENS_PASSIVE_ID = "extension-des-sens";
const REFRACTION_ELEMENTAIRE_PASSIVE_ID = "refraction-elementaire";
const LAST_GENERATED_RUNE_DAMAGE_BONUS_PERCENT = 20;
const DEFAULT_DECK_SPELL_LIMIT = 12;
const DEFAULT_PASSIVE_LIMIT = 6;
const RUNE_TO_HEART: Record<Rune, HuppermageHeart> = {
  incandescent: "fire",
  aquatic: "water",
  telluric: "earth",
  aerial: "air",
};
const RUNE_TO_ELEMENT: Record<Rune, Element> = RUNE_TO_HEART;
const OPPOSITE_RUNE: Record<Rune, Rune> = {
  incandescent: "aquatic",
  aquatic: "incandescent",
  telluric: "aerial",
  aerial: "telluric",
};

type EffectApplicationContext = {
  action: SimulationOptions["sequence"]["actions"][number];
  actionContext: ActionContext;
  classState: ClassTurnState;
  damageInflictedBonusPercent: number;
  resources: TurnState["remainingResources"];
  spell: CatalogEntry;
};

export function simulateTurn(options: SimulationOptions): SimulationResult {
  const sublimationValidation = validateSublimationBuild(options.character.sublimations);
  let state = createInitialTurnState(options.character, options.catalog, sublimationValidation.effectiveStacks);

  if (!sublimationValidation.valid) {
    return {
      valid: false,
      sequence: options.sequence,
      totalDamage: state.totalDamage,
      finalState: state,
      breakdown: state.actionLog,
      violations: sublimationValidation.violations.map((violation) => ({
        type: "invalidSublimation",
        actionIndex: -1,
        spellId: violation.sublimationId,
        message: violation.message,
      })),
    };
  }

  for (const [actionIndex, action] of options.sequence.actions.entries()) {
    const spell = findSpell(options.catalog, action.spellId);
    const effectiveCost = spell ? resolveEffectiveCost(spell, state, action) : undefined;
    const violation = validateSpellAction({
      spell,
      spellId: action.spellId,
      actionIndex,
      state,
      effectiveCost,
      action,
      maxCastsPerTurnOverride: getMaxCastsPerTurnOverride(spell, state),
    }) ?? validateHuppermageClassAction(spell, action, actionIndex, state)
      ?? validateHuppermageDeckAction(spell, actionIndex, state);

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
    const statsBefore = cloneStats(state.currentStats);
    let nextResources = payCost(state.remainingResources, effectiveCost);
    let nextStats = cloneStats(state.currentStats);
    let nextClassState = cloneClassState(state.classState);
    const actionContext = resolveActionContext({
      ...options.defaultActionContext,
      ...action.context,
    });
    const appliedEffects: AppliedEffect[] = [];
    let actionDamage = 0;

    const preparedState = applyPreSpellState(spell, nextStats, nextResources, nextClassState, actionIndex);
    nextStats = preparedState.stats;
    nextResources = preparedState.resources;
    nextClassState = preparedState.classState;
    appliedEffects.push(...preparedState.appliedEffects);

    const cycleElementaireApplication = applyCycleElementaire(spell, nextClassState, nextResources);
    nextClassState = cycleElementaireApplication.classState;
    nextResources = cycleElementaireApplication.resources;
    appliedEffects.push(...cycleElementaireApplication.appliedEffects);

    const damageBonusApplication = resolveSpellDamageBonus(spell, nextResources, nextClassState, action);
    appliedEffects.push(...damageBonusApplication.appliedEffects);
    const sublimationActionApplication = resolveActionSublimationEffects(
      spell,
      sublimationValidation.effectiveStacks,
    );
    appliedEffects.push(...sublimationActionApplication.appliedEffects);

    const effectContext = {
      action,
      actionContext,
      classState: nextClassState,
      damageInflictedBonusPercent: damageBonusApplication.damageInflictedBonusPercent + sublimationActionApplication.damageInflictedBonusPercent,
      resources: nextResources,
      spell,
    };

    for (const effect of spell.effects) {
      const effectApplication = applySupportedEffect(effect, nextStats, nextResources, actionContext, effectContext);
      nextResources = effectApplication.resources;
      nextStats = effectApplication.stats;
      actionDamage = roundDamage(actionDamage + effectApplication.damage);
      appliedEffects.push(...effectApplication.appliedEffects);
    }

    if (spell.id === "orbes-luisants") {
      const abundance = addAbundance(nextClassState, getActiveRuneCount(getHuppermageState(nextClassState)) * 10, "spellEffect");
      nextClassState = abundance.classState;
      appliedEffects.push(...abundance.appliedEffects);
    }

    const spellDamageMechanics = applySpellDamageMechanics(spell, actionDamage, nextStats, nextResources, nextClassState, actionContext, action);
    actionDamage = roundDamage(actionDamage + spellDamageMechanics.damage);
    nextClassState = spellDamageMechanics.classState;
    appliedEffects.push(...spellDamageMechanics.appliedEffects);

    const removalBqApplication = applyAbsorptionQuadramentale(spell, action, nextClassState, nextResources);
    nextResources = removalBqApplication.resources;
    appliedEffects.push(...removalBqApplication.appliedEffects);

    const extensionApplication = applyExtensionDesSens(spell, effectiveCost, nextClassState, nextResources);
    nextResources = extensionApplication.resources;
    nextClassState = extensionApplication.classState;
    appliedEffects.push(...extensionApplication.appliedEffects);

    const generatedRune = getGeneratedRuneFromElement(spell.element);
    const generatedRuneWasActiveBeforeConsumption = generatedRune
      ? getHuppermageState(nextClassState).runes.active[generatedRune]
      : false;

    const runeConsumption = applyRuneConsumption(spell.effects, nextClassState);
    nextClassState = runeConsumption.classState;
    appliedEffects.push(...runeConsumption.appliedEffects);
    if (runeConsumption.consumedRunes.length > 0) {
      const abundance = addAbundance(nextClassState, runeConsumption.consumedRunes.length * 15, "huppermageClassMechanic");
      nextClassState = abundance.classState;
      appliedEffects.push(...abundance.appliedEffects);
    }

    if (generatedRune && !generatedRuneWasActiveBeforeConsumption) {
      const runeGeneration = applyGeneratedRune(nextClassState, nextResources, generatedRune, "elementalSpellCast");
      nextClassState = runeGeneration.classState;
      nextResources = runeGeneration.resources;
      appliedEffects.push(...runeGeneration.appliedEffects);
    }

    const feuFolletApplication = applyFeuFolletAction(spell, action, nextClassState);
    nextClassState = feuFolletApplication.classState;
    appliedEffects.push(...feuFolletApplication.appliedEffects);

    const huppermageAfterAction = getHuppermageState(nextClassState);
    nextClassState = {
      ...nextClassState,
      huppermage: {
        ...huppermageAfterAction,
        cooldownsBySpellId: applySpellCooldown(huppermageAfterAction.cooldownsBySpellId, spell),
        usedSpellIds: addUsedSpellId(huppermageAfterAction.usedSpellIds, spell, huppermageAfterAction),
      },
    };
    const persistentStats = removeActionScopedStatModifiers(nextStats, preparedState.actionScopedStatModifiers);

    const actionResult: ActionResult = {
      actionIndex,
      spellId: spell.id,
      spellName: spell.name,
      damage: actionDamage,
      resourceBefore,
      resourceAfter: cloneResources(nextResources),
      statsBefore,
      statsAfter: cloneStats(persistentStats),
      classStateBefore,
      classStateAfter: cloneClassState(nextClassState),
      appliedEffects,
    };

    state = {
      remainingResources: nextResources,
      classState: nextClassState,
      currentStats: persistentStats,
      castsBySpellId: {
        ...state.castsBySpellId,
        [spell.id]: (state.castsBySpellId[spell.id] ?? 0) + 1,
      },
      targetCastsBySpellId: countsAsTargetCast(action)
        ? {
          ...state.targetCastsBySpellId,
          [spell.id]: (state.targetCastsBySpellId[spell.id] ?? 0) + 1,
        }
        : state.targetCastsBySpellId,
      totalDamage: roundDamage(state.totalDamage + actionDamage),
      actionLog: [...state.actionLog, actionResult],
      turnEndEffects: state.turnEndEffects,
      resourceCarryover: state.resourceCarryover,
    };
  }

  const finalizedState = options.includeTurnEnd
    ? applyTurnEnd(state, sublimationValidation.effectiveStacks)
    : state;

  return {
    valid: true,
    sequence: options.sequence,
    totalDamage: finalizedState.totalDamage,
    finalState: finalizedState,
    breakdown: finalizedState.actionLog,
    violations: [],
  };
}

function createInitialTurnState(
  character: SimulationOptions["character"],
  catalog: CatalogEntry[],
  sublimationStacks: EffectiveSublimationStack[] = [],
): TurnState {
  const initialResources = character.classState?.huppermage?.convertWpToBq
    ? addResource(character.resources, "bq", character.resources.wp * huppermageBqPerWp)
    : cloneResources(character.resources);
  const baseClassState = createClassState({ ...character, resources: initialResources });
  const initialPassiveState = applyInitialPassives(
    catalog,
    getHuppermageState(baseClassState).activePassives,
    cloneStats(character.stats),
    initialResources,
  );

  const initialSublimationState = applyInitialSublimations(
    initialPassiveState.stats,
    initialPassiveState.resources,
    sublimationStacks,
  );

  return {
    remainingResources: initialSublimationState.resources,
    classState: baseClassState,
    currentStats: initialSublimationState.stats,
    castsBySpellId: {},
    targetCastsBySpellId: {},
    totalDamage: 0,
    actionLog: [],
    turnEndEffects: [],
    resourceCarryover: {},
  };
}

function applyTurnEnd(state: TurnState, sublimationStacks: EffectiveSublimationStack[] = []): TurnState {
  const huppermageState = getHuppermageState(state.classState);
  if (!state.classState.huppermage) {
    return state;
  }

  const before = state.remainingResources.bq;
  const storedBefore = huppermageState.storedBq;
  let nextResources = state.remainingResources;
  let nextHuppermageState = huppermageState;
  let nextStats = state.currentStats;
  let nextClassState = state.classState;
  let amount = 0;
  const activeRuneCount = getActiveRuneCount(huppermageState);
  const activeRunes = { ...huppermageState.runes.active };

  if (huppermageState.activeHeart) {
    nextHuppermageState = {
      ...huppermageState,
      storedBq: huppermageState.storedBq + 75,
    };
  } else {
    amount = applyBqGainMultiplier(100 + huppermageState.storedBq, huppermageState);
    nextResources = addResource(state.remainingResources, "bq", amount);
    nextHuppermageState = {
      ...huppermageState,
      storedBq: 0,
    };
  }

  if (huppermageState.activePassives.includes("universalite") && activeRuneCount > 0) {
    nextStats = applyUniversaliteStats(nextStats, activeRunes);
    nextResources = addResource(nextResources, "bq", activeRuneCount * -50);
  }

  nextClassState = {
    ...state.classState,
    huppermage: nextHuppermageState,
  };

  if (huppermageState.activePassives.includes("profusion-runique") && activeRuneCount > 0) {
    const abundance = addAbundance(nextClassState, activeRuneCount * 15, "huppermageClassMechanic");
    nextClassState = abundance.classState;
    nextHuppermageState = getHuppermageState(nextClassState);
  }

  if (huppermageState.activePassives.includes("dynamo")) {
    nextHuppermageState = {
      ...nextHuppermageState,
      runes: {
        ...nextHuppermageState.runes,
        active: createRuneTracker(),
      },
    };
    nextClassState = {
      ...nextClassState,
      huppermage: nextHuppermageState,
    };
  }

  const carryoverApplication = applySublimationCarryover(nextResources, sublimationStacks);
  const turnEndEffects: AppliedEffect[] = [
    {
      type: "turnEndBq",
      amount,
      before,
      after: nextResources.bq,
      storedBefore,
      storedAfter: nextHuppermageState.storedBq,
      source: "huppermageClassMechanic",
    },
    ...carryoverApplication.appliedEffects,
  ];

  return {
    ...state,
    remainingResources: nextResources,
    classState: nextClassState,
    currentStats: nextStats,
    turnEndEffects,
    resourceCarryover: carryoverApplication.resourceCarryover,
  };
}

function applySublimationCarryover(
  resources: TurnState["remainingResources"],
  sublimationStacks: EffectiveSublimationStack[],
): { resourceCarryover: Partial<TurnState["remainingResources"]>; appliedEffects: AppliedEffect[] } {
  const resourceCarryover: Partial<TurnState["remainingResources"]> = {};
  const appliedEffects: AppliedEffect[] = [];

  for (const stack of sublimationStacks) {
    const entry = stack.entries[0];
    if (!entry) {
      continue;
    }

    for (const effect of getStackEffects(stack)) {
      if (effect.type !== "carryoverResource") {
        continue;
      }

      const before = resources[effect.resource];
      const amount = Math.min(before, effect.maxAmount === undefined ? before : effect.maxAmount * stack.effectiveLevel);
      if (amount <= 0) {
        continue;
      }

      resourceCarryover[effect.resource] = (resourceCarryover[effect.resource] ?? 0) + amount;
      appliedEffects.push({
        type: "resourceCarryover",
        resource: effect.resource,
        amount,
        before,
        after: (resourceCarryover[effect.resource] ?? 0),
        sublimationId: entry.id,
        sublimationName: entry.name,
        source: "sublimation",
      });
    }
  }

  return { resourceCarryover, appliedEffects };
}

function getStackEffects(stack: EffectiveSublimationStack): SublimationEffect[] {
  return stack.entries[0]?.effects ?? [];
}

function applyUniversaliteStats(stats: BaseStats, activeRunes: Record<Rune, boolean>): BaseStats {
  let nextStats = stats;

  if (activeRunes.incandescent) {
    nextStats = {
      ...nextStats,
      damageInflictedPercent: nextStats.damageInflictedPercent + 15,
    };
  }

  if (activeRunes.aquatic) {
    nextStats = {
      ...nextStats,
      healsPerformedPercent: (nextStats.healsPerformedPercent ?? 0) + 15,
    };
  }

  if (activeRunes.telluric) {
    nextStats = {
      ...nextStats,
      elementalResistance: (nextStats.elementalResistance ?? 0) + 75,
    };
  }

  if (activeRunes.aerial) {
    nextStats = {
      ...nextStats,
      range: (nextStats.range ?? 0) + 2,
    };
  }

  return nextStats;
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
      runeApGainsThisTurn: createRuneTracker(character.classState?.huppermage?.runeApGainsThisTurn),
      abundanceLevel: character.classState?.huppermage?.abundanceLevel ?? 0,
      feuFolletsActive: character.classState?.huppermage?.feuFolletsActive ?? 0,
      feuFolletStoredRunes: normalizeFeuFolletStoredRunes(
        character.classState?.huppermage?.feuFolletsActive ?? 0,
        character.classState?.huppermage?.feuFolletStoredRunes,
      ),
      feuFolletStoredLastRunes: normalizeFeuFolletStoredLastRunes(
        character.classState?.huppermage?.feuFolletsActive ?? 0,
        character.classState?.huppermage?.feuFolletStoredLastRunes,
      ),
      temporaryUnlockedSpellElement: character.classState?.huppermage?.temporaryUnlockedSpellElement ?? null,
      usedSpellIds: character.classState?.huppermage?.usedSpellIds ?? [],
      activePassives: character.classState?.huppermage?.activePassives ?? [],
      activeHeart: character.classState?.huppermage?.activeHeart ?? null,
      waterHeartLastSpellKind: character.classState?.huppermage?.waterHeartLastSpellKind ?? null,
      bqMax: character.classState?.huppermage?.bqMax
        ?? (
          character.classState?.huppermage?.convertWpToBq
            ? Math.max(character.resources.bq, character.resources.wp * huppermageBqPerWp)
            : Math.max(character.resources.bq, deriveHuppermageBqFromWp(character.resources.wp))
        ),
      storedBq: character.classState?.huppermage?.storedBq ?? 0,
      haloChatoyantMarks: character.classState?.huppermage?.haloChatoyantMarks ?? 0,
      cooldownsBySpellId: { ...character.classState?.huppermage?.cooldownsBySpellId },
      deckSpellLimit: character.classState?.huppermage?.deckSpellLimit ?? DEFAULT_DECK_SPELL_LIMIT,
      passiveLimit: character.classState?.huppermage?.passiveLimit ?? DEFAULT_PASSIVE_LIMIT,
    },
  };
}

function applyInitialPassives(
  catalog: CatalogEntry[],
  activePassiveIds: string[],
  stats: BaseStats,
  resources: TurnState["remainingResources"],
): { stats: BaseStats; resources: TurnState["remainingResources"] } {
  let nextStats = stats;
  let nextResources = resources;

  for (const passiveId of activePassiveIds) {
    const passive = catalog.find((entry) => entry.id === passiveId && entry.kind === "passive");
    if (!passive) {
      continue;
    }

    for (const effect of passive.effects) {
      if (effect.type === "resourceDelta" && (!effect.target || effect.target === "caster")) {
        nextResources = addResource(nextResources, effect.resource, effect.amount);
      }

      if (effect.type === "statModifier" && shouldApplyInitialPassiveStatModifier(passive.id, effect)) {
        const modification = applyStatModifier(nextStats, effect);
        nextStats = modification?.stats ?? nextStats;
      }
    }
  }

  return { stats: nextStats, resources: nextResources };
}

function applyInitialSublimations(
  stats: BaseStats,
  resources: TurnState["remainingResources"],
  sublimationStacks: EffectiveSublimationStack[],
): { stats: BaseStats; resources: TurnState["remainingResources"] } {
  let nextStats = stats;
  let nextResources = resources;

  for (const stack of sublimationStacks) {
    for (const effect of getStackEffects(stack)) {
      if (effect.type === "statModifier") {
        nextStats = applyNumericSublimationStat(nextStats, effect.stat, effect.amount * stack.effectiveLevel);
      }

      if (effect.type === "resourceDelta") {
        nextResources = addResource(nextResources, effect.resource, effect.amount * stack.effectiveLevel);
      }
    }
  }

  return { stats: nextStats, resources: nextResources };
}

function applyNumericSublimationStat(stats: BaseStats, stat: SublimationEffect & { type: "statModifier" }["stat"], amount: number): BaseStats {
  const before = stats[stat];
  if (typeof before !== "number") {
    return {
      ...stats,
      [stat]: amount,
    };
  }

  return {
    ...stats,
    [stat]: before + amount,
  };
}

function shouldApplyInitialPassiveStatModifier(passiveId: string, effect: StatModifierEffect): boolean {
  if (
    passiveId === "carnage"
    && effect.stat === "damageInflictedPercent"
    && effect.note === "Aux cibles ayant de l'Armure."
  ) {
    return false;
  }

  if (
    passiveId === "inspiration"
    && effect.stat === "damageInflictedPercent"
    && effect.note === "Aux combattants ayant plus d'Initiative."
  ) {
    return false;
  }

  return true;
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
    runeApGainsThisTurn: createRuneTracker(),
    abundanceLevel: 0,
    feuFolletsActive: 0,
    feuFolletStoredRunes: [],
    feuFolletStoredLastRunes: [],
    temporaryUnlockedSpellElement: null,
    usedSpellIds: [],
    activePassives: [],
    activeHeart: null,
    waterHeartLastSpellKind: null,
    bqMax: 0,
    storedBq: 0,
    haloChatoyantMarks: 0,
    cooldownsBySpellId: {},
    deckSpellLimit: DEFAULT_DECK_SPELL_LIMIT,
    passiveLimit: DEFAULT_PASSIVE_LIMIT,
  };
}

function cloneClassState(classState: ClassTurnState): ClassTurnState {
  return {
    huppermage: classState.huppermage
        ? {
          runes: cloneHuppermageRuneState(classState.huppermage.runes),
          runeApGainsThisTurn: { ...classState.huppermage.runeApGainsThisTurn },
          abundanceLevel: classState.huppermage.abundanceLevel,
          feuFolletsActive: classState.huppermage.feuFolletsActive,
          feuFolletStoredRunes: classState.huppermage.feuFolletStoredRunes.map((storedRunes) => [...storedRunes]),
          feuFolletStoredLastRunes: [...classState.huppermage.feuFolletStoredLastRunes],
          temporaryUnlockedSpellElement: classState.huppermage.temporaryUnlockedSpellElement,
          usedSpellIds: [...classState.huppermage.usedSpellIds],
          activePassives: [...classState.huppermage.activePassives],
          activeHeart: classState.huppermage.activeHeart,
          waterHeartLastSpellKind: classState.huppermage.waterHeartLastSpellKind,
          bqMax: classState.huppermage.bqMax,
          storedBq: classState.huppermage.storedBq,
          haloChatoyantMarks: classState.huppermage.haloChatoyantMarks,
          cooldownsBySpellId: { ...classState.huppermage.cooldownsBySpellId },
          deckSpellLimit: classState.huppermage.deckSpellLimit,
          passiveLimit: classState.huppermage.passiveLimit,
        }
      : undefined,
  };
}

function applySpellCooldown(cooldownsBySpellId: Record<string, number>, spell: CatalogEntry): Record<string, number> {
  const cooldown = spell.constraints.find((constraint) => constraint.type === "cooldownTurns");
  if (!cooldown || cooldown.type !== "cooldownTurns") {
    return cooldownsBySpellId;
  }

  return {
    ...cooldownsBySpellId,
    [spell.id]: cooldown.value,
  };
}

function createRuneTracker(runes: Partial<Record<Rune, boolean>> = {}): Record<Rune, boolean> {
  return {
    incandescent: runes.incandescent ?? false,
    aquatic: runes.aquatic ?? false,
    telluric: runes.telluric ?? false,
    aerial: runes.aerial ?? false,
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

function resolveEffectiveCost(
  spell: CatalogEntry,
  state: TurnState,
  action: SimulationOptions["sequence"]["actions"][number],
): SpellCost {
  const huppermageState = getHuppermageState(state.classState);
  const activeRuneCount = getActiveRuneCount(huppermageState);
  const cost = { ...(spell.cost ?? {}) };

  for (const effect of spell.effects) {
    applyCostTags(effect, cost, huppermageState, action);
  }

  if (cost.ap !== undefined) {
    cost.ap = Math.max(0, cost.ap);
  }
  if (cost.mp !== undefined) {
    cost.mp = Math.max(0, cost.mp);
  }
  if (cost.wp !== undefined) {
    cost.wp = Math.max(0, cost.wp);
  }
  if (cost.bq !== undefined) {
    cost.bq = Math.max(0, cost.bq);
  }

  function applyCostTags(
    effect: Effect,
    mutableCost: SpellCost,
    currentHuppermageState: NonNullable<ClassTurnState["huppermage"]>,
    currentAction: SimulationOptions["sequence"]["actions"][number],
  ) {
    if (effect.type === "tag" && effect.tag === "dynamicBqCostPerRune" && typeof effect.value === "number") {
      mutableCost.bq = getCostAmount(mutableCost, "bq") + activeRuneCount * effect.value;
    }

    if (effect.type === "tag" && effect.tag === "additionalBqCostPerRune" && typeof effect.value === "number") {
      mutableCost.bq = getCostAmount(mutableCost, "bq") + activeRuneCount * effect.value;
    }

    if (effect.type === "tag" && effect.tag === "increasingBqCostPerUseThisTurn" && typeof effect.value === "number") {
      mutableCost.bq = getCostAmount(mutableCost, "bq") + (state.castsBySpellId[spell.id] ?? 0) * effect.value;
    }

    if (effect.type === "tag" && effect.tag === "costDelta" && typeof effect.value === "string") {
      const [resource, amount] = effect.value.split(":") as [Resource, string];
      if (resource === "ap" || resource === "mp" || resource === "wp" || resource === "bq") {
        mutableCost[resource] = getCostAmount(mutableCost, resource) + Number(amount);
      }
    }

    if (effect.type === "conditional" && isConditionMet(effect.condition, currentHuppermageState, currentAction)) {
      for (const nestedEffect of effect.effects) {
        applyCostTags(nestedEffect, mutableCost, currentHuppermageState, currentAction);
      }
    }
  }

  return cost;
}

function validateHuppermageClassAction(
  spell: ReturnType<typeof findSpell>,
  action: SimulationOptions["sequence"]["actions"][number],
  actionIndex: number,
  state: TurnState,
) {
  if (!spell) {
    return undefined;
  }

  if (spell.id === "coeur-de-lumiere" && !getHuppermageState(state.classState).runes.lastGeneratedRune) {
    return {
      type: "invalidClassStateAction" as const,
      actionIndex,
      spellId: spell.id,
      message: `Spell '${spell.id}' requires a last generated rune.`,
      source: spell.metadata.sources[0],
    };
  }

  if (isRunificationSpell(spell) && getActiveRuneCount(getHuppermageState(state.classState)) <= 0) {
    return {
      type: "invalidClassStateAction" as const,
      actionIndex,
      spellId: spell.id,
      message: `Spell '${spell.id}' requires at least one active rune.`,
      source: spell.metadata.sources[0],
    };
  }

  if (!isFeuFolletSpell(spell)) {
    return undefined;
  }

  const targetKind = action.target?.kind;
  const huppermageState = getHuppermageState(state.classState);

  if (targetKind === "emptyCell" && getActiveRuneCount(huppermageState) <= 0) {
    return {
      type: "invalidClassStateAction" as const,
      actionIndex,
      spellId: spell.id,
      message: `Spell '${spell.id}' cannot place a Feu-Follet without an active rune.`,
      source: spell.metadata.sources[0],
    };
  }

  if (targetKind === "emptyCell" && !getFeuFolletStoredRune(huppermageState)) {
    return {
      type: "invalidClassStateAction" as const,
      actionIndex,
      spellId: spell.id,
      message: `Spell '${spell.id}' cannot place a Feu-Follet because the last generated rune is not active.`,
      source: spell.metadata.sources[0],
    };
  }

  if (targetKind === "emptyCell" && huppermageState.feuFolletsActive >= getFeuFolletMaximum(huppermageState)) {
    return {
      type: "invalidClassStateAction" as const,
      actionIndex,
      spellId: spell.id,
      message: `Spell '${spell.id}' cannot place more active Feu-Follets.`,
      source: spell.metadata.sources[0],
    };
  }

  const feuFolletCastLimit = getFeuFolletCastLimit(huppermageState);
  if (targetKind === "emptyCell" && feuFolletCastLimit !== undefined && (state.castsBySpellId[spell.id] ?? 0) >= feuFolletCastLimit) {
    return {
      type: "castLimitExceeded" as const,
      actionIndex,
      spellId: spell.id,
      required: feuFolletCastLimit,
      available: state.castsBySpellId[spell.id] ?? 0,
      message: `Spell '${spell.id}' exceeds Feu-Follet max casts per turn (${feuFolletCastLimit}).`,
      source: spell.metadata.sources[0],
    };
  }

  if (targetKind === "feuFollet" && huppermageState.feuFolletsActive <= 0) {
    return {
      type: "invalidClassStateAction" as const,
      actionIndex,
      spellId: spell.id,
      message: `Spell '${spell.id}' cannot recover a Feu-Follet because none is active.`,
      source: spell.metadata.sources[0],
    };
  }

  if (isEntityTargetKind(targetKind)) {
    return {
      type: "invalidClassStateAction" as const,
      actionIndex,
      spellId: spell.id,
      message: `Spell '${spell.id}' cannot target an entity.`,
      source: spell.metadata.sources[0],
    };
  }

  return undefined;
}

function getMaxCastsPerTurnOverride(
  spell: ReturnType<typeof findSpell>,
  state: TurnState,
): number | undefined {
  if (spell?.id !== "coeur-de-lumiere") {
    return undefined;
  }

  const huppermageState = getHuppermageState(state.classState);
  return huppermageState.activePassives.includes(REFRACTION_ELEMENTAIRE_PASSIVE_ID) ? 4 : undefined;
}

function getFeuFolletMaximum(huppermageState: NonNullable<ClassTurnState["huppermage"]>): number {
  return huppermageState.activePassives.includes("nouveau-souffle") ? 1 : 2;
}

function getFeuFolletCastLimit(huppermageState: NonNullable<ClassTurnState["huppermage"]>): number | undefined {
  return huppermageState.activePassives.includes(SAUVEGARDE_RUNIQUE_PASSIVE_ID) ? 1 : undefined;
}

function isEntityTargetKind(targetKind: SimulationOptions["sequence"]["actions"][number]["target"]["kind"] | undefined): boolean {
  return targetKind === "fighter" || targetKind === "ally" || targetKind === "enemy";
}

function validateHuppermageDeckAction(
  spell: ReturnType<typeof findSpell>,
  actionIndex: number,
  state: TurnState,
) {
  if (!spell || spell.kind !== "spell") {
    return undefined;
  }

  const huppermageState = getHuppermageState(state.classState);
  if (isSpellAvailableFromDeck(spell, huppermageState)) {
    return undefined;
  }

  return {
    type: "deckLimitExceeded" as const,
    actionIndex,
    spellId: spell.id,
    required: huppermageState.deckSpellLimit,
    available: getDeckTrackedUsedSpellIds(huppermageState.usedSpellIds).length,
    message: `Spell '${spell.id}' is not in the current deck and the deck limit is reached.`,
    source: spell.metadata.sources[0],
  };
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
  let feuFolletStoredLastRunes = [...previousHuppermageState.feuFolletStoredLastRunes];
  let temporaryUnlockedSpellElement = previousHuppermageState.temporaryUnlockedSpellElement;
  let nextClassState = classState;

  if (targetKind === "emptyCell") {
    const removedRune = getFeuFolletStoredRune(previousHuppermageState);
    const storedRunes = getSauvegardeRuniqueStoredRunes(previousHuppermageState);
    const storedRune = storedRunes.length > 0 ? null : removedRune;
    feuFolletStoredRunes = [...feuFolletStoredRunes, storedRunes];
    feuFolletStoredLastRunes = [...feuFolletStoredLastRunes, storedRune];
    if (removedRune) {
      runes = {
        ...runes,
        active: {
          ...runes.active,
          [removedRune]: false,
        },
      };
    }
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
    const [recoveredLastRune = null, ...remainingStoredLastRunes] = feuFolletStoredLastRunes;
    const shouldRecoverRune = !previousHuppermageState.activePassives.includes("plenitude");
    feuFolletStoredRunes = remainingStoredRunes;
    feuFolletStoredLastRunes = remainingStoredLastRunes;
    if (shouldRecoverRune && recoveredRunes.length > 0) {
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

    const unlockedRune = shouldRecoverRune && recoveredRunes.length > 0 ? runes.lastGeneratedRune : recoveredLastRune;
    if (unlockedRune) {
      temporaryUnlockedSpellElement = RUNE_TO_ELEMENT[unlockedRune];
      appliedEffects.push({
        type: "temporarySpellElementUnlocked",
        element: temporaryUnlockedSpellElement,
        source: "feuFollet",
      });
    }
    if (shouldRecoverRune && recoveredLastRune) {
      runes = {
        ...runes,
        active: {
          ...runes.active,
          [recoveredLastRune]: true,
        },
      };
    }

    if (!shouldRecoverRune) {
      nextClassState = {
        ...nextClassState,
        huppermage: {
          ...previousHuppermageState,
          runes,
          feuFolletsActive: after,
          feuFolletStoredRunes,
          feuFolletStoredLastRunes,
          temporaryUnlockedSpellElement,
        },
      };
      const abundance = addAbundance(nextClassState, 25, "huppermageClassMechanic");
      nextClassState = abundance.classState;
      appliedEffects.push(...abundance.appliedEffects);
    }
  }

  if (nextClassState !== classState) {
    return {
      classState: nextClassState,
      appliedEffects,
    };
  }

  return {
    classState: {
      ...classState,
      huppermage: {
        ...previousHuppermageState,
        runes,
        feuFolletsActive: after,
        feuFolletStoredRunes,
        feuFolletStoredLastRunes,
        temporaryUnlockedSpellElement,
      },
    },
    appliedEffects,
  };
}

function applyCycleElementaire(
  spell: ReturnType<typeof findSpell>,
  classState: ClassTurnState,
  resources: TurnState["remainingResources"],
): { classState: ClassTurnState; resources: TurnState["remainingResources"]; appliedEffects: AppliedEffect[] } {
  if (!spell || spell.id !== "cycle-elementaire") {
    return { classState, resources, appliedEffects: [] };
  }

  const huppermageState = getHuppermageState(classState);
  const lastGeneratedRune = huppermageState.runes.lastGeneratedRune;
  if (!lastGeneratedRune) {
    return { classState, resources, appliedEffects: [] };
  }

  const wasLastRuneActive = huppermageState.runes.active[lastGeneratedRune];
  const restoredRune = wasLastRuneActive
    ? OPPOSITE_RUNE[lastGeneratedRune]
    : lastGeneratedRune;
  const activeRunes = {
    ...huppermageState.runes.active,
  };

  if (wasLastRuneActive) {
    activeRunes[lastGeneratedRune] = false;
  }

  const preparedClassState = {
    ...classState,
    huppermage: {
      ...huppermageState,
      runes: {
        active: activeRunes,
        lastGeneratedRune: huppermageState.runes.lastGeneratedRune,
      },
    },
  };
  const runeGeneration = applyGeneratedRune(preparedClassState, resources, restoredRune, "cycleElementaire");
  let nextClassState = runeGeneration.classState;
  const appliedEffects = [...runeGeneration.appliedEffects];

  if (wasLastRuneActive && huppermageState.activePassives.includes("combinaison-elementaire")) {
    const abundance = addAbundance(nextClassState, 15, "huppermageClassMechanic");
    nextClassState = abundance.classState;
    appliedEffects.push(...abundance.appliedEffects);
  }

  return {
    classState: nextClassState,
    resources: runeGeneration.resources,
    appliedEffects,
  };
}

function applyGeneratedRune(
  classState: ClassTurnState,
  resources: TurnState["remainingResources"],
  generatedRune: Rune,
  source: "elementalSpellCast" | "cycleElementaire",
): { classState: ClassTurnState; resources: TurnState["remainingResources"]; appliedEffects: AppliedEffect[] } {
  const previousHuppermageState = getHuppermageState(classState);
  const before = previousHuppermageState.runes.active[generatedRune];
  if (before) {
    return { classState, resources, appliedEffects: [] };
  }

  const shouldGrantAp = !previousHuppermageState.runeApGainsThisTurn[generatedRune];
  let nextResources = resources;
  let nextClassState = {
    ...classState,
    huppermage: {
      ...previousHuppermageState,
      runes: {
        active: {
          ...previousHuppermageState.runes.active,
          [generatedRune]: true,
        },
        lastGeneratedRune: generatedRune,
      },
      runeApGainsThisTurn: {
        ...previousHuppermageState.runeApGainsThisTurn,
        [generatedRune]: true,
      },
    },
  };
  const appliedEffects: AppliedEffect[] = [
    {
      type: "runeGenerated",
      rune: generatedRune,
      before,
      after: true,
      source,
    },
  ];

  if (shouldGrantAp) {
    const beforeAp = nextResources.ap;
    nextResources = addResource(nextResources, "ap", 1);
    appliedEffects.push({
      type: "resourceDelta",
      resource: "ap",
      amount: 1,
      before: beforeAp,
      after: nextResources.ap,
      source: "huppermageClassMechanic",
    });
  }

  if (getHuppermageState(nextClassState).activePassives.includes("antithese")) {
    const beforeBq = nextResources.bq;
    const amount = applyBqGainMultiplier(20, getHuppermageState(nextClassState));
    nextResources = addResource(nextResources, "bq", amount);
    appliedEffects.push({
      type: "resourceDelta",
      resource: "bq",
      amount,
      before: beforeBq,
      after: nextResources.bq,
      source: "huppermageClassMechanic",
    });
  }

  return { classState: nextClassState, resources: nextResources, appliedEffects };
}

function isFeuFolletSpell(spell: NonNullable<ReturnType<typeof findSpell>>): boolean {
  return spell.id === "feu-follet" || spell.tags.includes("feu-follet");
}

function isRunificationSpell(spell: NonNullable<ReturnType<typeof findSpell>>): boolean {
  return spell.id === "runification" || spell.id === "runification-test";
}

function isSpellAvailableFromDeck(
  spell: NonNullable<ReturnType<typeof findSpell>>,
  huppermageState: NonNullable<ClassTurnState["huppermage"]>,
): boolean {
  if (!isDeckTrackedSpell(spell)) {
    return true;
  }

  const deckUsedSpellIds = getDeckTrackedUsedSpellIds(huppermageState.usedSpellIds);
  return huppermageState.usedSpellIds.includes(spell.id)
    || deckUsedSpellIds.length < huppermageState.deckSpellLimit
    || (huppermageState.temporaryUnlockedSpellElement !== null && spell.element === huppermageState.temporaryUnlockedSpellElement);
}

function addUsedSpellId(
  usedSpellIds: string[],
  spell: NonNullable<ReturnType<typeof findSpell>>,
  huppermageState: NonNullable<ClassTurnState["huppermage"]>,
): string[] {
  if (!isDeckTrackedSpell(spell) || usedSpellIds.includes(spell.id)) {
    return usedSpellIds;
  }

  if (getDeckTrackedUsedSpellIds(usedSpellIds).length >= huppermageState.deckSpellLimit && huppermageState.temporaryUnlockedSpellElement) {
    return usedSpellIds;
  }

  return [...usedSpellIds, spell.id];
}

function isDeckTrackedSpell(spell: NonNullable<ReturnType<typeof findSpell>>): boolean {
  return spell.id !== "coeur-de-lumiere"
    && spell.id !== "cycle-elementaire"
    && !isFeuFolletSpell(spell);
}

function getDeckTrackedUsedSpellIds(usedSpellIds: string[]): string[] {
  return usedSpellIds.filter((spellId) =>
    spellId !== "coeur-de-lumiere"
    && spellId !== "cycle-elementaire"
    && spellId !== "feu-follet"
  );
}

function normalizeFeuFolletStoredRunes(feuFolletsActive: number, storedRunes: Rune[][] = []): Rune[][] {
  return Array.from({ length: feuFolletsActive }, (_, index) => storedRunes[index] ? [...storedRunes[index]] : []);
}

function normalizeFeuFolletStoredLastRunes(feuFolletsActive: number, storedRunes: Array<Rune | null> = []): Array<Rune | null> {
  return Array.from({ length: feuFolletsActive }, (_, index) => storedRunes[index] ?? null);
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

function getFeuFolletStoredRune(huppermageState: NonNullable<ClassTurnState["huppermage"]>): Rune | null {
  const lastGeneratedRune = huppermageState.runes.lastGeneratedRune;
  if (lastGeneratedRune && huppermageState.runes.active[lastGeneratedRune]) {
    return lastGeneratedRune;
  }

  return null;
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

function resolveSpellDamageBonus(
  spell: CatalogEntry,
  resources: TurnState["remainingResources"],
  classState: ClassTurnState,
  action: SimulationOptions["sequence"]["actions"][number],
): { damageInflictedBonusPercent: number; appliedEffects: AppliedEffect[] } {
  const huppermageState = getHuppermageState(classState);
  let damageInflictedBonusPercent = 0;
  const appliedEffects: AppliedEffect[] = [];

  for (const value of getSatisfiedTagValues(spell.effects, "damageInflictedPercentPerBqPercentRemaining", huppermageState, action)) {
    if (typeof value !== "number") {
      continue;
    }

    const before = damageInflictedBonusPercent;
    const bqPercentRemaining = huppermageState.bqMax > 0
      ? Math.max(0, resources.bq) / huppermageState.bqMax * 100
      : 0;
    damageInflictedBonusPercent = roundDamage(damageInflictedBonusPercent + value * bqPercentRemaining);
    appliedEffects.push({
      type: "statModifier",
      stat: "damageInflictedPercent",
      amount: damageInflictedBonusPercent - before,
      before,
      after: damageInflictedBonusPercent,
      source: "spellEffect",
    });
  }

  return { damageInflictedBonusPercent, appliedEffects };
}

function resolveActionSublimationEffects(
  spell: CatalogEntry,
  sublimationStacks: EffectiveSublimationStack[],
): { damageInflictedBonusPercent: number; appliedEffects: AppliedEffect[] } {
  let damageInflictedBonusPercent = 0;
  const appliedEffects: AppliedEffect[] = [];

  for (const stack of sublimationStacks) {
    const entry = stack.entries[0];
    if (!entry) {
      continue;
    }

    for (const effect of getStackEffects(stack)) {
      if (effect.type !== "actionDamageInflictedPercent") {
        continue;
      }

      const eligibility = isSublimationActionEligible(spell, effect.condition);
      if (!eligibility.eligible) {
        appliedEffects.push({
          type: "sublimationEffect",
          sublimationId: entry.id,
          sublimationName: entry.name,
          status: "skipped",
          reason: eligibility.reason,
          source: "sublimation",
        });
        continue;
      }

      const amount = effect.amount * stack.effectiveLevel;
      damageInflictedBonusPercent += amount;
      appliedEffects.push({
        type: "sublimationEffect",
        sublimationId: entry.id,
        sublimationName: entry.name,
        status: "applied",
        reason: eligibility.reason,
        amount,
        source: "sublimation",
      });
    }
  }

  return { damageInflictedBonusPercent, appliedEffects };
}

function isSublimationActionEligible(
  spell: CatalogEntry,
  condition: Extract<SublimationEffect, { type: "actionDamageInflictedPercent" }>["condition"],
): { eligible: boolean; reason: string } {
  const profile = spell.castProfile;
  if (!profile) {
    return { eligible: false, reason: "missingCastProfile" };
  }

  if (condition.type === "zone") {
    return profile.isZone
      ? { eligible: true, reason: "zoneCapable" }
      : { eligible: false, reason: "notZoneCapable" };
  }

  if (condition.type === "geometry") {
    return profile.geometry?.includes(condition.geometry)
      ? { eligible: true, reason: `${condition.geometry}Capable` }
      : { eligible: false, reason: `${condition.geometry}NotCapable` };
  }

  if (condition.mode === "melee") {
    return profile.canMelee
      ? { eligible: true, reason: "meleeCapable" }
      : { eligible: false, reason: "notMeleeCapable" };
  }

  const satisfiesDistance = Boolean(profile.canDistance)
    && (condition.minRange === undefined || (profile.maxDistance ?? 0) >= condition.minRange);
  return satisfiesDistance
    ? { eligible: true, reason: "distanceCapable" }
    : { eligible: false, reason: "notDistanceCapable" };
}

function applySpellDamageMechanics(
  spell: CatalogEntry,
  actionDamage: number,
  stats: BaseStats,
  resources: TurnState["remainingResources"],
  classState: ClassTurnState,
  actionContext: ActionContext,
  action: SimulationOptions["sequence"]["actions"][number],
): { damage: number; classState: ClassTurnState; appliedEffects: AppliedEffect[] } {
  let extraDamage = 0;
  let nextClassState = classState;
  const appliedEffects: AppliedEffect[] = [];
  const huppermageState = getHuppermageState(nextClassState);

  for (const value of getSatisfiedTagValues(spell.effects, "delayedDamagePercentOfActionDamage", huppermageState, action)) {
    if (typeof value !== "number" || actionDamage <= 0) {
      continue;
    }

    const element = huppermageState.runes.lastGeneratedRune
      ? RUNE_TO_ELEMENT[huppermageState.runes.lastGeneratedRune]
      : spell.element ?? "light";
    const delayedDamage = roundDamage(actionDamage * value / 100);
    extraDamage = roundDamage(extraDamage + delayedDamage);
    appliedEffects.push(createDerivedDamageEffect(element, delayedDamage));
  }

  const lifeStealPercent = getSatisfiedTagValues(spell.effects, "lifeStealPercentPerRune", huppermageState, action)
    .reduce((total, value) => total + (typeof value === "number" ? value : 0), 0);
  if (lifeStealPercent > 0 && actionDamage > 0) {
    const percent = lifeStealPercent * getActiveRuneCount(huppermageState);
    const amount = roundDamage(actionDamage * percent / 100);
    if (amount > 0) {
      appliedEffects.push({
        type: "lifeSteal",
        amount,
        percent,
        sourceDamage: actionDamage,
        source: "spellEffect",
      });
    }
  }

  if (spell.id === "halo-chatoyant") {
    const haloApplication = applyHaloChatoyant(huppermageState, stats, actionContext);
    extraDamage = roundDamage(extraDamage + haloApplication.damage);
    nextClassState = {
      ...nextClassState,
      huppermage: haloApplication.huppermageState,
    };
    appliedEffects.push(...haloApplication.appliedEffects);
  }

  return { damage: extraDamage, classState: nextClassState, appliedEffects };
}

function applyHaloChatoyant(
  huppermageState: NonNullable<ClassTurnState["huppermage"]>,
  stats: BaseStats,
  actionContext: ActionContext,
): { damage: number; huppermageState: NonNullable<ClassTurnState["huppermage"]>; appliedEffects: AppliedEffect[] } {
  const before = huppermageState.haloChatoyantMarks;
  // The simulator is currently single-target, so only one existing Halo can be relevant.
  // Revisit this if enemy positions / multi-target zones are modeled.
  const triggeredExistingMarks = before > 0 ? 1 : 0;
  const triggersCurrentMark = huppermageState.runes.active.aerial;
  const triggerCount = triggeredExistingMarks + (triggersCurrentMark ? 1 : 0);
  const after = triggersCurrentMark ? 0 : 1;
  const appliedEffects: AppliedEffect[] = [
    {
      type: "haloMarksChanged",
      before,
      after,
      triggered: triggerCount,
      source: "spellEffect",
    },
  ];

  if (triggerCount === 0) {
    return {
      damage: 0,
      huppermageState: { ...huppermageState, haloChatoyantMarks: after },
      appliedEffects,
    };
  }

  const damageEffect: DamageEffect = { type: "damage", element: "light", base: 81, times: triggerCount };
  const formula = computeRawDamage(stats, damageEffect, actionContext);
    appliedEffects.push({
      type: "damage",
      amount: formula.result,
      element: "light",
      resolvedElement: formula.resolvedElement,
      source: "spellEffect",
      formula,
    });

  return {
    damage: formula.result,
    huppermageState: { ...huppermageState, haloChatoyantMarks: after },
    appliedEffects,
  };
}

function createDerivedDamageEffect(element: Element, amount: number): AppliedEffect {
  return {
    type: "damage",
    amount,
    element,
    resolvedElement: element,
    source: "spellEffect",
    formula: {
      baseDamage: amount,
      times: 1,
      resolvedElement: element,
      elementalMastery: 0,
      extraMastery: 0,
      masteryMultiplier: 1,
      criticalMode: "forcedNonCritical",
      effectiveCriticalHitPercent: 0,
      nonCriticalResult: amount,
      criticalResult: amount,
      criticalMultiplier: 1,
      positionMultiplier: 1,
      finalMultiplier: 1,
      blockMultiplier: 1,
      result: amount,
    },
  };
}

function applyPreSpellState(
  spell: CatalogEntry,
  stats: BaseStats,
  resources: TurnState["remainingResources"],
  classState: ClassTurnState,
  actionIndex: number,
): {
  stats: BaseStats;
  resources: TurnState["remainingResources"];
  classState: ClassTurnState;
  appliedEffects: AppliedEffect[];
  actionScopedStatModifiers: Partial<Record<keyof BaseStats, number>>;
} {
  let nextStats = stats;
  let nextResources = resources;
  let nextClassState = classState;
  const appliedEffects: AppliedEffect[] = [];
  const actionScopedStatModifiers: Partial<Record<keyof BaseStats, number>> = {};
  const huppermageState = getHuppermageState(nextClassState);

  if (spell.id === "coeur-de-lumiere" && huppermageState.runes.lastGeneratedRune) {
    const heart = RUNE_TO_HEART[huppermageState.runes.lastGeneratedRune];
    const heartApplication = applyHeartState(heart, nextStats, nextClassState);
    nextStats = heartApplication.stats;
    nextClassState = heartApplication.classState;
    appliedEffects.push(...heartApplication.appliedEffects);

    if (actionIndex === 0 && huppermageState.activePassives.includes("initiative-de-lame")) {
      const before = nextResources.ap;
      nextResources = addResource(nextResources, "ap", 2);
      appliedEffects.push({
        type: "resourceDelta",
        resource: "ap",
        amount: 2,
        before,
        after: nextResources.ap,
        source: "huppermageClassMechanic",
      });
    }
  }

  const stateAfterHeart = getHuppermageState(nextClassState);
  if (spell.element === "light" && stateAfterHeart.abundanceLevel > 0) {
    const before = stateAfterHeart.abundanceLevel;
    nextStats = {
      ...nextStats,
      damageInflictedPercent: nextStats.damageInflictedPercent + before,
      healsPerformedPercent: (nextStats.healsPerformedPercent ?? 0) + before,
    };
    actionScopedStatModifiers.damageInflictedPercent = (actionScopedStatModifiers.damageInflictedPercent ?? 0) + before;
    actionScopedStatModifiers.healsPerformedPercent = (actionScopedStatModifiers.healsPerformedPercent ?? 0) + before;
    nextClassState = {
      ...nextClassState,
      huppermage: {
        ...stateAfterHeart,
        abundanceLevel: 0,
      },
    };
    appliedEffects.push({
      type: "abundanceChanged",
      amount: -before,
      before,
      after: 0,
      source: "huppermageClassMechanic",
    });
  }

  if (spell.element && isElementalSpell(spell.element) && getHuppermageState(nextClassState).activePassives.includes("antithese")) {
    const before = nextStats.damageInflictedPercent;
    nextStats = { ...nextStats, damageInflictedPercent: before - 10 };
    appliedEffects.push({
      type: "statModifier",
      stat: "damageInflictedPercent",
      amount: -10,
      before,
      after: nextStats.damageInflictedPercent,
      source: "spellEffect",
    });
  }

  if (spell.element === "light" && getHuppermageState(nextClassState).activePassives.includes("absorption-quadramentale")) {
    const before = nextStats.damageInflictedPercent;
    nextStats = { ...nextStats, damageInflictedPercent: before - 10 };
    appliedEffects.push({
      type: "statModifier",
      stat: "damageInflictedPercent",
      amount: -10,
      before,
      after: nextStats.damageInflictedPercent,
      source: "spellEffect",
    });
  }

  return { stats: nextStats, resources: nextResources, classState: nextClassState, appliedEffects, actionScopedStatModifiers };
}

function removeActionScopedStatModifiers(
  stats: BaseStats,
  modifiers: Partial<Record<keyof BaseStats, number>>,
): BaseStats {
  let nextStats = stats;

  if (typeof modifiers.damageInflictedPercent === "number" && modifiers.damageInflictedPercent !== 0) {
    nextStats = {
      ...nextStats,
      damageInflictedPercent: nextStats.damageInflictedPercent - modifiers.damageInflictedPercent,
    };
  }

  if (typeof modifiers.healsPerformedPercent === "number" && modifiers.healsPerformedPercent !== 0) {
    nextStats = {
      ...nextStats,
      healsPerformedPercent: (nextStats.healsPerformedPercent ?? 0) - modifiers.healsPerformedPercent,
    };
  }

  return nextStats;
}

function applyHeartState(
  heart: HuppermageHeart,
  stats: BaseStats,
  classState: ClassTurnState,
): { stats: BaseStats; classState: ClassTurnState; appliedEffects: AppliedEffect[] } {
  const huppermageState = getHuppermageState(classState);
  const activePassives = huppermageState.activePassives;
  const bestElementalMastery = Math.max(0, ...Object.values(stats.elementalMastery).map((value) => value ?? 0));
  const heartMastery = Math.floor(bestElementalMastery * 1.2);
  const shouldApplyMastery = !activePassives.includes("refraction-elementaire");
  const shouldApplyDamage = !activePassives.includes("altruisme-de-lame");
  const healBonus = activePassives.includes("altruisme-de-lame") ? 30 : 15;
  let nextStats = {
    ...stats,
    damageInflictedPercent: stats.damageInflictedPercent + (shouldApplyDamage ? 30 : 0),
    healsPerformedPercent: (stats.healsPerformedPercent ?? 0) + healBonus,
    elementalMastery: shouldApplyMastery
      ? {
        ...stats.elementalMastery,
        [heart]: heartMastery,
      }
      : { ...stats.elementalMastery },
  };

  if (activePassives.includes("initiative-de-lame")) {
    nextStats = {
      ...nextStats,
      elementalMastery: {
        fire: heart === "fire" ? nextStats.elementalMastery.fire : 0,
        water: heart === "water" ? nextStats.elementalMastery.water : 0,
        earth: heart === "earth" ? nextStats.elementalMastery.earth : 0,
        air: heart === "air" ? nextStats.elementalMastery.air : 0,
        light: nextStats.elementalMastery.light,
        neutral: nextStats.elementalMastery.neutral,
      },
    };
  }

  return {
    stats: nextStats,
    classState: {
      ...classState,
      huppermage: {
        ...huppermageState,
        activeHeart: heart,
      },
    },
    appliedEffects: [
      {
        type: "heartChanged",
        heart,
        source: "coeurDeLumiere",
      },
    ],
  };
}

function addAbundance(
  classState: ClassTurnState,
  amount: number,
  source: "huppermageClassMechanic" | "spellEffect",
): { classState: ClassTurnState; appliedEffects: AppliedEffect[] } {
  if (amount === 0) {
    return { classState, appliedEffects: [] };
  }

  const huppermageState = getHuppermageState(classState);
  const before = huppermageState.abundanceLevel;
  const limit = huppermageState.activePassives.includes("combinaison-elementaire") ? 60 : Number.POSITIVE_INFINITY;
  const after = Math.min(limit, Math.max(0, before + amount));
  return {
    classState: {
      ...classState,
      huppermage: {
        ...huppermageState,
        abundanceLevel: after,
      },
    },
    appliedEffects: [
      {
        type: "abundanceChanged",
        amount: after - before,
        before,
        after,
        source,
      },
    ],
  };
}

function applyRuneConsumption(
  effects: Effect[],
  classState: ClassTurnState,
): { classState: ClassTurnState; appliedEffects: AppliedEffect[]; consumedRunes: Rune[] } {
  const huppermageState = getHuppermageState(classState);
  const consumedRunes = getConsumedRunesFromEffects(effects, huppermageState);
  if (consumedRunes.length === 0) {
    return { classState, appliedEffects: [], consumedRunes };
  }

  const nextRunes = {
    ...huppermageState.runes,
    active: consumedRunes.reduce(
      (activeRunes, rune) => ({
        ...activeRunes,
        [rune]: false,
      }),
      { ...huppermageState.runes.active },
    ),
  };

  return {
    classState: {
      ...classState,
      huppermage: {
        ...huppermageState,
        runes: nextRunes,
      },
    },
    appliedEffects: [
      {
        type: "runeConsumed",
        runes: consumedRunes,
        source: "spellEffect",
      },
    ],
    consumedRunes,
  };
}

function getConsumedRunesFromEffects(
  effects: Effect[],
  huppermageState: NonNullable<ClassTurnState["huppermage"]>,
): Rune[] {
  const consumedRunes = new Set<Rune>();

  for (const effect of effects) {
    if (effect.type === "tag" && effect.tag === "consumesRunes" && effect.value === true) {
      for (const rune of RUNE_APPLICATION_ORDER) {
        if (huppermageState.runes.active[rune]) {
          consumedRunes.add(rune);
        }
      }
    }

    if (effect.type === "tag" && effect.tag === "consumeAllRunes" && effect.value === true) {
      for (const rune of RUNE_APPLICATION_ORDER) {
        if (huppermageState.runes.active[rune]) {
          consumedRunes.add(rune);
        }
      }
    }

    if (effect.type === "tag" && effect.tag === "consumeRune" && isRune(effect.value)) {
      if (huppermageState.runes.active[effect.value]) {
        consumedRunes.add(effect.value);
      }
    }

    if (effect.type === "conditional" && isConditionMet(effect.condition, huppermageState)) {
      for (const rune of getConsumedRunesFromEffects(effect.effects, huppermageState)) {
        consumedRunes.add(rune);
      }
    }
  }

  return sortRunesForApplication([...consumedRunes]);
}

function isRune(value: unknown): value is Rune {
  return typeof value === "string" && RUNE_APPLICATION_ORDER.includes(value as Rune);
}

function applyExtensionDesSens(
  spell: NonNullable<ReturnType<typeof findSpell>>,
  effectiveCost: SpellCost,
  classState: ClassTurnState,
  resources: TurnState["remainingResources"],
): { classState: ClassTurnState; resources: TurnState["remainingResources"]; appliedEffects: AppliedEffect[] } {
  const huppermageState = getHuppermageState(classState);
  if (!huppermageState.activePassives.includes(EXTENSION_DES_SENS_PASSIVE_ID) || !huppermageState.activeHeart) {
    return { classState, resources, appliedEffects: [] };
  }

  const apCost = effectiveCost.ap ?? 0;
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
  const amount = applyBqGainMultiplier(regeneration.amount, huppermageState);
  const nextResources = addResource(resources, "bq", amount);

  return {
    classState: nextClassState,
    resources: nextResources,
    appliedEffects: [
      {
        type: "bqRegeneration",
        amount,
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

function getActiveRuneCount(huppermageState: NonNullable<ClassTurnState["huppermage"]>): number {
  return RUNE_APPLICATION_ORDER.filter((rune) => huppermageState.runes.active[rune]).length;
}

function applyBqGainMultiplier(amount: number, huppermageState: NonNullable<ClassTurnState["huppermage"]>): number {
  let multiplier = 1;
  if (huppermageState.activePassives.includes("transcendance-runique")) {
    multiplier *= getActiveRuneCount(huppermageState) === RUNE_APPLICATION_ORDER.length ? 2 : 0.5;
  }
  if (huppermageState.activePassives.includes("profusion-runique")) {
    multiplier *= 0.8;
  }
  return Math.round(amount * multiplier);
}

function applyAbsorptionQuadramentale(
  spell: CatalogEntry,
  action: SimulationOptions["sequence"]["actions"][number],
  classState: ClassTurnState,
  resources: TurnState["remainingResources"],
): { resources: TurnState["remainingResources"]; appliedEffects: AppliedEffect[] } {
  const huppermageState = getHuppermageState(classState);
  if (!huppermageState.activePassives.includes("absorption-quadramentale")) {
    return { resources, appliedEffects: [] };
  }

  const triggerCount = countRemovalEvents(spell.effects, huppermageState, action);
  if (triggerCount === 0) {
    return { resources, appliedEffects: [] };
  }

  const amount = applyBqGainMultiplier(triggerCount * 20, huppermageState);
  const before = resources.bq;
  const nextResources = addResource(resources, "bq", amount);
  return {
    resources: nextResources,
    appliedEffects: [
      {
        type: "resourceDelta",
        resource: "bq",
        amount,
        before,
        after: nextResources.bq,
        source: "huppermageClassMechanic",
      },
    ],
  };
}

function countRemovalEvents(
  effects: Effect[],
  huppermageState: NonNullable<ClassTurnState["huppermage"]>,
  action: SimulationOptions["sequence"]["actions"][number],
): number {
  return effects.reduce((count, effect) => {
    if (effect.type === "resourceDelta" && effect.target === "target" && effect.amount < 0 && (effect.resource === "ap" || effect.resource === "mp")) {
      return count + 1;
    }

    if (effect.type === "statModifier" && effect.target === "target" && effect.stat === "range" && effect.amount < 0) {
      return count + 1;
    }

    if (effect.type === "conditional" && isConditionMet(effect.condition, huppermageState, action)) {
      return count + countRemovalEvents(effect.effects, huppermageState, action);
    }

    return count;
  }, 0);
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
  action?: SimulationOptions["sequence"]["actions"][number],
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

  if (condition.type === "targetIs") {
    return action?.target?.kind === condition.value;
  }

  if (condition.type === "inState" && condition.target === "caster") {
    return condition.state === "Coeur de Lumiere" && huppermageState.activeHeart !== null;
  }

  if (condition.type === "event") {
    return false;
  }

  return false;
}

function getSatisfiedTagValues(
  effects: Effect[],
  tagName: string,
  huppermageState: NonNullable<ClassTurnState["huppermage"]>,
  action?: SimulationOptions["sequence"]["actions"][number],
): Array<string | number | boolean | undefined> {
  const values: Array<string | number | boolean | undefined> = [];

  for (const effect of effects) {
    if (effect.type === "tag" && effect.tag === tagName) {
      values.push(effect.value);
    }

    if (effect.type === "conditional" && isConditionMet(effect.condition, huppermageState, action)) {
      values.push(...getSatisfiedTagValues(effect.effects, tagName, huppermageState, action));
    }

    if (effect.type === "trigger") {
      values.push(...getSatisfiedTagValues(effect.effects, tagName, huppermageState, action));
    }
  }

  return values;
}

function applySupportedEffect(
  effect: Effect,
  stats: SimulationOptions["character"]["stats"],
  resources: TurnState["remainingResources"],
  context: ActionContext,
  effectContext: EffectApplicationContext,
): {
  resources: TurnState["remainingResources"];
  stats: BaseStats;
  damage: number;
  appliedEffects: AppliedEffect[];
} {
  if (effect.type === "conditional") {
    if (!isConditionMet(effect.condition, getHuppermageState(effectContext.classState), effectContext.action)) {
      return {
        resources,
        stats,
        damage: 0,
        appliedEffects: [],
      };
    }

    return effect.effects.reduce(
      (current, nestedEffect) => {
        const nestedApplication = applySupportedEffect(
          nestedEffect,
          current.stats,
          current.resources,
          context,
          { ...effectContext, resources: current.resources },
        );
        return {
          resources: nestedApplication.resources,
          stats: nestedApplication.stats,
          damage: roundDamage(current.damage + nestedApplication.damage),
          appliedEffects: [...current.appliedEffects, ...nestedApplication.appliedEffects],
        };
      },
      { resources, stats, damage: 0, appliedEffects: [] as AppliedEffect[] },
    );
  }

  if (effect.type === "damage") {
    if (isEmptyCellCast(effectContext.action)) {
      return {
        resources,
        stats,
        damage: 0,
        appliedEffects: [],
      };
    }

    const damageInflictedBonusPercent = effectContext.damageInflictedBonusPercent
      + getLastGeneratedRuneDamageBonusPercent(effect, stats, effectContext.classState);
    const formula = computeRawDamage(
      damageInflictedBonusPercent === 0
        ? stats
        : { ...stats, damageInflictedPercent: stats.damageInflictedPercent + damageInflictedBonusPercent },
      effect,
      context,
    );
    return {
      resources,
      stats,
      damage: formula.result,
      appliedEffects: [
        {
          type: "damage",
          amount: formula.result,
          element: effect.element,
          resolvedElement: formula.resolvedElement,
          source: "spellEffect",
          formula,
        },
      ],
    };
  }

  if (effect.type === "resourceDelta") {
    if (effect.target && effect.target !== "caster") {
      return {
        resources,
        stats,
        damage: 0,
        appliedEffects: [],
      };
    }

    const before = resources[effect.resource];
    const amount = effect.resource === "bq" && effect.amount > 0
      ? applyBqGainMultiplier(effect.amount, getHuppermageState(effectContext.classState))
      : effect.amount;
    const nextResources = addResource(resources, effect.resource, amount);
    return {
      resources: nextResources,
      stats,
      damage: 0,
      appliedEffects: [
        {
          type: "resourceDelta",
          resource: effect.resource,
          amount,
          before,
          after: nextResources[effect.resource],
          source: "spellEffect",
        },
      ],
    };
  }

  if (effect.type === "statModifier") {
    const effectiveModifier = resolveEffectiveStatModifier(effect, effectContext);
    if (effectiveModifier.amount === 0) {
      return {
        resources,
        stats,
        damage: 0,
        appliedEffects: [],
      };
    }

    const modification = applyStatModifier(stats, effectiveModifier);
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
          stat: effectiveModifier.stat,
          amount: effectiveModifier.amount,
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

function countsAsTargetCast(action: SimulationOptions["sequence"]["actions"][number]): boolean {
  return !isEmptyCellCast(action);
}

function isEmptyCellCast(action: SimulationOptions["sequence"]["actions"][number]): boolean {
  return action.target?.kind === "emptyCell";
}

function getLastGeneratedRuneDamageBonusPercent(
  effect: DamageEffect,
  stats: BaseStats,
  classState: ClassTurnState,
): number {
  const lastGeneratedRune = getHuppermageState(classState).runes.lastGeneratedRune;
  if (!lastGeneratedRune) {
    return 0;
  }

  return resolveDamageElement(effect.element, stats) === RUNE_TO_ELEMENT[lastGeneratedRune]
    ? LAST_GENERATED_RUNE_DAMAGE_BONUS_PERCENT
    : 0;
}

function resolveEffectiveStatModifier(
  effect: StatModifierEffect,
  effectContext: EffectApplicationContext,
): StatModifierEffect {
  if (!getSatisfiedTagValues(effectContext.spell.effects, "statModifiersScalePerRune", getHuppermageState(effectContext.classState), effectContext.action).some(Boolean)) {
    return effect;
  }

  return {
    ...effect,
    amount: effect.amount * getActiveRuneCount(getHuppermageState(effectContext.classState)),
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

  const supportedNumericStats = new Set<StatModifierEffect["stat"]>([
    "healsReceivedPercent",
    "armorReceivedPercent",
    "elementalResistance",
    "range",
    "willpower",
    "criticalHitPercent",
    "parry",
    "damageReceivedPercent",
  ]);

  if (supportedNumericStats.has(effect.stat)) {
    const key = effect.stat as keyof BaseStats;
    const before = typeof stats[key] === "number" ? stats[key] : 0;
    const after = before + effect.amount;
    return {
      stats: { ...stats, [key]: after },
      before,
      after,
    };
  }

  return undefined;
}
