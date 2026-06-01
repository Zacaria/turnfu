import assert from "node:assert/strict";
import test from "node:test";

import { cost, damage, normalizeCatalog, normalizeEntry, passive, screenshot, spell } from "../core/catalog/index.ts";
import { createSeedResearchWorkspace } from "./researchWorkspace.ts";
import {
  createDefaultOptimizerControls,
  createOptimizerCandidateId,
  createOptimizerCandidateSpellIconRows,
  createOptimizerExperimentOptionsForSetup,
  createOptimizerOptionsForSetup,
  createOptimizerResultViewModel,
  createPinnedCandidateComparison,
  createSavedComboName,
  groupOptimizerResultsByDuration,
  normalizeOptimizerControls,
  openCandidateInBuilder,
  runOptimizerForControlsLive,
  runOptimizerForControls,
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
    duration: 3,
    beamWidth: 25,
    maxResultsPerDuration: 7,
    scoreCriterion: "elementDamage" as const,
    targetElement: "fire" as const,
    requireSustainableCycle: true,
  };

  const options = createOptimizerOptionsForSetup(setup, catalog, controls, 3);

  assert.equal(options.character, setup.character);
  assert.equal(options.defaultActionContext, setup.defaultActionContext);
  assert.equal(options.availableSpellIds, undefined);
  assert.equal(options.maxTurns, 3);
  assert.equal(options.exactTurnCount, 3);
  assert.equal(options.beamWidth, 25);
  assert.equal(options.maxActionsPerTurn, undefined);
  assert.equal(options.criterion.type, "elementDamage");
  assert.equal(options.criterion.type === "elementDamage" ? options.criterion.element : null, "fire");
  assert.equal(options.requireSustainableCycle, true);
});

test("normalizes optimizer controls to supported duration and result limits", () => {
  const controls = normalizeOptimizerControls({
    ...createDefaultOptimizerControls(),
    beamWidth: 999,
    duration: 7,
    maxResultsPerDuration: 999,
  });

  assert.equal(controls.duration, 3);
  assert.equal(controls.beamWidth, 200);
  assert.equal(controls.iterationBudget, 1000);
  assert.equal(controls.maxResultsPerDuration, 50);
});

test("maps controls to experimental optimizer options with method and passive exploration", () => {
  const setup = {
    ...getSeedSetup(),
    character: {
      ...getSeedSetup().character,
      classState: {
        huppermage: {
          ...getSeedSetup().character.classState?.huppermage,
          passiveLimit: 3,
        },
      },
    },
  };
  const passiveCatalog = [
    ...catalog,
    normalizeEntry(
    passive("passive-a", {
      name: "Passive A",
      level: 200,
      effects: [],
      constraints: [],
      tags: [],
      metadata: { status: "extracted", sources: [source] },
    }),
    ),
  ];

  const options = createOptimizerExperimentOptionsForSetup(setup, passiveCatalog, {
    ...createDefaultOptimizerControls(),
    searchMethod: "genetic",
    iterationBudget: 500,
    maxResultsPerDuration: 8,
    scoreCriterion: "elementDamage",
    targetElement: "earth",
  });

  assert.deepEqual(options.engines, ["genetic"]);
  assert.equal(options.budget.iterations, 500);
  assert.equal(options.maxCandidates, 8);
  assert.equal(options.maxPassiveCount, 3);
  assert.deepEqual(options.availablePassiveIds, ["passive-a"]);
  assert.equal(options.criterion?.type, "elementDamage");
  assert.equal(options.criterion?.type === "elementDamage" ? options.criterion.element : null, "earth");
});

test("summarizes optimizer controls for saved run references", () => {
  const summary = summarizeOptimizerControls({
    ...createDefaultOptimizerControls(),
    duration: 3,
    scoreCriterion: "elementDamage",
    targetElement: "water",
    requireSustainableCycle: true,
    beamWidth: 25,
    maxResultsPerDuration: 7,
  });

  assert.equal(summary, "3T · dégâts eau · cycle soutenable · hybride · 1000 essais · 7 résultats");
});

test("formats three optimizer candidate spell icon rows from catalog names", () => {
  const rows = createOptimizerCandidateSpellIconRows({
    turns: [
      { actions: [{ spellId: "light-hit" }, { spellId: "missing-spell" }] },
      { actions: [{ spellId: "fire-hit" }] },
    ],
  }, catalog);

  assert.deepEqual(rows, [
    {
      turn: 1,
      icons: [
        { spellId: "light-hit", label: "Light Hit" },
        { spellId: "missing-spell", label: "missing-spell" },
      ],
    },
    {
      turn: 2,
      icons: [
        { spellId: "fire-hit", label: "Fire Hit" },
      ],
    },
    {
      turn: 3,
      icons: [],
    },
  ]);
});

