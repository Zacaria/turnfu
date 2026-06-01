# HANDOFF - Rust/WASM Hybrid Engine Port

Date: 2026-06-02

## Worktree

- Path: `/Users/zacariachtatar/game_repos/wakfu-turn-optimizer/.worktrees/codex/port-hybrid-engine-rust-wasm-handoff`
- Branch: `codex/port-hybrid-engine-rust-wasm-handoff`
- Active OpenSpec change: `port-hybrid-engine-to-rust-wasm`
- Current status at refresh: clean before this handoff update

This worktree is intentionally separate from the main checkout. Do not touch the
main checkout at `/Users/zacariachtatar/game_repos/wakfu-turn-optimizer`.

Use `rtk` before manual shell commands in Codex. Use `pnpm` for Node dependency
work. Keep this worktree's `node_modules` isolated.

## Current Direction

TypeScript remains the gameplay oracle. Rust/WASM owns large-search execution
only when its business rules have been checked against TypeScript.

Current policy:

- Small validation runs can use per-candidate TypeScript oracle checks.
- Large Rust/WASM runs can run without per-candidate oracle checks.
- Rust top candidates from large runs must remain revalidable through
  TypeScript before being trusted.
- Rust/WASM remains an opt-in experimental backend.

## Completed State

The OpenSpec task list for `port-hybrid-engine-to-rust-wasm` is complete:

- Backend boundary and adapter routing.
- Rust/WASM crate, serialization, and benchmark scripts.
- Gameplay parity for supported optimizer scenarios.
- Differential fixture and generated-candidate validation.
- Direct Rust hybrid search loop with warmup/ranking, repair and elite queues,
  local refinement, restarts/immigrants, direct evaluator cache, and metrics.
- Parallel Rust/WASM benchmark harness.
- SQLite-backed persistent search sessions and UI workspace/session state.
- Documentation and archived benchmark evidence.
- Full verification pass.

The UI no longer exposes a bounded progress bar for unbounded search sessions.
It stores optimizer workspace/session state in the SQLite-backed local API
instead of browser-only storage.

## Recent Commits

Most relevant recent commits before rebasing onto `master`:

- `6f534db test(optimizer): archive rust wasm rollout benchmarks`
  - Archives 100k, 1M, 10M, and 100M benchmark evidence.
  - Records throughput, score, valid rate, cache, and memory metrics.
- `c966d25 fix(optimizer): remove bounded progress from ui runs`
  - Replaces fixed progress with unbounded generation/evaluation counters.
- `8d6026d feat(optimizer): persist ui state in sqlite`
  - Adds SQLite-backed local API routes for workspace and optimizer sessions.
- `6277481 feat(optimizer): persist rust wasm search sessions`
  - Adds the resumable SQLite runner for long Rust/WASM searches.
- `ce8f2fb docs(optimizer): document rust wasm parallel rollout`
  - Documents parallel backend usage, trust level, and limitations.
- `32af927 perf(optimizer): borrow rust search effects`
  - Ports the effective hybrid search behavior into the direct Rust path.

## Validation Evidence

Latest completed verification before the sublimations rebase:

```bash
rtk pnpm test
rtk pnpm wasm:test
rtk pnpm diff:rust-wasm
rtk pnpm diff:rust-wasm:soak
rtk openspec validate port-hybrid-engine-to-rust-wasm --strict --no-interactive
rtk git diff --check
```

Results:

- TypeScript tests: 205 passed.
- Rust tests: 55 passed.
- CI differential: 91 fixtures, 24 generated candidates, 0 mismatches.
- Soak differential: 98 fixtures, 1024 generated candidates, 0 mismatches.
- OpenSpec strict validation: valid.

Notes:

- `wasm-pack` / `wasm-bindgen` may write temporary files outside the sandbox, so
  `rtk pnpm diff:rust-wasm` can require escalated execution in Codex.
- Node dependency work must use `pnpm`, not `npm`.

## Benchmark Evidence

Archived files live in `docs/benchmarks/`.

Representative results:

- `t3-full`, 1M, direct Rust/WASM no-oracle:
  - TypeScript: about `7.4k it/s`, score `103545.66`.
  - Rust/WASM direct: about `12.2k it/s`, score `103545.66`.
  - Top Rust candidates revalidated in TypeScript with score delta `0`.
- `t3-full`, 10M, Rust/WASM parallel:
  - Throughput about `79.7k it/s`.
  - Score `103545.66`.
  - Top 5 revalidated in TypeScript with max score delta `0`.
- `t3-full`, 100M, Rust/WASM parallel:
  - Throughput about `97.2k it/s`.
  - Score `103545.66`.
  - Valid rate about `0.3736`.
  - Evaluator cache limit `400000`.
  - Parent RSS about `329 MB`.
  - Peak worker RSS about `1012 MB`.
  - Top 5 revalidated in TypeScript with max score delta `0`.

Conclusion:

- Rust/WASM result quality is aligned for the archived rollout matrix.
- Direct Rust/WASM is faster than TypeScript, but not at the old simplified
  spike's x12 ratio.
- The parallel harness gives the useful speedup for long experimental runs.

## Rebase On Master

The branch is being rebased onto `origin/master`, which includes the TypeScript
sublimation engine work. After the rebase:

1. Inspect the sublimation rules now present in TypeScript.
2. Port the supported sublimation rules into Rust/WASM where needed.
3. Keep TypeScript as the oracle and expand differential coverage for the new
   rules.
4. Re-run the validation suite and commit the integration in coherent slices.

## Commands To Resume

```bash
cd /Users/zacariachtatar/game_repos/wakfu-turn-optimizer/.worktrees/codex/port-hybrid-engine-rust-wasm-handoff
rtk git status --short --branch
rtk pnpm wasm:test
rtk pnpm diff:rust-wasm
rtk pnpm diff:rust-wasm:soak
rtk pnpm test
rtk openspec validate port-hybrid-engine-to-rust-wasm --strict --no-interactive
```
