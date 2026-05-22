## 1. Simulation Types

- [x] 1.1 Create action, action sequence, turn state, action result, simulation result, and violation types.
- [x] 1.2 Include remaining resources, casts by spell id, total damage, and action breakdown in turn state or simulation result.
- [x] 1.3 Ensure simulation types depend on the spell catalog contract rather than GUI state.

## 2. Validation Flow

- [x] 2.1 Implement spell lookup validation for each action.
- [x] 2.2 Implement resource validation for AP, MP, WP, and BQ before each cast.
- [x] 2.3 Implement per-turn cast limit validation when the catalog defines a limit.
- [x] 2.4 Return structured invalid results without applying the failed action.

## 3. State Transitions

- [x] 3.1 Implement cost payment for valid casts.
- [x] 3.2 Implement supported resource delta effects.
- [x] 3.3 Implement action breakdown entries with resources before and after each successful cast.
- [x] 3.4 Preserve the state reached before a failed action in invalid results.

## 4. Damage Calculation

- [x] 4.1 Implement the MVP raw damage formula using base damage, applicable mastery, and damage inflicted percentage.
- [x] 4.2 Keep damage calculation isolated in a replaceable module.
- [x] 4.3 Define and test the chosen rounding behavior.

## 5. Tests

- [x] 5.1 Add tests for a valid one-spell sequence.
- [x] 5.2 Add tests for a valid multi-spell sequence with resource changes.
- [x] 5.3 Add tests for unknown spell id violations.
- [x] 5.4 Add tests for insufficient AP, MP, WP, and BQ.
- [x] 5.5 Add tests for per-turn cast limit violations.
- [x] 5.6 Add tests for damage totals and per-action breakdown.
- [x] 5.7 Add tests proving the simulator can be called without GUI modules.

## 6. Verification

- [x] 6.1 Run the project test suite for the simulation implementation.
- [x] 6.2 Run OpenSpec strict validation for `add-turn-simulation-engine`.
