import assert from "node:assert/strict";
import test from "node:test";

import { cooldownTurns, cost, damage, normalizeCatalog, resourceDelta, screenshot, spell } from "../catalog/index.ts";
import { createResources, simulateCombo } from "./index.ts";
import type { CatalogEntry } from "../catalog/types.ts";
import type { SimulatedCharacter } from "./types.ts";

const source = screenshot("/tmp/combo-simulator-test.png", "combo-simulator-test");

const catalog = normalizeCatalog([
  spell("spark", {
    name: "Spark",
    level: 200,
    element: "light",
    cost: cost({ ap: 2 }),
    effects: [damage({ element: "light", base: 10 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("fire-rune", {
    name: "Fire Rune",
    level: 200,
    element: "fire",
    cost: cost({ ap: 2 }),
    effects: [damage({ element: "fire", base: 10 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("resource-spend", {
    name: "Resource Spend",
    level: 200,
    element: "light",
    cost: cost({ ap: 5, mp: 2, wp: 1 }),
    effects: [resourceDelta({ resource: "bq", amount: 10 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("carryover-spend", {
    name: "Carryover Spend",
    level: 200,
    cost: cost({ ap: 4 }),
    effects: [],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("expensive", {
    name: "Expensive",
    level: 200,
    element: "light",
    cost: cost({ ap: 99 }),
    effects: [damage({ element: "light", base: 50 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("cooldown-spell", {
    name: "Cooldown Spell",
    level: 200,
    cost: cost({ ap: 1 }),
    effects: [damage({ element: "light", base: 10 })],
    constraints: [cooldownTurns(2)],
    metadata: { status: "extracted", sources: [source] },
  }),
]) as CatalogEntry[];

const character: SimulatedCharacter = {
  id: "combo-huppermage",
  className: "huppermage",
  resources: createResources({ ap: 6, mp: 3, wp: 2, bq: 0 }),
  stats: {
    generalMastery: 0,
    elementalMastery: {},
    damageInflictedPercent: 0,
  },
};

test("aggregates damage from valid multi-turn combo plans", () => {
  const result = simulateCombo({
    catalog,
    character,
    combo: {
      turns: [
        { actions: [{ spellId: "spark" }] },
        { actions: [{ spellId: "spark" }, { spellId: "spark" }] },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.turns.length, 2);
  assert.equal(result.turns[0].result.totalDamage, 10);
  assert.equal(result.turns[1].result.totalDamage, 20);
  assert.equal(result.totalDamage, 30);
});

test("carries unused AP from supported sublimations into the next turn", () => {
  const result = simulateCombo({
    catalog,
    character: {
      ...character,
      sublimations: {
        selections: [{ sublimationId: "report-pa" }],
        hpAssumption: "normal",
      },
    },
    combo: {
      turns: [
        { actions: [{ spellId: "carryover-spend" }] },
        { actions: [{ spellId: "spark" }] },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.turns[0].result.finalState.resourceCarryover.ap, 2);
  assert.equal(result.turns[1].initialCharacter.resources.ap, 8);
});

test("carries persistent Huppermage state and expires active Heart between turns", () => {
  const result = simulateCombo({
    catalog,
    character: {
      ...character,
      classState: {
        huppermage: {
          activeHeart: "fire",
        },
      },
    },
    combo: {
      turns: [
        { actions: [{ spellId: "fire-rune" }] },
        { actions: [] },
      ],
    },
  });

  assert.equal(result.valid, true);
  const secondTurnCharacter = result.turns[1].initialCharacter;
  assert.equal(secondTurnCharacter.classState?.huppermage?.runes?.incandescent, true);
  assert.equal(secondTurnCharacter.classState?.huppermage?.lastGeneratedRune, "incandescent");
  assert.equal(secondTurnCharacter.classState?.huppermage?.activeHeart, null);
  assert.equal(secondTurnCharacter.classState?.huppermage?.storedBq, 75);
});

test("refreshes AP and PM while carrying PW and BQ into the next turn", () => {
  const result = simulateCombo({
    catalog,
    character,
    combo: {
      turns: [
        { actions: [{ spellId: "resource-spend" }] },
        { actions: [] },
      ],
    },
  });

  assert.equal(result.valid, true);
  const secondTurnResources = result.turns[1].initialCharacter.resources;
  assert.equal(secondTurnResources.ap, 6);
  assert.equal(secondTurnResources.mp, 3);
  assert.equal(secondTurnResources.wp, 1);
  assert.equal(secondTurnResources.bq, 110);
});

test("blocks cooldown spells during their waiting turns", () => {
  const result = simulateCombo({
    catalog,
    character,
    combo: {
      turns: [
        { actions: [{ spellId: "cooldown-spell" }] },
        { actions: [{ spellId: "cooldown-spell" }] },
      ],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations[0].type, "cooldownActive");
  assert.equal(result.violations[0].turnIndex, 1);
  assert.equal(result.violations[0].actionIndex, 0);
});

test("allows cooldown spells after waiting the cooldown duration", () => {
  const result = simulateCombo({
    catalog,
    character,
    combo: {
      turns: [
        { actions: [{ spellId: "cooldown-spell" }] },
        { actions: [] },
        { actions: [] },
        { actions: [{ spellId: "cooldown-spell" }] },
      ],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.turns[3].result.breakdown[0].spellId, "cooldown-spell");
});

test("preserves completed turns and annotates violations from invalid later turns", () => {
  const result = simulateCombo({
    catalog,
    character,
    combo: {
      turns: [
        { actions: [{ spellId: "spark" }] },
        { actions: [{ spellId: "expensive" }] },
      ],
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.turns.length, 2);
  assert.equal(result.turns[0].result.valid, true);
  assert.equal(result.turns[1].result.valid, false);
  assert.equal(result.totalDamage, 10);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].turnIndex, 1);
  assert.equal(result.violations[0].actionIndex, 0);
  assert.equal(result.violations[0].type, "insufficientResource");
});
