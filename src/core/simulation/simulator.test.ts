import assert from "node:assert/strict";
import test from "node:test";

import {
  cost,
  damage,
  maxCastsPerTarget,
  maxCastsPerTurn,
  movement,
  normalizeCatalog,
  passive,
  range,
  requiresTarget,
  resourceDelta,
  screenshot,
  spell,
  statModifier,
  tag,
  when,
} from "../catalog/index.ts";
import { createResources, roundDamage, simulateTurn } from "./index.ts";
import type { CatalogEntry } from "../catalog/types.ts";
import type { SimulatedCharacter } from "./types.ts";

const source = screenshot("/tmp/simulation-test.png", "simulation-test");

const testCatalog = normalizeCatalog([
  spell("lueur-test", {
    name: "Lueur Test",
    level: 200,
    element: "light",
    cost: cost({ ap: 2 }),
    effects: [
      damage({ element: "light", base: 30 }),
      resourceDelta({ resource: "bq", amount: 10 }),
    ],
    constraints: [maxCastsPerTurn(2)],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("distance-damage-test", {
    name: "Distance Damage Test",
    level: 200,
    element: "fire",
    cost: cost({ ap: 1 }),
    range: range(1, 4),
    effects: [damage({ element: "fire", base: 10 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("water-damage-test", {
    name: "Water Damage Test",
    level: 200,
    element: "water",
    cost: cost({ ap: 1 }),
    effects: [damage({ element: "water", base: 10 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("water-trigger-test", {
    name: "Water Trigger Test",
    level: 200,
    element: "water",
    cost: cost({ ap: 1 }),
    effects: [],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("earth-trigger-test", {
    name: "Earth Trigger Test",
    level: 200,
    element: "earth",
    cost: cost({ ap: 1 }),
    effects: [],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("air-trigger-test", {
    name: "Air Trigger Test",
    level: 200,
    element: "air",
    cost: cost({ ap: 1 }),
    effects: [],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("earth-damage-test", {
    name: "Earth Damage Test",
    level: 200,
    element: "earth",
    cost: cost({ ap: 1 }),
    effects: [damage({ element: "earth", base: 10 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("air-damage-test", {
    name: "Air Damage Test",
    level: 200,
    element: "air",
    cost: cost({ ap: 1 }),
    effects: [damage({ element: "air", base: 10 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("cost-10-test", {
    name: "Cost 10 Test",
    level: 200,
    cost: cost({ ap: 10 }),
    effects: [],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("orbe-test", {
    name: "Orbe Test",
    level: 200,
    element: "light",
    cost: cost({ ap: 4, bq: 20 }),
    effects: [damage({ element: "light", base: 80 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("mp-test", {
    name: "MP Test",
    level: 200,
    element: "earth",
    cost: cost({ mp: 2 }),
    effects: [damage({ element: "earth", base: 10 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("wp-test", {
    name: "WP Test",
    level: 200,
    element: "water",
    cost: cost({ wp: 1 }),
    effects: [damage({ element: "water", base: 10 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("boost-test", {
    name: "Boost Test",
    level: 200,
    effects: [
      statModifier({
        stat: "damageInflictedPercent",
        amount: 10,
        target: "caster",
      }),
    ],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("fire-rune-test", {
    name: "Fire Rune Test",
    level: 200,
    element: "fire",
    cost: cost({ ap: 1 }),
    effects: [resourceDelta({ resource: "bq", amount: 15 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("water-rune-test", {
    name: "Water Rune Test",
    level: 200,
    element: "water",
    cost: cost({ ap: 1 }),
    effects: [resourceDelta({ resource: "bq", amount: 20 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("elemental-no-bq-test", {
    name: "Elemental No BQ Test",
    level: 200,
    element: "fire",
    cost: cost({ ap: 1 }),
    effects: [],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("earth-ap-test", {
    name: "Earth AP Test",
    level: 200,
    element: "earth",
    cost: cost({ ap: 3 }),
    effects: [],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("light-no-bq-test", {
    name: "Light No BQ Test",
    level: 200,
    element: "light",
    cost: cost({ ap: 2 }),
    effects: [],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("neutral-no-bq-test", {
    name: "Neutral No BQ Test",
    level: 200,
    element: "neutral",
    cost: cost({ ap: 1 }),
    effects: [],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("air-movement-test", {
    name: "Air Movement Test",
    level: 200,
    element: "air",
    cost: cost({ ap: 2 }),
    effects: [movement({ mode: "push", target: "target", cells: 1 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("papillons-test", {
    name: "Papillons Test",
    level: 200,
    element: "air",
    cost: cost({ ap: 2 }),
    effects: [
      when({ type: "hasRune", rune: "aquatic" }, [movement({ mode: "pull", target: "target", cells: 1 })]),
      when({ type: "hasRune", rune: "telluric" }, [movement({ mode: "push", target: "target", cells: 1 })]),
    ],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("feu-follet-test", {
    name: "Feu-Follet Test",
    level: 200,
    cost: cost({ ap: 1 }),
    effects: [],
    constraints: [],
    tags: ["feu-follet"],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("consume-runes-test", {
    name: "Consume Runes Test",
    level: 200,
    effects: [tag("consumesRunes", true)],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("consume-all-runes-test", {
    name: "Consume All Runes Test",
    level: 200,
    effects: [
      when({ type: "exactRuneCount", count: 2 }, [tag("consumeAllRunes", true)]),
    ],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("disque-luminescent-test", {
    name: "Disque Luminescent Test",
    level: 200,
    element: "fire",
    effects: [
      when({ type: "exactRuneCount", count: 3 }, [tag("consumeAllRunes", true)]),
    ],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("rayon-crepusculaire", {
    name: "Rayon Crepusculaire Test",
    level: 200,
    element: "light",
    effects: [
      damage({ element: "light", base: 100 }),
      when({ type: "hasRune", rune: "incandescent" }, [
        tag("damageInflictedPercentPerBqPercentRemaining", 0.5),
        tag("consumeRune", "incandescent"),
      ]),
    ],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("epee-de-lumiere", {
    name: "Epee de Lumiere Test",
    level: 200,
    element: "light",
    effects: [
      damage({ element: "light", base: 100 }),
      tag("lifeStealPercentPerRune", 30),
    ],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("lueur-de-laube", {
    name: "Lueur de l'Aube Test",
    level: 200,
    element: "fire",
    effects: [
      damage({ element: "fire", base: 100 }),
      when({ type: "hasRune", rune: "incandescent" }, [
        tag("delayedDamagePercentOfActionDamage", 10),
        tag("consumeRune", "incandescent"),
      ]),
    ],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("halo-chatoyant", {
    name: "Halo Chatoyant Test",
    level: 200,
    element: "light",
    effects: [
      when({ type: "hasRune", rune: "aerial" }, [
        tag("triggerMarkImmediately", true),
        tag("consumeRune", "aerial"),
      ]),
    ],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("runification-test", {
    name: "Runification Test",
    level: 200,
    cost: cost({ wp: 1 }),
    effects: [
      statModifier({
        stat: "damageInflictedPercent",
        amount: 10,
        duration: "1 turn",
        target: "caster",
      }),
      tag("dynamicBqCostPerRune", 40),
      tag("statModifiersScalePerRune", true),
      tag("consumesRunes", true),
    ],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("resonance-cost-test", {
    name: "Resonance Cost Test",
    level: 200,
    element: "light",
    cost: cost({ ap: 4 }),
    effects: [
      damage({ element: "light", base: 10 }),
      when({ type: "hasRune", rune: "aquatic" }, [tag("costDelta", "ap:-1")]),
      tag("additionalBqCostPerRune", 25),
    ],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("conditional-caster-buff-test", {
    name: "Conditional Caster Buff Test",
    level: 200,
    cost: cost({ ap: 1 }),
    effects: [
      when({ type: "hasRune", rune: "incandescent" }, [
        statModifier({ stat: "damageInflictedPercent", amount: 10, target: "caster" }),
      ]),
      damage({ element: "light", base: 10 }),
    ],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("coeur-de-lumiere", {
    name: "Coeur de Lumiere Test",
    level: 200,
    cost: cost({}),
    effects: [],
    constraints: [maxCastsPerTurn(1)],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("cycle-elementaire", {
    name: "Cycle Elementaire Test",
    level: 200,
    cost: cost({ ap: 1 }),
    effects: [],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("empty-cell-only-test", {
    name: "Empty Cell Only Test",
    level: 200,
    cost: cost({ ap: 1 }),
    effects: [],
    constraints: [requiresTarget("emptyCell")],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("target-limit-test", {
    name: "Target Limit Test",
    level: 200,
    element: "fire",
    cost: cost({ ap: 1 }),
    effects: [
      damage({ element: "fire", base: 10 }),
      resourceDelta({ resource: "bq", amount: 5 }),
    ],
    constraints: [
      maxCastsPerTurn(1),
      maxCastsPerTarget(1),
    ],
    metadata: { status: "extracted", sources: [source] },
  }),
  passive("motivation", {
    name: "Motivation Test",
    level: 35,
    effects: [
      resourceDelta({ resource: "ap", amount: 1 }),
      statModifier({ stat: "damageInflictedPercent", amount: -20, target: "caster" }),
      statModifier({ stat: "willpower", amount: 10, target: "caster" }),
    ],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  passive("carnage", {
    name: "Carnage Test",
    level: 110,
    effects: [
      statModifier({ stat: "damageInflictedPercent", amount: 15, target: "caster" }),
      statModifier({ stat: "damageInflictedPercent", amount: 10, target: "caster", note: "Aux cibles ayant de l'Armure." }),
      statModifier({ stat: "healsPerformedPercent", amount: -30, target: "caster" }),
    ],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  passive("inspiration", {
    name: "Inspiration Test",
    level: 25,
    effects: [
      statModifier({ stat: "damageInflictedPercent", amount: 10, target: "caster", note: "Aux combattants ayant plus d'Initiative." }),
    ],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
]) as CatalogEntry[];

const character: SimulatedCharacter = {
  id: "huppermage-test",
  className: "huppermage",
  resources: createResources({ ap: 6, mp: 3, wp: 1, bq: 0 }),
  stats: {
    generalMastery: 100,
    elementalMastery: {
      light: 200,
      earth: 50,
      water: 0,
    },
    damageInflictedPercent: 10,
  },
};

test("simulates a valid one-spell sequence", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: { actions: [{ spellId: "lueur-test" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.totalDamage, 82.5);
  assert.deepEqual(result.finalState.remainingResources, createResources({ ap: 4, mp: 3, wp: 1, bq: 10 }));
  assert.equal(result.breakdown.length, 1);
});

test("simulates a valid multi-spell sequence with resource changes", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: { ...character, resources: createResources({ ap: 8, mp: 3, wp: 1, bq: 0 }) },
    sequence: {
      actions: [
        { spellId: "lueur-test" },
        { spellId: "lueur-test" },
        { spellId: "orbe-test" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.totalDamage, 385);
  assert.deepEqual(result.finalState.remainingResources, createResources({ ap: 0, mp: 3, wp: 1, bq: 0 }));
  assert.deepEqual(result.finalState.castsBySpellId, {
    "lueur-test": 2,
    "orbe-test": 1,
  });
});

test("updates BQ in state and action breakdown during the turn", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: {
      actions: [
        { spellId: "fire-rune-test" },
        { spellId: "water-rune-test" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.remainingResources.bq, 85);
  assert.equal(result.breakdown[0].resourceBefore.bq, 0);
  assert.equal(result.breakdown[0].resourceAfter.bq, 40);
  assert.equal(result.breakdown[1].resourceBefore.bq, 40);
  assert.equal(result.breakdown[1].resourceAfter.bq, 85);
});

test("updates active runes and last generated rune during the turn", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: {
      actions: [
        { spellId: "fire-rune-test" },
        { spellId: "water-rune-test" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.aquatic, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.telluric, false);
  assert.equal(result.finalState.classState.huppermage?.runes.active.aerial, false);
  assert.equal(result.finalState.classState.huppermage?.runes.lastGeneratedRune, "aquatic");

  assert.equal(result.breakdown[0].classStateBefore.huppermage?.runes.active.incandescent, false);
  assert.equal(result.breakdown[0].classStateAfter.huppermage?.runes.active.incandescent, true);
  assert.equal(result.breakdown[0].classStateAfter.huppermage?.runes.lastGeneratedRune, "incandescent");
  assert.equal(result.breakdown[1].classStateBefore.huppermage?.runes.active.incandescent, true);
  assert.equal(result.breakdown[1].classStateAfter.huppermage?.runes.active.aquatic, true);
  assert.equal(result.breakdown[1].classStateAfter.huppermage?.runes.lastGeneratedRune, "aquatic");
});

test("grants 1 AP the first time each rune is generated during the turn", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: {
      actions: [
        { spellId: "fire-rune-test" },
        { spellId: "fire-rune-test" },
        { spellId: "water-rune-test" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.remainingResources.ap, 5);
  assert.equal(result.breakdown[0].resourceAfter.ap, 6);
  assert.equal(result.breakdown[1].resourceAfter.ap, 5);
  assert.equal(result.breakdown[2].resourceAfter.ap, 5);
  assert.deepEqual(result.finalState.classState.huppermage?.runeApGainsThisTurn, {
    incandescent: true,
    aquatic: true,
    telluric: false,
    aerial: false,
  });

  const apGainEffects = result.breakdown.flatMap((action) =>
    action.appliedEffects.filter((effect) => effect.type === "resourceDelta" && effect.resource === "ap")
  );
  assert.equal(apGainEffects.length, 2);
  assert.equal(apGainEffects[0].source, "huppermageClassMechanic");
  assert.equal(apGainEffects[1].source, "huppermageClassMechanic");
});

test("does not grant rune AP or update last generated rune when the rune is already active", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
          },
          lastGeneratedRune: null,
        },
      },
    },
    sequence: { actions: [{ spellId: "fire-rune-test" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].classStateBefore.huppermage?.runes.active.incandescent, true);
  assert.equal(result.breakdown[0].resourceAfter.ap, 5);
  assert.equal(result.finalState.classState.huppermage?.runes.lastGeneratedRune, null);
  assert.equal(result.finalState.classState.huppermage?.runeApGainsThisTurn.incandescent, false);
  assert.equal(result.breakdown[0].appliedEffects.some((effect) => effect.type === "runeGenerated"), false);
});

test("normal rune generation grants BQ and Abundance only when the rune is absent", () => {
  const firstGeneration = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: { actions: [{ spellId: "elemental-no-bq-test" }] },
  });

  assert.equal(firstGeneration.valid, true);
  assert.equal(firstGeneration.finalState.remainingResources.bq, 25);
  assert.equal(firstGeneration.finalState.classState.huppermage?.abundanceLevel, 15);

  const repeatedGeneration = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
          },
          lastGeneratedRune: null,
        },
      },
    },
    sequence: { actions: [{ spellId: "elemental-no-bq-test" }] },
  });

  assert.equal(repeatedGeneration.valid, true);
  assert.equal(repeatedGeneration.finalState.remainingResources.bq, 0);
  assert.equal(repeatedGeneration.finalState.classState.huppermage?.abundanceLevel, 0);
  assert.equal(repeatedGeneration.finalState.classState.huppermage?.runes.lastGeneratedRune, null);
});

test("allows rune AP after an initially active rune is consumed then generated", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "consume-runes-test" },
        { spellId: "fire-rune-test" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].classStateAfter.huppermage?.runes.active.incandescent, false);
  assert.equal(result.breakdown[0].appliedEffects.some((effect) => effect.type === "runeConsumed"), true);
  assert.equal(result.breakdown[1].resourceAfter.ap, 6);
  assert.equal(result.breakdown[1].classStateAfter.huppermage?.runes.lastGeneratedRune, "incandescent");
  assert.equal(result.finalState.classState.huppermage?.runeApGainsThisTurn.incandescent, true);
});

test("consumes all active runes from consumeAllRunes tags", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
            aquatic: true,
          },
        },
      },
    },
    sequence: { actions: [{ spellId: "consume-all-runes-test" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, false);
  assert.equal(result.finalState.classState.huppermage?.runes.active.aquatic, false);
  const consumed = result.breakdown[0].appliedEffects.find((effect) => effect.type === "runeConsumed");
  assert.ok(consumed && consumed.type === "runeConsumed");
  assert.deepEqual(consumed.runes, ["incandescent", "aquatic"]);
});

test("does not regenerate Disque Luminescent's fire rune when it consumed three active runes", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
            aquatic: true,
            telluric: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: { actions: [{ spellId: "disque-luminescent-test" }] },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.finalState.classState.huppermage?.runes.active, {
    incandescent: false,
    aquatic: false,
    telluric: false,
    aerial: false,
  });
  const consumed = result.breakdown[0].appliedEffects.find((effect) => effect.type === "runeConsumed");
  assert.ok(consumed && consumed.type === "runeConsumed");
  assert.deepEqual(consumed.runes, ["incandescent", "aquatic", "telluric"]);
  assert.equal(result.breakdown[0].appliedEffects.some((effect) => effect.type === "runeGenerated"), false);
});

test("regenerates the active heart rune after it is consumed with all runes", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activeHeart: "fire",
          runes: {
            incandescent: true,
            aquatic: true,
            telluric: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: { actions: [{ spellId: "disque-luminescent-test" }] },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.finalState.classState.huppermage?.runes.active, {
    incandescent: true,
    aquatic: false,
    telluric: false,
    aerial: false,
  });
  assert.equal(result.finalState.classState.huppermage?.runes.lastGeneratedRune, "incandescent");
  assert.equal(result.finalState.remainingResources.bq, 100);
  assert.equal(result.finalState.classState.huppermage?.abundanceLevel, 60);
});

test("does not regenerate an absent heart rune when another rune is consumed", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 2, bq: 200 }),
      classState: {
        huppermage: {
          activeHeart: "fire",
          runes: {
            aquatic: true,
            telluric: true,
          },
          lastGeneratedRune: "telluric",
        },
      },
    },
    sequence: { actions: [{ spellId: "runification-test" }] },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.finalState.classState.huppermage?.runes.active, {
    incandescent: false,
    aquatic: false,
    telluric: false,
    aerial: false,
  });
  assert.notEqual(result.finalState.classState.huppermage?.runes.lastGeneratedRune, "incandescent");
});

test("keeps existing runes and generates fire when Disque Luminescent starts below three runes", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            aquatic: true,
            telluric: true,
          },
          lastGeneratedRune: "telluric",
        },
      },
    },
    sequence: { actions: [{ spellId: "disque-luminescent-test" }] },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.finalState.classState.huppermage?.runes.active, {
    incandescent: true,
    aquatic: true,
    telluric: true,
    aerial: false,
  });
  assert.equal(result.breakdown[0].appliedEffects.some((effect) => effect.type === "runeConsumed"), false);
  assert.equal(result.finalState.classState.huppermage?.runes.lastGeneratedRune, "incandescent");
});

test("applies dynamic costs from active runes before paying spell cost", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 2, bq: 200 }),
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
            aquatic: true,
          },
        },
      },
    },
    sequence: { actions: [{ spellId: "runification-test" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].resourceAfter.bq, 170);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, false);
  assert.equal(result.finalState.classState.huppermage?.runes.active.aquatic, false);
});

test("keeps Runification's per-rune damage bonus for later actions in the turn", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 2, bq: 200 }),
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
            aquatic: true,
          },
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "runification-test" },
        { spellId: "lueur-test" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].statsAfter.damageInflictedPercent, 30);
  assert.equal(result.breakdown[1].statsBefore.damageInflictedPercent, 30);
  assert.equal(result.breakdown[1].damage, 120);
  assert.equal(result.breakdown[1].statsAfter.damageInflictedPercent, 30);
});

test("scales Runification damage inflicted bonus by active rune count", () => {
  const cases = [
    { runes: { incandescent: true }, expectedBonus: 10 },
    { runes: { incandescent: true, aquatic: true }, expectedBonus: 20 },
    { runes: { incandescent: true, aquatic: true, telluric: true }, expectedBonus: 30 },
    { runes: { incandescent: true, aquatic: true, telluric: true, aerial: true }, expectedBonus: 40 },
  ];

  for (const { runes, expectedBonus } of cases) {
    const zeroDamageInflictedCharacter: SimulatedCharacter = {
      ...character,
      stats: {
        ...character.stats,
        damageInflictedPercent: 0,
      },
    };
    const result = simulateTurn({
      catalog: testCatalog,
      character: {
        ...zeroDamageInflictedCharacter,
        resources: createResources({ ap: 6, mp: 3, wp: 2, bq: 200 }),
        classState: {
          huppermage: {
            runes,
          },
        },
      },
      sequence: {
        actions: [{ spellId: "runification-test" }],
      },
    });

    assert.equal(result.valid, true);
    assert.equal(result.breakdown[0].statsAfter.damageInflictedPercent, expectedBonus);
    assert.equal(
      result.breakdown[0].appliedEffects.some((effect) => effect.type === "statModifier"),
      expectedBonus > 0,
    );
  }
});

test("rejects Runification without an active rune", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 2, bq: 200 }),
      classState: {
        huppermage: {
          runes: {},
        },
      },
    },
    sequence: {
      actions: [{ spellId: "runification-test" }],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "invalidClassStateAction");
  assert.equal(result.breakdown.length, 0);
});

test("consumes Abondance on the next light spell without persisting the bonus", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 1, bq: 0 }),
      classState: {
        huppermage: {
          abundanceLevel: 30,
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "lueur-test" },
        { spellId: "lueur-test" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].damage, 105);
  assert.equal(result.breakdown[0].statsAfter.damageInflictedPercent, 10);
  assert.equal(result.breakdown[1].statsBefore.damageInflictedPercent, 10);
  assert.equal(result.breakdown[1].damage, 82.5);
  assert.equal(result.finalState.classState.huppermage?.abundanceLevel, 0);
});

test("applies conditional cost deltas and additional BQ costs", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 1, bq: 50 }),
      classState: {
        huppermage: {
          runes: {
            aquatic: true,
          },
        },
      },
    },
    sequence: { actions: [{ spellId: "resonance-cost-test" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].resourceAfter.ap, 3);
  assert.equal(result.breakdown[0].resourceAfter.bq, 25);
});

test("applies conditional caster effects before damage", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
          },
        },
      },
    },
    sequence: { actions: [{ spellId: "conditional-caster-buff-test" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].damage, 30);
  assert.equal(result.breakdown[0].statsAfter.damageInflictedPercent, 20);
});

test("adds 20% damage to the last generated rune element", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: { actions: [{ spellId: "lueur-de-laube" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].damage, 260);
});

test("applies selected passive initial stat and resource modifiers", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activePassives: ["motivation"],
        },
      },
    },
    sequence: { actions: [{ spellId: "lueur-test" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].resourceBefore.ap, 7);
  assert.equal(result.breakdown[0].statsBefore.damageInflictedPercent, -10);
  assert.equal(result.breakdown[0].statsBefore.willpower, 10);
});

test("does not apply conditional passive stat notes as permanent initial stats", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activePassives: ["carnage", "inspiration"],
        },
      },
    },
    sequence: { actions: [{ spellId: "lueur-test" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].statsBefore.damageInflictedPercent, 25);
  assert.equal(result.breakdown[0].statsBefore.healsPerformedPercent, -30);
});

test("activates Coeur de Lumiere from last rune and evolves stats", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "coeur-de-lumiere" },
        { spellId: "lueur-test" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].classStateAfter.huppermage?.activeHeart, "fire");
  assert.equal(result.breakdown[1].statsBefore.damageInflictedPercent, 40);
  assert.equal(result.breakdown[1].statsBefore.healsPerformedPercent, 15);
  assert.equal(result.breakdown[1].statsBefore.elementalMastery.fire, 240);
});

test("rejects Coeur de Lumiere before any rune has been generated", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: {
      actions: [{ spellId: "coeur-de-lumiere" }],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "invalidClassStateAction");
});

test("allows Refraction Elementaire to raise Coeur de Lumiere cast limit", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activePassives: ["refraction-elementaire"],
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "coeur-de-lumiere" },
        { spellId: "coeur-de-lumiere" },
        { spellId: "coeur-de-lumiere" },
        { spellId: "coeur-de-lumiere" },
        { spellId: "coeur-de-lumiere" },
      ],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "castLimitExceeded");
  assert.equal(result.violations[0].actionIndex, 4);
  assert.equal(result.breakdown.length, 4);
});

test("Cycle Elementaire restores the last generated rune when it is inactive", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [{ spellId: "cycle-elementaire" }],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, true);
  assert.equal(result.finalState.classState.huppermage?.runes.lastGeneratedRune, "incandescent");
});

test("Cycle Elementaire rune restoration triggers rune generation rewards", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activePassives: ["antithese"],
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [{ spellId: "cycle-elementaire" }],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.remainingResources.ap, 6);
  assert.equal(result.finalState.remainingResources.bq, 45);
  assert.equal(result.finalState.classState.huppermage?.runeApGainsThisTurn.incandescent, true);
});

test("Cycle Elementaire transforms the active last generated rune into its opposite rune", () => {
  const cases = [
    ["incandescent", "aquatic"],
    ["aquatic", "incandescent"],
    ["telluric", "aerial"],
    ["aerial", "telluric"],
  ] as const;

  for (const [lastGeneratedRune, oppositeRune] of cases) {
    const result = simulateTurn({
      catalog: testCatalog,
      character: {
        ...character,
        classState: {
          huppermage: {
            runes: {
              [lastGeneratedRune]: true,
            },
            lastGeneratedRune,
          },
        },
      },
      sequence: {
        actions: [{ spellId: "cycle-elementaire" }],
      },
    });

    assert.equal(result.valid, true);
    assert.equal(result.finalState.classState.huppermage?.runes.active[lastGeneratedRune], false);
    assert.equal(result.finalState.classState.huppermage?.runes.active[oppositeRune], true);
    assert.equal(result.finalState.classState.huppermage?.runes.lastGeneratedRune, oppositeRune);
  }
});

test("Cycle Elementaire force-generates an existing nemesis rune and regenerates each active heart", () => {
  const cases = [
    {
      activeHeart: "fire",
      lastGeneratedRune: "incandescent",
      nemesisRune: "aquatic",
    },
    {
      activeHeart: "water",
      lastGeneratedRune: "aquatic",
      nemesisRune: "incandescent",
    },
    {
      activeHeart: "earth",
      lastGeneratedRune: "telluric",
      nemesisRune: "aerial",
    },
    {
      activeHeart: "air",
      lastGeneratedRune: "aerial",
      nemesisRune: "telluric",
    },
  ] as const;

  for (const { activeHeart, lastGeneratedRune, nemesisRune } of cases) {
    const result = simulateTurn({
      catalog: testCatalog,
      character: {
        ...character,
        classState: {
          huppermage: {
            activeHeart,
            runes: {
              [lastGeneratedRune]: true,
              [nemesisRune]: true,
            },
            lastGeneratedRune,
          },
        },
      },
      sequence: {
        actions: [{ spellId: "cycle-elementaire" }],
      },
    });

    assert.equal(result.valid, true);
    assert.equal(result.finalState.classState.huppermage?.runes.active[lastGeneratedRune], true);
    assert.equal(result.finalState.classState.huppermage?.runes.active[nemesisRune], true);
    assert.equal(result.finalState.classState.huppermage?.runes.lastGeneratedRune, lastGeneratedRune);
    assert.equal(result.finalState.remainingResources.bq, 50);
    assert.equal(result.finalState.classState.huppermage?.abundanceLevel, 30);
  }
});

test("Cycle Elementaire nemesis generation grants Combinaison Elementaire abundance", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activePassives: ["combinaison-elementaire"],
          runes: {
            incandescent: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [{ spellId: "cycle-elementaire" }],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.aquatic, true);
  assert.equal(result.finalState.classState.huppermage?.abundanceLevel, 30);
});

test("validates catalog target constraints", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: {
      actions: [{ spellId: "empty-cell-only-test", target: { kind: "enemy" } }],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "invalidTarget");
});

test("rejects empty-cell casts unless the spell explicitly supports empty cells", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: {
      actions: [
        { spellId: "target-limit-test", target: { kind: "enemy" } },
        { spellId: "target-limit-test", target: { kind: "emptyCell" } },
      ],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0]?.type, "invalidTarget");
  assert.equal(result.violations[0]?.spellId, "target-limit-test");
});

test("rejects repeated casts on the same target when max casts per target is reached", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: {
      actions: [
        { spellId: "target-limit-test", target: { kind: "enemy" } },
        { spellId: "target-limit-test", target: { kind: "enemy" } },
      ],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0]?.type, "castLimitExceeded");
  assert.equal(result.violations[0]?.required, 1);
  assert.equal(result.violations[0]?.available, 1);
});

test("enforces deck spell limit unless a Feu-Follet temporary element unlock applies", () => {
  const blocked = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          deckSpellLimit: 1,
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "fire-rune-test" },
        { spellId: "water-rune-test" },
      ],
    },
  });

  assert.equal(blocked.valid, false);
  assert.equal(blocked.violations[0].type, "deckLimitExceeded");

  const unlocked = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          deckSpellLimit: 1,
          usedSpellIds: ["fire-rune-test"],
          feuFolletsActive: 1,
          feuFolletStoredLastRunes: ["aquatic"],
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "feu-follet-test", target: { kind: "feuFollet" } },
        { spellId: "water-rune-test" },
      ],
    },
  });

  assert.equal(unlocked.valid, true);
  assert.equal(unlocked.breakdown[0].classStateAfter.huppermage?.temporaryUnlockedSpellElement, "water");
});

test("does not count third-bar Huppermage spells against the deck limit", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 1, bq: 0 }),
      classState: {
        huppermage: {
          deckSpellLimit: 0,
          runes: {
            incandescent: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "cycle-elementaire" },
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
        { spellId: "coeur-de-lumiere" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.finalState.classState.huppermage?.usedSpellIds, []);

  const trackedSpell = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          deckSpellLimit: 0,
        },
      },
    },
    sequence: { actions: [{ spellId: "fire-rune-test" }] },
  });

  assert.equal(trackedSpell.valid, false);
  assert.equal(trackedSpell.violations[0].type, "deckLimitExceeded");
});

test("unlocks temporary spell element from the recovered Feu-Follet rune", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
          },
          lastGeneratedRune: "incandescent",
          feuFolletsActive: 1,
          feuFolletStoredLastRunes: ["aquatic"],
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "feu-follet-test", target: { kind: "feuFollet" } },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.classState.huppermage?.temporaryUnlockedSpellElement, "water");
});

test("always exposes last generated rune state for Huppermage", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: { actions: [] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.classState.huppermage?.runes.lastGeneratedRune, null);
});

test("preserves initial active runes configured before turn one", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            telluric: true,
          },
          lastGeneratedRune: "telluric",
        },
      },
    },
    sequence: { actions: [{ spellId: "fire-rune-test" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].classStateBefore.huppermage?.runes.active.telluric, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.telluric, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, true);
  assert.equal(result.finalState.classState.huppermage?.runes.lastGeneratedRune, "incandescent");
});

test("counts active Feu-Follets when placing and recovering them", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
        { spellId: "water-rune-test" },
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
        { spellId: "feu-follet-test", target: { kind: "feuFollet" } },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.classState.huppermage?.feuFolletsActive, 1);

  assert.equal(result.breakdown[0].classStateBefore.huppermage?.feuFolletsActive, 0);
  assert.equal(result.breakdown[0].classStateAfter.huppermage?.feuFolletsActive, 1);
  assert.equal(result.breakdown[0].appliedEffects.at(-1)?.type, "feuFolletChanged");
  assert.deepEqual(result.breakdown.map((action) => action.classStateAfter.huppermage?.feuFolletsActive), [1, 1, 2, 1]);
});

test("rejects placing more Feu-Follets than the active maximum allows", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
        { spellId: "water-rune-test" },
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
        { spellId: "air-movement-test" },
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
      ],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "invalidClassStateAction");
  assert.equal(result.violations[0].actionIndex, 4);
  assert.equal(result.finalState.classState.huppermage?.feuFolletsActive, 2);
});