test("runs optimizer for the selected exact duration only", () => {
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
    duration: 3,
    maxResultsPerDuration: 2,
  });

  assert.deepEqual(Object.keys(groups), ["3"]);
  assert.ok(groups[3].every((result) => result.duration === 3));
  assert.ok(groups[3][0].totalDamage > 0);
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
    duration: 1,
    scoreCriterion: "elementDamage",
    targetElement: "water",
  })[1];

  assert.ok(candidate);
  assert.equal(candidate.duration, 1);
  assert.ok(candidate.damageByResolvedElement.water > 0);
  assert.equal(candidate.score, candidate.damageByResolvedElement.water);
  assert.equal(candidate.damagePerTurn, candidate.totalDamage);
  assert.ok(candidate.damagePerAp > 0);
});

test("creates pinned candidate comparisons from a completed run", () => {
  const setup = {
    ...getSeedSetup(),
    deckSpellIds: ["light-hit", "fire-hit"],
  };
  const candidates = runOptimizerForControls(setup, catalog, {
    ...createDefaultOptimizerControls(),
    duration: 1,
  });
  const comparison = createPinnedCandidateComparison(candidates.slice(0, 2));

  assert.ok(comparison.length > 0);
  assert.ok(comparison.every((candidate) => candidate.duration === 1));
  assert.ok(comparison[0].damagePerTurn > 0);
});

test("live optimizer run reports intermediate best results and counters", async () => {
  const setup = {
    ...getSeedSetup(),
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
  const snapshots: Array<{ attempts: number; resultCount: number }> = [];

  const results = await runOptimizerForControlsLive(setup, catalog, {
    ...createDefaultOptimizerControls(),
    duration: 1,
    iterationBudget: 25,
    maxResultsPerDuration: 2,
    searchMethod: "genetic",
  }, (progress) => {
    snapshots.push({ attempts: progress.attempts, resultCount: progress.results.length });
  });

  assert.ok(snapshots.length > 1);
  assert.ok(snapshots.at(-1)!.attempts >= 25);
  assert.ok(snapshots.some((snapshot) => snapshot.resultCount > 0));
  assert.ok(results.length > 0);
});

test("live optimizer throttles progress for large genetic workspace runs", async () => {
  const setup = {
    ...getSeedSetup(),
    deckSpellIds: ["light-hit", "fire-hit"],
  };
  const snapshots: Array<{ attempts: number; resultCount: number }> = [];

  const results = await runOptimizerForControlsLive(setup, catalog, {
    ...createDefaultOptimizerControls(),
    duration: 1,
    iterationBudget: 10_000,
    maxResultsPerDuration: 2,
    searchMethod: "genetic",
  }, (progress) => {
    snapshots.push({ attempts: progress.attempts, resultCount: progress.results.length });
  });

  assert.ok(snapshots.length > 1);
  assert.ok(snapshots.length <= 202);
  assert.ok(snapshots.at(-1)!.attempts >= 10_000);
  assert.ok(results.length > 0);
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
          targetCastsBySpellId: {},
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
  assert.equal(createOptimizerCandidateId(result.plan, ["passive-b", "passive-a"]), "passive-a+passive-b::light-hit");
  assert.equal(createOptimizerCandidateId(result.plan, [], ["sauvegarde-6"]), "sauvegarde-6::light-hit");
  assert.equal(createSavedComboName(result), "1T · 40 dégâts · 40/tour");

  const passiveHandoff = openCandidateInBuilder(setup, {
    ...result,
    passiveIds: ["passive-a", "passive-b"],
  });

  assert.notEqual(passiveHandoff.character, setup.character);
  assert.deepEqual(passiveHandoff.character.classState?.huppermage?.activePassives, ["passive-a", "passive-b"]);
  assert.deepEqual(passiveHandoff.plan, result.plan);

  const sublimationHandoff = openCandidateInBuilder(setup, {
    ...result,
    sublimationIds: ["sauvegarde-6"],
    sublimations: {
      selections: [{ sublimationId: "sauvegarde-6" }],
      hpAssumption: "normal",
      nearbyAlliesAssumption: "unspecified",
      contactEnemiesAssumption: "unspecified",
    },
  });

  assert.notEqual(sublimationHandoff.character, setup.character);
  assert.deepEqual(sublimationHandoff.character.sublimations?.selections, [{ sublimationId: "sauvegarde-6" }]);
  assert.deepEqual(sublimationHandoff.character.classState?.huppermage?.activePassives, setup.character.classState?.huppermage?.activePassives);
});
