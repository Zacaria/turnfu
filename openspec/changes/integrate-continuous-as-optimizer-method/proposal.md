## Why

Continuous search currently lives on a separate page with a weaker result surface than the main optimizer. That makes good discoveries hard to inspect, compare, save, or validate against the same combo-detail workflow used by classic optimizer runs.

This change reintegrates Continuous search as a first-class optimizer method so users can keep one optimizer workflow while choosing the search algorithm that proposes candidates.

## What Changes

- Add `Continuous` as a selectable method in the existing setup-scoped optimizer workspace.
- Remove user-facing "preset" terminology from the primary workflow; Continuous should default to the best validated learned policy and expose lower-level policy choices only as advanced diagnostics if needed.
- Route optimizer controls, including exact duration, scoring criterion, target element, sustainable-cycle requirement, and set/setup context, into Continuous search runs.
- Stream Continuous progress into the optimizer workspace while preserving the existing optimizer result summary/detail experience.
- Persist and display oracle-verified Continuous candidates as normal optimizer candidates, including score breakdowns, resources, sustainability metadata, spell icon rows, timeline-builder handoff, pinning, and saved-combo workflows.
- Keep the standalone Continuous page, if retained, as diagnostics for corpus/evidence inspection rather than the primary way to run the algorithm.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `combo-optimizer-workspace`: Add Continuous as a first-class optimizer method and require Continuous results to use the same summary/detail/save/inspect workflow as existing optimizer results.
- `combo-optimizer`: Require long-running search methods to expose oracle-verified candidate payloads through the same result contract as existing optimizer engines.

## Impact

- UI: optimizer method controls, run lifecycle handling, progress display, result rendering, and possible demotion of the dedicated Continuous page to diagnostics.
- API/dev server: Continuous stream endpoint response shape and run lifecycle integration with optimizer workspace state.
- Search CLI/storage: top candidate serialization must include enough simulator-backed data for optimizer result view models.
- Tests: optimizer workspace view-model tests, stream argument mapping tests, Continuous result hydration tests, and browser verification on a custom sustainable two-turn air-damage run.