test("applies passive Feu-Follet placement limits", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activePassives: ["nouveau-souffle"],
          runes: {
            incandescent: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
        { spellId: "water-rune-test" },
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
      ],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "invalidClassStateAction");
  assert.equal(result.violations[0].actionIndex, 2);
  assert.equal(result.finalState.classState.huppermage?.feuFolletsActive, 1);
});

test("applies Sauvegarde Runique Feu-Follet cast limit", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activePassives: ["sauvegarde-runique"],
          runes: {
            incandescent: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
        { spellId: "water-rune-test" },
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
      ],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "castLimitExceeded");
  assert.equal(result.violations[0].actionIndex, 2);
  assert.equal(result.finalState.classState.huppermage?.feuFolletsActive, 1);
});

test("rejects placing a Feu-Follet without an active rune", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: {
      actions: [{ spellId: "feu-follet-test", target: { kind: "emptyCell" } }],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "invalidClassStateAction");
  assert.equal(result.finalState.classState.huppermage?.feuFolletsActive, 0);
  assert.equal(result.breakdown.length, 0);
});

test("rejects casting Feu-Follet on an entity target", () => {
  for (const targetKind of ["fighter", "ally", "enemy"] as const) {
    const result = simulateTurn({
      catalog: testCatalog,
      character: {
        ...character,
        classState: {
          huppermage: {
            runes: {
              incandescent: true,
            },
            lastGeneratedRune: "incandescent",
          },
        },
      },
      sequence: {
        actions: [{ spellId: "feu-follet-test", target: { kind: targetKind } }],
      },
    });

    assert.equal(result.valid, false);
    assert.equal(result.violations[0].type, "invalidClassStateAction");
    assert.equal(result.finalState.classState.huppermage?.feuFolletsActive, 0);
    assert.equal(result.breakdown.length, 0);
  }
});

