import assert from "node:assert/strict";
import test from "node:test";

import { createResources } from "../core/simulation/index.ts";
import {
  createBalancedElementSet,
  createBuild,
  createMemoryWorkspaceStorage,
  createOptimizerRunReference,
  createSeedResearchWorkspace,
  deleteSavedCombo,
  deleteSavedCombos,
  deleteSetupSnapshot,
  filterBuildsByClass,
  isWakfuClassSelectable,
  restoreResearchWorkspace,
  saveResearchWorkspace,
  saveOptimizerCandidateCombo,
  renameBuild,
  renameSetupSnapshot,
  saveSetupVersion,
} from "./researchWorkspace.ts";
import {
  createResearchRoute,
  openBuilderFromSetup,
  openBuild,
  openOptimizerFromSetup,
  openOptimizerRun,
  openSavedComboComparison,
  openSetup,
  retargetSetupRoute,
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

test("renames a build without changing its saved sets", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const build = workspace.builds[0];
  assert.ok(build);

  const nextWorkspace = renameBuild(workspace, {
    buildId: build.id,
    name: "Huppermage BQ édité",
    now: "2026-05-26T10:10:00.000Z",
  });

  assert.equal(nextWorkspace.builds[0].name, "Huppermage BQ édité");
  assert.equal(nextWorkspace.builds[0].updatedAt, "2026-05-26T10:10:00.000Z");
  assert.deepEqual(nextWorkspace.builds[0].setupSnapshotIds, build.setupSnapshotIds);
  assert.deepEqual(nextWorkspace.setupSnapshots, workspace.setupSnapshots);
});

test("ignores blank build names", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const build = workspace.builds[0];
  assert.ok(build);

  const nextWorkspace = renameBuild(workspace, {
    buildId: build.id,
    name: "   ",
    now: "2026-05-26T10:10:00.000Z",
  });

  assert.equal(nextWorkspace, workspace);
});

test("renames a setup snapshot without changing saved assumptions", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);

  const nextWorkspace = renameSetupSnapshot(workspace, {
    buildId: setup.buildId,
    setupSnapshotId: setup.id,
    name: "Set BQ 550",
    now: "2026-05-26T10:10:00.000Z",
  });

  assert.equal(nextWorkspace.setupSnapshots[0].name, "Set BQ 550");
  assert.equal(nextWorkspace.setupSnapshots[0].id, setup.id);
  assert.equal(nextWorkspace.setupSnapshots[0].version, setup.version);
  assert.deepEqual(nextWorkspace.setupSnapshots[0].character, setup.character);
  assert.equal(nextWorkspace.builds[0].updatedAt, "2026-05-26T10:10:00.000Z");
});

test("ignores blank setup snapshot names", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);

  const nextWorkspace = renameSetupSnapshot(workspace, {
    buildId: setup.buildId,
    setupSnapshotId: setup.id,
    name: "   ",
    now: "2026-05-26T10:10:00.000Z",
  });

  assert.equal(nextWorkspace, workspace);
});

test("serializes setup snapshots with final stats, resources, equipment notes and initial state", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);
  assert.equal(setup.classId, "huppermage");
  assert.equal(setup.character.resources.bq, 500);
  assert.equal(setup.equipmentNotes, "Set de référence avec 1200 maîtrise générale et 1200 maîtrise sur Feu/Eau/Terre/Air; les items ne sont pas modelises.");
  assert.ok(setup.passiveIds.includes("extension-des-sens"));
  assert.ok(setup.deckSpellIds.length > 0);
  assert.equal(setup.target.kind, "enemy");
  assert.equal(setup.defaultActionContext.rangeMode, "distance");
  assert.equal(setup.defaultActionContext.criticalMode, "expected");
  assert.deepEqual(setup.sublimations, {
    selections: [],
    hpAssumption: "normal",
    nearbyAlliesAssumption: "unspecified",
    contactEnemiesAssumption: "unspecified",
  });
  assert.equal(setup.hpAssumption, "normal");
  assert.equal(setup.character.classState?.huppermage?.bqMax, 500);
  assert.equal(setup.name, "Set 1200 maîtrise 4 éléments");
  assert.equal(setup.character.stats.generalMastery, 1200);
  assert.equal(setup.character.stats.elementalMastery.fire, 1200);
  assert.equal(setup.character.stats.elementalMastery.water, 1200);
  assert.equal(setup.character.stats.elementalMastery.earth, 1200);
  assert.equal(setup.character.stats.elementalMastery.air, 1200);
});

