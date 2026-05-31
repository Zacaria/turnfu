## 1. Core Optimizer Search

- [x] 1.1 Add tests for exact turn count search returning only the requested duration.
- [x] 1.2 Add tests for deterministic beam search with bounded frontier expansion and stable ordering.
- [x] 1.3 Add tests proving beam search can exhaust valid actions without a user-facing action-count limit.
- [x] 1.4 Add tests proving tied candidates prefer greater resource use before plan tie-breakers.
- [x] 1.5 Add tests proving repeated simulator states are pruned without an action-count limit.
- [x] 1.6 Implement exact turn count support in optimizer options.
- [x] 1.7 Implement deterministic beam search that drops invalid partial plans and scores with simulator-backed scoring.
- [x] 1.8 Preserve sustainability filtering and result metadata for beam search candidates.
- [x] 1.9 Prune repeated simulator states and repeated zero-cost utility loops within candidate paths.

## 2. Optimizer Workspace Controls

- [x] 2.1 Add tests for search-width controls mapping into optimizer options without a user-facing actions-per-turn limit.
- [x] 2.2 Add search-width controls to the optimizer workspace UI.
- [x] 2.3 Use exact-duration optimizer calls for each one-, two-, and three-turn result group.
- [x] 2.4 Keep controls clamped to responsive ranges.

## 3. Verification

- [x] 3.1 Run focused core optimizer and optimizer workspace tests.
- [x] 3.2 Run the project test suite.
- [x] 3.3 Run the frontend production build.
- [x] 3.4 Run OpenSpec strict validation for `improve-combo-optimizer-search`.
