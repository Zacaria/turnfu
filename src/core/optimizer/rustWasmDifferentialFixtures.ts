import {
  getHuppermagePassives,
  getHuppermageSpells,
  huppermageCatalog,
  type CatalogEntry,
  type DamageEffect,
  type Effect,
  type Resource,
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
  type BaseStats,
  type ResourcePool,
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
