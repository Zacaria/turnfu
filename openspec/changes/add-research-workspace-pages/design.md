## Context

The current UI is centered on one Huppermage turn/combo builder. That is useful for editing a sequence, but it does not model the higher-level theorycraft workflow: creating named builds, comparing setup assumptions, optimizer runs, and saved candidates over time.

The first implementation should persist locally in `localStorage` and avoid a backend dependency. It should still introduce stable domain types so later persistence can store the same data without redesigning the UI.

## Goals / Non-Goals

**Goals:**

- Introduce a research library page as the product entrypoint.
- Add build creation with free-form build names and class selection.
- Add build-level pages that group related setup versions, optimizer runs, and saved combos.
- Add setup snapshots as immutable or versioned inputs for repeatable optimization.
- Keep the existing builder reachable as an editor/inspection surface.
- Create page and data boundaries that show multiple classes but only enable Huppermage until other classes are implemented.

**Non-Goals:**

- Full equipment import or item database modeling.
- Cloud persistence, auth, sharing, or collaboration.
- Implementing optimizer result comparison UI; that belongs to `add-combo-optimizer-workspace-ui`.
- Rewriting the simulation or optimizer core.
- Optimizing non-Huppermage builds.

## Decisions

### Use a Research > Build > Setup hierarchy

The research library lists named builds. A build represents one user-named class/gameplay idea, and setup snapshots represent concrete assumptions inside that build. This matches the user workflow: create as many named builds as needed, preserve setup versions, then run several searches from each setup.

Alternative considered: put all setups in one flat list. That would be simpler initially but would make cross-class and concept-level exploration hard to scan.

### Treat setup snapshots as versioned inputs

A setup snapshot captures final stats, equipment notes, deck/passives, target context, action defaults, and initial class state. Optimizer runs and saved combos reference the snapshot they came from so comparisons remain explainable.

Alternative considered: always read the current mutable builder state. That is fast to wire, but results become hard to trust because editing stats changes the meaning of older runs.

### Persist local-first data in localStorage

The first page implementation will use seeded defaults and a `localStorage` repository. Types should live outside UI components and avoid browser-only assumptions so storage can later move to a durable backend.

Alternative considered: in-memory only. That is simpler but would lose builds on refresh, which is not acceptable for a research workspace. A database now would delay the product workflow without adding value for the immediate local exploration use case.

### Show unsupported classes as disabled choices

Build creation will display the class list so the product shape is clear, but only Huppermage can be selected. Disabled classes should communicate that they are planned for later per-class implementation.

Alternative considered: hide every class except Huppermage. That would simplify the first UI but make the future multi-class direction less clear.

### Split pages from dense tools

The research library and build pages should be list-oriented and scannable. Dense editors such as the current timeline builder should remain dedicated tool surfaces opened from a setup or saved combo.

Alternative considered: extend the existing builder with panels. The builder is already dense; adding project navigation and run history there would make comparison slower.

## Risks / Trade-offs

- [Risk] Local-first data can drift from future persistence needs. → Keep explicit domain types and serialization tests around build/setup shapes.
- [Risk] Too many pages before optimizer UI could feel empty. → Seed a minimal research library and expose clear links to the existing builder.
- [Risk] Setup snapshots may duplicate large stat objects. → Store normalized references where possible, but prefer correctness and traceability over premature compression.
- [Risk] Disabled class choices may frustrate users. → Label them as unavailable until class support is added.
