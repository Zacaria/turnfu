import assert from "node:assert/strict";
import test from "node:test";

import { createTurnRows } from "./turnRows.ts";

test("summarizes each planned turn with label, remaining AP and damage", () => {
  const rows = createTurnRows({
    turns: [
      [{ uid: "a", spellId: "spark" }],
      [{ uid: "b", spellId: "burst" }, { uid: "c", spellId: "spark" }],
    ],
    turnResults: [
      {
        turnIndex: 0,
        result: {
          totalDamage: 2840,
          valid: true,
          breakdown: [{}],
          finalState: { remainingResources: { ap: 0, mp: 3, wp: 6, bq: 100 } },
        },
      },
      {
        turnIndex: 1,
        result: {
          totalDamage: 1960,
          valid: true,
          breakdown: [{}, {}],
          finalState: { remainingResources: { ap: 2, mp: 3, wp: 6, bq: 100 } },
        },
      },
    ],
  });

  assert.deepEqual(rows.map(({ label, remainingAp, totalDamage, plannedActionCount, completedActionCount }) => ({
    label,
    remainingAp,
    totalDamage,
    plannedActionCount,
    completedActionCount,
  })), [
    { label: "T1", remainingAp: 0, totalDamage: 2840, plannedActionCount: 1, completedActionCount: 1 },
    { label: "T2", remainingAp: 2, totalDamage: 1960, plannedActionCount: 2, completedActionCount: 2 },
  ]);
});
