## Why

Once sublimations can be selected in a build, supported effects must influence turn simulation and optimizer scoring without pretending every Wakfu sublimation is already modeled. This change introduces the first exploitable subset while keeping unsupported gameplay-changing effects visible but blocked.

## What Changes

- Apply supported sublimation effects to initial stats, resources, and per-action damage contexts.
- Support deterministic flat-stat and start-of-turn effects such as mastery, range, critical-hit chance, damage inflicted, AP, MP, WP, and BQ where applicable.
- Support action-conditioned sublimations when the spell metadata proves the condition can be satisfied, including melee, distance, zone, line, and diagonal constraints.
- Support end-of-turn PA/PM carryover effects as deterministic multi-turn state transitions.
- Exclude death-triggered sublimations such as PA return or Enflamme return from selectable supported effects.
- Keep first-critical-hit and other event-specific critical sublimations visible but unavailable until a later critical-event model exists.
- Record applied sublimation effects in simulation breakdowns so results remain explainable.

## Capabilities

### New Capabilities

- `sublimation-effect-resolution`: Covers supported sublimation effect application, per-action eligibility, end-of-turn carryover, and unsupported-effect blocking.

### Modified Capabilities

- `turn-simulation-engine`: The simulator SHALL apply selected supported sublimations from the build to stats, resources, action damage, and end-of-turn transitions.
- `combo-optimizer`: Optimizer results SHALL include simulator-backed sublimation effects when evaluating and ranking candidates.

## Impact

- Core simulation initialization, action context resolution, damage calculations, and turn-end processing.
- Spell catalog metadata for cast profiles such as range qualification, zone shape, line-only, and diagonal-capable casts.
- Optimizer scoring and sustainability checks for carried resources.
- UI result breakdowns explaining which sublimation effects applied or were skipped.
- Tests for supported effects, action eligibility, exclusions, and carryover behavior.
