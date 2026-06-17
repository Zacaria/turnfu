# HANDOFF: Constraint Path Discovery

## Current State

Worktree:

`/Users/zacariachtatar/game_repos/wakfu-turn-optimizer/.worktrees/codex/add-constraint-path-discovery`

Branch:

`codex/add-constraint-path-discovery`

Active OpenSpec change:

`add-constraint-path-discovery`

This branch implements the first practical discovery layer for the optimizer. It is not meant to prove that discovery already beats master on final damage. The smoke benchmark currently shows equal final score to baseline at a tiny budget, while exposing new descriptors, motifs, motif seeds, and constraint-boundary samples. Treat this as a foundation for discovering hidden paths, not as a finished search-quality win.

The main checkout is clean. The OpenSpec draft was removed from the main checkout and remains in this worktree under:

`openspec/changes/add-constraint-path-discovery/`

## Why This Exists

The existing optimizer is already strong at exploitation once a high-value region is visible. It has deterministic simulator scoring, stochastic experiment engines, hybrid islands, warmups, resource-aware sampling, repair queues, local refinement, elite neighbors, restarts, and Rust/WASM throughput.

The weak point we discussed is discovery under constraints. Final damage or sustainable-cycle score can make a setup path look bad until the right constraints line up later: rune state, BQ, WP, cooldowns, targets, passives, sublimations, heart state, Feu-Follet state, or replay sustainability.

The Trackmania articles suggested the useful split:

- Discovery: find rare or enabling rule states.
- Optimization: exploit discovered states into high final score.
- Consistency: verify candidates with the exact oracle.

For this optimizer, discovery should be cheap, inspectable, and simulator-derived. It should feed better candidates into the existing hybrid engine without replacing strict final scoring.

## Research Takeaways To Preserve

1. Keep final scoring strict.
   Returned candidates must still rank by simulator-backed damage or sustainable-cycle score. Heuristic discovery score must not make a low-damage plan win final ranking.

2. Separate discovery score from final score.
   Discovery score is a shaping signal for exploration and telemetry. It gives credit to enabling states such as rune setup, BQ recovery, WP preservation, conditional unlocks, valid long plans, and sustainable replay readiness.

3. Learn motifs, not only whole winning plans.
   Useful structures are often partial patterns such as "generate runes before burst", "recover BQ before spending", "unlock a temporary element", or "repair a sustainable replay". These should become reusable seeds or macros, but must still pass simulation.

4. Use curriculum objectives.
   Hidden techniques are easier to find when intermediate goals are searched directly. The first curricula are BQ generation, rune cycling, valid long plans, sustainable loops, and conditional unlocks.

5. Treat failed candidates as boundary samples.
   Invalid candidates are not only failures. A resource debt, cooldown lock, missing target, deck limit, cast limit, class-state gate, or replay debt tells search which constraint boundary it hit and what kind of repair may be nearby.

6. Explore approximately, verify exactly.
   Discovery can use approximate or partial descriptors, especially in Rust/WASM candidate-only paths, but final trusted candidates must be exact simulator/oracle-verified.

7. Favor fast feedback over a perfect search stack.
   Do not jump straight to neural guidance. First collect descriptors, motifs, boundary samples, and benchmark evidence. Only propose learned policy/value guidance after heuristic discovery plateaus against fixed-seed baselines.

## What Was Implemented

### Discovery Descriptor Layer

Added `src/core/optimizer/discovery.ts`.

It defines:

- discovery options and curriculum objectives;
- valid and invalid candidate descriptors;
- compact final state descriptors for resources, Huppermage state, runes, heart, stored BQ, Feu-Follet, halo marks, cooldown count, and affordances;
- violation categories for actionable failures;
- bounded discovery scores and score reasons;
- motif mining, motif merging, motif ranking, and motif seed cloning helpers.

Descriptors are derived from simulator outputs. There is no parallel rules model.

### Separate Discovery Score

Discovery score is bounded and attached as metadata:

- `runeSetup`
- `runeCycle`
- `bqRecovery`
- `wpPreservation`
- `conditionalUnlock`
- `validLongPlan`
- `sustainableReplay`
- `boundary:<category>`
- `curriculum:<objective>`

Final ranking still uses the existing candidate comparison and simulator score helpers. `compareCandidates` and `compareRankedCandidates` were not converted to discovery scoring.

### Constraint-Boundary Repair Signals

Invalid candidates now produce classified repair signals when discovery is enabled. The hybrid repair queue carries:

