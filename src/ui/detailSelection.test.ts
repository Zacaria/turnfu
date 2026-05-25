import assert from "node:assert/strict";
import test from "node:test";

import { resolveDetailTarget } from "./detailSelection.ts";

test("keeps the selected timeline action while hovering a catalog entry", () => {
  const target = resolveDetailTarget({
    hoveredCatalogEntryId: "rayon-crepusculaire",
    selectedCatalogEntryId: "lueur-de-laube",
    selectedTimelineUid: "action-1",
    selectedActionIndex: 0,
  });

  assert.deepEqual(target, { kind: "timeline", uid: "action-1", actionIndex: 0 });
});

test("keeps the clicked catalog entry while hovering another catalog entry", () => {
  const target = resolveDetailTarget({
    hoveredCatalogEntryId: "rayon-crepusculaire",
    selectedCatalogEntryId: "lueur-de-laube",
    selectedTimelineUid: null,
    selectedActionIndex: null,
  });

  assert.deepEqual(target, { kind: "catalog", entryId: "lueur-de-laube" });
});

test("falls back to the selected timeline action before a selected catalog entry", () => {
  const target = resolveDetailTarget({
    hoveredCatalogEntryId: null,
    selectedCatalogEntryId: "lueur-de-laube",
    selectedTimelineUid: "action-1",
    selectedActionIndex: 2,
  });

  assert.deepEqual(target, { kind: "timeline", uid: "action-1", actionIndex: 2 });
});
