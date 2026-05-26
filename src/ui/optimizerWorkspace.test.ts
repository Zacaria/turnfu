import assert from "node:assert/strict";
import test from "node:test";

import { cost, damage, normalizeCatalog, screenshot, spell } from "../core/catalog/index.ts";
import { createSeedResearchWorkspace } from "./researchWorkspace.ts";
import {
  createDefaultOptimizerControls,
  createOptimizerCandidateId,
  createOptimizerOptionsForSetup,
  createOptimizerResultViewModel,
  createPinnedCandidateComparison,
  createSavedComboName,
  groupOptimizerResultsByDuration,
  normalizeOptimizerControls,
  openCandidateInBuilder,
  summarizeOptimizerControls,
} from "./optimizerWorkspace.ts";

const source = screenshot("/tmp/optimizer-workspace-test.png", "optimizer-workspace-test");
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
]);

function getSeedSetup() {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);
  return setup;
}

test("maps setup snapshots and controls to core optimizer options", () => {
  const setup = getSeedSetup();
  const controls = {
    ...createDefaultOptimizerControls(),
    durations: [1, 3],
    beamWidth: 25,
    maxResultsPerDuration: 7,
    scoreCriterion: "elementDamage" as const,
    targetElement: "fire" as const,
    requireSustainableCycle: true,
  };

  const options = createOptimizerOptionsForSetup(setup, catalog, controls, 3);

  assert.equal(options.character, setup.character);
  assert.equal(options.defaultActionContext, setup.defaultActionContext);
  assert.deepEqual(options.availableSpellIds, setup.deckSpellIds.filter((spellId) => catalog.some((entry) => entry.id === spellId)));
  assert.equal(options.maxTurns, 3);
  assert.equal(options.exactTurnCount, 3);
  assert.equal(options.beamWidth, 25);
  assert.equal(options.maxActionsPerTurn, undefined);
  assert.equal(options.criterion.type, "elementDamage");
  assert.equal(options.criterion.type === "elementDamage" ? options.criterion.element : null, "fire");
  assert.equal(options.requireSustainableCycle, true);
});

test("normalizes optimizer controls to supported durations and result limits", () => {
  const controls = normalizeOptimizerControls({
    ...createDefaultOptimizerControls(),
    beamWidth: 999,
    durations: [0, 1, 3, 7],
    maxResultsPerDuration: 999,
  });

  assert.deepEqual(controls.durations, [1, 3]);
  assert.equal(controls.beamWidth, 200);
  assert.equal(controls.maxResultsPerDuration, 50);
});

test("summarizes optimizer controls for saved run references", () => {
  const summary = summarizeOptimizerControls({
    ...createDefaultOptimizerControls(),
    durations: [3, 1],
    scoreCriterion: "elementDamage",
    targetElement: "water",
    requireSustainableCycle: true,
    beamWidth: 25,
    maxResultsPerDuration: 7,
  });

  assert.equal(summary, "1T, 3T · dégâts eau · cycle soutenable · largeur 25 · 7 résultats");
});

test("groups optimizer results by exact duration without cross-ranking raw totals", () => {
  const setup = {
    ...getSeedSetup(),
    deckSpellIds: ["light-hit", "fire-hit"],
    character: {
      ...getSeedSetup().character,
      stats: {
        ...getSeedSetup().character.stats,
        generalMastery: 0,
        elementalMastery: {
          fire: 100,
          water: 300,
          earth: 0,
          air: 0,
          light: 0,
          neutral: 0,
        },
      },
    },
  };

  const groups = groupOptimizerResultsByDuration(setup, catalog, {
    ...createDefaultOptimizerControls(),
    durations: [1, 2, 3],
    maxResultsPerDuration: 2,
  });

  assert.deepEqual(Object.keys(groups), ["1", "2", "3"]);
  assert.ok(groups[1].every((result) => result.duration === 1));
  assert.ok(groups[2].every((result) => result.duration === 2));
  assert.ok(groups[3].every((result) => result.duration === 3));
  assert.ok(groups[3][0].totalDamage > groups[1][0].totalDamage);
});

test("builds result view models with normalized metrics and resolved element damage", () => {
  const setup = {
    ...getSeedSetup(),
    deckSpellIds: ["light-hit"],
    character: {
      ...getSeedSetup().character,
      stats: {
        ...getSeedSetup().character.stats,
        generalMastery: 0,
        distanceMastery: 0,
        damageInflictedPercent: 0,
        elementalMastery: {
          fire: 0,
          water: 300,
          earth: 0,
          air: 0,
          light: 900,
          neutral: 0,
        },
      },
    },
  };
  const [candidate] = groupOptimizerResultsByDuration(setup, catalog, {
    ...createDefaultOptimizerControls(),
    durations: [1],
    scoreCriterion: "elementDamage",
    targetElement: "water",
  })[1];

  assert.ok(candidate);
  assert.equal(candidate.duration, 1);
  assert.equal(candidate.damageByResolvedElement.water, 480);
  assert.equal(candidate.score, 480);
  assert.equal(candidate.damagePerTurn, 480);
  assert.equal(candidate.damagePerAp, 40);
  assert.equal(candidate.finalResources.ap, 0);
});

test("compares pinned candidates across durations using normalized metrics", () => {
  const setup = {
    ...getSeedSetup(),
    deckSpellIds: ["light-hit", "fire-hit"],
  };
  const groups = groupOptimizerResultsByDuration(setup, catalog, {
    ...createDefaultOptimizerControls(),
    durations: [1, 2],
  });
  const comparison = createPinnedCandidateComparison([groups[1][0], groups[2][0]]);

  assert.equal(comparison.length, 2);
  assert.deepEqual(comparison.map((candidate) => candidate.duration), [1, 2]);
  assert.ok(comparison[0].damagePerTurn > 0);
  assert.ok(comparison[1].damagePerTurn > 0);
});

test("creates builder handoff payload from an optimizer candidate", () => {
  const setup = getSeedSetup();
  const result = createOptimizerResultViewModel({
    duration: 1,
    result: {
      plan: { turns: [{ actions: [{ spellId: "light-hit" }] }] },
      simulation: {
        valid: true,
        combo: { turns: [{ actions: [{ spellId: "light-hit" }] }] },
        turns: [],
        totalDamage: 40,
        finalState: {
          remainingResources: setup.character.resources,
          classState: setup.character.classState ?? {},
          currentStats: setup.character.stats,
          castsBySpellId: {},
          totalDamage: 40,
          actionLog: [],
          turnEndEffects: [],
        },
        violations: [],
      },
      score: {
        score: 40,
        totalDamage: 40,
        damageByResolvedElement: {
          fire: 0,
          water: 40,
          earth: 0,
          air: 0,
          light: 0,
          neutral: 0,
        },
      },
      sustainability: {
        required: false,
        sustainable: true,
      },
    },
  });

  const handoff = openCandidateInBuilder(setup, result);

  assert.equal(handoff.setupSnapshotId, setup.id);
  assert.equal(handoff.character, setup.character);
  assert.deepEqual(handoff.plan, result.plan);
  assert.equal(createOptimizerCandidateId(result.plan), "light-hit");
  assert.equal(createSavedComboName(result), "1T · 40 dégâts · 40/tour");
});
