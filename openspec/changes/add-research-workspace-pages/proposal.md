## Why

The app needs a higher-level workspace for theorycraft research, not only a single combo builder. Users need to create and name as many builds as they want, then organize each build's setup versions, optimizer runs, and saved combo candidates without losing the assumptions behind each result.

## What Changes

- Add a research library page listing user-created builds.
- Allow users to create any number of builds and name them freely.
- Add build-level pages for exploring one class/gameplay idea.
- Add setup snapshot support so final stats, equipment notes, deck/passives, target context, and initial class state can be reused across runs.
- Add navigation paths from the research library to builds, setup versions, optimizer runs, and saved combos.
- Persist the first implementation in `localStorage`.
- Show other Wakfu classes at build creation time, but only allow Huppermage selection until class support is added case by case.

## Capabilities

### New Capabilities

- `research-workspace`: Covers the research library, build pages, build creation, class gating, `localStorage` persistence, and navigation between builds, setups, runs, and saved combos.
- `setup-snapshots`: Covers immutable setup snapshots that bind final stats, equipment notes, deck/passives, target context, and initial state for repeatable optimization.

### Modified Capabilities

None.

## Impact

- Frontend routing/navigation for the research library and build workspace pages.
- New domain types for builds, setup snapshots, optimizer runs, and saved combo references.
- `localStorage` repository for the first implementation, with a shape compatible with later persistence.
- Existing turn builder and simulation modules remain available but become reachable from a broader research workflow.
