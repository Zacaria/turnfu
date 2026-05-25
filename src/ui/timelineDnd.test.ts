import assert from "node:assert/strict";
import test from "node:test";

import { createTimelineDropIntent, shouldRemoveTimelineActionOnDragEnd } from "./timelineDnd.ts";

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

test("creates a cross-turn move intent when source uid is outside the target turn", () => {
  assert.deepEqual(
    createTimelineDropIntent(
      { type: "timelineAction", uid: "action-1" },
      ["turn-2-action"],
      1,
      { sourceTimelineUids: timelineUids },
    ),
    {
      kind: "moveAction",
      insertIndex: 1,
      isNoop: false,
      normalizedIndex: 1,
      sourceIndex: 0,
      uid: "action-1",
    },
  );
});

test("removes a dragged timeline action only when dropped outside the turn stack", () => {
  const turnStackBounds = { left: 10, right: 210, top: 20, bottom: 120 };

  assert.equal(
    shouldRemoveTimelineActionOnDragEnd("none", { x: 4, y: 80 }, turnStackBounds),
    true,
  );
  assert.equal(
    shouldRemoveTimelineActionOnDragEnd("none", { x: 80, y: 80 }, turnStackBounds),
    false,
  );
  assert.equal(
    shouldRemoveTimelineActionOnDragEnd("move", { x: 4, y: 80 }, turnStackBounds),
    false,
  );
});

test("removes a dragged timeline action when dropped between timeline lanes", () => {
  const timelineBounds = [
    { left: 10, right: 210, top: 20, bottom: 60 },
    { left: 10, right: 210, top: 80, bottom: 120 },
  ];

  assert.equal(
    shouldRemoveTimelineActionOnDragEnd("none", { x: 80, y: 70 }, timelineBounds),
    true,
  );
  assert.equal(
    shouldRemoveTimelineActionOnDragEnd("none", { x: 80, y: 40 }, timelineBounds),
    false,
  );
});
