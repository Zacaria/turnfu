## Why

Optimizer comparisons are currently transient: pinned candidates disappear when leaving the page, and the build page cannot show meaningful run history. Persisting optimizer runs and selected combos makes the research workspace useful for comparing concepts over time.

## What Changes

- Add workspace actions to save the current optimizer search as a named run.
- Add workspace actions to save individual optimizer candidates as named combos.
- Keep saved runs and combos associated with the originating build and setup snapshot.
- Display saved run criteria and saved combo summaries from the build page.
- Preserve existing localStorage persistence; no backend or item modeling is introduced.

## Capabilities

### New Capabilities

### Modified Capabilities

- `combo-optimizer-workspace`: Optimizer workspace can persist named runs and saved combo candidates for later comparison.

## Impact

- Affected UI: optimizer workspace page and build detail page.
- Affected state model: `ResearchWorkspaceData.optimizerRuns`, `ResearchWorkspaceData.savedCombos`, and build references.
- Affected persistence: existing localStorage workspace serialization.
- Affected tests: research workspace state helpers and optimizer workspace UI/state tests.
