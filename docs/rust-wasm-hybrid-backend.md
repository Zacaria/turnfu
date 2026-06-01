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

Local timings are noisy and machine-dependent, but the latest validated
`t3-full` evidence is:

| Mode | Budget | Throughput | Score | TypeScript final validation |
| --- | ---: | ---: | ---: | --- |
| TypeScript | 1M | ~8.7k it/s | 103545.66 | canonical |
| Rust/WASM direct | 1M | ~12.9k it/s | 103545.66 | top 5 valid, delta 0 |
| Rust/WASM parallel, 20 workers | 1M | ~99.3k it/s | 103545.66 | top 5 valid, delta 0 |
| Rust/WASM parallel, 20 workers, 100M target timeboxed | 16M completed in 204s | ~78.4k it/s | 103545.66 | top 5 valid, delta 0 |

The 100M-target timeboxed run did not find a better score than the TypeScript
reference best on `t3-full`. It did prove that the parallel long-run harness can
merge multi-million-candidate Rust/WASM runs and revalidate the final top
candidates with TypeScript.

## Merge Guardrails

- Keep TypeScript as the default backend and gameplay oracle.
- Keep Rust/WASM marked experimental until the remaining benchmark matrix and a
  full 100M run are archived.
- Trusted long-run Rust/WASM results must use final top-candidate TypeScript
  validation.
- Do not mark OpenSpec benchmark tasks 6.2 or 6.3 complete until the full
  requested evidence exists.