test("attaches the active last generated rune to a placed Feu-Follet", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [{ spellId: "feu-follet-test", target: { kind: "emptyCell" } }],
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.finalState.classState.huppermage?.feuFolletStoredLastRunes, ["incandescent"]);
  assert.deepEqual(result.finalState.classState.huppermage?.feuFolletStoredRunes, [[]]);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, false);
});

test("places a Feu-Follet by removing the last generated rune when multiple runes are active", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
            aquatic: true,
          },
          lastGeneratedRune: "aquatic",
        },
      },
    },
    sequence: {
      actions: [{ spellId: "feu-follet-test", target: { kind: "emptyCell" } }],
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.finalState.classState.huppermage?.feuFolletStoredLastRunes, ["aquatic"]);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.aquatic, false);
});

test("rejects placing a Feu-Follet when the last generated rune was consumed", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
            aquatic: false,
          },
          lastGeneratedRune: "aquatic",
        },
      },
    },
    sequence: {
      actions: [{ spellId: "feu-follet-test", target: { kind: "emptyCell" } }],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "invalidClassStateAction");
  assert.equal(result.finalState.classState.huppermage?.feuFolletsActive, 0);
  assert.deepEqual(result.finalState.classState.huppermage?.feuFolletStoredLastRunes, []);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, true);
});

