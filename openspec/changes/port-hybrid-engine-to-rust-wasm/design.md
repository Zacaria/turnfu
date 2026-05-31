## Context

The current hybrid optimizer is implemented in TypeScript and now supports long searches with a bounded evaluation cache, islanded search, elite neighborhoods, repair queues, and deterministic benchmarking. A Rust/WASM spike on a simplified batched kernel measured about a 12x speedup at 10M and 100M iterations, but it did not prove gameplay equivalence because it intentionally skipped the real Huppermage rules.

The port must therefore separate two concerns:

- gameplay semantics are fixed and must match the TypeScript simulator;
- search strategy can evolve if it still evaluates candidates with the same rules and returns the same public result contract.

TypeScript remains the oracle until the Rust differential suite proves equivalence across valid plans, invalid plans, multi-turn state transitions, scoring, and sustainability checks.

## Goals / Non-Goals

**Goals:**

- Add a full Rust/WASM backend for the hybrid optimizer, not only a per-candidate evaluator.
- Keep candidate generation, mutation, island loops, evaluation cache, top-candidate tracking, and metrics inside Rust for large batches.
- Preserve the existing TypeScript optimizer API shape so UI callers can switch backends without knowing implementation details.
- Build a differential test harness that compares TypeScript and Rust simulation/evaluation with deterministic fixtures and generated candidate batches.
- Make Rust eligible to become the canonical engine only after gameplay equivalence and long-run stability are proven.

**Non-Goals:**

- Do not remove the TypeScript simulator in this change.
- Do not require the Rust search strategy to produce the same candidate order as the TypeScript hybrid engine.
- Do not port unrelated UI state, saved-combo views, or catalog editing flows.
- Do not make Rust canonical until a follow-up change explicitly performs that migration.

## Decisions

### Use a backend adapter boundary

The TypeScript core will expose a stable optimizer backend boundary with at least two implementations: the existing TypeScript engine and a Rust/WASM engine. The adapter converts catalog, character, options, and progress requests into a backend-neutral request and converts backend results into the current optimizer result shape.

Alternative considered: call Rust only from the evaluator. This is lower risk, but it would keep search loops, cache churn, and top-candidate management in TypeScript and would likely lose much of the speedup to JS/WASM boundary overhead.

### Port gameplay before trusting search results

Rust will first implement the simulator/evaluator semantics needed by hybrid optimization: resource payment, Huppermage class state, passives, dynamic costs, effects, damage rounding, turn transitions, violations, scoring, and sustainability. Search improvements can happen after those semantics are covered by differential tests.

Alternative considered: port the search first and fill in gameplay behavior opportunistically. That would produce fast results earlier, but any result could be invalid or mis-scored without a reliable equivalence gate.

### Batch the Rust API

The Rust backend will run large chunks per WASM call. The API should accept a complete optimizer request and return progress snapshots, final candidates, and compact metrics. Intermediate candidate evaluation should stay inside Rust.

Alternative considered: expose a one-candidate `evaluate()` WASM function. This is useful for debugging but not suitable as the main optimizer path because boundary overhead grows with iteration count.

### Differential tests use TypeScript as oracle

The differential suite will generate both fixed and seeded randomized cases, run the TypeScript simulator/evaluator and Rust backend on the same inputs, and compare normalized outputs. The suite should include invalid candidates and edge-state transitions, not only successful high-damage branches.

Alternative considered: compare only final optimizer scores. That misses rule drift because different search strategies can find different candidates while still using wrong gameplay semantics.

### Rust search strategy may diverge

The Rust hybrid backend may change search internals, including island scheduling, mutation distributions, local refinement cadence, restart logic, and cache layout. It MUST evaluate every candidate with equivalent gameplay rules and MUST return the public optimizer contract with deterministic behavior for a fixed seed.

Alternative considered: force Rust to mirror the TypeScript algorithm line-by-line. That reduces initial comparison complexity but preserves TypeScript-specific data structures and limits the payoff of the port.

## Risks / Trade-offs

- Gameplay drift between TypeScript and Rust -> Mitigate with differential tests for fixed fixtures, generated batches, invalid plans, and multi-turn state snapshots before enabling Rust by default.
- WASM serialization overhead -> Mitigate by passing complete optimizer requests and returning compact summaries rather than crossing the boundary per candidate.
- Rust implementation complexity -> Mitigate by porting in vertical slices: catalog encoding, one-turn simulation, combo simulation, scoring, then hybrid search.
- Debuggability loss -> Mitigate by keeping TypeScript oracle traces and Rust debug traces for mismatches, including first divergent action, resources, class state, damage, and violation fields.
- Build friction -> Mitigate with explicit scripts for Rust build, WASM generation, benchmark runs, and differential tests.

## Migration Plan

1. Add Rust/WASM build scaffolding and a backend adapter that is disabled by default.
2. Port catalog and request encoding so TypeScript can pass normalized optimizer inputs into Rust deterministically.
3. Port one-turn simulation semantics and differential-test it against TypeScript fixtures.
4. Port combo simulation, scoring, sustainability, and invalid-candidate reporting.
5. Port the hybrid batch search and expose Rust progress/final result summaries through the backend adapter.
6. Benchmark TypeScript vs Rust on 100k, 1M, 10M, and selected 100M scenarios.
7. Enable Rust as an experimental backend for long runs once differential tests and benchmarks pass.
8. In a later change, decide whether Rust becomes canonical and TypeScript remains only the UI adapter.

Rollback is straightforward while TypeScript remains the default backend: disable the Rust backend selection and keep using the existing TypeScript engine.

## Open Questions

- Which generated WASM artifacts should be committed versus rebuilt locally?
- What numeric tolerance is acceptable for floating-point damage comparison? The default should be exact at the current two-decimal rounded outputs, with any exception documented per field.
- How large should CI differential batches be versus local soak batches?
