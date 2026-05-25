## 1. Core Combo Model

- [x] 1.1 Add `TurnPlan`, `ComboPlan`, `ComboTurnResult`, and `ComboSimulationResult` types.
- [x] 1.2 Add a `simulateCombo` API that evaluates turn plans in order using `simulateTurn`.
- [x] 1.3 Implement MVP turn transition: refresh AP/PM, carry PW/BQ and persistent Huppermage class state, expire one-turn Heart, and reset transient turn stats.
- [x] 1.4 Export the combo API from the simulation module.

## 2. Core Verification

- [x] 2.1 Add tests for valid two-turn combo damage aggregation.
- [x] 2.2 Add tests for BQ/rune/class-state carry-over into the next turn.
- [x] 2.3 Add tests for AP/PM refresh and PW/BQ carry-over.
- [x] 2.4 Add tests preserving partial results when a later turn is invalid.

## 3. GUI Multi-Turn Planner

- [x] 3.1 Replace single timeline state with an ordered list of turn timelines.
- [x] 3.2 Add controls to create, select, and remove turns.
- [x] 3.3 Recalculate the combo through `simulateCombo` whenever any turn, initial state, or action context changes.
- [x] 3.4 Keep existing drag-and-drop and action configuration behavior working for the selected turn.

## 4. GUI Inspection

- [x] 4.1 Add a combo snapshot adapter that flattens turn results into global cursor steps.
- [x] 4.2 Display combo total damage and per-turn summaries.
- [x] 4.3 Update the inspector to show selected turn/action identifiers and cumulative combo damage.
- [x] 4.4 Preserve violation display for invalid later turns.

## 5. Verification

- [x] 5.1 Add focused tests for combo snapshot flattening.
- [x] 5.2 Run the project test suite.
- [x] 5.3 Run the frontend production build.
- [x] 5.4 Run OpenSpec strict validation for `add-multi-turn-combo-simulation`.
