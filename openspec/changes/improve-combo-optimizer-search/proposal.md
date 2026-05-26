## Why

The optimizer UI now exposes combo search, but the core search is still exhaustive over full turn/action products and the UI keeps actions per turn very low to avoid combinatorial blowups. Users need practical search controls that can explore richer one-, two-, and three-turn combos without freezing the app.

## What Changes

- Add deterministic beam search to the core combo optimizer.
- Add exact-duration search so one-turn, two-turn, and three-turn sections do not compute irrelevant shorter candidates.
- Preserve sustainability filtering and resolved-element scoring inside the improved search.
- Expose search-width controls in the optimizer workspace UI without asking users to limit actions per turn.
- Keep deterministic ranking and tie-breaking for repeatable comparisons.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `combo-optimizer`: Improve core search behavior with deterministic bounded expansion and exact-duration support.
- `combo-optimizer-workspace`: Expose practical search controls and use the improved core optimizer.

## Impact

- Core optimizer candidate generation and options.
- Optimizer tests for exact duration, pruning, deterministic beam behavior, and sustainability compatibility.
- UI optimizer controls and view-model tests.
- OpenSpec validation for this change and existing optimizer workspace behavior.
