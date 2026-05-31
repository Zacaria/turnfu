## 1. Effect and Cast-Profile Model

- [x] 1.1 Add structured supported sublimation effect kinds for flat stats, resources, action-conditioned bonuses, and PA/PM carryover.
- [x] 1.2 Add spell cast-profile metadata for melee, distance, zone, line, and diagonal eligibility.
- [x] 1.3 Mark missing required cast-profile metadata as ineligible rather than applicable.

## 2. Simulator Integration

- [x] 2.1 Apply supported flat stat and resource sublimations during simulation initialization.
- [x] 2.2 Apply supported action-conditioned sublimations during action damage context resolution.
- [x] 2.3 Apply deterministic PA/PM carryover at turn end and carry results into later combo turns.
- [x] 2.4 Reject unsupported, first-critical-event, and death-trigger sublimations before simulation.
- [x] 2.5 Record applied and skipped sublimation effects in action and turn breakdowns.

## 3. Optimizer and UI Integration

- [x] 3.1 Ensure optimizer candidate scoring includes simulator-applied sublimation effects.
- [x] 3.2 Ensure optimizer sustainability replay includes PA/PM carryover effects.
- [x] 3.3 Display applied and skipped sublimation explanations in result details.

## 4. Verification

- [x] 4.1 Add tests for flat stat/resource sublimation effects at turn start.
- [x] 4.2 Add tests for melee, distance, zone, line, and diagonal eligibility.
- [x] 4.3 Add tests for PA/PM carryover across combo turns.
- [x] 4.4 Add tests for blocked first-critical-event and death-trigger sublimations.
- [x] 4.5 Run the affected test suite and OpenSpec validation for this change.
