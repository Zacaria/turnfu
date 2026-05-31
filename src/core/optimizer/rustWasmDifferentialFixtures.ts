import {
  getHuppermagePassives,
  getHuppermageSpells,
  huppermageCatalog,
  type CatalogEntry,
  type DamageEffect,
  type Element,
  type Effect,
  type Resource,
  type Rune,
  type SpellCost,
  type StatModifierEffect,
} from "../catalog/index.ts";
import {
  computeRawDamage,
  createResources,
  payCost,
  resolveActionContext,
  simulateTurn,
  type ActionContext,
  type ActionTarget,
  type BaseStats,
  type ResourcePool,
  type SimulationViolation,
  type SimulatedCharacter,
} from "../simulation/index.ts";

export type RustWasmDifferentialFixture =
  | {
      kind: "resourceCost";
      name: string;
      spellId: string;
      actionIndex: number;
      resources: ResourcePool;
      cost: Required<SpellCost>;
      context?: Partial<ActionContext>;
      expected: unknown;
    }
  | {
      kind: "damage";
      name: string;
      spellId: string;
      actionIndex: number;
      stats: ReturnType<typeof normalizeStatsForRust>;
      effect: DamageEffect;
      context?: Partial<ActionContext>;
      expected: unknown;
    }
  | {
      kind: "initialPassives";
      name: string;
      passiveIds: string[];
      stats: ReturnType<typeof normalizeStatsForRust>;
      resources: ResourcePool;
      passives: RustPassiveEntry[];
      expected: unknown;
    }
  | {
      kind: "invalidPlan";
      name: string;
      operation: RustInvalidPlanOperation;
      spellId: string;
      actionIndex: number;
      resources?: ResourcePool;
      cost?: Required<SpellCost>;
      target?: ActionTarget["kind"];
      spellRules?: RustSpellRules;
      castsBySpellId?: Record<string, number>;
      targetCastsBySpellId?: Record<string, number>;
      huppermageState?: ReturnType<typeof createRustHuppermageState>;
      expected: unknown;
    };

type RustPassiveEntry = {
  id: string;
  effects: Array<
    | {
        type: "resourceDelta";
        resource: Resource;
        amount: number;
        target?: string;
      }
    | {
        type: "statModifier";
        stat: StatModifierEffect["stat"];
        amount: number;
        target?: string;
        element?: string;
        note?: string;
      }
  >;
};

type RustInvalidPlanOperation =
  | "unknownSpell"
  | "resourceCost"
  | "spellRules"
  | "huppermageClassAction";

type RustSpellRules = {
  id: string;
  element?: Element;
  isDeckTracked: boolean;
  maxCastsPerTurn?: number;
  maxCastsPerTarget?: number;
  cooldownTurns?: number;
  requiredTarget?: ActionTarget["kind"];
};

const resources = ["ap", "mp", "wp", "bq"] as const;

const baseResources = createResources({ ap: 20, mp: 10, wp: 10, bq: 2_000 });

const baseStats = {
  level: 200,
  generalMastery: 1_050,
  elementalMastery: {
    fire: 900,
    water: 1_100,
    earth: 1_000,
    air: 950,
    light: 0,
    neutral: 0,
  },
  meleeMastery: 120,
  distanceMastery: 80,
  berserkMastery: 70,
  rearMastery: 140,
  criticalMastery: 160,
  damageInflictedPercent: 12,
  healsPerformedPercent: 5,
  healsReceivedPercent: 3,
  armorReceivedPercent: 4,
  elementalResistance: 50,
  range: 1,
  willpower: 20,
  criticalHitPercent: 25,
  parry: 10,
  damageReceivedPercent: 0,
} satisfies BaseStats & { damageReceivedPercent?: number };

const damageContext: Partial<ActionContext> = {
  position: "rear",
  rangeMode: "distance",
  isCritical: true,
  isBerserk: true,
  isBlocked: false,
};

export function createRustWasmDifferentialFixtures(): RustWasmDifferentialFixture[] {
  return [
    ...createSpellCostFixtures(),
    ...createDamageFixtures(),
    ...createInitialPassiveFixtures(),
    ...createInvalidPlanFixtures(),
  ];
}

