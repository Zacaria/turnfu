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
rtk npm run wasm:test
rtk npm run diff:rust-wasm
rtk npm run bench:hybrid -- --compare-backends --scenario t3-full --budget 100000 --seed smoke --no-build --no-oracle
rtk npm run bench:hybrid -- --compare-backends --scenario t3-full --budget 1000000 --seed smoke --no-build --no-oracle
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
