## Why

Sublimations are part of a Wakfu build in the same way as passives: they are selected before the combo and do not change during the combo. The application needs a catalog and build-slot model before any individual sublimation effects can be applied by the simulator.

## What Changes

- Add a sublimation catalog with normal, epic, and relic sublimation categories.
- Represent sublimations as build selections alongside character stats and active passives.
- Enforce build slot limits: up to 10 normal sublimations, 1 epic sublimation, and 1 relic sublimation.
- Ignore rune/equipment prerequisites, but retain support status and blocking reasons for unsupported sublimations.
- Track sublimation levels, copies, and cumulative maximums so duplicate level selections are capped by each sublimation's max stack.
- Show all cataloged sublimations while preventing unsupported or explicitly ignored entries from being selected.
- Add HP-condition assumptions so mutually exclusive high-HP and berserk sublimations cannot be selected together.

## Capabilities

### New Capabilities

- `sublimation-build-catalog`: Covers sublimation catalog entries, build-slot selection rules, support status, cumulative max handling, and compatibility validation.

### Modified Capabilities

- None.

## Impact

- New core catalog/domain types for sublimations and build selections.
- Build/setup state, defaults, persistence, and validation.
- GUI catalog and build controls for visible, disabled, supported, planned, and ignored sublimations.
- Tests for slot limits, duplicate cumulative caps, support-state blocking, and HP-condition conflicts.
