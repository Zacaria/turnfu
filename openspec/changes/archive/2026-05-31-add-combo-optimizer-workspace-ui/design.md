## Context

The core combo optimizer can evaluate bounded candidate plans and score them by total or resolved-element damage. Users now need a UI that turns that core capability into an exploration workflow: run searches from a fixed setup, inspect separate one-turn/two-turn/three-turn result sets, pin candidates, and compare metrics without mixing incompatible durations.

This change should consume setup snapshot concepts from `add-research-workspace-pages`, but it can be implemented against seeded setup data first if both changes are developed in parallel.

## Goals / Non-Goals

**Goals:**

- Add an optimizer workspace page scoped to one setup snapshot.
- Expose search controls for duration, scoring criterion, target element, sustainable cycle requirement, and result count.
- Group results by exact duration so one-turn, two-turn, and three-turn combos are not ranked against each other by raw total damage.
- Provide a comparison area for pinned candidates with normalized metrics and resource state.
- Allow opening a candidate in the timeline builder.
- Use the initial sustainable-cycle rule from the core optimizer: replay validity plus final replay BQ/PW greater than or equal to replay initial BQ/PW.

**Non-Goals:**

- Changing the core optimizer algorithm beyond adapter needs.
- Supporting more than the configured three-turn maximum.
- Persisting optimizer runs to a backend.
- Modeling equipment item databases or non-Huppermage class mechanics in this change.
- Requiring identical rune, heart, or other Huppermage class state at the end of a sustainable cycle.

## Decisions

### Group by exact duration

The workspace will request or derive separate result groups for one-turn, two-turn, and three-turn candidates. Within a group, raw total damage is meaningful. Across groups, the UI will use normalized metrics such as damage per turn and damage per AP.

Alternative considered: one global ranked table. That would make longer plans dominate and hide useful one-turn burst candidates.

### Pin candidates for comparison

Users can pin candidates from any result group into a comparison table. The comparison table shows both raw and normalized metrics and identifies the duration of each candidate.

Alternative considered: compare only rows visible in the current list. Pinning is more useful because it lets users compare candidates from different filters or durations while preserving context.

### Use adapter functions between setup snapshots and optimizer input

The UI should not construct optimizer inputs inline. A small adapter layer will map setup snapshots and controls into optimizer calls, and map optimizer results into UI rows.

Alternative considered: call `optimizeCombo` directly from component render logic. That would couple UI state, domain mapping, and expensive computation in one place.

### Keep Light attribution visible in result details

Result rows and comparison details will display damage grouped by resolved element. Light damage remains display-Light in action details but contributes to the resolved element score chosen by the simulator.

Alternative considered: show only total damage. That would hide why element-targeted scoring selected a candidate.

### Keep sustainability simple for the first UI

The first sustainable-cycle UI will mirror the core optimizer rule: the candidate must replay validly from the first run's carried state, and replay final BQ/PW must be greater than or equal to replay initial BQ/PW. Rune, heart, and other Huppermage state differences can be surfaced later as warnings or stricter modes.

Alternative considered: require full class state equivalence. That is more precise but would block useful cycle exploration before the BQ/PW resource loop is validated.

## Risks / Trade-offs

- [Risk] Candidate expansion can become expensive. → Keep result count controls, memoize by setup/control key, and start with conservative defaults.
- [Risk] Users may misread cross-duration comparisons. → Keep exact-duration result groups and label normalized metrics clearly.
- [Risk] Setup snapshot implementation may arrive after optimizer UI work. → Build adapters around typed interfaces and allow seeded snapshots during early UI development.
