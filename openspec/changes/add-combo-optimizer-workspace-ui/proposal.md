## Why

The core optimizer can produce candidate plans, but users need a dedicated UI to search, filter, and compare combo variants from the same setup. Raw total damage is not enough because one-turn, two-turn, and three-turn combos answer different gameplay questions.

## What Changes

- Add an optimizer workspace page scoped to a selected setup snapshot.
- Add controls for duration, scoring criterion, target element, sustainable-cycle filtering, and result limits.
- Show optimizer results in separate one-turn, two-turn, and three-turn result groups.
- Add comparison tools for pinned candidates with normalized metrics such as damage per turn, damage per AP, resolved-element damage, and final BQ/PW.
- Allow a candidate combo to be opened in the existing turn/timeline builder for inspection and editing.
- Preserve the distinction between display element and resolved scoring element, including Light damage attributed to the highest effective elemental mastery.

## Capabilities

### New Capabilities

- `combo-optimizer-workspace`: Covers the optimizer page, criteria controls, duration-separated result lists, candidate comparison, and timeline handoff.

### Modified Capabilities

None.

## Impact

- Frontend pages/components for optimizer controls, result tables, candidate comparison, and timeline handoff.
- Adapter from setup snapshots to the existing core optimizer input types.
- UI formatting for combo score breakdowns, damage by resolved element, sustainability state, and final resources.
- Tests for duration grouping, scoring criteria, pinned comparison, and Light damage attribution in UI-visible results.