test("creates a versioned setup snapshot when sublimations change", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);

  const result = saveSetupVersion(workspace, {
    buildId: setup.buildId,
    character: {
      ...setup.character,
      sublimations: {
        selections: [
          { sublimationId: "influence-6" },
          { sublimationId: "sauvegarde-6" },
        ],
        hpAssumption: "healthy90",
        nearbyAlliesAssumption: "twoPlus",
        contactEnemiesAssumption: "one",
      },
    },
    sourceSetupSnapshotId: setup.id,
    now: "2026-05-26T10:20:00.000Z",
  });
  const nextWorkspace = result.workspace;
  const nextSetup = nextWorkspace.setupSnapshots.at(-1);

  assert.equal(result.created, true);
  assert.ok(nextSetup);
  assert.notEqual(nextSetup.id, setup.id);
  assert.equal(nextSetup.version, setup.version + 1);
  assert.deepEqual(nextSetup.sublimations.selections, [
    { sublimationId: "influence-6" },
    { sublimationId: "sauvegarde-6" },
  ]);
  assert.equal(nextSetup.hpAssumption, "healthy90");
  assert.equal(nextSetup.character.sublimations.hpAssumption, "healthy90");
  assert.equal(nextSetup.character.sublimations.nearbyAlliesAssumption, "twoPlus");
  assert.equal(nextSetup.character.sublimations.contactEnemiesAssumption, "one");
  assert.deepEqual(nextSetup.character.sublimations, nextSetup.sublimations);
  assert.ok(nextWorkspace.builds[0].setupSnapshotIds.includes(nextSetup.id));
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
    passiveIds: ["carnage", "extension-des-sens"],
    sublimations: {
      selections: [{ sublimationId: "sauvegarde-6" }],
      hpAssumption: "normal",
      nearbyAlliesAssumption: "twoPlus",
      contactEnemiesAssumption: "one",
    },
    totalDamage: 480,
    criteriaSummary: "2T · dégâts eau",
    now: "2026-05-26T10:06:00.000Z",
  });
  const combo = withCombo.savedCombos[0];
  assert.ok(combo);
  assert.equal(combo.name, "Combo 2T eau");
  assert.equal(combo.totalDamage, 480);
  assert.deepEqual(combo.passiveIds, ["carnage", "extension-des-sens"]);
  assert.deepEqual(combo.sublimations?.selections, [{ sublimationId: "sauvegarde-6" }]);
  assert.equal(combo.sublimations?.nearbyAlliesAssumption, "twoPlus");
  assert.equal(combo.sublimations?.contactEnemiesAssumption, "one");
  assert.equal(combo.criteriaSummary, "2T · dégâts eau");
  assert.deepEqual(withCombo.builds[0].savedComboIds, [combo.id]);
  assert.equal(withCombo.builds[0].updatedAt, "2026-05-26T10:06:00.000Z");
});

test("deletes saved combo references from workspace and build", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);
  const withFirstCombo = saveOptimizerCandidateCombo(workspace, {
    buildId: setup.buildId,
    setupSnapshotId: setup.id,
    name: "Combo 1",
    plan: { turns: [{ actions: [{ spellId: "lueur-de-laube" }] }] },
    now: "2026-05-26T10:05:00.000Z",
  });
  const withSecondCombo = saveOptimizerCandidateCombo(withFirstCombo, {
    buildId: setup.buildId,
    setupSnapshotId: setup.id,
    name: "Combo 2",
    plan: { turns: [{ actions: [{ spellId: "rayon-crepusculaire" }] }] },
    now: "2026-05-26T10:06:00.000Z",
  });
  const firstCombo = withSecondCombo.savedCombos[0];
  const secondCombo = withSecondCombo.savedCombos[1];
  assert.ok(firstCombo);
  assert.ok(secondCombo);

  const withoutFirstCombo = deleteSavedCombo(withSecondCombo, firstCombo.id, "2026-05-26T10:07:00.000Z");

  assert.deepEqual(withoutFirstCombo.savedCombos.map((combo) => combo.id), [secondCombo.id]);
  assert.deepEqual(withoutFirstCombo.builds[0].savedComboIds, [secondCombo.id]);
  assert.equal(withoutFirstCombo.builds[0].updatedAt, "2026-05-26T10:07:00.000Z");
});