function createSpellCostFixtures(): RustWasmDifferentialFixture[] {
  return getHuppermageSpells().map((spell, index) => {
    const cost = normalizeCost(spell.cost);
    const context = { position: "face", isCritical: false, isBerserk: false, isBlocked: false } satisfies Partial<ActionContext>;

    return {
      kind: "resourceCost",
      name: `spell-cost:${spell.id}`,
      spellId: spell.id,
      actionIndex: index,
      resources: baseResources,
      cost,
      context,
      expected: validateResourceCost(baseResources, cost, spell.id, index, context),
    };
  });
}

function createDamageFixtures(): RustWasmDifferentialFixture[] {
  const fixtures: RustWasmDifferentialFixture[] = [];

  for (const spell of getHuppermageSpells()) {
    const damageEffects = collectDamageEffects(spell.effects);
    for (const [effectIndex, effect] of damageEffects.entries()) {
      fixtures.push({
        kind: "damage",
        name: `damage:${spell.id}:${effectIndex}`,
        spellId: spell.id,
        actionIndex: effectIndex,
        stats: normalizeStatsForRust(baseStats),
        effect,
        context: damageContext,
        expected: computeRawDamage(baseStats, effect, damageContext),
      });
    }
  }

  return fixtures;
}

function createInitialPassiveFixtures(): RustWasmDifferentialFixture[] {
  return getHuppermagePassives().map((passive) => {
    const resources = createResources({ ap: 12, mp: 6, wp: 6, bq: 500 });
    const stats = normalizeStatsForRust(baseStats);
    const character = createPassiveFixtureCharacter(passive.id, resources);
    const simulation = simulateTurn({
      catalog: huppermageCatalog,
      character,
      sequence: { actions: [] },
      includeTurnEnd: false,
    });

    return {
      kind: "initialPassives",
      name: `initial-passive:${passive.id}`,
      passiveIds: [passive.id],
      resources,
      stats,
      passives: [normalizePassiveForRust(passive)],
      expected: {
        resources: simulation.finalState.remainingResources,
        stats: normalizeStatsForRust(simulation.finalState.currentStats),
      },
    };
  });
}

