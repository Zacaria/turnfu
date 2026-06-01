# Rust/WASM Hybrid Backend

This document records the current Rust/WASM hybrid optimizer rollout state.
TypeScript remains the gameplay oracle and the default optimizer backend.

## Backend Status

- `typescript`: default backend and canonical gameplay implementation.
- `rustWasm`: experimental direct Rust/WASM hybrid backend for supported
  Huppermage hybrid searches.
- `rustWasmParallel`: benchmark and long-run harness that shards Rust/WASM
  hybrid searches across Node workers, merges top candidates, and revalidates
  final top candidates with the TypeScript evaluator.

Rust/WASM results are suitable for experimental long-run search when final top
candidates are revalidated by TypeScript. They are not yet a replacement for the
TypeScript gameplay oracle.

## Trust Levels

- `rustWasmOracle: "perCandidate"`: highest validation, lowest throughput.
  Every candidate can be checked across the JS/Rust boundary.
- `rustWasmOracle: "finalTopCandidates"`: preferred long-run mode. Rust owns
  candidate generation and scoring, then the reported top candidates are
  re-evaluated by TypeScript before trusting the result.
- `rustWasmOracle: "disabled"`: exploratory only. Use this for profiling or
  generator diagnostics, not for trusted optimizer results.

Benchmark `--no-oracle` maps to final top-candidate validation for the
Rust/WASM backend.

## Validation Commands

```bash
rtk pnpm wasm:test
rtk pnpm diff:rust-wasm
rtk pnpm test
rtk pnpm bench:hybrid -- --compare-backends --scenario t3-full --budget 100000 --seed smoke --no-build --no-oracle
rtk pnpm bench:hybrid -- --compare-backends --scenario t3-full --budget 1000000 --seed smoke --no-build --no-oracle
rtk openspec validate port-hybrid-engine-to-rust-wasm --strict --no-interactive
```

`diff:rust-wasm` may require running outside the Codex sandbox because
`wasm-pack` and `wasm-bindgen` use temporary directories outside the worktree.

## Parallel Long-Run Commands

Fixed-budget run:

```bash
rtk pnpm bench:rust-wasm:parallel -- --scenario t3-full --budget 1000000 --seed smoke --workers 20
```

Timeboxed 100M-target run:

```bash
rtk pnpm bench:rust-wasm:parallel -- --scenario t3-full --budget 100000000 --seed smoke-100m-timebox --workers 20 --timebox-ms 180000 --chunk-size 100000
```

The timeboxed command treats `--budget` as the target cap and stops after the
current worker chunk completes once `--timebox-ms` has elapsed. The JSON output
includes `completedBudget` so partial 100M-target runs can be compared without
pretending the full 100M budget completed.

Persistent SQLite search session:

```bash
rtk pnpm search:rust-wasm -- --session hupper-t3-full --db .optimizer/rust-wasm-search.sqlite --scenario t3-full --seed continuous --workers 20 --chunk-size 100000
```

The persistent runner stores one resumable Rust/WASM state per worker in SQLite.
When the command is started again with the same session and matching gameplay
fingerprint, it resumes from the saved population, repair queue,
elite-neighbor queue, restart/stagnation counters, and RNG state. Use `--reset`
to discard a session after rules, catalog, character setup, or optimizer options
change. For smoke tests, add `--max-rounds 1` or `--timebox-ms <milliseconds>`.

## UI SQLite Recovery

The optimizer UI persists its research workspace through the local Vite API at
`/api/research-workspace` and its latest optimizer workspace sessions through
`/api/optimizer-sessions`. The API stores this UI state in the same SQLite
database used by persistent Rust/WASM search sessions, defaulting to
`.optimizer/rust-wasm-search.sqlite`. Optimizer sessions are stored one row per
setup so reopening a setup can recover the last controls, progress, result list,
and pinned candidates.

Use `WAKFU_OPTIMIZER_DB=/path/to/search.sqlite rtk pnpm dev` when the UI should
read and write a different SQLite file. Existing `localStorage` research
workspace data is migrated into SQLite once the API is available. If the API is
unavailable, the browser keeps the current state in memory for that page load
but cannot recover it after reopening the optimizer.

## Current Local Evidence

Local timings are noisy and machine-dependent. The latest rollout benchmark
artifacts are archived as JSON/JSONL under `docs/benchmarks/`.

### 100k and 1M Direct Backend Comparison

Raw file: `docs/benchmarks/rust-wasm-rollout-100k-1m-compare.jsonl`.

