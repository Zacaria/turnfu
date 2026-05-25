type DragPayload =
  | { type: "spell"; spellId: string }
  | { type: "timelineAction"; uid: string };

export type TimelineDropIntent =
  | { kind: "insertSpell"; insertIndex: number; spellId: string }
  | { kind: "moveAction"; insertIndex: number; isNoop: boolean; normalizedIndex: number; sourceIndex: number; uid: string };

export function createTimelineDropIntent(
  payload: DragPayload,
  timelineUids: string[],
  insertIndex: number,
): TimelineDropIntent | null {
  const boundedIndex = clamp(insertIndex, 0, timelineUids.length);

  if (payload.type === "spell") {
    return { kind: "insertSpell", insertIndex: boundedIndex, spellId: payload.spellId };
  }

  const sourceIndex = timelineUids.indexOf(payload.uid);
  if (sourceIndex < 0) {
    return null;
  }

  const normalizedIndex = sourceIndex < boundedIndex ? boundedIndex - 1 : boundedIndex;

  return {
    kind: "moveAction",
    insertIndex: boundedIndex,
    isNoop: normalizedIndex === sourceIndex,
    normalizedIndex,
    sourceIndex,
    uid: payload.uid,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