test("recovers the rune transferred to a Feu-Follet", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
        { spellId: "feu-follet-test", target: { kind: "feuFollet" } },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].classStateAfter.huppermage?.runes.active.incandescent, false);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, true);
  assert.deepEqual(result.finalState.classState.huppermage?.feuFolletStoredLastRunes, []);
});

test("Plenitude consumes a Feu-Follet without recovering its rune and grants AP", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activePassives: ["plenitude"],
          runes: {
            incandescent: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
        { spellId: "feu-follet-test", target: { kind: "feuFollet" } },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.classState.huppermage?.feuFolletsActive, 0);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, false);
  assert.equal(result.finalState.remainingResources.ap, 6);
  assert.equal(result.finalState.classState.huppermage?.abundanceLevel, 0);
  assert.deepEqual(result.finalState.classState.huppermage?.feuFolletStoredLastRunes, []);
});

test("stores and recovers missing runes with Sauvegarde Runique", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activePassives: ["sauvegarde-runique"],
          runes: {
            aerial: true,
          },
          lastGeneratedRune: "aerial",
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
        { spellId: "feu-follet-test", target: { kind: "feuFollet" } },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.breakdown[0].classStateAfter.huppermage?.feuFolletStoredLastRunes, [null]);
  assert.deepEqual(result.breakdown[0].classStateAfter.huppermage?.feuFolletStoredRunes, [
    ["incandescent", "aquatic", "telluric"],
  ]);
  assert.equal(result.finalState.classState.huppermage?.feuFolletsActive, 0);
  assert.deepEqual(result.finalState.classState.huppermage?.feuFolletStoredRunes, []);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.aquatic, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.telluric, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.aerial, false);
  assert.equal(result.finalState.classState.huppermage?.runes.lastGeneratedRune, "telluric");

  const storeEffect = result.breakdown[0].appliedEffects.at(-1);
  assert.ok(storeEffect && storeEffect.type === "feuFolletRunesStored");
  assert.deepEqual(storeEffect.runes, ["incandescent", "aquatic", "telluric"]);

  const recoverEffect = result.breakdown[1].appliedEffects.find((effect) => effect.type === "feuFolletRunesRecovered");
  assert.ok(recoverEffect && recoverEffect.type === "feuFolletRunesRecovered");
  assert.deepEqual(recoverEffect.runes, ["incandescent", "aquatic", "telluric"]);
  assert.equal(recoverEffect.lastGeneratedRuneAfter, "telluric");
});