function createInvalidPlanFixtures(): RustWasmDifferentialFixture[] {
  const enoughResources = createResources({ ap: 20, mp: 10, wp: 10, bq: 2_000 });
  const fixtures: RustWasmDifferentialFixture[] = [];

  fixtures.push({
    kind: "invalidPlan",
    name: "invalid-plan:unknown-spell",
    operation: "unknownSpell",
    spellId: "missing-huppermage-spell",
    actionIndex: 0,
    expected: simulateInvalidPlan([{ spellId: "missing-huppermage-spell" }], createBaseCharacter(enoughResources)),
  });

  const expensiveSpell = requireSpell("fleche-de-lumiere");
  fixtures.push({
    kind: "invalidPlan",
    name: "invalid-plan:insufficient-resource",
    operation: "resourceCost",
    spellId: expensiveSpell.id,
    actionIndex: 0,
    resources: createResources({ ap: 1, mp: 6, wp: 6, bq: 0 }),
    cost: normalizeCost(expensiveSpell.cost),
    expected: simulateInvalidPlan([{ spellId: expensiveSpell.id }], createBaseCharacter(createResources({ ap: 1, mp: 6, wp: 6, bq: 0 }))),
  });

  const heartSpell = requireSpell("coeur-de-lumiere");
  fixtures.push({
    kind: "invalidPlan",
    name: "invalid-plan:cast-limit",
    operation: "spellRules",
    spellId: heartSpell.id,
    actionIndex: 1,
    spellRules: createRustSpellRules(heartSpell),
    castsBySpellId: { [heartSpell.id]: 1 },
    targetCastsBySpellId: {},
    huppermageState: createRustHuppermageState({ lastGeneratedRune: "incandescent" }),
    expected: simulateInvalidPlan(
      [{ spellId: heartSpell.id }, { spellId: heartSpell.id }],
      createBaseCharacter(enoughResources, { lastGeneratedRune: "incandescent" }),
    ),
  });

  fixtures.push({
    kind: "invalidPlan",
    name: "invalid-plan:cooldown",
    operation: "spellRules",
    spellId: expensiveSpell.id,
    actionIndex: 0,
    spellRules: createRustSpellRules(expensiveSpell),
    castsBySpellId: {},
    targetCastsBySpellId: {},
    huppermageState: createRustHuppermageState({ cooldownsBySpellId: { [expensiveSpell.id]: 2 } }),
    expected: simulateInvalidPlan(
      [{ spellId: expensiveSpell.id }],
      createBaseCharacter(enoughResources, { cooldownsBySpellId: { [expensiveSpell.id]: 2 } }),
    ),
  });

  const deckLimitedSpell = requireSpell("mirage");
  const usedSpellIds = getDeckLimitUsedSpellIds(deckLimitedSpell.id);
  fixtures.push({
    kind: "invalidPlan",
    name: "invalid-plan:deck-limit",
    operation: "spellRules",
    spellId: deckLimitedSpell.id,
    actionIndex: 0,
    spellRules: createRustSpellRules(deckLimitedSpell),
    castsBySpellId: {},
    targetCastsBySpellId: {},
    huppermageState: createRustHuppermageState({ usedSpellIds }),
    expected: simulateInvalidPlan(
      [{ spellId: deckLimitedSpell.id }],
      createBaseCharacter(enoughResources, { usedSpellIds }),
    ),
  });

  fixtures.push({
    kind: "invalidPlan",
    name: "invalid-plan:coeur-missing-last-rune",
    operation: "huppermageClassAction",
    spellId: heartSpell.id,
    actionIndex: 0,
    castsBySpellId: {},
    huppermageState: createRustHuppermageState(),
    expected: simulateInvalidPlan([{ spellId: heartSpell.id }], createBaseCharacter(enoughResources)),
  });

  const runificationSpell = requireSpell("runification");
  fixtures.push({
    kind: "invalidPlan",
    name: "invalid-plan:runification-no-rune",
    operation: "huppermageClassAction",
    spellId: runificationSpell.id,
    actionIndex: 0,
    castsBySpellId: {},
    huppermageState: createRustHuppermageState(),
    expected: simulateInvalidPlan([{ spellId: runificationSpell.id }], createBaseCharacter(enoughResources)),
  });

  const feuFolletSpell = requireSpell("feu-follet");
  fixtures.push({
    kind: "invalidPlan",
    name: "invalid-plan:feu-follet-no-rune",
    operation: "huppermageClassAction",
    spellId: feuFolletSpell.id,
    actionIndex: 0,
    target: "emptyCell",
    castsBySpellId: {},
    huppermageState: createRustHuppermageState(),
    expected: simulateInvalidPlan(
      [{ spellId: feuFolletSpell.id, target: { kind: "emptyCell" } }],
      createBaseCharacter(enoughResources),
    ),
  });

  const targetSpell = requireSpell("mur-energie");
  fixtures.push({
    kind: "invalidPlan",
    name: "invalid-plan:invalid-target",
    operation: "spellRules",
    spellId: targetSpell.id,
    actionIndex: 0,
    target: "fighter",
    spellRules: createRustSpellRules(targetSpell),
    castsBySpellId: {},
    targetCastsBySpellId: {},
    huppermageState: createRustHuppermageState(),
    expected: simulateInvalidPlan(
      [{ spellId: targetSpell.id, target: { kind: "fighter" } }],
      createBaseCharacter(enoughResources),
    ),
  });

  return fixtures;
}

function validateResourceCost(
  inputResources: ResourcePool,
  cost: Required<SpellCost>,
  spellId: string,
  actionIndex: number,
  context: Partial<ActionContext>,
) {
  const resolvedContext = resolveActionContext(context);
  for (const resource of resources) {
    const required = cost[resource];
    const available = inputResources[resource];
    if (required > available) {
      return {
        valid: false,
        context: resolvedContext,
        resourcesAfterCost: inputResources,
        violation: {
          violationType: "insufficientResource",
          actionIndex,
          spellId,
          resource,
          required,
          available,
        },
      };
    }
  }

  return {
    valid: true,
    context: resolvedContext,
    resourcesAfterCost: payCost(inputResources, cost),
  };
}

