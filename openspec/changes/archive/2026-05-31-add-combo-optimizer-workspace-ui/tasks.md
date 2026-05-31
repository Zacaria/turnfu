## 1. Optimizer UI Adapter

- [x] 1.1 Add adapter types that map setup snapshots and optimizer controls to core optimizer options.
- [x] 1.2 Add tests proving adapter output preserves setup stats, resources, passives, target context, default action context, and initial class state.
- [x] 1.3 Add result view-model helpers for score, duration, damage per turn, damage per AP, final resources, sustainability state, and damage by resolved element.

## 2. Search Controls

- [x] 2.1 Build optimizer controls for duration selection, scoring criterion, target element, sustainable cycle requirement, and result count.
- [x] 2.2 Clamp duration controls to the supported one-turn, two-turn, and three-turn search space.
- [x] 2.3 Add tests for control state and generated optimizer criteria.

## 3. Duration-Grouped Results

- [x] 3.1 Run or organize optimizer searches into exact one-turn, two-turn, and three-turn result groups.
- [x] 3.2 Build result sections that rank candidates only within their exact duration group.
- [x] 3.3 Display score, total damage, damage per turn, action count, final AP/MP/PW/BQ, and sustainability state for each row.
- [x] 3.4 Add tests proving one-turn, two-turn, and three-turn raw damage rankings are separated.

## 4. Candidate Comparison

- [x] 4.1 Add pin/unpin behavior for optimizer candidates across duration groups.
- [x] 4.2 Build a comparison table showing duration, total damage, damage per turn, damage per AP, damage by resolved element, final resources, action count, and sustainability state.
- [x] 4.3 Add tests proving pinned candidates from different durations can be compared using normalized metrics.

## 5. Builder Handoff

- [x] 5.1 Add an action to open an optimizer candidate in the timeline builder.
- [x] 5.2 Ensure the builder loads the candidate plan with the setup snapshot assumptions that produced it.
- [x] 5.3 Add tests for optimizer candidate to builder handoff.

## 6. Verification

- [x] 6.1 Run focused optimizer workspace UI tests.
- [x] 6.2 Run the project test suite.
- [x] 6.3 Run the frontend production build.
- [x] 6.4 Run OpenSpec strict validation for `add-combo-optimizer-workspace-ui`.
