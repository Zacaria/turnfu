import assert from "node:assert/strict";
import test from "node:test";

import { createTimelineCursorMarks } from "./timelineCursor.ts";

test("creates one action tick per spell and centers turn markers on their action span", () => {
  const marks = createTimelineCursorMarks([3, 2]);

  assert.deepEqual(marks.actionSteps, [1, 2, 3, 4, 5]);
  assert.deepEqual(marks.turns, [
    { actionCount: 3, endStep: 3, midpointStep: 2, startStep: 1, turnIndex: 0 },
    { actionCount: 2, endStep: 5, midpointStep: 4.5, startStep: 4, turnIndex: 1 },
  ]);
});

test("keeps empty turns visible at the current sequence boundary", () => {
  const marks = createTimelineCursorMarks([3, 0]);

  assert.deepEqual(marks.turns[1], {
    actionCount: 0,
    endStep: 3,
    midpointStep: 3,
    startStep: 3,
    turnIndex: 1,
  });
});