function createPassiveFixtureCharacter(passiveId: string, resources: ResourcePool): SimulatedCharacter {
  return {
    id: `rust-wasm-differential:${passiveId}`,
    className: "huppermage",
    resources,
    stats: baseStats,
    classState: {
      huppermage: {
        activePassives: [passiveId],
      },
    },
  };
}

function createBaseCharacter(
  resources: ResourcePool,
  huppermage: NonNullable<SimulatedCharacter["classState"]>["huppermage"] = {},
): SimulatedCharacter {
  return {
    id: "rust-wasm-invalid-plan-fixture",
    className: "huppermage",
    resources,
    stats: baseStats,
    classState: {
      huppermage,
    },
  };
}

function simulateInvalidPlan(
  actions: Array<{ spellId: string; target?: ActionTarget }>,
  character: SimulatedCharacter,
) {
  const simulation = simulateTurn({
    catalog: huppermageCatalog,
    character,
    sequence: { actions },
    includeTurnEnd: false,
  });

  if (simulation.valid || !simulation.violations[0]) {
    throw new Error(`Expected invalid fixture for '${actions[0]?.spellId ?? "empty"}'.`);
  }

  return normalizeViolation(simulation.violations[0]);
}

export function normalizeViolation(violation: SimulationViolation | undefined): Record<string, unknown> | null {
  if (!violation) {
    return null;
  }

  return pruneUndefined({
    violationType: violation.type,
    actionIndex: violation.actionIndex,
    spellId: violation.spellId,
    resource: violation.resource,
    required: violation.required,
    available: violation.available,
    scope: violation.scope,
  });
}

function collectDamageEffects(effects: Effect[]): DamageEffect[] {
  const damageEffects: DamageEffect[] = [];

  for (const effect of effects) {
    if (effect.type === "damage") {
      damageEffects.push(effect);
    }

    if (effect.type === "conditional" || effect.type === "trigger") {
      damageEffects.push(...collectDamageEffects(effect.effects));
    }
  }

  return damageEffects;
}

function normalizeCost(cost: SpellCost | undefined): Required<SpellCost> {
  return {
    ap: cost?.ap ?? 0,
    mp: cost?.mp ?? 0,
    wp: cost?.wp ?? 0,
    bq: cost?.bq ?? 0,
  };
}

function normalizePassiveForRust(passive: CatalogEntry): RustPassiveEntry {
  const effects: RustPassiveEntry["effects"] = [];

  for (const effect of passive.effects) {
    if (effect.type === "resourceDelta") {
      effects.push({
        type: "resourceDelta",
        resource: effect.resource,
        amount: effect.amount,
        target: effect.target,
      });
      continue;
    }

    if (effect.type === "statModifier") {
      effects.push({
        type: "statModifier",
        stat: effect.stat,
        amount: effect.amount,
        target: effect.target,
        element: effect.element,
        note: effect.note,
      });
    }
  }

  return {
    id: passive.id,
    effects,
  };
}

function createRustSpellRules(spell: CatalogEntry): RustSpellRules {
  return pruneUndefined({
    id: spell.id,
    element: spell.element,
    isDeckTracked: spell.id !== "coeur-de-lumiere" && spell.id !== "cycle-elementaire" && spell.id !== "feu-follet",
    maxCastsPerTurn: getConstraintValue(spell, "maxCastsPerTurn"),
    maxCastsPerTarget: getConstraintValue(spell, "maxCastsPerTarget"),
    cooldownTurns: getConstraintValue(spell, "cooldownTurns"),
    requiredTarget: getRequiredTarget(spell),
  }) as RustSpellRules;
}

