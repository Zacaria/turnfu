## Context

`SetupSnapshot` still contains `deckSpellIds` because the builder and saved setup snapshots need deck information. For optimizer exploration, however, the desired workflow is broader: choose a stat set, then let the optimizer find the best combo among every modeled spell.

## Design

Do not pass `availableSpellIds` when creating optimizer options for a set. The core optimizer already treats a missing `availableSpellIds` value as "all catalog spell entries".

The set detail page should avoid presenting the saved deck under "Hypothèses". The first pass keeps the underlying data model intact and changes only optimizer option mapping and visible copy.

## Non-Goals

- Removing deck tracking from the simulator or builder.
- Removing `deckSpellIds` from saved setup snapshots.
- Changing passive or target context handling.
