## Why

The planner can now simulate authored multi-turn Huppermage combos, but users still have to discover strong sequences manually. The next useful step is a deterministic combo optimizer that can search bounded plans, rank them by damage criteria, and reject cycles that cannot be sustained.

This also requires correcting Light damage semantics before optimization: Light damage should resolve through the highest effective elemental mastery at damage time, and elemental scoring must attribute that Light damage to the resolved element.

## What Changes

- Add a core combo optimization API that searches candidate Huppermage combo plans up to a configured turn limit.
- Support criteria for number of turns, total damage maximization, target-element damage maximization, and sustainable cycle filtering.
- Define sustainable cycles as replayable bounded combos that do not accumulate BQ/PW debt across a second loop.
- Limit the first optimizer scope to at most three turns and deterministic exhaustive/beam-style search over supported catalog actions.
- Modify simulation damage semantics so Light damage resolves using the highest effective elemental mastery among Fire, Water, Earth, and Air at damage time.
- Expose enough damage attribution data for optimizer scoring to count Light damage toward the resolved elemental bucket.

## Capabilities

### New Capabilities

- `combo-optimizer`: Covers bounded combo search, optimizer criteria, sustainable-cycle validation, result ranking, and score breakdowns.

### Modified Capabilities

- `turn-simulation-engine`: Light damage resolution and damage attribution for elemental scoring.

## Impact

- New core optimizer module under `src/core`.
- Changes to simulation damage breakdowns and tests for Light damage attribution.
- New tests covering bounded search, element-specific scoring, and sustainable-cycle rejection.
- Future GUI integration can consume optimizer results without duplicating simulation or scoring rules.
