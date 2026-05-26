import assert from "node:assert/strict";
import test from "node:test";

import { cost, damage, normalizeCatalog, screenshot, spell } from "../catalog/index.ts";
import { createResources, simulateCombo } from "../simulation/index.ts";
import { evaluateSustainableCycle, optimizeCombo, scoreComboSimulation } from "./comboOptimizer.ts";
import type { CatalogEntry } from "../catalog/types.ts";
import type { SimulatedCharacter } from "../simulation/types.ts";

const source = screenshot("/tmp/combo-optimizer-test.png", "combo-optimizer-test");

const catalog = normalizeCatalog([
  spell("light-hit", {
    name: "Light Hit",
    level: 200,
    element: "light",
    cost: cost({ ap: 1 }),
    effects: [damage({ element: "light", base: 10 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("fire-hit", {
    name: "Fire Hit",
    level: 200,
    element: "fire",
    cost: cost({ ap: 1 }),
    effects: [damage({ element: "fire", base: 10 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("balanced-bq-cycle", {
    name: "Balanced BQ Cycle",
    level: 200,
    cost: cost({ bq: 100 }),
    effects: [],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("draining-bq-cycle", {
    name: "Draining BQ Cycle",
    level: 200,
    cost: cost({ bq: 150 }),
    effects: [],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
]) as CatalogEntry[];

const character: SimulatedCharacter = {
  id: "optimizer-test",
  className: "huppermage",
  resources: createResources({ ap: 6, mp: 3, wp: 1, bq: 0 }),
  stats: {
    generalMastery: 0,
    elementalMastery: {
      fire: 100,
      water: 300,
      earth: 50,
      air: 0,
      light: 900,
    },
    damageInflictedPercent: 0,
  },
};

test("scores Light damage under its resolved elemental attribution", () => {
  const simulation = simulateCombo({
    catalog,
    character,
    combo: {
      turns: [
        { actions: [{ spellId: "light-hit" }] },
      ],
    },
  });

  const waterScore = scoreComboSimulation(simulation, { type: "elementDamage", element: "water" });
  const fireScore = scoreComboSimulation(simulation, { type: "elementDamage", element: "fire" });

  assert.equal(simulation.valid, true);
  assert.equal(simulation.totalDamage, 40);
  assert.equal(waterScore.score, 40);
  assert.equal(waterScore.damageByResolvedElement.water, 40);
  assert.equal(fireScore.score, 0);
  assert.equal(fireScore.damageByResolvedElement.fire, 0);
});

test("accepts a sustainable cycle when replay preserves BQ and PW", () => {
  const sustainability = evaluateSustainableCycle({
    catalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 1, bq: 500 }),
    },
    plan: {
      turns: [
        { actions: [{ spellId: "balanced-bq-cycle" }] },
      ],
    },
  });

  assert.equal(sustainability.required, true);
  assert.equal(sustainability.sustainable, true);
  assert.equal(sustainability.reason, undefined);
});

test("rejects a cycle whose replay spends unrecovered BQ", () => {
  const sustainability = evaluateSustainableCycle({
    catalog,
    character: {
      ...character,
      resources: createResources({ ap: 6, mp: 3, wp: 1, bq: 500 }),
    },
    plan: {
      turns: [
        { actions: [{ spellId: "draining-bq-cycle" }] },
      ],
    },
  });

  assert.equal(sustainability.required, true);
  assert.equal(sustainability.sustainable, false);
  assert.equal(sustainability.reason, "replayResourceDebt");
});

test("scores total combo damage", () => {
  const simulation = simulateCombo({
    catalog,
    character,
    combo: {
      turns: [
        { actions: [{ spellId: "light-hit" }, { spellId: "fire-hit" }] },
      ],
    },
  });

  const score = scoreComboSimulation(simulation, { type: "totalDamage" });

  assert.equal(simulation.valid, true);
  assert.equal(score.score, 60);
  assert.equal(score.totalDamage, 60);
  assert.equal(score.damageByResolvedElement.water, 40);
  assert.equal(score.damageByResolvedElement.fire, 20);
});

test("searches bounded combo plans up to three turns and ranks by score", () => {
  const results = optimizeCombo({
    catalog,
    character,
    availableSpellIds: ["light-hit", "fire-hit"],
    maxTurns: 3,
    maxActionsPerTurn: 1,
    criterion: { type: "totalDamage" },
  });

  assert.ok(results.length > 0);
  assert.ok(results.every((result) => result.plan.turns.length <= 3));
  assert.equal(results[0].plan.turns.length, 3);
  assert.deepEqual(results[0].plan.turns.map((turn) => turn.actions[0]?.spellId), [
    "light-hit",
    "light-hit",
    "light-hit",
  ]);
  assert.equal(results[0].score.score, 120);
});

test("limits returned optimizer candidates deterministically", () => {
  const results = optimizeCombo({
    catalog,
    character,
    availableSpellIds: ["light-hit", "fire-hit"],
    maxTurns: 3,
    maxActionsPerTurn: 1,
    criterion: { type: "totalDamage" },
    maxCandidates: 2,
  });

  assert.equal(results.length, 2);
  assert.ok(results[0].score.score >= results[1].score.score);
});