- candidate input;
- violation category.

Metrics record repair signals, attempts, and successes by category. This preserves the previous repair mechanism while making the boundary data inspectable.

### Motif Mining And Reuse

Motifs are mined from evaluated candidates and near-miss candidates. Motifs record:

- action pattern;
- required state;
- resulting state;
- support count;
- valid count;
- validation rate;
- final-score contribution;
- discovery-score contribution;
- a seed candidate.

Motif storage is bounded in memory and pruned by support, validation rate, score contribution, discovery contribution, and recency. Motif-derived candidates are only search hints. They still go through normal simulation, pruning, repair limits, and final ranking.

Important limitation: motifs are not yet persisted across runs. Persistence remains a follow-up decision after benchmark evidence shows which motifs are actually predictive.

### Curriculum Candidate Sampling

Discovery-enabled hybrid search can sample curriculum candidates for:

- `bqGeneration`
- `runeCycling`
- `validLongPlans`
- `sustainableLoops`
- `conditionalUnlocks`

Curriculum sampling is opt-in and budget-limited. It currently enters the fresh-candidate path probabilistically, so it should be measured against baseline on fixed seeds and budgets before tuning further.

### Rust/WASM Integration

Rust/WASM search paths record discovery data in two ways:

- full TypeScript oracle evaluations record normal descriptors;
- no-oracle Rust/WASM batches can record candidate-only descriptors from normalized candidates and Rust scores.

Final top-candidate verification still records exact discovery descriptors from the TypeScript oracle. The differential suite remains the safety check for Rust/WASM parity.

### Benchmark Controls

`scripts/benchmark-hybrid.ts` now supports:

```bash
rtk pnpm bench:hybrid -- --scenario t2-a8-p2 --budget 1000000 --seed a,b,c,d,e --discovery
rtk pnpm bench:hybrid -- --scenario t2-a8-p2 --budget 1000000 --seed a,b,c,d,e --compare-discovery
```

`--compare-discovery` runs baseline and discovery under the same scenario, budget, seed, criterion, and backend options.
Budgets below `1_000_000` attempts are smoke checks only. Do not use 1000-budget runs as search-quality evidence.

## Initial Evidence

Historical smoke check:

```bash
rtk pnpm bench:hybrid -- --scenario t2-a8-p2 --budget 100 --seed a --compare-discovery
```

Observed result:

| Mode | Score | Valid rate | Discovery telemetry |
| --- | ---: | ---: | --- |
| Baseline | `93663.64` | `0.82` | none |
| Discovery | `93663.64` | `0.82` | 100 descriptors, 32 motifs, 11 motif seed candidates, 18 boundary samples |

Interpretation:

- This does not prove discovery improves final score yet.
- It only proves discovery can run without degrading the final score in this smoke case.
- The new value is observability and new candidate sources: descriptors, motifs, curriculum candidates, and repair-boundary metrics.
- Budgets of at least 1M attempts, multiple seeds, and harder scenarios are required before deciding whether discovery guidance improves score per iteration.

## Relationship To Continuous SQLite Search

Important: the real proof path should build on the existing continuous Rust/WASM SQLite search loop, not only on small one-shot benchmark commands.

That infrastructure already exists in master/current branch:

- `scripts/search-rust-wasm-sqlite.ts`
- `rtk pnpm search:rust-wasm`
- persistent sessions in `.optimizer/rust-wasm-search.sqlite`
- per-worker Rust/WASM resume state;
- saved best candidate and checkpoints;
- final top-candidate TypeScript oracle verification.

The current discovery implementation does not yet persist discovery descriptors, motifs, curriculum lineage, or boundary samples into the SQLite search database. It only wires discovery into the TypeScript experiment/hybrid layer and benchmark comparison path. That is enough to validate the shape of the discovery signals, but it is not enough to prove discovery improves long-running search.

Next serious implementation step:

1. Extend the SQLite search schema with discovery tables or JSON columns for descriptor summaries, motif summaries, boundary samples, curriculum counts, and motif seed outcomes.
2. Add discovery options to `scripts/search-rust-wasm-sqlite.ts`, likely behind `--discovery` and `--compare-discovery`-style flags.
3. Persist per-worker discovery state or at least aggregate checkpoint summaries across rounds.
4. Keep Rust/WASM resume state compatible and exact-oracle final verification unchanged.
5. Compare continuous baseline sessions and continuous discovery sessions with the same scenario, seed, worker count, chunk size, and timebox.

