## Context

The damage engine already has `criticalHitPercent`, `criticalMastery`, and an action-level `isCritical` flag. That flag is useful for deterministic inspection, but it does not represent a build's average expected damage and blocks meaningful sublimation work around critical-hit chance.

The optimizer currently ranks simulator totals. This change should keep that contract: the simulator owns damage semantics, and the optimizer consumes the result without duplicating the formula.

## Goals / Non-Goals

**Goals:**

- Add expected critical damage as a simulator damage mode.
- Keep forced critical and forced non-critical modes for deterministic tests and future inspection.
- Expose normal, critical, critical chance, and expected damage in damage breakdowns.
- Make optimizer scoring use the selected simulator damage mode.

**Non-Goals:**

- Model event-specific critical effects such as first critical hit of the turn.
- Simulate random combat outcomes.
- Add target resistance or Wakfu's full critical formula beyond the current multiplier and critical mastery model.

## Decisions

### Decision: Add a damage mode instead of replacing `isCritical`

The simulator will resolve a critical evaluation mode such as `expected`, `forcedCritical`, or `forcedNonCritical`. Expected mode computes both non-critical and critical branches and combines them with clamped critical-hit chance.

Alternative considered: remove `isCritical` and always use expected damage. Rejected because deterministic forced states remain useful for formula inspection, regression tests, and later mechanics that explicitly force critical or non-critical damage.

### Decision: Keep expected damage deterministic

Expected damage is a pure mathematical expectation:

`expected = nonCritical * (1 - critRate) + critical * critRate`

`critRate` is derived from current `criticalHitPercent` and clamped to `[0, 100]`.

Alternative considered: generate critical outcomes through seeded randomness. Rejected because optimizer ranking must remain stable and explainable.

### Decision: Put branch details in the formula breakdown

Damage breakdowns should include non-critical result, critical result, critical chance, selected mode, and final result. The UI can then show why expected damage differs from forced values without recalculating core rules.

Alternative considered: expose only final expected damage. Rejected because the project already favors explainable formula breakdowns.

## Risks / Trade-offs

- Existing tests assume non-critical totals by default -> choose the default mode deliberately and update fixtures explicitly.
- Expected damage can produce fractional totals -> continue using the existing rounding helper at clear boundaries and cover rounding with tests.
- Critical-event sublimations are tempting to include too early -> keep them blocked until an event-level critical model exists.

## Migration Plan

1. Extend simulation types and damage helpers with a critical evaluation mode.
2. Update damage breakdown shape and UI formatting.
3. Update simulator and optimizer tests to opt into the intended mode explicitly.
4. Keep forced critical and forced non-critical examples as regression coverage.

## Open Questions

- Should new UI setups default to expected damage immediately, or should the first implementation expose a visible toggle while preserving current non-critical defaults?