| Scenario | Budget | TypeScript it/s | Rust/WASM direct it/s | Score | Rust final TS validation |
| --- | ---: | ---: | ---: | ---: | --- |
| `t2-a8-p2` | 100k | 16,649.02 | 17,108.64 | 73,204.18 | top 5 valid, delta 0 |
| `t2-a8-p2` | 1M | 13,312.02 | 18,420.83 | 73,204.18 | top 5 valid, delta 0 |
| `t3-a12-p3` | 100k | 8,576.19 | 11,705.18 | 103,545.66 | top 5 valid, delta 0 |
| `t3-a12-p3` | 1M | 9,380.20 | 12,942.12 | 103,545.66 | top 5 valid, delta 0 |
| `t3-full` | 100k | 7,246.38 | 11,431.05 | 103,545.66 | top 5 valid, delta 0 |
| `t3-full` | 1M | 7,356.78 | 12,244.11 | 103,545.66 | top 5 valid, delta 0 |

Post-rebase sublimation smoke on 2026-06-02:

- Command: `rtk pnpm bench:hybrid -- --compare-backends --scenario t3-full --budget 100000 --seed smoke --no-build --no-oracle`
- TypeScript: `7,010.96 it/s`, score `103,545.66`, valid rate `0.4434`.
- Rust/WASM direct: `11,572.42 it/s`, score `103,545.66`, valid rate
  `0.3124`.
- Rust final top-candidate TypeScript validation: top 5 valid, max score delta
  `0`, max total damage delta `0`.

The same post-rebase validation pass ran:

- `rtk pnpm diff:rust-wasm`: 94 fixtures, 102 generated candidates, 0
  mismatches.
- `rtk pnpm diff:rust-wasm:soak`: 122 fixtures, 1648 generated candidates, 0
  mismatches.

The generated differential batches now include targeted candidates for
every currently supported sublimation catalog entry, including initial
stat/resource effects with fractional resources, action damage, elemental
carryover, Alternance, Exces, Puissance Brute, elemental mastery percentage
modifiers, HP-assumption threshold overlap, action-level `criticalMode`, and
invalid sublimation violations.

### 10M Parallel Rust/WASM Matrix

Raw files:

- `docs/benchmarks/rust-wasm-rollout-10m-t2-a8-p2.json`
- `docs/benchmarks/rust-wasm-rollout-10m-t3-a12-p3.json`
- `docs/benchmarks/rust-wasm-rollout-10m-t3-full.json`

| Scenario | Budget | Workers | Throughput | Score | Valid rate | TypeScript final validation |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `t2-a8-p2` | 10M | 20 | 124,968.61 it/s | 73,204.18 | 0.6113 | top 5 valid, delta 0 |
| `t3-a12-p3` | 10M | 20 | 78,400.01 it/s | 103,545.66 | 0.3500 | top 5 valid, delta 0 |
| `t3-full` | 10M | 20 | 79,736.95 it/s | 103,545.66 | 0.3556 | top 5 valid, delta 0 |

### 100M Parallel Rust/WASM Run

Raw files:

- `docs/benchmarks/rust-wasm-rollout-100m-t3-full.json`
- `docs/benchmarks/rust-wasm-rollout-100m-t3-full-memory.json`

The memory-instrumented `t3-full` 100M run completed in `1,028,705.16ms`
with 20 workers:

- Throughput: `97,209.58 it/s`
- Score: `103,545.66`
- Valid rate: `0.3736`
- Cache metrics: `9,502,676` hits, `90,497,324` misses, `90,097,324`
  evictions with a `400,000` evaluation-cache limit across workers.
- Memory behavior: parent RSS `329.44 MB`, average worker RSS `725.88 MB`,
  peak worker RSS `1,012.50 MB`, sampled workers `20`.
- TypeScript final validation: top 5 valid, max score delta `0`, max total
  damage delta `0`.

The 100M run did not find a score above the current TypeScript reference best on
`t3-full`, but it proves that the parallel long-run harness can complete a full
100M Rust/WASM search, merge the top candidates, and revalidate them with the
TypeScript gameplay oracle.

## Merge Guardrails

- Keep TypeScript as the default backend and gameplay oracle.
- Keep Rust/WASM marked experimental until a separate promotion change makes
  Rust canonical.
- Trusted long-run Rust/WASM results must use final top-candidate TypeScript
  validation.
- Reset incompatible persistent search sessions after gameplay rules, catalog
  entries, sublimation support, character setup, or optimizer options change.
- Re-run differential validation after TypeScript gameplay changes before
  trusting Rust/WASM long-run results.
