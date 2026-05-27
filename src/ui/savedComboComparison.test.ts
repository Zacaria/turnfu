import assert from "node:assert/strict";
import test from "node:test";

import type { SavedComboReference } from "./researchWorkspace.ts";
import {
  createSavedComboComparisonRow,
  filterSavedCombosForComparison,
  getSavedComboDurationsForSet,
  groupSavedCombosByDuration,
} from "./savedComboComparison.ts";

const combo1Turn: SavedComboReference = {
  id: "combo-1",
  buildId: "build-1",
  setupSnapshotId: "setup-1",
  name: "Combo 1T",
  plan: { turns: [{ actions: [{ spellId: "spell-a" }, { spellId: "spell-b" }] }] },
  totalDamage: 600,
  criteriaSummary: "1T · dégâts totaux",
  createdAt: "2026-05-27T10:00:00.000Z",
};

const combo2Turns: SavedComboReference = {
  id: "combo-2",
  buildId: "build-1",
  setupSnapshotId: "setup-1",
  name: "Combo 2T",
  plan: {
    turns: [
      { actions: [{ spellId: "spell-a" }] },
      { actions: [{ spellId: "spell-b" }, { spellId: "spell-c" }] },
    ],
  },
  totalDamage: 1200,
  createdAt: "2026-05-27T10:01:00.000Z",
};

const stronger2Turns: SavedComboReference = {
  ...combo2Turns,
  id: "combo-3",
  name: "Combo 2T fort",
  totalDamage: 1400,
  createdAt: "2026-05-27T10:02:00.000Z",
};

test("creates normalized saved combo comparison rows", () => {
  const row = createSavedComboComparisonRow(combo2Turns);

  assert.equal(row.duration, 2);
  assert.equal(row.actionCount, 3);
  assert.equal(row.totalDamage, 1200);
  assert.equal(row.damagePerTurn, 600);
});

test("groups saved combos by exact duration without cross-ranking durations", () => {
  const groups = groupSavedCombosByDuration([combo2Turns, combo1Turn, stronger2Turns]);

  assert.deepEqual(groups[1].map((row) => row.combo.id), ["combo-1"]);
  assert.deepEqual(groups[2].map((row) => row.combo.id), ["combo-3", "combo-2"]);
  assert.deepEqual(groups[3], []);
});

test("filters saved combo comparisons by set and exact duration", () => {
  const otherSetCombo = {
    ...stronger2Turns,
    id: "combo-4",
    setupSnapshotId: "setup-2",
    totalDamage: 1800,
  };

  const rows = filterSavedCombosForComparison([combo1Turn, combo2Turns, stronger2Turns, otherSetCombo], {
    duration: 2,
    setupSnapshotId: "setup-1",
  });

  assert.deepEqual(rows.map((row) => row.combo.id), ["combo-3", "combo-2"]);
  assert.deepEqual(getSavedComboDurationsForSet([combo1Turn, combo2Turns, stronger2Turns, otherSetCombo], "setup-1"), [1, 2]);
});
