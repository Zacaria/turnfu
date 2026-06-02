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
  simulateCombo,
  simulateTurn,
  type ActionContext,
  type ActionTarget,
  type BaseStats,
  type ComboPlan,
  type ComboSimulationResult,
  type ClassTurnState,
  type ResourcePool,
  type SimulationViolation,
  type SimulatedCharacter,
} from "../simulation/index.ts";
import { evaluateSustainableCycle, scoreComboSimulation } from "./comboOptimizer.ts";
import { createRustWasmOptimizerRequest, type RustWasmOptimizerRequest } from "./rustWasmBackendTypes.ts";
import { sublimationCatalog } from "../sublimations/catalog.ts";

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
    }
  | {
      kind: "multiTurn";
      name: string;
      operation: "nextTurnState";
      turnIndex: number;
      baseResources: ResourcePool;
      previousResources: ResourcePool;
      previousHuppermage: ReturnType<typeof normalizeHuppermageForRust>;
      castsBySpellId: Record<string, number>;
      expected: unknown;
    }
  | {
      kind: "multiTurn";
      name: string;
      operation: "feuFolletRecover";
      turnIndex: number;
      actionIndex: number;
      huppermageState: ReturnType<typeof normalizeHuppermageForRust>;
      expected: unknown;
    }
  | {
      kind: "multiTurn";
      name: string;
      operation: "sustainability";
      required: boolean;
      firstSummary: ReturnType<typeof createRustSimulationSummary>;
      replaySummary: ReturnType<typeof createRustSimulationSummary>;
      expected: unknown;
    }
  | {
      kind: "candidateBatch";
      name: string;
      seed: string;
      request: RustWasmOptimizerRequest;
      candidates: GeneratedCandidate[];
      resources: ResourcePool;
      stats: ReturnType<typeof normalizeStatsForRust>;
      initialHuppermage: ReturnType<typeof createRustHuppermageState>;
      spellBook: Record<string, GeneratedSpellProjection>;
      expected: unknown;
    };

