import assert from "node:assert/strict";
import test from "node:test";

import { createResources } from "../core/simulation/index.ts";
import {
  createBalancedElementSet,
  createBuild,
  createMemoryWorkspaceStorage,
  createOptimizerRunReference,
  createSeedResearchWorkspace,
  filterBuildsByClass,
  isWakfuClassSelectable,
  restoreResearchWorkspace,
  saveResearchWorkspace,
  saveOptimizerCandidateCombo,
} from "./researchWorkspace.ts";
import {
  createResearchRoute,
  openBuilderFromSetup,
  openBuild,
  openOptimizerRun,
  openSavedComboComparison,
  openSetup,
  returnToBuild,
  returnToPrevious,
} from "./researchNavigation.ts";

test("creates named Huppermage builds while keeping unsupported classes disabled", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const nextWorkspace = createBuild(workspace, {
    classId: "huppermage",
    gameplayLabel: "Cycle BQ",
    name: "Hupper cycle lumière",
    now: "2026-05-26T10:15:00.000Z",
  });

  assert.equal(isWakfuClassSelectable("huppermage"), true);
  assert.equal(isWakfuClassSelectable("iop"), false);
  assert.equal(nextWorkspace.builds.length, workspace.builds.length + 1);
  assert.equal(nextWorkspace.builds.at(-1)?.name, "Hupper cycle lumière");
  assert.equal(nextWorkspace.builds.at(-1)?.classId, "huppermage");
});

test("serializes setup snapshots with final stats, resources, equipment notes and initial state", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);
  assert.equal(setup.classId, "huppermage");
  assert.equal(setup.character.resources.bq, 500);
  assert.equal(setup.equipmentNotes, "Stats finales saisies manuellement; les items ne sont pas modelises.");
  assert.ok(setup.passiveIds.includes("extension-des-sens"));
  assert.ok(setup.deckSpellIds.length > 0);
  assert.equal(setup.target.kind, "enemy");
  assert.equal(setup.defaultActionContext.rangeMode, "distance");
  assert.equal(setup.character.classState?.huppermage?.bqMax, 500);
});

test("saves and restores workspace data from local storage", () => {
  const storage = createMemoryWorkspaceStorage();
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);
  const withRun = {
    ...workspace,
    optimizerRuns: [
      {
        id: "run-1",
        buildId: setup.buildId,
        setupSnapshotId: setup.id,
        label: "Total 1T",
        createdAt: "2026-05-26T10:05:00.000Z",
        criteriaSummary: "totalDamage",
      },
    ],
    savedCombos: [
      {
        id: "combo-1",
        buildId: setup.buildId,
        setupSnapshotId: setup.id,
        name: "Burst test",
        createdAt: "2026-05-26T10:06:00.000Z",
        plan: { turns: [{ actions: [{ spellId: "lueur-de-laube" }] }] },
        totalDamage: 123,
      },
    ],
  };

  saveResearchWorkspace(storage, withRun);
  const restored = restoreResearchWorkspace(storage);

  assert.deepEqual(restored, withRun);
});

test("creates optimizer run and saved combo references for a build setup", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);

  const withRun = createOptimizerRunReference(workspace, {
    buildId: setup.buildId,
    setupSnapshotId: setup.id,
    label: "Run eau soutenable",
    criteriaSummary: "1T, 2T · dégâts eau · cycle soutenable",
    now: "2026-05-26T10:05:00.000Z",
  });
  const run = withRun.optimizerRuns[0];
  assert.ok(run);
  assert.equal(run.buildId, setup.buildId);
  assert.equal(run.setupSnapshotId, setup.id);
  assert.equal(run.label, "Run eau soutenable");
  assert.deepEqual(withRun.builds[0].optimizerRunIds, [run.id]);
  assert.equal(withRun.builds[0].updatedAt, "2026-05-26T10:05:00.000Z");

  const withCombo = saveOptimizerCandidateCombo(withRun, {
    buildId: setup.buildId,
    setupSnapshotId: setup.id,
    name: "Combo 2T eau",
    plan: { turns: [{ actions: [{ spellId: "lueur-de-laube" }] }] },
    totalDamage: 480,
    now: "2026-05-26T10:06:00.000Z",
  });
  const combo = withCombo.savedCombos[0];
  assert.ok(combo);
  assert.equal(combo.name, "Combo 2T eau");
  assert.equal(combo.totalDamage, 480);
  assert.deepEqual(withCombo.builds[0].savedComboIds, [combo.id]);
  assert.equal(withCombo.builds[0].updatedAt, "2026-05-26T10:06:00.000Z");
});