Until this is done, discovery should be treated as a promising instrumentation and candidate-generation layer, not as a proven optimizer improvement.

## What Is Intentionally Not Done

- No neural network policy or value model.
- No persistent descriptor or motif corpus.
- No UI surface for discovery telemetry.
- No replacement of exact simulator ranking.
- No trusted macro-action system that bypasses validation.
- No claim that this branch already improves final score versus master.
- No broad retuning of hybrid probabilities beyond a conservative opt-in curriculum branch and motif seed budget.

These omissions are deliberate. They keep the first change inspectable and make the next benchmark decision easier.

## Follow-Up Directives

Before implementing neural guidance or deeper search changes, run a benchmark matrix:

```bash
rtk pnpm bench:hybrid -- --scenario t2-a8-p2 --budget 1000000 --seed a,b,c,d,e --compare-discovery
rtk pnpm bench:hybrid -- --scenario t3-a12-p3 --budget 1000000 --seed a,b,c,d,e --compare-discovery
rtk pnpm bench:hybrid -- --scenario t3-full --budget 1000000 --seed a,b,c,d,e --compare-discovery
```

Track:

- final score distribution;
- valid rate;
- score per iteration;
- discovery descriptor count;
- discovery-score leader versus final-score leader;
- motif count, motif support, motif seed attempts, and motif seed successes;
- boundary samples by category;
- repair attempts and successes by category;
- curriculum candidate counts by objective;
- Rust/WASM final top-candidate verification deltas.

If discovery helps, tune budgets and motif seed selection. If it only adds telemetry, use the descriptor corpus to decide whether a persisted corpus or learned guide is justified.

For proof-quality evidence, prefer continuous SQLite sessions:

```bash
rtk pnpm search:rust-wasm -- --session baseline-t3-full-a --scenario t3-full --seed a --workers 6 --chunk-size 100000 --timebox-ms 600000
rtk pnpm search:rust-wasm -- --session discovery-t3-full-a --scenario t3-full --seed a --workers 6 --chunk-size 100000 --timebox-ms 600000 --discovery
```

The `--discovery` flag shown above does not exist yet. Add it before using this command as a proof run.

## Neural Guidance Gate

Only propose neural guidance after all of these are true:

- discovery-guided search has plateaued against baseline;
- a sizable simulator-evaluated corpus exists;
- descriptors or motifs show predictive value for final score or repair success;
- a learned guide can be compared against heuristic discovery under identical seeds, budgets, and exact final oracle verification.

Potential learned-guide roles later:

- policy prior for action/passive/sublimation sampling;
- value estimate for partial plans;
- motif ranking or pruning;
- repair-category prediction.

Non-negotiable constraint: learned guidance must never replace exact simulator validation for final candidates.

## Verification Status

Passed:

```bash
rtk pnpm test
rtk pnpm wasm:test
rtk pnpm diff:rust-wasm
rtk pnpm bench:hybrid -- --scenario t2-a8-p2 --budget 100 --seed a --compare-discovery # smoke only, not quality evidence
rtk pnpm build
rtk openspec validate add-constraint-path-discovery --strict --no-interactive
rtk git diff --check
```

Rust/WASM verification:

- `rtk pnpm wasm:test`: 61 passed.
- `rtk pnpm diff:rust-wasm`: 94 fixtures, 102 generated candidates, 0 mismatches.

The Rust unit expectations in `rust/optimizer-wasm/src/lib.rs` were refreshed to match current simulator behavior for base rune-generation BQ, abundance retention, profusion turn-end abundance, and light-damage abundance consumption.

## Important Files

- `src/core/optimizer/discovery.ts`
- `src/core/optimizer/optimizerExperiment.ts`
- `src/core/optimizer/optimizerExperiment.test.ts`
- `scripts/benchmark-hybrid.ts`
- `docs/constraint-path-discovery.md`
- `openspec/changes/add-constraint-path-discovery/`
- `rust/optimizer-wasm/src/lib.rs`

## Current Git State

Expected uncommitted worktree changes:

- modified `HANDOFF.md`;
- modified Rust unit expectations in `rust/optimizer-wasm/src/lib.rs`;
- modified optimizer experiment code and tests;
- added `src/core/optimizer/discovery.ts`;
- added `docs/constraint-path-discovery.md`;
- added OpenSpec change files under `openspec/changes/add-constraint-path-discovery/`.

Do not remove the OpenSpec draft from this worktree. It was intentionally removed only from the main checkout.