function createRustHuppermageState(input: {
  activeRunes?: Partial<Record<Rune, boolean>>;
  lastGeneratedRune?: Rune | null;
  activePassives?: string[];
  usedSpellIds?: string[];
  feuFolletsActive?: number;
  temporaryUnlockedSpellElement?: Element | null;
  cooldownsBySpellId?: Record<string, number>;
} = {}) {
  return {
    runes: {
      active: {
        incandescent: input.activeRunes?.incandescent ?? false,
        aquatic: input.activeRunes?.aquatic ?? false,
        telluric: input.activeRunes?.telluric ?? false,
        aerial: input.activeRunes?.aerial ?? false,
      },
      lastGeneratedRune: input.lastGeneratedRune ?? null,
    },
    runeApGainsThisTurn: {
      incandescent: false,
      aquatic: false,
      telluric: false,
      aerial: false,
    },
    abundanceLevel: 0,
    feuFolletsActive: input.feuFolletsActive ?? 0,
    feuFolletStoredRunes: [],
    feuFolletStoredLastRunes: [],
    temporaryUnlockedSpellElement: input.temporaryUnlockedSpellElement ?? null,
    usedSpellIds: input.usedSpellIds ?? [],
    activePassives: input.activePassives ?? [],
    activeHeart: null,
    bqMax: 1_000,
    storedBq: 0,
    cooldownsBySpellId: input.cooldownsBySpellId ?? {},
    deckSpellLimit: 12,
    passiveLimit: 6,
  };
}

function getConstraintValue(
  spell: CatalogEntry,
  type: "maxCastsPerTurn" | "maxCastsPerTarget" | "cooldownTurns",
): number | undefined {
  const constraint = spell.constraints.find((constraint) => constraint.type === type);
  return constraint && "value" in constraint ? constraint.value : undefined;
}

function getRequiredTarget(spell: CatalogEntry): ActionTarget["kind"] | undefined {
  const constraint = spell.constraints.find((constraint) => constraint.type === "requiresTarget");
  return constraint?.type === "requiresTarget" ? constraint.target : undefined;
}

function requireSpell(spellId: string): CatalogEntry {
  const spell = huppermageCatalog.find((entry) => entry.id === spellId && entry.kind === "spell");
  if (!spell) {
    throw new Error(`Missing Huppermage spell fixture '${spellId}'.`);
  }
  return spell;
}

function getDeckLimitUsedSpellIds(excludedSpellId: string): string[] {
  return getHuppermageSpells()
    .map((spell) => spell.id)
    .filter((spellId) =>
      spellId !== excludedSpellId
      && spellId !== "coeur-de-lumiere"
      && spellId !== "cycle-elementaire"
      && spellId !== "feu-follet"
    )
    .slice(0, 12);
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)) as T;
}

function normalizeStatsForRust(stats: BaseStats) {
  return {
    generalMastery: stats.generalMastery ?? 0,
    elementalMastery: {
      fire: stats.elementalMastery.fire ?? 0,
      water: stats.elementalMastery.water ?? 0,
      earth: stats.elementalMastery.earth ?? 0,
      air: stats.elementalMastery.air ?? 0,
      light: stats.elementalMastery.light ?? 0,
      neutral: stats.elementalMastery.neutral ?? 0,
    },
    meleeMastery: stats.meleeMastery ?? 0,
    distanceMastery: stats.distanceMastery ?? 0,
    berserkMastery: stats.berserkMastery ?? 0,
    rearMastery: stats.rearMastery ?? 0,
    criticalMastery: stats.criticalMastery ?? 0,
    damageInflictedPercent: stats.damageInflictedPercent ?? 0,
    healsPerformedPercent: stats.healsPerformedPercent ?? 0,
    healsReceivedPercent: stats.healsReceivedPercent ?? 0,
    armorReceivedPercent: stats.armorReceivedPercent ?? 0,
    elementalResistance: stats.elementalResistance ?? 0,
    range: stats.range ?? 0,
    willpower: stats.willpower ?? 0,
    criticalHitPercent: stats.criticalHitPercent ?? 0,
    parry: stats.parry ?? 0,
    damageReceivedPercent: (stats as BaseStats & { damageReceivedPercent?: number }).damageReceivedPercent ?? 0,
  };
}