test("Sauvegarde Runique recovery force-generates stored runes even when already active", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activePassives: ["sauvegarde-runique"],
          runes: {
            incandescent: true,
            aquatic: true,
            telluric: true,
            aerial: true,
          },
          lastGeneratedRune: "aerial",
          feuFolletsActive: 1,
          feuFolletStoredRunes: [["incandescent", "aquatic", "telluric"]],
        },
      },
    },
    sequence: {
      actions: [{ spellId: "feu-follet-test", target: { kind: "feuFollet" } }],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.remainingResources.bq, 75);
  assert.equal(result.finalState.classState.huppermage?.abundanceLevel, 45);
  assert.equal(result.finalState.classState.huppermage?.runes.lastGeneratedRune, "telluric");

  const generated = result.breakdown[0].appliedEffects.filter((effect) => effect.type === "runeGenerated");
  assert.deepEqual(
    generated.map((effect) => effect.type === "runeGenerated" ? effect.rune : null),
    ["incandescent", "aquatic", "telluric"],
  );
});

test("regenerates BQ through Extension des sens in fire and earth hearts", () => {
  const fireResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activeHeart: "fire",
          activePassives: ["extension-des-sens"],
        },
      },
    },
    sequence: { actions: [{ spellId: "elemental-no-bq-test" }] },
  });

  assert.equal(fireResult.valid, true);
  assert.equal(fireResult.finalState.remainingResources.bq, 20);

  const earthResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activeHeart: "earth",
          activePassives: ["extension-des-sens"],
        },
      },
    },
    sequence: { actions: [{ spellId: "earth-ap-test" }] },
  });

  assert.equal(earthResult.valid, true);
  assert.equal(earthResult.finalState.remainingResources.bq, 60);
});

test("regenerates BQ through Extension des sens from the effective AP cost", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 1, bq: 100 }),
      classState: {
        huppermage: {
          activeHeart: "earth",
          activePassives: ["extension-des-sens"],
          runes: {
            aquatic: true,
          },
        },
      },
    },
    sequence: { actions: [{ spellId: "resonance-cost-test" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].resourceAfter.ap, 3);
  assert.equal(result.finalState.remainingResources.bq, 135);
});

test("regenerates BQ through Extension des sens for air movement events", () => {
  const singleMovementResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activeHeart: "air",
          activePassives: ["extension-des-sens"],
        },
      },
    },
    sequence: { actions: [{ spellId: "air-movement-test" }] },
  });

  assert.equal(singleMovementResult.valid, true);
  assert.equal(singleMovementResult.finalState.remainingResources.bq, 40);

  const papillonsResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activeHeart: "air",
          activePassives: ["extension-des-sens"],
          runes: {
            aquatic: true,
            telluric: true,
          },
        },
      },
    },
    sequence: { actions: [{ spellId: "papillons-test" }] },
  });

  assert.equal(papillonsResult.valid, true);
  assert.equal(papillonsResult.finalState.remainingResources.bq, 80);
});

test("regenerates BQ through Extension des sens by alternating light and elemental spells in water heart", () => {
  const alternatingResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activeHeart: "water",
          activePassives: ["extension-des-sens"],
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "elemental-no-bq-test" },
        { spellId: "light-no-bq-test" },
      ],
    },
  });

  assert.equal(alternatingResult.valid, true);
  assert.equal(alternatingResult.finalState.remainingResources.bq, 40);
  assert.equal(alternatingResult.finalState.classState.huppermage?.waterHeartLastSpellKind, "light");

  const brokenAlternationResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activeHeart: "water",
          activePassives: ["extension-des-sens"],
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "elemental-no-bq-test" },
        { spellId: "neutral-no-bq-test" },
        { spellId: "light-no-bq-test" },
      ],
    },
  });

  assert.equal(brokenAlternationResult.valid, true);
  assert.equal(brokenAlternationResult.finalState.remainingResources.bq, 0);
  assert.equal(brokenAlternationResult.finalState.classState.huppermage?.waterHeartLastSpellKind, "light");
});

test("converts configured PW into initial BQ when enabled", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 2, bq: 0 }),
      classState: {
        huppermage: {
          convertWpToBq: true,
        },
      },
    },
    sequence: { actions: [] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.remainingResources.bq, 150);
  assert.equal(result.finalState.classState.huppermage?.bqMax, 150);
});

test("defaults Huppermage BQ max to 500 plus PW variations", () => {
  const baselineResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 6, bq: 0 }),
      classState: {
        huppermage: {},
      },
    },
    sequence: { actions: [] },
  });
  const boostedResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 8, bq: 0 }),
      classState: {
        huppermage: {},
      },
    },
    sequence: { actions: [] },
  });

  assert.equal(baselineResult.finalState.classState.huppermage?.bqMax, 500);
  assert.equal(boostedResult.finalState.classState.huppermage?.bqMax, 650);
});

test("applies puissance brute WP penalty before initial BQ conversion", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 4, bq: 0 }),
      classState: {
        huppermage: {
          convertWpToBq: true,
        },
      },
      sublimations: {
        selections: [
          { sublimationId: "puissance-brute-i" },
          { sublimationId: "puissance-brute-i" },
        ],
        hpAssumption: "normal",
      },
    },
    sequence: { actions: [] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.remainingResources.wp, 2);
  assert.equal(result.finalState.remainingResources.bq, 150);
  assert.equal(result.finalState.classState.huppermage?.bqMax, 150);
});

