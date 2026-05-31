## Context

The catalog and build-slot change establishes which sublimations can be selected. This change makes the supported subset affect simulation while leaving complex or unsupported sublimations visible but blocked.

The simulator is still a pure core module. Sublimation effects should be data-driven and explainable in action breakdowns, following the same pattern as spells and passives.

## Goals / Non-Goals

**Goals:**

- Apply supported build-level sublimation effects in simulation.
- Support flat stat/resource effects, action-qualified damage effects, and deterministic end-of-turn carryover.
- Add spell cast-profile metadata needed for melee, distance, zone, line, and diagonal eligibility.
- Keep unsupported, death-triggered, and first-critical-hit sublimations blocked.
- Preserve optimizer scoring through simulator results.

**Non-Goals:**

- Model enemy death triggers.
- Model random critical-hit events.
- Model exact grid placement, pathing, or line-of-sight geometry.
- Make every cataloged sublimation selectable.

## Decisions

### Decision: Sublimation effects use explicit supported effect kinds

Supported sublimations will be normalized into structured effect kinds instead of parsing description text during simulation.

Alternative considered: evaluate raw text tags. Rejected because text parsing would be fragile and hard to test.

### Decision: Action eligibility is based on spell capability, not exact placement

For melee, distance, zone, line, and diagonal sublimations, the simulator will treat the condition as satisfied when the spell metadata proves the spell can satisfy it. It will not search actual board positions.

Alternative considered: require the user to select exact target cells. Rejected for this phase because placement is not otherwise modeled.

### Decision: PA/PM carryover is a turn-end effect

Carryover sublimations will resolve at the end of a turn from remaining resources and then influence the next turn through combo state.

Alternative considered: treat carryover as unsupported until full multi-turn placement exists. Rejected because remaining PA/PM is already deterministic in the combo simulator.

## Risks / Trade-offs

- Spell cast-profile data may be incomplete -> missing metadata should make a condition ineligible rather than silently applying it.
- Distance assumptions can overstate real-game positioning -> document that eligibility means "the spell can satisfy the condition" rather than "the board state proves it."
- Carryover can affect sustainability rankings -> cover end-of-turn state transitions and optimizer replay with tests.

## Migration Plan

1. Add cast-profile metadata to relevant spell catalog entries.
2. Add supported sublimation effect resolution before turn start, before action damage, and at turn end.
3. Add applied/skipped sublimation effect breakdowns.
4. Update optimizer and UI to consume simulator-backed sublimation results.

## Open Questions

- What exact range threshold should define "distance" for each distance-based sublimation when the game text varies by sublimation?
