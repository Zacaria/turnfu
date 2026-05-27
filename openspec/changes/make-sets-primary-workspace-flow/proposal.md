## Why

The current workspace still feels build-first, then optimizer-first. The actual theorycraft workflow should start from a set of final stats and deck assumptions, then search combos inside that set. This also makes elemental optimizer results easier to reason about: if a set is fire-heavy, an "Eau" scoring run may still prefer sequences shaped by the fire-leaning stats.

## What Changes

- Reframe setup snapshots as "sets" in the workspace navigation and copy.
- Make the build page emphasize set selection before optimizer actions.
- Add a build-page action to create a new balanced-element set from an existing set.
- Keep optimizer runs and saved combos scoped to the originating set.

## Capabilities

### New Capabilities

### Modified Capabilities

- `research-workspace`: Builds organize named sets; users start optimizer searches from a selected set.
- `combo-optimizer-workspace`: Optimizer workspace clearly runs inside one selected set.

## Impact

- Affected UI: build page, set detail page, optimizer page labels.
- Affected state model: setup snapshot creation helper for balanced-element set variants.
- Affected tests: research workspace helpers and navigation copy assumptions.
