import assert from "node:assert/strict";
import test from "node:test";

import {
  cost,
  damage,
  maxCastsPerTurn,
  movement,
  normalizeCatalog,
  passive,
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
      tag("dynamicBqCostPerRune", 40),
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
    constraints: [],
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
  assert.equal(result.breakdown[0].resourceAfter.bq, 120);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, false);
  assert.equal(result.finalState.classState.huppermage?.runes.active.aquatic, false);
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
  assert.equal(result.breakdown[0].damage, 48);
  assert.equal(result.breakdown[0].statsAfter.damageInflictedPercent, 20);
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
  assert.equal(result.finalState.remainingResources.bq, 20);
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
  assert.equal(result.finalState.classState.huppermage?.abundanceLevel, 15);
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
            aquatic: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
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

test("rejects placing more Feu-Follets than the active maximum allows", () => {
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
    sequence: {
      actions: [
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
      ],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "invalidClassStateAction");
  assert.equal(result.violations[0].actionIndex, 2);
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
            aquatic: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
      ],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "invalidClassStateAction");
  assert.equal(result.violations[0].actionIndex, 1);
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
            aquatic: true,
          },
          lastGeneratedRune: "incandescent",
        },
      },
    },
    sequence: {
      actions: [
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
        { spellId: "feu-follet-test", target: { kind: "emptyCell" } },
      ],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "castLimitExceeded");
  assert.equal(result.violations[0].actionIndex, 1);
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

test("attaches an active rune to a placed Feu-Follet", () => {
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
    sequence: {
      actions: [{ spellId: "feu-follet-test", target: { kind: "emptyCell" } }],
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.finalState.classState.huppermage?.feuFolletStoredLastRunes, ["incandescent"]);
  assert.deepEqual(result.finalState.classState.huppermage?.feuFolletStoredRunes, [[]]);
  assert.equal(result.finalState.classState.huppermage?.runes.active.incandescent, false);
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

test("Plenitude consumes a Feu-Follet without recovering its rune and grants abundance", () => {
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
  assert.equal(result.finalState.classState.huppermage?.abundanceLevel, 25);
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
  assert.deepEqual(result.breakdown[0].classStateAfter.huppermage?.feuFolletStoredLastRunes, ["aerial"]);
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

  const recoverEffect = result.breakdown[1].appliedEffects.find((effect) => effect.type === "feuFolletRunesRecovered");
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
  assert.equal(result.totalDamage, 540);
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
  assert.equal(result.totalDamage, 440);
  const lifeSteal = result.breakdown[0].appliedEffects.find((effect) => effect.type === "lifeSteal");
  assert.ok(lifeSteal && lifeSteal.type === "lifeSteal");
  assert.equal(lifeSteal.percent, 60);
  assert.equal(lifeSteal.amount, 264);
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
  assert.equal(result.totalDamage, 242);
  const damageEffects = result.breakdown[0].appliedEffects.filter((effect) => effect.type === "damage");
  assert.equal(damageEffects.length, 2);
  assert.equal(damageEffects[1].amount, 22);
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
  assert.equal(result.breakdown[1].damage, 356.4);
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
  assert.equal(aerialResult.totalDamage, 356.4);
  assert.equal(aerialResult.finalState.classState.huppermage?.haloChatoyantMarks, 0);
  assert.equal(aerialResult.finalState.classState.huppermage?.runes.active.aerial, false);
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
