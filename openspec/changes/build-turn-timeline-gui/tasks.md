## 1. Frontend Setup

- [ ] 1.1 Add Vite, React, TypeScript, and frontend scripts to the project.
- [ ] 1.2 Create the frontend entrypoint, root component, and base styling.
- [ ] 1.3 Ensure the frontend can import core catalog and simulation modules.

## 2. Simulation Inspection API

- [ ] 2.1 Add `statsBefore` and `statsAfter` to each simulation action breakdown.
- [ ] 2.2 Add tests proving stat snapshots evolve correctly across actions.
- [ ] 2.3 Add a UI-facing snapshot adapter that maps `SimulationResult` to cursor steps.

## 3. Timeline Builder

- [ ] 3.1 Implement timeline state for ordered actions.
- [ ] 3.2 Implement add, remove, duplicate, and move controls for actions.
- [ ] 3.3 Implement action configuration controls for target kind and action context.
- [ ] 3.4 Re-run simulation whenever timeline, initial state, or action context changes.

## 4. Initial State Configuration

- [ ] 4.1 Implement editable initial resources and base damage stats.
- [ ] 4.2 Implement Huppermage class-state controls for runes, last rune, Feu-Follets, active passives, and active Heart.
- [ ] 4.3 Keep initial configuration defaults usable without manual setup.

## 5. Timeline Inspection

- [ ] 5.1 Implement a discrete cursor with one initial step and one step after each completed action.
- [ ] 5.2 Display selected-step resources, stats, runes, Feu-Follets, passives, Heart, and applied effects.
- [ ] 5.3 Display simulation violations while preserving completed-action inspection.

## 6. Damage Visualization

- [ ] 6.1 Display total turn damage and cumulative damage up to the selected step.
- [ ] 6.2 Display damage by action in the timeline.
- [ ] 6.3 Display formula breakdown for damage effects on the selected action.

## 7. Verification

- [ ] 7.1 Add focused tests for the snapshot adapter and stat snapshots.
- [ ] 7.2 Run the project test suite.
- [ ] 7.3 Run the frontend production build.
- [ ] 7.4 Run OpenSpec strict validation for `build-turn-timeline-gui`.
