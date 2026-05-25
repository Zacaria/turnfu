export type DetailTarget =
  | { kind: "catalog"; entryId: string }
  | { kind: "timeline"; uid: string; actionIndex: number }
  | { kind: "empty" };

export function resolveDetailTarget({
  hoveredCatalogEntryId,
  selectedCatalogEntryId,
  selectedTimelineUid,
  selectedActionIndex,
}: {
  hoveredCatalogEntryId: string | null;
  selectedCatalogEntryId: string | null;
  selectedTimelineUid: string | null;
  selectedActionIndex: number | null;
}): DetailTarget {
  void hoveredCatalogEntryId;

  if (selectedTimelineUid && selectedActionIndex !== null) {
    return { kind: "timeline", uid: selectedTimelineUid, actionIndex: selectedActionIndex };
  }

  if (selectedCatalogEntryId) {
    return { kind: "catalog", entryId: selectedCatalogEntryId };
  }

  return { kind: "empty" };
}
