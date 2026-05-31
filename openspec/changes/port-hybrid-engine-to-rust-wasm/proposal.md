## Why

The Rust/WASM spike showed that a batched native kernel can run tens to hundreds of millions of optimizer iterations much faster than the TypeScript hot path. The next opportunity is to port the full hybrid engine so long runs become routine, while keeping TypeScript as the gameplay oracle until Rust proves strict rule equivalence.

## What Changes

- Add a Rust/WASM hybrid optimizer backend that owns large-batch candidate generation, mutation, evaluation, cache management, top-candidate tracking, and metrics.
- Preserve Huppermage gameplay rules exactly across the Rust port: costs, resources, runes, passives, cooldowns, deck limits, cast limits, damage rounding, turn transitions, and sustainable-cycle checks.
- Add a differential test harness that compares TypeScript and Rust simulation/evaluation over fixed fixtures, generated candidates, invalid plans, and seeded large batches.
- Expose a stable optimizer backend contract so the UI can choose TypeScript or Rust/WASM without depending on backend internals.
- Keep TypeScript as the canonical simulator until the differential suite proves Rust equivalence; only then plan a later migration where Rust becomes canonical and TypeScript remains the UI adapter.

## Capabilities

### New Capabilities
- `rust-wasm-hybrid-engine`: Rust/WASM backend for the hybrid optimizer and the differential validation required before it can become the default engine.

### Modified Capabilities
- `combo-optimizer`: Optimizer results can be produced by selectable TypeScript or Rust/WASM backends while preserving the public result contract.
- `turn-simulation-engine`: Gameplay simulation semantics must be reproducible by the Rust/WASM engine and verified against the TypeScript simulator before Rust-backed optimizer results are trusted.

## Impact

- Affected code: `src/core/optimizer`, `src/core/simulation`, `scripts/benchmark-hybrid.ts`, future Rust crate under `rust/optimizer-wasm`, and test infrastructure.
- API impact: add an internal backend selection layer while preserving existing optimizer result shapes for UI callers.
- Build impact: add Rust/WASM build tooling and generated WASM artifacts to the local development and CI workflow.
- Risk: gameplay divergence between TypeScript and Rust. The mitigation is a staged differential test suite with TypeScript as the oracle until equivalence is demonstrated.
