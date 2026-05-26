## 1. Domain Model

- [x] 1.1 Add build, setup snapshot, optimizer run reference, and saved combo reference types.
- [x] 1.2 Add setup snapshot serialization tests for final stats, resources, equipment notes, passives, deck, target context, default action context, and initial class state.
- [x] 1.3 Add `localStorage` repository tests for saving and restoring builds, setup snapshots, optimizer run references, and saved combo references.
- [x] 1.4 Add seeded local research data covering at least one Huppermage build with one setup snapshot.

## 2. Routing and Navigation

- [x] 2.1 Introduce page-level navigation state for research library, build detail, setup detail, builder, and future optimizer workspace routes.
- [x] 2.2 Keep the current timeline builder reachable from a setup or saved combo without losing originating build context.
- [x] 2.3 Add tests for navigation context preservation from build to setup to builder and back.

## 3. Research Library Page

- [x] 3.1 Build a scannable research library list with build name, class, gameplay label, setup count, saved combo count, and last updated status.
- [x] 3.2 Add build creation with free-form names and class selection where only Huppermage is selectable.
- [x] 3.3 Add class filtering for builds.
- [x] 3.4 Add empty states for no builds and no filtered results.

## 4. Build and Setup Pages

- [x] 4.1 Build a build page grouping setup snapshots, optimizer run references, saved combos, and notes.
- [x] 4.2 Build a setup snapshot detail page showing class, key stats, resources, equipment notes, passives, deck summary, target context, and initial state summary.
- [x] 4.3 Add actions to open a setup in the builder and to prepare opening it in the optimizer workspace.

## 5. Verification

- [x] 5.1 Run focused tests for research workspace domain and navigation helpers.
- [x] 5.2 Run the project test suite.
- [x] 5.3 Run the frontend production build.
- [x] 5.4 Run OpenSpec strict validation for `add-research-workspace-pages`.
