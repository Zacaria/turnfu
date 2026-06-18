## Context

The continuous corpus has crossed the point where raw storage is no longer the
hard part. The failed exact-replay and naive neighbor-mutation experiments show
that evidence is only useful when it changes future candidate generation in a
measurable way.

## Decision

Introduce a small adaptive strategy selector before considering a neural guide.
The selector operates at mutation-strategy granularity, because current reuse
trials already record `strategy`, `source_score`, `result_score`, and
`improved_global_best`.

The policy is intentionally conservative:

- keep unseen strategies available for exploration;
- require a minimum number of scored trials before suppressing a strategy;
- suppress only when the strategy has no global-best wins and a negative
  source-relative average delta;
- rank surviving strategies by global-best rate, positive-delta rate, and
  average source-relative delta;
- keep final result correctness unchanged by treating selected candidates as
  Rust/WASM seed warmups only.

## Validation

Smoke tests may use smaller budgets to verify wiring, but search-quality
claims start at `1_000_000` matched attempts. If the adaptive policy fails to
improve final score or global-best trial improvements at 1M, the next proposal
should move to a neural or bandit policy/value guide with explicit labels and
validation splits.
