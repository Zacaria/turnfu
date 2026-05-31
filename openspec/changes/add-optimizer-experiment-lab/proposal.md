## Why

The current optimizer is deterministic and bounded, but Wakfu combo discovery often requires weak setup turns that only pay off after later turns. We need an experiment-oriented optimizer layer that can run longer searches, compare stochastic and tree-search strategies under the same budget, and report progress while always evaluating complete simulated plans.

## What Changes

- Add an optimizer experiment capability with a shared runner API for long-running search engines.
- Support comparable engines for random baseline, Monte Carlo tree search, novelty search, simulated annealing, and genetic search.
- Evaluate complete passives/spells/action plans through the existing simulator and scoring model instead of judging setup turns by immediate damage alone.
- Expose progress snapshots so the UI or future workers can show attempts, best candidates, invalid rate, elapsed budget, and engine-specific metrics.
- Add memoization hooks for reusable state evaluation and transposition-style pruning without hard-coded Wakfu state buckets.

## Capabilities

### New Capabilities

- `optimizer-experiment-lab`: Defines long-running optimizer experiment runs, engine comparison, progress reporting, complete-plan evaluation, and shared memoization behavior.

### Modified Capabilities

- None.

## Impact

- Adds new core optimizer modules and tests under `src/core/optimizer`.
- Reuses existing `simulateCombo`, scoring, sustainability, catalog, and character types.
- Extends optimizer exports without replacing the current deterministic optimizer API.
- No new runtime dependencies are expected.
