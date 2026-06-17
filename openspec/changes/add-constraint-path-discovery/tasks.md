## 1. Discovery Descriptors

- [x] 1.1 Define descriptor types for valid candidate traces, invalid candidate traces, state affordances, and violation categories.
- [x] 1.2 Extract descriptors from TypeScript simulator results without changing existing scoring or result ranking.
- [x] 1.3 Extract equivalent descriptor data from Rust/WASM evaluation paths or add an adapter that derives descriptors from normalized Rust results.
- [x] 1.4 Add tests for descriptor extraction across valid plans, invalid plans, delayed payoff plans, and sustainable-cycle replay cases.

## 2. Discovery Scoring and Metrics

- [x] 2.1 Add bounded discovery-score helpers for enabling states such as rune setup, BQ/WP recovery, conditional spell access, valid long plans, and sustainability readiness.
- [x] 2.2 Keep discovery score separate from final simulator score in candidate records, progress snapshots, and engine metrics.
- [x] 2.3 Add experiment metrics for descriptor count, discovery-score leaders, final-score leaders, repair-derived candidates, and curriculum-derived candidates.
- [x] 2.4 Verify final optimizer ranking remains based on the configured simulator-backed criterion.

## 3. Constraint-Boundary Repair Signals

- [x] 3.1 Classify invalid candidates by actionable violation categories such as resource debt, missing target, cooldown lock, cast limit, deck limit, class-state gate, and replay debt.
- [x] 3.2 Feed classified invalid candidates into bounded repair candidate generation.
- [x] 3.3 Report repair signal counts and repair success rates in experiment metrics.
- [x] 3.4 Add tests proving invalid candidates can influence repair queues without appearing as final results.

## 4. Motif Mining

- [x] 4.1 Define motif metadata including action pattern, required state, resulting state, support count, validation rate, final-score contribution, and discovery-score contribution.
- [x] 4.2 Mine motifs from repeated successful candidates, repaired candidates, and near-miss candidates.
- [x] 4.3 Bound motif storage by support, validation rate, score contribution, and recency.
- [x] 4.4 Add tests for motif extraction, ranking, deduplication, and pruning.

## 5. Curriculum Objectives

- [x] 5.1 Add experiment configuration for discovery curriculum objectives.
- [x] 5.2 Implement curriculum objectives for BQ generation, rune cycling, valid long plans, sustainable loops, and conditional unlocks.
- [x] 5.3 Allow curriculum candidates and motifs to seed the main hybrid search under explicit budget limits.
- [x] 5.4 Report budget spent on curriculum-derived inputs separately from ordinary hybrid candidates.

## 6. Hybrid Integration

- [x] 6.1 Add a discovery-guided hybrid configuration that can consume discovery rewards, repair signals, motifs, and curriculum seeds.
- [x] 6.2 Integrate motif-derived seeds and mutations without bypassing simulation, pruning, repair limits, or final ranking.
- [x] 6.3 Keep the default hybrid behavior unchanged when discovery guidance is disabled.
- [x] 6.4 Add deterministic seed tests comparing baseline hybrid and discovery-guided hybrid result reproducibility.

## 7. Benchmarking and Evidence Gate

- [x] 7.1 Add benchmark scenarios that compare baseline hybrid and discovery-guided hybrid under the same setup, seed, criterion, and budget.
- [x] 7.2 Measure final score, valid rate, repair success rate, motif usefulness, discovery overhead, and score-per-iteration.
- [x] 7.3 Document benchmark results and practical guidance for enabling discovery-guided search.
- [x] 7.4 Decide whether the generated candidate corpus and benchmark plateau justify a separate neural-guidance proposal.

## 8. Verification

- [x] 8.1 Run the TypeScript test suite.
- [x] 8.2 Run the Rust/WASM tests and differential suite for affected optimizer paths.
- [x] 8.3 Run representative optimizer benchmarks for baseline and discovery-guided configurations.
- [x] 8.4 Validate this OpenSpec change with `openspec validate add-constraint-path-discovery --strict --no-interactive`.