export type RustWasmDifferentialFixtureOptions = {
  candidateBatchSeeds?: readonly string[];
  candidatesPerBatch?: number;
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

export type GeneratedCandidate = {
  id: string;
  passiveIds?: string[];
  sublimationIds?: string[];
  plan: ComboPlan;
};

export type GeneratedSpellProjection = {
  id: string;
  cost: Required<SpellCost>;
  damageEffects: DamageEffect[];
  rules: RustSpellRules;
};

const resources = ["ap", "mp", "wp", "bq"] as const;

const baseResources = createResources({ ap: 20, mp: 10, wp: 10, bq: 2_000 });

export const rustWasmDifferentialCiFixtureOptions = {
  candidateBatchSeeds: ["rust-wasm-differential-ci"],
  candidatesPerBatch: 24,
} satisfies Required<RustWasmDifferentialFixtureOptions>;

export const rustWasmDifferentialSoakFixtureOptions = {
  candidateBatchSeeds: Array.from({ length: 8 }, (_, index) => `rust-wasm-differential-soak:${index}`),
  candidatesPerBatch: 128,
} satisfies Required<RustWasmDifferentialFixtureOptions>;

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

export function createRustWasmDifferentialFixtures(
  options: RustWasmDifferentialFixtureOptions = {},
): RustWasmDifferentialFixture[] {
  const normalizedOptions = normalizeRustWasmDifferentialFixtureOptions(options);

  return [
    ...createSpellCostFixtures(),
    ...createDamageFixtures(),
    ...createInitialPassiveFixtures(),
    ...createInvalidPlanFixtures(),
    ...createMultiTurnFixtures(),
    ...createSeededCandidateBatchFixtures(normalizedOptions),
  ];
}

function normalizeRustWasmDifferentialFixtureOptions(
  options: RustWasmDifferentialFixtureOptions,
): Required<RustWasmDifferentialFixtureOptions> {
  const candidateBatchSeeds = Array.from(
    options.candidateBatchSeeds ?? rustWasmDifferentialCiFixtureOptions.candidateBatchSeeds,
  );
  const candidatesPerBatch = options.candidatesPerBatch
    ?? rustWasmDifferentialCiFixtureOptions.candidatesPerBatch;

  if (!Number.isInteger(candidatesPerBatch) || candidatesPerBatch < 1) {
    throw new Error(`Expected candidatesPerBatch to be a positive integer, got ${candidatesPerBatch}.`);
  }

  return {
    candidateBatchSeeds,
    candidatesPerBatch,
  };
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

function createMultiTurnFixtures(): RustWasmDifferentialFixture[] {
  const fixtures: RustWasmDifferentialFixture[] = [];
  const transitionCharacter = createBaseCharacter(createResources({ ap: 20, mp: 10, wp: 8, bq: 2_000 }));
  const transitionCombo = simulateCombo({
    catalog: huppermageCatalog,
    character: transitionCharacter,
    combo: {
      turns: [
        { actions: [{ spellId: "lueur-de-laube" }, { spellId: "fleche-de-lumiere" }] },
        { actions: [] },
        { actions: [] },
      ],
    },
  });

  fixtures.push(createNextTurnFixture("multi-turn:rune-resource-cooldown-carry", transitionCharacter, transitionCombo, 0));
  fixtures.push(createNextTurnFixture("multi-turn:cooldown-aging", transitionCharacter, transitionCombo, 1));

  const heartCharacter = createBaseCharacter(
    createResources({ ap: 20, mp: 10, wp: 8, bq: 2_000 }),
    { activePassives: ["extension-des-sens"] },
  );
  const heartCombo = simulateCombo({
    catalog: huppermageCatalog,
    character: heartCharacter,
    combo: {
      turns: [
        { actions: [{ spellId: "lueur-de-laube" }, { spellId: "coeur-de-lumiere" }] },
        { actions: [] },
      ],
    },
  });
  fixtures.push(createNextTurnFixture("multi-turn:stored-bq-and-passives", heartCharacter, heartCombo, 0));

  const feuFolletCharacter = createBaseCharacter(
    createResources({ ap: 20, mp: 10, wp: 8, bq: 2_000 }),
    { activePassives: ["sauvegarde-runique"] },
  );
  const feuFolletCombo = simulateCombo({
    catalog: huppermageCatalog,
    character: feuFolletCharacter,
    combo: {
      turns: [
        { actions: [{ spellId: "lueur-de-laube" }, { spellId: "feu-follet", target: { kind: "emptyCell" } }] },
        { actions: [{ spellId: "feu-follet", target: { kind: "feuFollet" } }] },
      ],
    },
  });
  const recoveryAction = feuFolletCombo.turns[1]?.result.breakdown[0];
  if (!recoveryAction?.classStateAfter.huppermage) {
    throw new Error("Expected Feu-Follet recovery fixture to produce a recovery action.");
  }
  fixtures.push({
    kind: "multiTurn",
    name: "multi-turn:feu-follet-recovery",
    operation: "feuFolletRecover",
    turnIndex: 1,
    actionIndex: 0,
    huppermageState: normalizeHuppermageForRust(feuFolletCombo.turns[1].initialCharacter.classState?.huppermage),
    expected: {
      state: normalizeHuppermageForRust(recoveryAction.classStateAfter.huppermage),
      operation: "recovered",
      before: 1,
      after: 0,
      recoveredRunes: ["aquatic", "telluric", "aerial"],
      temporaryUnlockedSpellElement: "air",
    },
  });

  fixtures.push(createSustainabilityFixture(
    "multi-turn:sustainable-cycle-replay",
    { turns: [{ actions: [{ spellId: "lueur-de-laube" }] }] },
    createBaseCharacter(createResources({ ap: 20, mp: 10, wp: 8, bq: 2_000 })),
  ));
  fixtures.push(createSustainabilityFixture(
    "multi-turn:unsustainable-cycle-replay",
    { turns: [{ actions: [{ spellId: "fleche-de-lumiere" }] }] },
    createBaseCharacter(createResources({ ap: 20, mp: 10, wp: 8, bq: 2_000 })),
  ));

  return fixtures;
}

function createSeededCandidateBatchFixtures(
  options: Required<RustWasmDifferentialFixtureOptions>,
): RustWasmDifferentialFixture[] {
  const spellIds = [
    "epee-de-lumiere",
    "faisceau-de-lune",
    "resonance",
    "fleche-de-lumiere",
    "larmes-scintillantes",
    "lueur-de-laube",
    "disque-luminescent",
    "flux-denergie",
    "debacle",
    "averse",
    "eboulement",
    "faille",
    "mirage",
    "ombres-dansantes",
  ];
  const spellBook = Object.fromEntries(spellIds.map((spellId) => {
    const spell = requireSpell(spellId);
    return [spellId, createGeneratedSpellProjection(spell)];
  }));

  const supportedSublimationIds = getSupportedSublimationIds();
  return options.candidateBatchSeeds.flatMap((seed) => {
    const normalCharacter = createGeneratedBatchCharacter("normal");
    const candidates = [
      ...createSeededGeneratedCandidates(seed, spellIds, options.candidatesPerBatch),
      ...createSublimationGeneratedCandidates(seed, supportedSublimationIds),
    ];

    const normalFixture: RustWasmDifferentialFixture = {
      kind: "candidateBatch",
      name: `candidate-batch:${seed}`,
      seed,
      request: createRustWasmOptimizerRequest({
        catalog: huppermageCatalog,
        character: normalCharacter,
        duration: 3,
        engines: ["hybrid"],
        budget: { iterations: candidates.length },
        seed,
        availableSpellIds: spellIds,
        maxActionsPerTurn: 4,
        maxPassiveCount: 0,
        maxSublimationCount: 2,
        availableSublimationIds: supportedSublimationIds,
      }),
      candidates,
      resources: normalCharacter.resources,
      stats: normalizeStatsForRust(normalCharacter.stats),
      initialHuppermage: createRustHuppermageState({ bqMax: normalCharacter.resources.bq }),
      spellBook,
      expected: candidates.map((candidate) => evaluateGeneratedCandidateWithTypeScript(candidate, normalCharacter)),
    };

    return [
      normalFixture,
      createSublimationAssumptionCandidateBatchFixture(seed, "healthy90", spellIds, spellBook, [
        "agilite-vitale-ii",
        "carnage-iii",
        "force-vitale-ii",
        "influence-vitale-iii",
      ]),
      createSublimationAssumptionCandidateBatchFixture(seed, "berserk50", spellIds, spellBook, [
        "critique-berserk-iii",
      ]),
      createLowApSublimationCandidateBatchFixture(seed, spellIds, spellBook),
    ];
  });
}

function createSublimationAssumptionCandidateBatchFixture(
  seed: string,
  hpAssumption: NonNullable<NonNullable<SimulatedCharacter["sublimations"]>["hpAssumption"]>,
  spellIds: string[],
  spellBook: Record<string, GeneratedSpellProjection>,
  sublimationIds: string[],
): RustWasmDifferentialFixture {
  const character = createGeneratedBatchCharacter(hpAssumption);
  const candidates = sublimationIds.map((sublimationId) =>
    createSublimationGeneratedCandidate(`${seed}:sublimation:${hpAssumption}`, sublimationId)
  );

  return {
    kind: "candidateBatch",
    name: `candidate-batch:${seed}:${hpAssumption}`,
    seed: `${seed}:${hpAssumption}`,
    request: createRustWasmOptimizerRequest({
      catalog: huppermageCatalog,
      character,
      duration: 3,
      engines: ["hybrid"],
      budget: { iterations: candidates.length },
      seed: `${seed}:${hpAssumption}`,
      availableSpellIds: spellIds,
      maxActionsPerTurn: 12,
      maxPassiveCount: 0,
      maxSublimationCount: 2,
      availableSublimationIds: getSupportedSublimationIds(),
    }),
    candidates,
    resources: character.resources,
    stats: normalizeStatsForRust(character.stats),
    initialHuppermage: createRustHuppermageState({ bqMax: character.resources.bq }),
    spellBook,
    expected: candidates.map((candidate) => evaluateGeneratedCandidateWithTypeScript(candidate, character)),
  };
}

function createLowApSublimationCandidateBatchFixture(
  seed: string,
  spellIds: string[],
  spellBook: Record<string, GeneratedSpellProjection>,
): RustWasmDifferentialFixture {
  const character = {
    ...createGeneratedBatchCharacter("normal"),
    resources: createResources({ ap: 10, mp: 6, wp: 6, bq: 3_000 }),
    stats: {
      ...baseStats,
      meleeMastery: 0,
      distanceMastery: 0,
      berserkMastery: 0,
      rearMastery: 0,
      criticalMastery: 0,
    },
  } satisfies SimulatedCharacter;
  const candidates = ["inflexibilite", "inflexibilite-ii", "secret-critique"].map((sublimationId) =>
    createSublimationGeneratedCandidate(`${seed}:sublimation:low-ap`, sublimationId)
  );

  return {
    kind: "candidateBatch",
    name: `candidate-batch:${seed}:low-ap`,
    seed: `${seed}:low-ap`,
    request: createRustWasmOptimizerRequest({
      catalog: huppermageCatalog,
      character,
      duration: 3,
      engines: ["hybrid"],
      budget: { iterations: candidates.length },
      seed: `${seed}:low-ap`,
      availableSpellIds: spellIds,
      maxActionsPerTurn: 12,
      maxPassiveCount: 0,
      maxSublimationCount: 2,
      availableSublimationIds: getSupportedSublimationIds(),
    }),
    candidates,
    resources: character.resources,
    stats: normalizeStatsForRust(character.stats),
    initialHuppermage: createRustHuppermageState({ bqMax: character.resources.bq }),
    spellBook,
    expected: candidates.map((candidate) => evaluateGeneratedCandidateWithTypeScript(candidate, character)),
  };
}

function createSublimationGeneratedCandidates(seed: string, sublimationIds: string[]): GeneratedCandidate[] {
  return [
    ...sublimationIds.map((sublimationId) => createSublimationGeneratedCandidate(seed, sublimationId)),
    {
      id: `${seed}:sublimation:invalid-sublimation`,
      sublimationIds: ["absolution"],
      plan: { turns: [{ actions: [{ spellId: "lueur-de-laube" }] }] },
    },
  ];
}

function createSublimationGeneratedCandidate(seed: string, sublimationId: string): GeneratedCandidate {
  return {
    id: `${seed}:sublimation:${sublimationId}`,
    sublimationIds: [sublimationId],
    plan: createSublimationPlan(sublimationId),
  };
}

function createSublimationPlan(sublimationId: string): ComboPlan {
  const familyId = requireSublimationFamilyId(sublimationId);
  if (familyId === "brulure") {
    return { turns: [{ actions: [{ spellId: "lueur-de-laube" }] }] };
  }
  if (familyId === "gel") {
    return { turns: [{ actions: [{ spellId: "debacle" }] }] };
  }
  if (familyId === "tellurisme") {
    return { turns: [{ actions: [{ spellId: "eboulement" }] }] };
  }
  if (familyId === "ventilation") {
    return { turns: [{ actions: [{ spellId: "mirage" }] }] };
  }
  if (familyId === "brulure-secondaire") {
    return { turns: [{ actions: [{ spellId: "debacle" }, { spellId: "lueur-de-laube" }] }] };
  }
  if (familyId === "gel-secondaire") {
    return { turns: [{ actions: [{ spellId: "lueur-de-laube" }, { spellId: "debacle" }] }] };
  }
  if (familyId === "tellurisme-secondaire") {
    return { turns: [{ actions: [{ spellId: "lueur-de-laube" }, { spellId: "eboulement" }] }] };
  }
  if (familyId === "ventilation-secondaire") {
    return { turns: [{ actions: [{ spellId: "lueur-de-laube" }, { spellId: "mirage" }] }] };
  }
  if (familyId === "alternance") {
    return { turns: [{ actions: [{ spellId: "lueur-de-laube" }, { spellId: "debacle" }] }] };
  }
  if (familyId === "exces") {
    return {
      turns: [
        { actions: [{ spellId: "lueur-de-laube" }, { spellId: "flux-denergie" }, { spellId: "disque-luminescent" }, { spellId: "debacle" }] },
        { actions: [{ spellId: "eboulement" }, { spellId: "mirage" }, { spellId: "resonance" }, { spellId: "larmes-scintillantes" }] },
        { actions: [{ spellId: "faisceau-de-lune" }, { spellId: "epee-de-lumiere" }, { spellId: "ombres-dansantes" }] },
      ],
    };
  }
  if (familyId === "puissance-brute") {
    return { turns: [{ actions: [{ spellId: "averse" }, { spellId: "averse" }, { spellId: "lueur-de-laube" }] }] };
  }
  if (familyId === "sauvegarde" || familyId === "tolerance") {
    return { turns: [{ actions: [{ spellId: "lueur-de-laube" }] }, { actions: [{ spellId: "debacle" }] }] };
  }
  return { turns: [{ actions: [{ spellId: "lueur-de-laube", context: { criticalMode: "expected" } }] }] };
}

function getSupportedSublimationIds(): string[] {
  return sublimationCatalog
    .filter((entry) => entry.supportStatus === "supported")
    .map((entry) => entry.id)
    .sort();
}

function requireSublimationFamilyId(sublimationId: string): string {
  const sublimation = sublimationCatalog.find((entry) => entry.id === sublimationId);
  if (!sublimation) {
    throw new Error(`Missing sublimation fixture '${sublimationId}'.`);
  }
  return sublimation.familyId;
}

function createSeededGeneratedCandidates(seed: string, spellIds: string[], count: number): GeneratedCandidate[] {
  const rng = createSeededRandom(seed);
  const candidates: GeneratedCandidate[] = [];

  for (let candidateIndex = 0; candidateIndex < count; candidateIndex += 1) {
    const turns = Array.from({ length: 3 }, () => ({
      actions: Array.from({ length: rng.integer(1, 4) }, () => ({
        spellId: rng.pick(spellIds),
      })),
    }));

    candidates.push({
      id: `${seed}:${candidateIndex}`,
      plan: { turns },
    });
  }

  return candidates;
}

function evaluateGeneratedCandidateWithTypeScript(
  candidate: GeneratedCandidate,
  character: SimulatedCharacter,
) {
  const activePassives = candidate.passiveIds ?? [];
  const sublimationIds = candidate.sublimationIds ?? [];
  const candidateCharacter: SimulatedCharacter = {
    ...character,
    classState: {
      ...character.classState,
      huppermage: {
        ...character.classState?.huppermage,
        activePassives,
      },
    },
    sublimations: sublimationIds.length > 0
      ? {
        ...character.sublimations,
        selections: sublimationIds.map((sublimationId) => ({ sublimationId })),
        hpAssumption: character.sublimations?.hpAssumption ?? "normal",
      }
      : character.sublimations,
  };
  const simulation = simulateCombo({
    catalog: huppermageCatalog,
    character: candidateCharacter,
    combo: candidate.plan,
  });

  return normalizeGeneratedCandidateResult(candidate.id, simulation);
}

export function normalizeGeneratedCandidateResult(
  candidateId: string,
  simulation: ComboSimulationResult,
) {
  return pruneUndefined({
    candidateId,
    valid: simulation.valid,
    totalDamage: simulation.totalDamage,
    finalResources: simulation.finalState.remainingResources,
    finalHuppermage: normalizeHuppermageForRust(simulation.finalState.classState.huppermage),
    score: simulation.valid ? scoreComboSimulation(simulation) : undefined,
    firstViolation: simulation.violations[0]
      ? {
        turnIndex: simulation.violations[0].turnIndex,
        ...normalizeViolation(simulation.violations[0]),
      }
      : undefined,
  });
}

function createNextTurnFixture(
  name: string,
  baseCharacter: SimulatedCharacter,
  simulation: ComboSimulationResult,
  turnIndex: number,
): RustWasmDifferentialFixture {
  if (!simulation.valid) {
    throw new Error(`Expected valid multi-turn fixture '${name}'.`);
  }

  const completedTurn = simulation.turns[turnIndex];
  const nextTurn = simulation.turns[turnIndex + 1];
  if (!completedTurn?.result.finalState.classState.huppermage || !nextTurn?.initialCharacter.classState?.huppermage) {
    throw new Error(`Missing turn state for fixture '${name}'.`);
  }

  return {
    kind: "multiTurn",
    name,
    operation: "nextTurnState",
    turnIndex,
    baseResources: baseCharacter.resources,
    previousResources: completedTurn.result.finalState.remainingResources,
    previousHuppermage: normalizeHuppermageForRust(completedTurn.result.finalState.classState.huppermage),
    castsBySpellId: completedTurn.result.finalState.castsBySpellId,
    expected: {
      resources: nextTurn.initialCharacter.resources,
      huppermage: normalizeHuppermageForRust(nextTurn.initialCharacter.classState.huppermage),
    },
  };
}

function createSustainabilityFixture(
  name: string,
  plan: ComboPlan,
  character: SimulatedCharacter,
): RustWasmDifferentialFixture {
  const firstRun = simulateCombo({
    catalog: huppermageCatalog,
    character,
    combo: plan,
  });
  const sustainability = evaluateSustainableCycle({
    catalog: huppermageCatalog,
    character,
    plan,
  });
  if (!sustainability.replay) {
    throw new Error(`Expected sustainability replay for fixture '${name}'.`);
  }

  return {
    kind: "multiTurn",
    name,
    operation: "sustainability",
    required: true,
    firstSummary: createRustSimulationSummary(firstRun, character.resources),
    replaySummary: createRustSimulationSummary(
      sustainability.replay,
      firstRun.finalState.remainingResources,
    ),
    expected: {
      required: true,
      sustainable: sustainability.sustainable,
      initialWp: firstRun.finalState.remainingResources.wp,
      finalWp: sustainability.replay.finalState.remainingResources.wp,
      initialBq: firstRun.finalState.remainingResources.bq,
      finalBq: sustainability.replay.finalState.remainingResources.bq,
    },
  };
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

function createGeneratedBatchCharacter(
  hpAssumption: NonNullable<NonNullable<SimulatedCharacter["sublimations"]>["hpAssumption"]> = "normal",
): SimulatedCharacter {
  return {
    ...createBaseCharacter(createResources({ ap: 30, mp: 6, wp: 6, bq: 3_000 })),
    sublimations: {
      selections: [],
      hpAssumption,
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

function createGeneratedSpellProjection(spell: CatalogEntry): GeneratedSpellProjection {
  return {
    id: spell.id,
    cost: normalizeCost(spell.cost),
    damageEffects: spell.effects.filter((effect): effect is DamageEffect => effect.type === "damage"),
    rules: createRustSpellRules(spell),
  };
}

function createRustHuppermageState(input: {
  activeRunes?: Partial<Record<Rune, boolean>>;
  lastGeneratedRune?: Rune | null;
  runeApGainsThisTurn?: Partial<Record<Rune, boolean>>;
  abundanceLevel?: number;
  activePassives?: string[];
  usedSpellIds?: string[];
  feuFolletsActive?: number;
  feuFolletStoredRunes?: Rune[][];
  feuFolletStoredLastRunes?: Array<Rune | null>;
  temporaryUnlockedSpellElement?: Element | null;
  activeHeart?: string | null;
  bqMax?: number;
  storedBq?: number;
  cooldownsBySpellId?: Record<string, number>;
  deckSpellLimit?: number;
  passiveLimit?: number;
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
      incandescent: input.runeApGainsThisTurn?.incandescent ?? false,
      aquatic: input.runeApGainsThisTurn?.aquatic ?? false,
      telluric: input.runeApGainsThisTurn?.telluric ?? false,
      aerial: input.runeApGainsThisTurn?.aerial ?? false,
    },
    abundanceLevel: input.abundanceLevel ?? 0,
    feuFolletsActive: input.feuFolletsActive ?? 0,
    feuFolletStoredRunes: input.feuFolletStoredRunes ?? [],
    feuFolletStoredLastRunes: input.feuFolletStoredLastRunes ?? [],
    temporaryUnlockedSpellElement: input.temporaryUnlockedSpellElement ?? null,
    usedSpellIds: input.usedSpellIds ?? [],
    activePassives: input.activePassives ?? [],
    activeHeart: input.activeHeart ?? null,
    bqMax: input.bqMax ?? 1_000,
    storedBq: input.storedBq ?? 0,
    cooldownsBySpellId: input.cooldownsBySpellId ?? {},
    deckSpellLimit: input.deckSpellLimit ?? 12,
    passiveLimit: input.passiveLimit ?? 6,
  };
}

function normalizeHuppermageForRust(
  huppermage: ClassTurnState["huppermage"] | NonNullable<SimulatedCharacter["classState"]>["huppermage"],
) {
  const raw = huppermage as
    | (NonNullable<ClassTurnState["huppermage"]> & { lastGeneratedRune?: Rune | null })
    | undefined;
  const runes = raw?.runes as { active?: Partial<Record<Rune, boolean>>; lastGeneratedRune?: Rune | null } | Partial<Record<Rune, boolean>> | undefined;
  const activeRunes = runes && "active" in runes ? runes.active : runes;
  const lastGeneratedRune = runes && "lastGeneratedRune" in runes
    ? runes.lastGeneratedRune
    : raw?.lastGeneratedRune;

  return createRustHuppermageState({
    activeRunes,
    lastGeneratedRune: lastGeneratedRune ?? null,
    activePassives: huppermage?.activePassives ?? [],
    usedSpellIds: huppermage?.usedSpellIds ?? [],
    feuFolletsActive: huppermage?.feuFolletsActive ?? 0,
    temporaryUnlockedSpellElement: huppermage?.temporaryUnlockedSpellElement ?? null,
    cooldownsBySpellId: huppermage?.cooldownsBySpellId ?? {},
    runeApGainsThisTurn: huppermage?.runeApGainsThisTurn,
    abundanceLevel: huppermage?.abundanceLevel,
    feuFolletStoredRunes: huppermage?.feuFolletStoredRunes,
    feuFolletStoredLastRunes: huppermage?.feuFolletStoredLastRunes,
    activeHeart: huppermage?.activeHeart,
    bqMax: huppermage?.bqMax,
    storedBq: huppermage?.storedBq,
    deckSpellLimit: huppermage?.deckSpellLimit,
    passiveLimit: huppermage?.passiveLimit,
  });
}

function createRustSimulationSummary(
  simulation: ComboSimulationResult,
  initialResources: ResourcePool,
) {
  return {
    valid: simulation.valid,
    totalDamage: simulation.totalDamage,
    damageByResolvedElement: {
      fire: 0,
      water: 0,
      earth: 0,
      air: 0,
      light: 0,
      neutral: 0,
    },
    initialResources,
    finalResources: simulation.finalState.remainingResources,
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

type SeededRandom = {
  next(): number;
  integer(min: number, max: number): number;
  pick<T>(values: T[]): T;
};

function createSeededRandom(seed: string): SeededRandom {
  let state = hashSeed(seed);

  return {
    next() {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    },
    integer(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick(values) {
      return values[this.integer(0, values.length - 1)]!;
    },
  };
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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
