## Why

The simulator currently treats critical hits as a manual per-action boolean, which makes combo results too brittle for theorycrafting builds with critical-hit stats and sublimations. Expected critical damage is needed before sublimations that alter critical rate, critical mastery, or non-critical damage can be modeled honestly.

## What Changes

- Add an expected critical damage mode that computes damage from critical-hit chance instead of requiring each action to be marked critical or non-critical.
- Preserve deterministic forced critical and forced non-critical evaluation for debugging, comparisons, and future special mechanics.
- Extend damage breakdowns so UI and optimizer results can show normal damage, critical damage, critical chance, and expected damage.
- Update optimizer scoring to rank combos by expected damage when the selected damage mode is expected.
- Keep event-specific critical effects, such as first critical hit of the turn, out of scope for this change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `turn-simulation-engine`: Damage calculation SHALL support expected critical damage derived from current critical-hit stats.
- `combo-optimizer`: Optimizer scoring SHALL use simulator-backed expected damage when the simulation damage mode is expected.

## Impact

- Core simulation types for action context, damage mode, and damage formula breakdown.
- Damage calculation helpers and tests.
- Turn and combo simulator result values.
- Optimizer scoring, result ordering, and tests that assume damage totals.
- GUI display of damage formula details where critical state is shown.
