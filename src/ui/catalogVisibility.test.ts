import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogEntry } from "../core/catalog/types.ts";
import {
  countHiddenCatalogEntries,
  createHiddenCatalogEntryState,
  getVisibleCatalogEntries,
  isCatalogEntryHidden,
  toggleHiddenCatalogEntry,
} from "./catalogVisibility.ts";

const spell = { id: "rayon-crepusculaire", kind: "spell", name: "Rayon Crepusculaire" } as CatalogEntry;
const passive = { id: "dynamo", kind: "passive", name: "Dynamo" } as CatalogEntry;

test("filters hidden catalog entries unless hidden entries are shown", () => {
  const hiddenState = toggleHiddenCatalogEntry(createHiddenCatalogEntryState(), spell);

  assert.equal(isCatalogEntryHidden(hiddenState, spell), true);
  assert.deepEqual(getVisibleCatalogEntries([spell, passive], hiddenState, false).map((entry) => entry.id), ["dynamo"]);
  assert.deepEqual(getVisibleCatalogEntries([spell, passive], hiddenState, true).map((entry) => entry.id), [
    "rayon-crepusculaire",
    "dynamo",
  ]);
});

test("keeps spell and passive hidden state separate", () => {
  const hiddenState = toggleHiddenCatalogEntry(toggleHiddenCatalogEntry(createHiddenCatalogEntryState(), spell), passive);

  assert.equal(countHiddenCatalogEntries(hiddenState), 2);
  assert.equal(isCatalogEntryHidden(toggleHiddenCatalogEntry(hiddenState, spell), spell), false);
  assert.equal(isCatalogEntryHidden(hiddenState, passive), true);
});