test("applies turn-end natural BQ regeneration and stored BQ", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 1, bq: 50 }),
      classState: {
        huppermage: {
          storedBq: 25,
        },
      },
    },
    sequence: { actions: [] },
    includeTurnEnd: true,
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.remainingResources.bq, 175);
  assert.equal(result.finalState.classState.huppermage?.storedBq, 0);
  assert.equal(result.finalState.turnEndEffects[0].type, "turnEndBq");
});

test("stores turn-end BQ under Coeur de Lumiere instead of regenerating it", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 1, bq: 50 }),
      classState: {
        huppermage: {
          activeHeart: "fire",
          storedBq: 25,
        },
      },
    },
    sequence: { actions: [] },
    includeTurnEnd: true,
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.remainingResources.bq, 50);
  assert.equal(result.finalState.classState.huppermage?.storedBq, 100);
});

test("applies Transcendance Runique and Profusion Runique to turn-end BQ gains", () => {
  const transcendanceResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activePassives: ["transcendance-runique"],
          runes: {
            incandescent: true,
            aquatic: true,
            telluric: true,
            aerial: true,
          },
        },
      },
    },
    sequence: { actions: [] },
    includeTurnEnd: true,
  });

  assert.equal(transcendanceResult.valid, true);
  assert.equal(transcendanceResult.finalState.remainingResources.bq, 200);

  const profusionResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activePassives: ["profusion-runique"],
        },
      },
    },
    sequence: { actions: [] },
    includeTurnEnd: true,
  });

  assert.equal(profusionResult.valid, true);
  assert.equal(profusionResult.finalState.remainingResources.bq, 80);
});

test("applies Dynamo at turn end by clearing active runes", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activePassives: ["dynamo"],
          runes: {
            incandescent: true,
            aquatic: true,
          },
          lastGeneratedRune: "aquatic",
        },
      },
    },
    sequence: { actions: [] },
    includeTurnEnd: true,
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, false);
  assert.equal(result.finalState.classState.huppermage?.runes.active.aquatic, false);
});

test("applies Universalite per-rune turn-end bonuses and BQ cost", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 1, bq: 100 }),
      classState: {
        huppermage: {
          activePassives: ["universalite"],
          runes: {
            incandescent: true,
            aquatic: true,
          },
        },
      },
    },
    sequence: { actions: [] },
    includeTurnEnd: true,
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.remainingResources.bq, 100);
  assert.equal(result.finalState.currentStats.damageInflictedPercent, 25);
  assert.equal(result.finalState.currentStats.healsPerformedPercent, 15);
});

test("adds Profusion Runique turn-end abundance per active rune", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activePassives: ["profusion-runique"],
          runes: {
            incandescent: true,
            aquatic: true,
          },
        },
      },
    },
    sequence: { actions: [] },
    includeTurnEnd: true,
  });

  assert.equal(result.valid, true);
  assert.equal(result.finalState.remainingResources.bq, 80);
  assert.equal(result.finalState.classState.huppermage?.abundanceLevel, 30);
});

test("rejects recovering a Feu-Follet when none is active", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: {
      actions: [{ spellId: "feu-follet-test", target: { kind: "feuFollet" } }],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "invalidClassStateAction");
  assert.equal(result.finalState.classState.huppermage?.feuFolletsActive, 0);
  assert.equal(result.breakdown.length, 0);
});

test("returns unknown spell id violations", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: { actions: [{ spellId: "missing-spell" }] },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "unknownSpell");
  assert.equal(result.violations[0].spellId, "missing-spell");
  assert.equal(result.breakdown.length, 0);
});

test("returns insufficient AP, MP, WP, and BQ violations without applying failed action", () => {
  const insufficientAp = simulateTurn({
    catalog: testCatalog,
    character: { ...character, resources: createResources({ ap: 1, mp: 3, wp: 1, bq: 0 }) },
    sequence: { actions: [{ spellId: "lueur-test" }] },
  });
  assert.equal(insufficientAp.violations[0].resource, "ap");

  const insufficientMp = simulateTurn({
    catalog: testCatalog,
    character: { ...character, resources: createResources({ ap: 6, mp: 1, wp: 1, bq: 0 }) },
    sequence: { actions: [{ spellId: "mp-test" }] },
  });
  assert.equal(insufficientMp.violations[0].resource, "mp");

  const insufficientWp = simulateTurn({
    catalog: testCatalog,
    character: { ...character, resources: createResources({ ap: 6, mp: 3, wp: 0, bq: 0 }) },
    sequence: { actions: [{ spellId: "wp-test" }] },
  });
  assert.equal(insufficientWp.violations[0].resource, "wp");

  const insufficientBq = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: { actions: [{ spellId: "orbe-test" }] },
  });
  assert.equal(insufficientBq.violations[0].resource, "bq");
});

test("enforces per-turn cast limits", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: { ...character, resources: createResources({ ap: 8, mp: 3, wp: 1, bq: 0 }) },
    sequence: {
      actions: [
        { spellId: "lueur-test" },
        { spellId: "lueur-test" },
        { spellId: "lueur-test" },
      ],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "castLimitExceeded");
  assert.equal(result.breakdown.length, 2);
  assert.deepEqual(result.finalState.remainingResources, createResources({ ap: 4, mp: 3, wp: 1, bq: 20 }));
});

test("preserves state reached before a failed action", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: {
      actions: [
        { spellId: "lueur-test" },
        { spellId: "orbe-test" },
      ],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].resource, "bq");
  assert.equal(result.breakdown.length, 1);
  assert.deepEqual(result.finalState.remainingResources, createResources({ ap: 4, mp: 3, wp: 1, bq: 10 }));
});

test("records damage totals and per-action breakdown", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: { actions: [{ spellId: "lueur-test" }] },
  });

  const [action] = result.breakdown;
  assert.equal(action.damage, 82.5);
  assert.deepEqual(action.resourceBefore, createResources({ ap: 6, mp: 3, wp: 1, bq: 0 }));
  assert.deepEqual(action.resourceAfter, createResources({ ap: 4, mp: 3, wp: 1, bq: 10 }));
  assert.equal(action.appliedEffects[0].type, "damage");
  assert.equal(action.appliedEffects[1].type, "resourceDelta");
});

test("applies complete damage formula without target resistance", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      stats: {
        ...character.stats,
        meleeMastery: 50,
        berserkMastery: 25,
        rearMastery: 75,
        criticalMastery: 40,
      },
    },
    sequence: {
      actions: [
        {
          spellId: "lueur-test",
          context: {
            position: "rear",
            rangeMode: "melee",
            isCritical: true,
            isBerserk: true,
            isBlocked: true,
          },
        },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.totalDamage, 181.5);

  const damageEffect = result.breakdown[0].appliedEffects[0];
  assert.equal(damageEffect.type, "damage");
  assert.equal(damageEffect.formula.elementalMastery, 50);
  assert.equal(damageEffect.resolvedElement, "earth");
  assert.equal(damageEffect.formula.extraMastery, 190);
  assert.equal(damageEffect.formula.criticalMultiplier, 1.25);
  assert.equal(damageEffect.formula.positionMultiplier, 1.25);
  assert.equal(damageEffect.formula.blockMultiplier, 0.8);
});

test("computes expected critical damage from current critical stats", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      stats: {
        ...character.stats,
        criticalHitPercent: 50,
        criticalMastery: 100,
      },
    },
    sequence: {
      actions: [
        {
          spellId: "lueur-test",
          context: { criticalMode: "expected" },
        },
      ],
    },
  });

  const damageEffect = result.breakdown[0].appliedEffects[0];
  assert.equal(damageEffect.type, "damage");
  assert.equal(damageEffect.formula.criticalMode, "expected");
  assert.equal(damageEffect.formula.effectiveCriticalHitPercent, 50);
  assert.equal(damageEffect.formula.nonCriticalResult, 82.5);
  assert.equal(damageEffect.formula.criticalResult, 144.38);
  assert.equal(damageEffect.amount, 113.44);
});

