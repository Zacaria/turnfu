## Context

The workspace already separates builds, sets, optimizer runs, and saved combos. Saved combos know their build, set, plan, total damage, and creation date, but not the optimizer controls that produced them.

## Design

### Saved Combo Criteria

Add an optional `criteriaSummary` field to `SavedComboReference`. New saved combos from the optimizer store `summarizeOptimizerControls(normalizedControls)`.

The field stays optional so existing localStorage data remains readable.

### Comparison Scope

The comparison page should make two explicit choices:

- set: compare combos produced from the same set;
- duration: compare only 1T with 1T, 2T with 2T, or 3T with 3T.

The default selected set is the first set that has saved combos, falling back to the first build set. The default selected duration is the first duration with combos for that set, falling back to 1T.

## Non-Goals

- Linking a saved combo to a saved run id.
- Full run history diffing.
- Changing optimizer scoring logic.