test("deletes multiple saved combos in one workspace update", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);
  const withCombos = ["lueur-de-laube", "rayon-crepusculaire", "coeur-de-lumiere"].reduce(
    (currentWorkspace, spellId, index) => saveOptimizerCandidateCombo(currentWorkspace, {
      buildId: setup.buildId,
      setupSnapshotId: setup.id,
      name: `Combo ${index + 1}`,
      plan: { turns: [{ actions: [{ spellId }] }] },
      now: `2026-05-26T10:0${index + 1}:00.000Z`,
    }),
    workspace,
  );
  const idsToDelete = withCombos.savedCombos.slice(0, 2).map((combo) => combo.id);

  const nextWorkspace = deleteSavedCombos(withCombos, {
    comboIds: idsToDelete,
    now: "2026-05-26T10:10:00.000Z",
  });

  assert.deepEqual(nextWorkspace.savedCombos.map((combo) => combo.name), ["Combo 3"]);
  assert.deepEqual(nextWorkspace.builds[0].savedComboIds, [nextWorkspace.savedCombos[0].id]);
  assert.equal(nextWorkspace.builds[0].updatedAt, "2026-05-26T10:10:00.000Z");
});

test("deletes setup snapshots and their saved run and combo references", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const sourceSetup = workspace.setupSnapshots[0];
  assert.ok(sourceSetup);
  const withSecondSetup = createBalancedElementSet(workspace, {
    buildId: sourceSetup.buildId,
    sourceSetupSnapshotId: sourceSetup.id,
    name: "Set à supprimer",
    now: "2026-05-26T10:05:00.000Z",
  });
  const deletedSetup = withSecondSetup.setupSnapshots[1];
  assert.ok(deletedSetup);
  const withRun = createOptimizerRunReference(withSecondSetup, {
    buildId: deletedSetup.buildId,
    setupSnapshotId: deletedSetup.id,
    criteriaSummary: "1T · dégâts totaux",
    now: "2026-05-26T10:06:00.000Z",
  });
  const withCombo = saveOptimizerCandidateCombo(withRun, {
    buildId: deletedSetup.buildId,
    setupSnapshotId: deletedSetup.id,
    name: "Combo lié au set",
    plan: { turns: [{ actions: [{ spellId: "lueur-de-laube" }] }] },
    now: "2026-05-26T10:07:00.000Z",
  });

  const nextWorkspace = deleteSetupSnapshot(withCombo, {
    buildId: deletedSetup.buildId,
    setupSnapshotId: deletedSetup.id,
    now: "2026-05-26T10:08:00.000Z",
  });

  assert.deepEqual(nextWorkspace.setupSnapshots.map((setup) => setup.id), [sourceSetup.id]);
  assert.deepEqual(nextWorkspace.builds[0].setupSnapshotIds, [sourceSetup.id]);
  assert.deepEqual(nextWorkspace.builds[0].optimizerRunIds, []);
  assert.deepEqual(nextWorkspace.builds[0].savedComboIds, []);
  assert.deepEqual(nextWorkspace.optimizerRuns, []);
  assert.deepEqual(nextWorkspace.savedCombos, []);
  assert.equal(nextWorkspace.builds[0].updatedAt, "2026-05-26T10:08:00.000Z");
});

