## 1. Light Damage Semantics

- [x] 1.1 Add tests proving Light damage uses the highest effective Fire/Water/Earth/Air mastery instead of Light mastery.
- [x] 1.2 Add tests proving Light damage records a resolved elemental attribution for scoring.
- [x] 1.3 Implement Light damage mastery resolution and deterministic tie handling in the simulation damage path.
- [x] 1.4 Update damage effect types, formula breakdowns, and UI-safe formatting to preserve display element and resolved scoring element.

## 2. Optimizer Model

- [x] 2.1 Define optimizer option, criterion, candidate result, score breakdown, and sustainability metadata types.
- [x] 2.2 Add helpers to score simulated combo damage by total damage and resolved element.
- [x] 2.3 Add tests for target-element scoring that counts Light damage resolved to the target element.

## 3. Sustainable Cycle Validation

- [x] 3.1 Add tests for sustainable replay across a bounded combo cycle.
- [x] 3.2 Implement replay-based sustainability validation using the first run's final carried state.
- [x] 3.3 Reject candidates whose replay is invalid or whose replay final PW/BQ is lower than replay initial PW/BQ.

## 4. Combo Search

- [x] 4.1 Add tests for bounded optimizer search respecting a maximum of three turns.
- [x] 4.2 Implement deterministic candidate expansion over supported spell actions using `simulateCombo`.
- [x] 4.3 Add deterministic pruning controls for candidate count or beam width.
- [x] 4.4 Return ranked optimizer results with plan, simulation, score breakdown, damage by resolved element, and sustainability metadata.

## 5. Integration and Verification

- [x] 5.1 Export the optimizer from the core simulation or optimizer entrypoint without importing GUI modules.
- [x] 5.2 Add focused import tests proving optimizer usage stays independent from UI.
- [x] 5.3 Run the project test suite.
- [x] 5.4 Run the frontend production build.
- [x] 5.5 Run OpenSpec strict validation for `add-combo-optimizer`.
