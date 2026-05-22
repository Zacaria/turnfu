import assert from "node:assert/strict";
import test from "node:test";

import {
  cost,
  damage,
  maxCastsPerTurn,
  movement,
  normalizeCatalog,
  resourceDelta,
  screenshot,
  spell,
  statModifier,
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
  assert.equal(result.totalDamage, 132);
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
  assert.equal(result.totalDamage, 616);
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
  assert.equal(result.finalState.remainingResources.bq, 35);
  assert.equal(result.breakdown[0].resourceBefore.bq, 0);
  assert.equal(result.breakdown[0].resourceAfter.bq, 15);
  assert.equal(result.breakdown[1].resourceBefore.bq, 15);
  assert.equal(result.breakdown[1].resourceAfter.bq, 35);
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
    character,
    sequence: {
      actions: [
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
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
  assert.deepEqual(result.breakdown.map((action) => action.classStateAfter.huppermage?.feuFolletsActive), [1, 2, 1]);
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
  assert.deepEqual(result.breakdown[0].classStateAfter.huppermage?.feuFolletStoredRunes, [
    ["incandescent", "aquatic", "telluric"],
  ]);
  assert.equal(result.finalState.classState.huppermage?.feuFolletsActive, 0);
  assert.deepEqual(result.finalState.classState.huppermage?.feuFolletStoredRunes, []);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.aquatic, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.telluric, true);
  assert.equal(result.finalState.classState.huppermage?.runes.active.aerial, true);
  assert.equal(result.finalState.classState.huppermage?.runes.lastGeneratedRune, "telluric");

  const storeEffect = result.breakdown[0].appliedEffects.at(-1);
  assert.ok(storeEffect && storeEffect.type === "feuFolletRunesStored");
  assert.deepEqual(storeEffect.runes, ["incandescent", "aquatic", "telluric"]);

  const recoverEffect = result.breakdown[1].appliedEffects.at(-1);
  assert.ok(recoverEffect && recoverEffect.type === "feuFolletRunesRecovered");
  assert.deepEqual(recoverEffect.runes, ["incandescent", "aquatic", "telluric"]);
  assert.equal(recoverEffect.lastGeneratedRuneAfter, "telluric");
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
  assert.equal(action.damage, 132);
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
  assert.equal(result.totalDamage, 243.38);

  const damageEffect = result.breakdown[0].appliedEffects[0];
  assert.equal(damageEffect.type, "damage");
  assert.equal(damageEffect.formula.elementalMastery, 200);
  assert.equal(damageEffect.formula.extraMastery, 190);
  assert.equal(damageEffect.formula.criticalMultiplier, 1.25);
  assert.equal(damageEffect.formula.positionMultiplier, 1.25);
  assert.equal(damageEffect.formula.blockMultiplier, 0.8);
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
  assert.equal(result.totalDamage, 144);
  assert.equal(result.finalState.currentStats.damageInflictedPercent, 20);
  assert.equal(result.breakdown[0].appliedEffects[0].type, "statModifier");
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
