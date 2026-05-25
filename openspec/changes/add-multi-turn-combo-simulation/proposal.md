## Why

One-turn timelines are useful for validating local rotations, but Huppermage theorycrafting depends on setup, resource carry-over, Heart state, and BQ decisions across several turns. Multi-turn combo simulation is needed before automatic optimization so saved and compared combos represent complete play patterns instead of isolated turns.

## What Changes

- Add a multi-turn combo model composed of ordered turn plans, each turn containing an action timeline.
- Add a `simulateCombo` core API that runs each turn through the existing one-turn simulator and transitions state between turns.
- Define a first deterministic turn transition for the MVP: end-of-turn Huppermage BQ resolution, refreshed base AP/MP, carried PW/BQ/class state, and expired transient one-turn stats.
- Extend the GUI from a single timeline to a turn-aware combo planner with add/remove/select turn controls.
- Provide a global inspection cursor that can inspect the initial combo state and each action step across all turns.
- Display combo-level totals in addition to current turn/action damage.

## Capabilities

### New Capabilities
- `multi-turn-combo-simulation`: Covers multi-turn combo plans, turn-to-turn state transitions, combo simulation results, and GUI inspection of multi-turn timelines.

### Modified Capabilities
- None.

## Impact

- New core combo simulation types and tests under `src/core/simulation`.
- GUI state changes in `src/ui` to store multiple turn timelines instead of one flat timeline.
- Timeline snapshot adapter changes to produce global combo steps.
- OpenSpec artifacts for the multi-turn MVP foundation.
