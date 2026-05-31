## 1. Backend Boundary

- [x] 1.1 Add an optimizer backend option and metadata field without changing existing TypeScript default behavior.
- [x] 1.2 Extract a backend adapter interface that accepts normalized optimizer requests and returns the existing optimizer result shape.
- [x] 1.3 Route TypeScript optimizer runs through the adapter interface and prove current tests still pass.
- [x] 1.4 Add explicit unsupported-backend errors for engine or option combinations the Rust backend cannot run.

## 2. Rust/WASM Scaffolding

- [x] 2.1 Add a Rust crate under `rust/optimizer-wasm` with deterministic build scripts.
- [x] 2.2 Add package scripts for WASM build, Rust benchmark runs, and differential test runs.
- [x] 2.3 Define the compact request and response data model shared between TypeScript and Rust.
- [x] 2.4 Implement serialization and normalization helpers for catalog entries, character state, optimizer options, plans, results, and metrics.

## 3. Gameplay Port

- [x] 3.1 Port resource pools, spell costs, action context resolution, and resource validation to Rust.
- [x] 3.2 Port damage calculation, resolved element logic, contextual mastery handling, critical/rear/block modifiers, and two-decimal rounding.
- [x] 3.3 Port Huppermage rune state, rune AP gains, Abondance, Feu-Follet state, Coeur de Lumiere, BQ conversion, and end-of-turn BQ rules.
- [x] 3.4 Port supported passive behavior including initial stat/resource modifiers and Huppermage BQ gain modifiers.
- [x] 3.5 Port cooldowns, cast limits, deck limits, target validation, and normalized violation reporting.
- [x] 3.6 Port combo turn transitions, carried WP/BQ, persistent Huppermage state, cooldown aging, and multi-turn invalid result handling.
- [x] 3.7 Port score breakdowns, resolved-element scoring, and sustainable-cycle evaluation.

## 4. Differential Validation

- [x] 4.1 Add fixed differential fixtures for every Huppermage spell and supported passive touched by optimizer scenarios.
- [x] 4.2 Add invalid-plan fixtures covering unknown spells, insufficient resources, cast limits, cooldowns, deck limits, invalid class-state actions, and invalid targets.
- [x] 4.3 Add multi-turn fixtures covering rune carryover, WP/BQ carryover, cooldown aging, stored BQ, active passives, Feu-Follet recovery, and sustainable-cycle replay.
- [ ] 4.4 Add seeded candidate-batch generation that evaluates the same normalized candidates through TypeScript and Rust.
- [ ] 4.5 Report first mismatch details with fixture or seed, turn index, action index, spell id, field path, TypeScript value, and Rust value.
- [ ] 4.6 Add CI-sized differential tests and a larger local soak command.

## 5. Rust Hybrid Search

- [ ] 5.1 Port seeded RNG and deterministic candidate encoding to Rust.
- [ ] 5.2 Implement Rust candidate sampler support for random and resource-aware fresh branches.
- [ ] 5.3 Implement Rust island scheduling, population management, restart behavior, and immigrant injection.
- [ ] 5.4 Implement Rust crossover, mutation, local refinement, repair queue, and elite-neighbor generation.
- [ ] 5.5 Implement Rust evaluator cache with bounded memory and cache hit, miss, and eviction metrics.
- [ ] 5.6 Implement incremental top-candidate tracking and deterministic tie-breaking.
- [ ] 5.7 Emit progress snapshots at configured intervals without per-candidate boundary calls.

## 6. Benchmarking and Rollout

- [ ] 6.1 Extend hybrid benchmarks to compare TypeScript and Rust/WASM backends on the same scenarios.
- [ ] 6.2 Benchmark 100k, 1M, and 10M budgets for `t2-a8-p2`, `t3-a12-p3`, and `t3-full`.
- [ ] 6.3 Run at least one local 100M Rust/WASM benchmark and record throughput, score, valid rate, cache metrics, and memory behavior.
- [ ] 6.4 Add documentation for backend selection, differential commands, benchmark commands, and expected trust levels.
- [ ] 6.5 Enable Rust/WASM only as an experimental backend until differential tests and benchmark evidence justify a separate canonical-engine migration.

## 7. Verification

- [ ] 7.1 Run the full TypeScript test suite.
- [ ] 7.2 Run the Rust unit tests.
- [ ] 7.3 Run the CI-sized differential suite.
- [ ] 7.4 Run the local differential soak on representative generated batches.
- [ ] 7.5 Run TypeScript and Rust/WASM benchmark comparisons and archive the results in project docs.
- [ ] 7.6 Validate this OpenSpec change with `openspec validate port-hybrid-engine-to-rust-wasm --strict --no-interactive`.
