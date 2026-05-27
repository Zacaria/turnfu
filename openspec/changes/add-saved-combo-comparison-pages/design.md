## Context

The research workspace already has persistent `optimizerRuns` and `savedCombos`. The current build page is useful as a summary, but it does not provide enough structure to compare multiple combo versions quickly.

## Goals

- Make saved optimizer runs clickable.
- Make saved combos comparable from a dedicated page.
- Keep comparisons separated by exact duration.
- Reuse existing saved combo plans and builder handoff behavior.

## Non-Goals

- Re-running optimizer searches from historical run criteria.
- Persisting full optimizer result sets.
- Cross-build comparison.
- Backend persistence.

## Design

### Navigation

Extend `ResearchRoute` with two build-scoped pages:

- `optimizerRun`: shows one saved optimizer run and the saved combos from the same setup.
- `savedCombos`: shows all saved combos for a build grouped by plan duration.

Both routes return to the owning build.

### Derived Comparison Model

Add pure helpers that derive saved combo comparison rows from `SavedComboReference` records:

- exact duration from `plan.turns.length`;
- action count from all plan actions;
- total damage from the saved reference;
- damage per turn from total damage divided by duration;
- sorted groups by total damage descending within each duration.

The helper does not simulate the combo again because saved combos are references to optimizer output at save time.

### UI

The build page adds explicit actions to inspect runs and compare saved combos. The saved combo comparison page renders separate sections for one-, two-, and three-turn combos. Saved combos can be opened in the builder using the setup snapshot stored on the saved combo.

## Risks

- [Risk] Saved combos currently store limited metrics. The first comparison uses available persisted fields; richer metrics can be added later without changing the route structure.
- [Risk] Saved run detail may feel sparse until run result sets are persisted. It still anchors saved combos to the setup and criteria that produced the search.