test("clamps expected critical chance and preserves forced modes", () => {
  const clamped = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      stats: {
        ...character.stats,
        criticalHitPercent: 150,
        criticalMastery: 100,
      },
    },
    sequence: { actions: [{ spellId: "lueur-test", context: { criticalMode: "expected" } }] },
  });
  const clampedDamage = clamped.breakdown[0].appliedEffects[0];
  assert.equal(clampedDamage.type, "damage");
  assert.equal(clampedDamage.formula.effectiveCriticalHitPercent, 100);
  assert.equal(clampedDamage.amount, clampedDamage.formula.criticalResult);

  const forced = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: { actions: [{ spellId: "lueur-test", context: { criticalMode: "forcedCritical" } }] },
  });
  const forcedDamage = forced.breakdown[0].appliedEffects[0];
  assert.equal(forcedDamage.type, "damage");
  assert.equal(forcedDamage.formula.criticalMode, "forcedCritical");
  assert.equal(forcedDamage.formula.effectiveCriticalHitPercent, 100);
});

test("applies supported sublimation flat stats and action conditions", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      stats: {
        ...character.stats,
        generalMastery: 0,
        elementalMastery: { fire: 0 },
        damageInflictedPercent: 0,
      },
      sublimations: {
        selections: [
          { sublimationId: "influence-6" },
          { sublimationId: "longueur-6" },
        ],
        hpAssumption: "normal",
      },
    },
    sequence: { actions: [{ spellId: "distance-damage-test" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].statsBefore.criticalHitPercent, 18);
  assert.equal(result.breakdown[0].damage, 11.2);
  assert.equal(result.breakdown[0].appliedEffects.some((effect) => effect.type === "sublimationEffect" && effect.status === "applied"), true);
});

test("evaluates initial sublimation conditions from combat-start resources", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 10, mp: 3, wp: 1, bq: 0 }),
      stats: {
        ...character.stats,
        generalMastery: 0,
        elementalMastery: { fire: 0 },
        damageInflictedPercent: 0,
      },
      sublimations: {
        selections: [
          { sublimationId: "force-vitale-ii" },
          { sublimationId: "inflexibilite" },
        ],
        hpAssumption: "healthy90",
      },
    },
    sequence: { actions: [{ spellId: "distance-damage-test" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].resourceBefore.ap, 11);
  assert.equal(result.breakdown[0].statsBefore.damageInflictedPercent, 15);
  assert.equal(result.breakdown[0].statsBefore.willpower, 10);
});

test("keeps HP-threshold sublimations valid but inactive when the assumption does not match", () => {
  const normalResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      stats: {
        ...character.stats,
        generalMastery: 0,
        elementalMastery: { fire: 0 },
        damageInflictedPercent: 0,
      },
      sublimations: {
        selections: [{ sublimationId: "carnage-6" }],
        hpAssumption: "normal",
      },
    },
    sequence: { actions: [{ spellId: "distance-damage-test" }] },
  });
  const healthyResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      stats: {
        ...character.stats,
        generalMastery: 0,
        elementalMastery: { fire: 0 },
        damageInflictedPercent: 0,
      },
      sublimations: {
        selections: [{ sublimationId: "carnage-6" }],
        hpAssumption: "healthy90",
      },
    },
    sequence: { actions: [{ spellId: "distance-damage-test" }] },
  });

  assert.equal(normalResult.valid, true);
  assert.equal(normalResult.breakdown[0].statsBefore.generalMastery, 0);
  assert.equal(normalResult.breakdown[0].damage, 10);
  assert.equal(healthyResult.valid, true);
  assert.equal(healthyResult.breakdown[0].statsBefore.generalMastery, 540);
  assert.equal(healthyResult.breakdown[0].damage, 64);
});

test("applies elemental damage sublimations only to matching non-light spells", () => {
  const fireResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      stats: {
        ...character.stats,
        generalMastery: 0,
        elementalMastery: { fire: 0, light: 0 },
        damageInflictedPercent: 0,
      },
      sublimations: {
        selections: [{ sublimationId: "brulure-4" }],
        hpAssumption: "normal",
      },
    },
    sequence: { actions: [{ spellId: "distance-damage-test" }] },
  });
  const lightResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      stats: {
        ...character.stats,
        generalMastery: 0,
        elementalMastery: { fire: 900, light: 0 },
        damageInflictedPercent: 0,
      },
      sublimations: {
        selections: [{ sublimationId: "brulure-4" }],
        hpAssumption: "normal",
      },
    },
    sequence: { actions: [{ spellId: "lueur-test" }] },
  });

  assert.equal(fireResult.valid, true);
  assert.equal(fireResult.breakdown[0].damage, 11.6);
  assert.equal(lightResult.valid, true);
  assert.equal(lightResult.breakdown[0].damage, 300);
  assert.equal(lightResult.breakdown[0].appliedEffects.some((effect) => effect.type === "sublimationEffect" && effect.status === "applied"), false);
});

test("stores secondary elemental sublimation damage for the next matching non-light spell", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 12, mp: 3, wp: 1, bq: 0 }),
      stats: {
        ...character.stats,
        generalMastery: 0,
        elementalMastery: { fire: 0, water: 0, earth: 0, air: 0, light: 0 },
        damageInflictedPercent: 0,
      },
      sublimations: {
        selections: [{ sublimationId: "brulure-secondaire-4" }],
        hpAssumption: "normal",
      },
    },
    sequence: {
      actions: [
        { spellId: "water-trigger-test" },
        { spellId: "earth-trigger-test" },
        { spellId: "lueur-test" },
        { spellId: "air-trigger-test" },
        { spellId: "water-trigger-test" },
        { spellId: "earth-trigger-test" },
        { spellId: "air-trigger-test" },
        { spellId: "distance-damage-test" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.breakdown.map((action) => action.damage), [0, 0, 39, 0, 0, 0, 0, 13]);
  assert.equal(result.finalState.sublimationElementalCarryover.fire, 0);
  assert.equal(result.breakdown[2].appliedEffects.some((effect) => effect.type === "sublimationEffect" && effect.status === "applied"), false);
  assert.equal(
    result.breakdown[7].appliedEffects.some((effect) =>
      effect.type === "sublimationEffect"
      && effect.status === "applied"
      && effect.sublimationId === "brulure-secondaire-4"
      && effect.amount === 30
      && effect.reason === "fireCarryoverConsumed"
    ),
    true,
  );
});

test("applies alternance relic sublimations from previous damage elements", () => {
  const alternanceResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 1, bq: 0 }),
      stats: {
        ...character.stats,
        generalMastery: 0,
        elementalMastery: { fire: 0, water: 0, earth: 0 },
        damageInflictedPercent: 0,
      },
      sublimations: {
        selections: [{ sublimationId: "alternance" }],
        hpAssumption: "normal",
      },
    },
    sequence: {
      actions: [
        { spellId: "distance-damage-test" },
        { spellId: "water-damage-test" },
        { spellId: "earth-damage-test" },
      ],
    },
  });
  const alternanceTwoResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 3, mp: 3, wp: 1, bq: 0 }),
      stats: {
        ...character.stats,
        generalMastery: 0,
        elementalMastery: { fire: 0, water: 0 },
        damageInflictedPercent: 0,
      },
      sublimations: {
        selections: [{ sublimationId: "alternance-ii" }],
        hpAssumption: "normal",
      },
    },
    sequence: {
      actions: [
        { spellId: "distance-damage-test" },
        { spellId: "water-damage-test" },
      ],
    },
  });

  assert.equal(alternanceResult.valid, true);
  assert.deepEqual(alternanceResult.breakdown.map((action) => action.damage), [10, 12, 10]);
  assert.equal(alternanceTwoResult.valid, true);
  assert.deepEqual(alternanceTwoResult.breakdown.map((action) => action.damage), [10, 11.5]);
});

test("applies concentration elementaire initial damage and weakest elemental mastery penalty", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      stats: {
        ...character.stats,
        generalMastery: 0,
        elementalMastery: { fire: 1000, water: 300, earth: 200, air: 100 },
        damageInflictedPercent: 0,
      },
      sublimations: {
        selections: [{ sublimationId: "concentration-elementaire" }],
        hpAssumption: "normal",
      },
    },
    sequence: { actions: [{ spellId: "distance-damage-test" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].statsBefore.damageInflictedPercent, 20);
  assert.deepEqual(result.breakdown[0].statsBefore.elementalMastery, {
    fire: 1000,
    water: 210,
    earth: 140,
    air: 70,
  });
  assert.equal(result.breakdown[0].damage, 132);
});

test("applies exces relic sublimation counters to the next spell", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 7, mp: 3, wp: 1, bq: 0 }),
      stats: {
        ...character.stats,
        generalMastery: 0,
        elementalMastery: { fire: 0 },
        damageInflictedPercent: 0,
      },
      sublimations: {
        selections: [{ sublimationId: "exces-ii" }],
        hpAssumption: "normal",
      },
    },
    sequence: {
      actions: [
        { spellId: "neutral-no-bq-test" },
        { spellId: "neutral-no-bq-test" },
        { spellId: "neutral-no-bq-test" },
        { spellId: "neutral-no-bq-test" },
        { spellId: "neutral-no-bq-test" },
        { spellId: "distance-damage-test" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[5].damage, 14);
});

