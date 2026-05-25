import type { CatalogEntry } from "../core/catalog/types.ts";

export type HideableCatalogEntryKind = "spell" | "passive";

export type HiddenCatalogEntryState = Record<HideableCatalogEntryKind, string[]>;

export function createHiddenCatalogEntryState(): HiddenCatalogEntryState {
  return {
    spell: [],
    passive: [],
  };
}

export function isCatalogEntryHidden(state: HiddenCatalogEntryState, entry: CatalogEntry): boolean {
  return isHideableCatalogEntry(entry) && state[entry.kind].includes(entry.id);
}

export function toggleHiddenCatalogEntry(state: HiddenCatalogEntryState, entry: CatalogEntry): HiddenCatalogEntryState {
  if (!isHideableCatalogEntry(entry)) {
    return state;
  }

  const hiddenIds = new Set(state[entry.kind]);
  if (hiddenIds.has(entry.id)) {
    hiddenIds.delete(entry.id);
  } else {
    hiddenIds.add(entry.id);
  }

  return {
    ...state,
    [entry.kind]: [...hiddenIds],
  };
}

export function getVisibleCatalogEntries<TEntry extends CatalogEntry>(
  entries: TEntry[],
  state: HiddenCatalogEntryState,
  showHiddenEntries: boolean,
): TEntry[] {
  return showHiddenEntries ? entries : entries.filter((entry) => !isCatalogEntryHidden(state, entry));
}

export function countHiddenCatalogEntries(state: HiddenCatalogEntryState): number {
  return state.spell.length + state.passive.length;
}

function isHideableCatalogEntry(entry: CatalogEntry): entry is CatalogEntry & { kind: HideableCatalogEntryKind } {
  return entry.kind === "spell" || entry.kind === "passive";
}