test("does not delete the last setup snapshot for a build", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);

  const nextWorkspace = deleteSetupSnapshot(workspace, {
    buildId: setup.buildId,
    setupSnapshotId: setup.id,
    now: "2026-05-26T10:08:00.000Z",
  });

  assert.equal(nextWorkspace, workspace);
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
  assert.equal(balancedSet.character.stats.elementalMastery.fire, 1200);
  assert.equal(balancedSet.character.stats.elementalMastery.water, 1200);
  assert.equal(balancedSet.character.stats.elementalMastery.earth, 1200);
  assert.equal(balancedSet.character.stats.elementalMastery.air, 1200);
  assert.equal(sourceSetup.character.stats.elementalMastery.fire, 1200);
  assert.equal(sourceSetup.character.stats.elementalMastery.water, 1200);
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
  const returnedRoute = returnToPrevious(builderRoute);

  assert.equal(builderRoute.page, "builder");
  assert.equal(builderRoute.buildId, setup.buildId);
  assert.equal(builderRoute.setupSnapshotId, setup.id);
  assert.equal(returnedRoute.page, "setup");
  assert.equal(returnedRoute.buildId, setup.buildId);
  assert.equal(returnedRoute.setupSnapshotId, setup.id);
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
      resources: createResources({ ...setup.character.resources, bq: 375 }),
    },
  };

  assert.equal(setup.version, 1);
  assert.equal(edited.version, 2);
  assert.equal(setup.character.resources.bq, 500);
  assert.equal(edited.character.resources.bq, 375);
});

test("saves builder stat edits as a new setup version", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);

  const result = saveSetupVersion(workspace, {
    buildId: setup.buildId,
    sourceSetupSnapshotId: setup.id,
    character: {
      ...setup.character,
      resources: createResources({ ...setup.character.resources, bq: 450 }),
    },
    now: "2026-05-26T12:00:00.000Z",
  });
  const editedSetup = result.workspace.setupSnapshots.find((candidate) => candidate.id === result.setupSnapshotId);

  assert.equal(result.created, true);
  assert.ok(editedSetup);
  assert.notEqual(editedSetup.id, setup.id);
  assert.equal(editedSetup.version, setup.version + 1);
  assert.equal(editedSetup.character.resources.bq, 450);
  assert.equal(setup.character.resources.bq, 500);
  assert.deepEqual(result.workspace.builds[0].setupSnapshotIds, [setup.id, editedSetup.id]);
});

test("reuses an existing setup version for identical builder assumptions", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);

  const firstResult = saveSetupVersion(workspace, {
    buildId: setup.buildId,
    sourceSetupSnapshotId: setup.id,
    character: {
      ...setup.character,
      resources: createResources({ ...setup.character.resources, bq: 450 }),
    },
    now: "2026-05-26T12:00:00.000Z",
  });
  const secondResult = saveSetupVersion(firstResult.workspace, {
    buildId: setup.buildId,
    sourceSetupSnapshotId: setup.id,
    character: {
      ...setup.character,
      resources: createResources({ ...setup.character.resources, bq: 450 }),
    },
    now: "2026-05-26T12:05:00.000Z",
  });

  assert.equal(secondResult.created, false);
  assert.equal(secondResult.setupSnapshotId, firstResult.setupSnapshotId);
  assert.equal(secondResult.workspace.setupSnapshots.length, firstResult.workspace.setupSnapshots.length);
});

test("retargets optimizer return routes to an edited setup version", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-05-26T10:00:00.000Z" });
  const setup = workspace.setupSnapshots[0];
  assert.ok(setup);

  const optimizerRoute = openOptimizerFromSetup(openBuild(createResearchRoute(), setup.buildId), setup.buildId, setup.id);
  const builderRoute = openBuilderFromSetup(optimizerRoute, setup.buildId, setup.id);
  const returnedRoute = retargetSetupRoute(returnToPrevious(builderRoute), "setup-edited");

  assert.equal(returnedRoute.page, "optimizer");
  assert.equal(returnedRoute.setupSnapshotId, "setup-edited");
  assert.equal(returnedRoute.returnTo?.page, "setup");
  assert.equal(returnedRoute.returnTo?.setupSnapshotId, "setup-edited");
});
