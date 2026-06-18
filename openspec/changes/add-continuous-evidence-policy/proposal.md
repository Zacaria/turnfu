## Why

Continuous Rust/WASM search now stores useful evidence: exact candidate
evaluations, checkpoints, motifs, and labeled reuse-trial outcomes. The last
validation showed that storing evidence and naively replaying neighbor
mutations does not improve final simulator-backed score. The corpus needs to
affect future generation choices directly.

## What Changes

- Add an adaptive continuous evidence policy that summarizes
  `continuous_reuse_trials` by mutation strategy.
- Suppress mutation strategies whose scored trials consistently underperform
  their source candidate and do not produce global-best improvements.
- Prioritize strategies that have produced global-best improvements or
  positive source-relative score deltas.
- Report the policy decision in continuous search summaries so A/B runs can
  explain why reuse was applied or skipped.
- Keep all reused candidates as simulation hints only; final ranking remains
  exact simulator-backed and TypeScript-oracle validated.

## Impact

- Affected code: `scripts/continuous-search-store.ts`,
  `scripts/search-rust-wasm-sqlite.ts`, continuous search tests, and
  continuous search documentation.
- Search impact: `--reuse-trials` becomes evidence-gated instead of blindly
  sampling all handcrafted mutation families.
- Validation impact: quality claims still require matched runs with at least
  `1_000_000` attempts.
