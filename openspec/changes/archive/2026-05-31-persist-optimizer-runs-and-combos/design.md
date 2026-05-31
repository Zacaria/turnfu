## Context

The optimizer page can already generate duration-separated candidates and pin them for an in-page comparison. That state is still transient, while the research workspace model already contains build-scoped optimizer run and saved combo references.

## Goals

- Persist a named optimizer run from the current setup and criteria.
- Persist a selected optimizer candidate as a named saved combo.
- Keep both references scoped to the originating build and setup snapshot.
- Reuse the existing localStorage workspace repository.

## Non-Goals

- Backend persistence or sharing.
- Item modeling or equipment import.
- Cross-build ranking dashboards.
- Editing saved run criteria after creation.

## Design

### Workspace Helpers

Add pure helpers in the research workspace model to create optimizer run references and saved combo references. These helpers append the new record and update the owning build's reference id list and `updatedAt` timestamp.

### Optimizer Summaries

Add optimizer adapter helpers that format normalized controls into a concise criteria summary and format saved combo names from candidate metrics. The summary is presentation data stored with the run so the build page can display useful context without recomputing old criteria from UI state.

### UI Actions

The optimizer page gets:

- A header action to save the current search criteria as a run.
- A row action to save a candidate combo.
- Saved candidate state based on plan identity for the current setup, preventing accidental duplicate clicks in the active page.

The build page already lists optimizer runs and saved combos, so it can immediately show the persisted data once the workspace updates.

## Risks

- [Risk] Users may want custom names later. Start with deterministic readable names; custom rename can be added without changing the persistence model.
- [Risk] Plan identity ignores action context. Current optimizer candidates are produced from one setup default context, so plan identity is sufficient for marking current-page saved candidates.