test("applies puissance brute from WP and BQ spent during the turn", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 6, bq: 0 }),
      stats: {
        ...character.stats,
        generalMastery: 0,
        elementalMastery: { water: 0, fire: 0 },
        damageInflictedPercent: 0,
      },
      sublimations: {
        selections: [
          { sublimationId: "puissance-brute-ii" },
          { sublimationId: "puissance-brute-ii" },
        ],
        hpAssumption: "normal",
      },
    },
    sequence: {
      actions: [
        { spellId: "wp-test" },
        { spellId: "wp-test" },
        { spellId: "distance-damage-test" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].resourceBefore.wp, 2);
  assert.deepEqual(result.breakdown.map((action) => action.damage), [10.8, 13.6, 11.6]);
});

test("counts any BQ spend as a puissance brute trigger", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 8, mp: 3, wp: 6, bq: 40 }),
      stats: {
        ...character.stats,
        generalMastery: 0,
        elementalMastery: { light: 0 },
        damageInflictedPercent: 0,
      },
      sublimations: {
        selections: [
          { sublimationId: "puissance-brute-ii" },
          { sublimationId: "puissance-brute-ii" },
        ],
        hpAssumption: "normal",
      },
    },
    sequence: {
      actions: [
        { spellId: "orbe-test" },
        { spellId: "orbe-test" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].resourceBefore.wp, 2);
  assert.deepEqual(result.breakdown.map((action) => action.damage), [86.4, 92.8]);
});

test("applies puissance brute to Halo Chatoyant triggered damage", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 8, mp: 3, wp: 6, bq: 40 }),
      stats: {
        ...character.stats,
        generalMastery: 0,
        elementalMastery: {
          fire: 0,
          water: 0,
          earth: 0,
          air: 0,
          light: 0,
          neutral: 0,
        },
        damageInflictedPercent: 0,
      },
      classState: {
        huppermage: {
          runes: {
            aerial: true,
          },
        },
      },
      sublimations: {
        selections: [
          { sublimationId: "puissance-brute-ii" },
          { sublimationId: "puissance-brute-ii" },
        ],
        hpAssumption: "normal",
      },
    },
    sequence: {
      actions: [
        { spellId: "orbe-test" },
        { spellId: "halo-chatoyant" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.breakdown.map((action) => action.damage), [86.4, 87.48]);
});

test("rejects unsupported sublimations before simulation", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      sublimations: {
        selections: [{ sublimationId: "absolution" }],
        hpAssumption: "normal",
      },
    },
    sequence: { actions: [{ spellId: "lueur-test" }] },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "invalidSublimation");
});

test("uses highest elemental mastery when computing Light damage", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      stats: {
        ...character.stats,
        generalMastery: 100,
        elementalMastery: {
          fire: 50,
          water: 300,
          earth: 100,
          air: 75,
          light: 900,
        },
        damageInflictedPercent: 10,
      },
    },
    sequence: { actions: [{ spellId: "lueur-test" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.totalDamage, 165);

  const damageEffect = result.breakdown[0].appliedEffects.find((effect) => effect.type === "damage");
  assert.ok(damageEffect && damageEffect.type === "damage");
  assert.equal(damageEffect.element, "light");
  assert.equal(damageEffect.formula.elementalMastery, 300);
  assert.equal(damageEffect.resolvedElement, "water");
});

test("resolves tied Light damage mastery deterministically", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      stats: {
        ...character.stats,
        generalMastery: 100,
        elementalMastery: {
          fire: 250,
          water: 250,
          earth: 80,
          air: 80,
          light: 0,
        },
        damageInflictedPercent: 10,
      },
    },
    sequence: { actions: [{ spellId: "lueur-test" }] },
  });

  const damageEffect = result.breakdown[0].appliedEffects.find((effect) => effect.type === "damage");
  assert.ok(damageEffect && damageEffect.type === "damage");
  assert.equal(damageEffect.formula.elementalMastery, 250);
  assert.equal(damageEffect.resolvedElement, "fire");
});

test("applies Rayon Crepusculaire BQ remaining damage scaling", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 1, bq: 250 }),
      classState: {
        huppermage: {
          bqMax: 500,
          runes: {
            incandescent: true,
          },
        },
      },
    },
    sequence: { actions: [{ spellId: "rayon-crepusculaire" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.totalDamage, 337.5);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, false);
});

test("records Epee de Lumiere life steal from active runes", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
            aquatic: true,
          },
        },
      },
    },
    sequence: { actions: [{ spellId: "epee-de-lumiere" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.totalDamage, 275);
  const lifeSteal = result.breakdown[0].appliedEffects.find((effect) => effect.type === "lifeSteal");
  assert.ok(lifeSteal && lifeSteal.type === "lifeSteal");
  assert.equal(lifeSteal.percent, 60);
  assert.equal(lifeSteal.amount, 165);
});

test("adds Lueur de l'Aube delayed damage when the fire rune is consumed", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            incandescent: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: { actions: [{ spellId: "lueur-de-laube" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.totalDamage, 286);
  const damageEffects = result.breakdown[0].appliedEffects.filter((effect) => effect.type === "damage");
  assert.equal(damageEffects.length, 2);
  assert.equal(damageEffects[1].amount, 26);
});

test("tracks and triggers Halo Chatoyant marks", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: {
      actions: [
        { spellId: "halo-chatoyant" },
        { spellId: "halo-chatoyant" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].damage, 0);
  assert.equal(result.breakdown[0].classStateAfter.huppermage?.haloChatoyantMarks, 1);
  assert.equal(result.breakdown[1].damage, 222.75);
  assert.equal(result.breakdown[1].classStateAfter.huppermage?.haloChatoyantMarks, 1);

  const aerialResult = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          runes: {
            aerial: true,
          },
        },
      },
    },
    sequence: { actions: [{ spellId: "halo-chatoyant" }] },
  });

  assert.equal(aerialResult.valid, true);
  assert.equal(aerialResult.totalDamage, 222.75);
  assert.equal(aerialResult.finalState.classState.huppermage?.haloChatoyantMarks, 0);
  assert.equal(aerialResult.finalState.classState.huppermage?.runes.active.aerial, false);
});

test("caps existing Halo Chatoyant triggers to one mark in single-target simulation", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          haloChatoyantMarks: 2,
          runes: {
            aerial: true,
          },
        },
      },
    },
    sequence: { actions: [{ spellId: "halo-chatoyant" }] },
  });

  assert.equal(result.valid, true);
  assert.equal(result.totalDamage, 445.5);
  assert.equal(result.finalState.classState.huppermage?.haloChatoyantMarks, 0);
  assert.equal(result.finalState.classState.huppermage?.runes.active.aerial, false);
});

test("evolves caster stats during the turn from supported stat modifiers", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: {
      actions: [
        { spellId: "boost-test" },
        { spellId: "lueur-test" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.totalDamage, 90);
  assert.equal(result.finalState.currentStats.damageInflictedPercent, 20);
  assert.equal(result.breakdown[0].appliedEffects[0].type, "statModifier");
});

test("records stat snapshots before and after each successful action", () => {
  const result = simulateTurn({
    catalog: testCatalog,
    character,
    sequence: {
      actions: [
        { spellId: "boost-test" },
        { spellId: "lueur-test" },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.breakdown[0].statsBefore.damageInflictedPercent, 10);
  assert.equal(result.breakdown[0].statsAfter.damageInflictedPercent, 20);
  assert.equal(result.breakdown[1].statsBefore.damageInflictedPercent, 20);
  assert.equal(result.breakdown[1].statsAfter.damageInflictedPercent, 20);
});

test("rounds damage to two decimals per damage effect", () => {
  assert.equal(roundDamage(10.005), 10.01);

  const result = simulateTurn({
    catalog: normalizeCatalog([
      spell("rounding-test", {
        name: "Rounding Test",
        effects: [damage({ element: "neutral", base: 10.005 })],
        constraints: [],
        metadata: { status: "extracted", sources: [source] },
      }),
    ]),
    character: {
      ...character,
      stats: {
        generalMastery: 0,
        elementalMastery: {},
        damageInflictedPercent: 0,
      },
    },
    sequence: { actions: [{ spellId: "rounding-test" }] },
  });

  assert.equal(result.totalDamage, 10.01);
});

test("simulator can be imported and called without GUI modules", async () => {
  const module = await import("./simulator.ts");
  assert.equal(typeof module.simulateTurn, "function");
});