test("creates balanced element set variants without mutating the source set", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const sourceSetup = workspace.setupSnapshots[0];
  assert.ok(sourceSetup);

  const nextWorkspace = createBalancedElementSet(workspace, {
    buildId: sourceSetup.buildId,
    sourceSetupSnapshotId: sourceSetup.id,
    name: "Set multi équilibré",
    now: "2026-05-26T11:00:00.000Z",
  });
  const balancedSet = nextWorkspace.setupSnapshots.at(-1);

  assert.ok(balancedSet);
  assert.notEqual(balancedSet.id, sourceSetup.id);
  assert.equal(balancedSet.buildId, sourceSetup.buildId);
  assert.equal(balancedSet.name, "Set multi équilibré");
  assert.equal(balancedSet.character.stats.elementalMastery.fire, 463);
  assert.equal(balancedSet.character.stats.elementalMastery.water, 463);
  assert.equal(balancedSet.character.stats.elementalMastery.earth, 463);
  assert.equal(balancedSet.character.stats.elementalMastery.air, 463);
  assert.equal(sourceSetup.character.stats.elementalMastery.fire, 400);
  assert.equal(sourceSetup.character.stats.elementalMastery.water, 700);
  assert.deepEqual(nextWorkspace.builds[0].setupSnapshotIds, [sourceSetup.id, balancedSet.id]);
  assert.equal(nextWorkspace.builds[0].updatedAt, "2026-05-26T11:00:00.000Z");
});

test("filters builds by class", () => {
  const workspace = createBuild(createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" }), {
    classId: "huppermage",
    gameplayLabel: "Burst",
    name: "Hupper burst",
    now: "2026-05-26T10:30:00.000Z",
  });

  assert.equal(filterBuildsByClass(workspace.builds, "huppermage").length, workspace.builds.length);
  assert.equal(filterBuildsByClass(workspace.builds, "iop").length, 0);
});

test("preserves build and setup context across navigation", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);

  const route = createResearchRoute();
  const buildRoute = openBuild(route, setup.buildId);
  const setupRoute = openSetup(buildRoute, setup.buildId, setup.id);
  const builderRoute = openBuilderFromSetup(setupRoute, setup.buildId, setup.id);
  const returnedRoute = returnToBuild(builderRoute);

  assert.equal(builderRoute.page, "builder");
  assert.equal(builderRoute.buildId, setup.buildId);
  assert.equal(builderRoute.setupSnapshotId, setup.id);
  assert.equal(returnedRoute.page, "build");
  assert.equal(returnedRoute.buildId, setup.buildId);
});

test("navigates to saved optimizer run and saved combo comparison pages", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);
  const withRun = createOptimizerRunReference(workspace, {
    buildId: setup.buildId,
    setupSnapshotId: setup.id,
    label: "Run test",
    criteriaSummary: "1T · dégâts totaux",
    now: "2026-05-26T10:05:00.000Z",
  });
  const run = withRun.optimizerRuns[0];
  assert.ok(run);

  const buildRoute = openBuild(createResearchRoute(), setup.buildId);
  const runRoute = openOptimizerRun(buildRoute, setup.buildId, run.id);
  const comboRoute = openSavedComboComparison(buildRoute, setup.buildId);

  assert.equal(runRoute.page, "optimizerRun");
  assert.equal(runRoute.optimizerRunId, run.id);
  assert.deepEqual(returnToPrevious(runRoute), buildRoute);
  assert.equal(comboRoute.page, "savedCombos");
  assert.deepEqual(returnToPrevious(comboRoute), buildRoute);
});

test("setup snapshots are versioned instead of mutated", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);

  const edited = {
    ...setup,
    id: "setup-edited",
    version: setup.version + 1,
    character: {
      ...setup.character,
      resources: createResources({ ...setup.character.resources, bq: 450 }),
    },
  };

  assert.equal(setup.version, 1);
  assert.equal(edited.version, 2);
  assert.equal(setup.character.resources.bq, 500);
  assert.equal(edited.character.resources.bq, 450);
});
