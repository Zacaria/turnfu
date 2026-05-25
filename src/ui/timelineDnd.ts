type DragPayload =
  | { type: "spell"; spellId: string }
  | { type: "timelineAction"; uid: string };

export type TimelineDropIntent =
  | { kind: "insertSpell"; insertIndex: number; spellId: string }
  | { kind: "moveAction"; insertIndex: number; isNoop: boolean; normalizedIndex: number; sourceIndex: number; uid: string };

type TimelineDropOptions = {
  sourceTimelineUids?: string[];
};

type Bounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export function createTimelineDropIntent(
  payload: DragPayload,
  timelineUids: string[],
  insertIndex: number,
  options: TimelineDropOptions = {},
): TimelineDropIntent | null {
  const boundedIndex = clamp(insertIndex, 0, timelineUids.length);

  if (payload.type === "spell") {
    return { kind: "insertSpell", insertIndex: boundedIndex, spellId: payload.spellId };
  }

  const sourceIndex = (options.sourceTimelineUids ?? timelineUids).indexOf(payload.uid);
  if (sourceIndex < 0) {
    return null;
  }

  const isSameTimeline = !options.sourceTimelineUids || options.sourceTimelineUids === timelineUids;
  const normalizedIndex = isSameTimeline && sourceIndex < boundedIndex ? boundedIndex - 1 : boundedIndex;

  return {
    kind: "moveAction",
    insertIndex: boundedIndex,
    isNoop: isSameTimeline && normalizedIndex === sourceIndex,
    normalizedIndex,
    sourceIndex,
    uid: payload.uid,
  };
}

export function shouldRemoveTimelineActionOnDragEnd(
  dropEffect: DataTransfer["dropEffect"] | string,
  point: { x: number; y: number },
  timelineBounds: Bounds | Bounds[],
): boolean {
  if (dropEffect !== "none") {
    return false;
  }

  const boundsList = Array.isArray(timelineBounds) ? timelineBounds : [timelineBounds];
  return !boundsList.some((bounds) => containsPoint(bounds, point));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function containsPoint(bounds: Bounds, point: { x: number; y: number }): boolean {
  return point.x >= bounds.left
    && point.x <= bounds.right
    && point.y >= bounds.top
    && point.y <= bounds.bottom;
}
