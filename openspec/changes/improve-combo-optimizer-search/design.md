## Context

The current optimizer builds every turn plan by Cartesian product before simulation. That is acceptable for tiny fixtures, but it does not scale to a real deck. The UI currently defaults to one action per turn, which makes the optimizer visible but not useful for actual combo exploration.

## Goals / Non-Goals

**Goals:**

- Search exact one-, two-, and three-turn durations independently.
- Use deterministic bounded expansion so richer action counts are usable.
- Preserve existing scoring, resolved Light attribution, and sustainability rules.
- Avoid limits on actions per turn in normal beam search; resources, cast constraints, and simulator validity should shape when a turn is exhausted.
- Keep exhaustive behavior available for tiny tests and compatibility when no beam width is configured.

**Non-Goals:**

- Guaranteeing a mathematically global optimum for large search spaces.
- Background workers, cancellation, or async progress reporting.
- New class mechanics or equipment modeling.

## Decisions

### Add beam search as a bounded search mode

When `beamWidth` is configured, the optimizer expands partial plans and keeps only the best candidates at each frontier. This allows the UI to explore multi-action turns while bounding work.

Alternative considered: keep exhaustive search and only reduce controls. That would hide the problem rather than improve it.

### Add exact turn count

The UI result groups need exact one-, two-, and three-turn candidates. A new `exactTurnCount` option avoids generating shorter plans and filtering them afterward.

Alternative considered: keep filtering after `maxTurns`. That wastes work and makes duration groups slower.

### Let simulator validity exhaust turns

Beam search will keep appending actions while at least one valid simulator-backed expansion exists. Candidates are collected along the way, and the ranked output still prioritizes the selected damage criterion. When scores tie, candidates that use more resources rank higher before the deterministic plan tie-breaker.

Alternative considered: expose or enforce actions per turn as a control. The user clarified that the optimizer should instead maximize resource usage naturally, so this is removed from normal search semantics.

### Prune repeated simulator states

Beam search tracks simulator state signatures seen in the current candidate path and drops expansions that return to an already-seen state for the same turn. It also refuses repeated same-turn casts of zero-cost, zero-damage utility spells after the first cast. This avoids zero-cost/no-progress loops and runaway stat-stacking loops while preserving the absence of a user-facing action-count limit.

Alternative considered: add a hidden action cap. That would contradict the intended resource-driven search model and could hide valid high-resource lines.

### Score partial plans with the same scoring model

Partial plans are simulated and scored with the same `scoreComboSimulation` helper used for final results. Invalid partial plans are dropped immediately.

Alternative considered: estimate scores from spell metadata. That would be faster, but it would duplicate simulator rules and break class-mechanic correctness.

## Risks / Trade-offs

- [Risk] Beam search can miss a combo whose early score is low but later payoff is high. → Keep beam width configurable and preserve exhaustive mode when beam width is absent.
- [Risk] Re-simulating many prefixes is still expensive. → Bound breadth by beam width, exact duration, resources, cast constraints, simulator validity, and repeated-state pruning.
- [Risk] UI controls can imply exact optimality. → Label the control as search width and keep deterministic repeatability.
