## 1. Dataset Export

- [x] 1.1 Define the learned policy dataset row schema and label definitions.
- [x] 1.2 Export candidate, reuse-trial, checkpoint, motif, and boundary evidence from continuous SQLite.
- [x] 1.3 Add deterministic dataset split support by session or seed.
- [x] 1.4 Add smoke tests for export shape, label computation, and split stability.

## 2. Offline Policy Evaluation

- [x] 2.1 Add a baseline evaluator for current handcrafted mutation ordering.
- [x] 2.2 Add at least one inspectable ranking baseline using exported features.
- [x] 2.3 Report top-k score delta, validity, global-best recall, invalid selection rate, and lift over handcrafted ordering.
- [x] 2.4 Document the minimum offline lift required before online integration.

## 3. Optional Learned Policy

- [x] 3.1 Decide whether the offline baseline justifies a neural policy/value model.
- [ ] 3.2 If justified, define model inputs, labels, validation split, and artifact versioning.
- [x] 3.3 Keep predicted values out of final scoring and expose them only as search-priority hints.

## 4. Online Integration Gate

- [ ] 4.1 Integrate policy-ranked candidates into Rust/WASM continuous seed prioritization only after offline lift is positive.
- [ ] 4.2 Run matched validation with at least 1M attempts and exact oracle checks.
- [ ] 4.3 Compare against no-policy and handcrafted-policy baselines before any larger run.

## 5. Verification

- [x] 5.1 Run affected TypeScript tests.
- [x] 5.2 Validate this OpenSpec change with `openspec validate add-learned-search-policy --strict --no-interactive`.
