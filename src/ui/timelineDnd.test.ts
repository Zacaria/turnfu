import assert from "node:assert/strict";
import test from "node:test";

import { createTimelineDropIntent } from "./timelineDnd.ts";

const timelineUids = ["action-1", "action-2", "action-3"];

test("creates a spell insertion intent at the hovered sequence index", () => {
  assert.deepEqual(
    createTimelineDropIntent({ type: "spell", spellId: "averse" }, timelineUids, 1),
    { kind: "insertSpell", insertIndex: 1, spellId: "averse" },
  );
});

test("normalizes a moved action index after removing its source tile", () => {
  assert.deepEqual(
    createTimelineDropIntent({ type: "timelineAction", uid: "action-1" }, timelineUids, 3),
    { kind: "moveAction", insertIndex: 3, isNoop: false, normalizedIndex: 2, sourceIndex: 0, uid: "action-1" },
  );
});

test("detects no-op drops around the dragged tile", () => {
  assert.deepEqual(
    createTimelineDropIntent({ type: "timelineAction", uid: "action-2" }, timelineUids, 2),
    { kind: "moveAction", insertIndex: 2, isNoop: true, normalizedIndex: 1, sourceIndex: 1, uid: "action-2" },
  );
});
