## 1. Core Damage Model

- [x] 1.1 Add critical evaluation mode types for expected, forced critical, and forced non-critical damage.
- [x] 1.2 Update damage calculation to compute non-critical, critical, and expected branches from current stats.
- [x] 1.3 Clamp effective critical-hit chance to 0-100 percent during expected damage calculation.
- [x] 1.4 Extend damage formula breakdowns with mode, effective critical chance, branch results, and final result.

## 2. Simulator Integration

- [x] 2.1 Thread the selected critical evaluation mode through turn and combo simulation options.
- [x] 2.2 Ensure per-action stat changes to critical-hit chance or critical mastery affect later expected damage.
- [x] 2.3 Preserve deterministic forced critical and forced non-critical simulation paths.

## 3. Optimizer and UI Integration

- [x] 3.1 Update optimizer scoring to use simulator-backed expected totals and expected resolved-element damage.
- [x] 3.2 Update UI formula formatting to display expected critical details without recalculating damage.
- [x] 3.3 Decide and document the initial UI default for critical evaluation mode.

## 4. Verification

- [x] 4.1 Add unit tests for expected damage, clamped critical chance, and forced modes.
- [x] 4.2 Update simulator and optimizer tests for expected-damage scoring behavior.
- [x] 4.3 Run the affected test suite and OpenSpec validation for this change.
