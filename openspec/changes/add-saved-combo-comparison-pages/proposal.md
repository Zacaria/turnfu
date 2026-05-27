## Why

Saved optimizer data is now persistent, but the build page only shows short list rows. Users need a faster way to inspect a saved run and compare saved combo variants without mixing one-, two-, and three-turn plans.

## What Changes

- Add build-level navigation to a saved optimizer run detail page.
- Add build-level navigation to a saved combo comparison page.
- Group saved combos by exact plan duration so one-turn, two-turn, and three-turn combos are compared separately.
- Show normalized combo metrics such as total damage, damage per turn, and action count.
- Allow saved combos to be opened back in the existing builder for inspection.

## Capabilities

### New Capabilities

### Modified Capabilities

- `combo-optimizer-workspace`: Saved optimizer runs and saved combos can be inspected and compared from dedicated workspace pages.

## Impact

- Affected UI: build detail page, run detail page, saved combo comparison page.
- Affected navigation: research workspace route state.
- Affected state model: read-only derived comparison view models over saved combos.
- Affected tests: research navigation and saved combo comparison helpers.
