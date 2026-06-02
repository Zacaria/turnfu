# HANDOFF - Rust/WASM Hybrid Engine Port

Date: 2026-06-02

## Worktree

- Path: `/Users/zacariachtatar/game_repos/wakfu-turn-optimizer/.worktrees/codex/port-hybrid-engine-rust-wasm-handoff`
- Branch: `codex/port-hybrid-engine-rust-wasm-handoff`
- Active OpenSpec change: `port-hybrid-engine-to-rust-wasm`
- Current status at refresh: post-rebase sublimation integration in progress.
  The Rust/WASM backend is faster and revalidates final top candidates through
  TypeScript, but it is not yet merge-ready for `master` because the
  sublimation-enabled 100k smoke still scores below TypeScript and exposes a
  Puissance Brute scoring delta on some Rust-ranked candidates.

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
- Rebase onto `master` with the TypeScript sublimation engine integrated into
  Rust/WASM search transport, direct evaluation, and differential fixtures.
- Documentation and archived benchmark evidence.
- Verification pass before the latest Puissance Brute/replay investigation.

The UI no longer exposes a bounded progress bar for unbounded search sessions.
It stores optimizer workspace/session state in the SQLite-backed local API
instead of browser-only storage.

## Recent Commits

Most relevant recent commits after rebasing onto `master`:

- `9c44374 feat(optimizer): carry sublimations through rust wasm search`
  - Carries candidate `sublimationIds` through Rust/WASM request, search,
    resume-state, scoring, and final top-candidate transport.

- `e9d01d5 test(optimizer): archive rust wasm rollout benchmarks`
  - Archives 100k, 1M, 10M, and 100M benchmark evidence.
  - Records throughput, score, valid rate, cache, and memory metrics.
- `cc39b91 fix(optimizer): remove bounded progress from ui runs`
  - Replaces fixed progress with unbounded generation/evaluation counters.
- `d584611 feat(optimizer): persist ui state in sqlite`
  - Adds SQLite-backed local API routes for workspace and optimizer sessions.
- `2e56654 feat(optimizer): persist rust wasm search sessions`
  - Adds the resumable SQLite runner for long Rust/WASM searches.
- `26a6af0 docs(optimizer): document rust wasm parallel rollout`
  - Documents parallel backend usage, trust level, and limitations.
- `711da97 perf(optimizer): borrow rust search effects`
  - Ports the effective hybrid search behavior into the direct Rust path.

## Latest Validation Evidence

Latest verification after enabling supported sublimations in the benchmark
requests and correcting TypeScript multi-turn PW replay for Puissance Brute:

```bash
rtk pnpm test
rtk pnpm wasm:test
rtk pnpm diff:rust-wasm
rtk pnpm bench:hybrid -- --compare-backends --scenario t3-full --budget 100000 --seed smoke --no-build --no-oracle
rtk openspec validate port-hybrid-engine-to-rust-wasm --strict --no-interactive
rtk git diff --check
```

Results:

- TypeScript tests: 255 passed.
- Rust tests: 55 passed.
- CI differential: 94 fixtures, 102 generated candidates, 0 mismatches.
- OpenSpec strict validation: valid.
- Diff whitespace check: passed.
- `t3-full` 10k smoke with supported sublimations, no per-candidate oracle:
  - TypeScript: about `7.0k it/s`, score `137824.34`.
  - Rust/WASM: about `5.5k it/s`, TypeScript-verified score `149820.13`.
  - Final top candidate score delta `0`; diagnostic max delta remains non-zero
    on lower-ranked Puissance Brute candidates.
- `t3-full` 100k smoke with supported sublimations, no per-candidate oracle:
  - TypeScript: about `2.6k it/s`, score `165010.79`.
  - Rust/WASM: about `6.1k it/s`, TypeScript-verified score `164042.00`.
  - Rust/WASM keeps 50 unverified finalists for TypeScript revalidation, but
    still needs Puissance Brute scoring parity and/or better medium-budget
    search quality before this branch should merge.

Notes:

- `wasm-pack` / `wasm-bindgen` may write temporary files outside the sandbox, so
  `rtk pnpm diff:rust-wasm` can require escalated execution in Codex.
- Node dependency work must use `pnpm`, not `npm`.

## Archived Benchmark Evidence

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

Archived conclusion before the sublimation-enabled benchmark correction:

- Rust/WASM result quality was aligned for the archived no-sublimation rollout
  matrix.
- Direct Rust/WASM is faster than TypeScript, but not at the old simplified
  spike's x12 ratio.
- The parallel harness gives the useful speedup for long experimental runs.

## Post-Rebase Sublimation Notes

The branch has been rebased onto `origin/master`, which includes the TypeScript
sublimation engine. TypeScript remains the oracle. Rust/WASM now:

- accepts action-level context in candidate plans, including `criticalMode`;
- applies supported sublimation effective levels for initial stat/resource
  effects, per-action elemental bonuses, elemental carryover, Exces counters,
  Puissance Brute spent-resource bonuses, and AP/MP carryover;
- preserves fractional AP/MP/WP/BQ resources required by supported
  sublimations such as Devastation and Armure Lourde;
- mirrors TypeScript HP-assumption range overlap for threshold sublimations,
  including berserk effects that overlap the `normal` 21-89% assumption;
- reports global `invalidSublimation` candidate violations with the same
  normalized `actionIndex: -1` shape as TypeScript;
- keeps final Rust top candidates revalidated through TypeScript in no-oracle
  benchmark mode.
- asks Rust/WASM for a larger unverified finalist buffer in final-oracle mode,
  so TypeScript can choose the best verified candidates instead of trusting the
  first few Rust-ranked candidates blindly.

Known open issue:

- Puissance Brute should reduce base/max PW at combat start, not subtract PW
  again every turn. TypeScript combo replay now preserves carried PW by
  precompensating initial `wp` sublimation deltas before each replayed turn.
  Rust already carries PW without reapplying the malus.
- Some Rust-ranked Puissance Brute candidates still show non-zero score deltas
  after TypeScript revalidation. The best 10k Rust candidate is delta `0`, but
  the 100k Rust verified score remains below TypeScript. Fix this before
  calling the branch merge-ready.

If TypeScript gameplay rules, catalog entries, or supported sublimation effects
change again, reset incompatible persistent search sessions and re-run the
differential suite before trusting Rust/WASM results.

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
