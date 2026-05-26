import assert from "node:assert/strict";
import test from "node:test";

import { createResources } from "../core/simulation/index.ts";
import {
  createBuild,
  createMemoryWorkspaceStorage,
  createSeedResearchWorkspace,
  filterBuildsByClass,
  isWakfuClassSelectable,
  restoreResearchWorkspace,
  saveResearchWorkspace,
} from "./researchWorkspace.ts";
import {
  createResearchRoute,
  openBuilderFromSetup,
  openBuild,
  openSetup,
  returnToBuild,
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
