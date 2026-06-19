# Global Validity Guidance Design

## Context

Continuous Rust/WASM search has become hard to improve by simply scaling more
attempts or narrowing the catalog further. The current validated preset is:

```text
--resource-aware-fresh-chance 1
--learned-loadout-prior
--learned-action-set-prior
--contextual-adjacent-swaps
--plateau-order-chain-neighbors
--plateau-trigger-rounds 1
```

Previous observations show that exact replay, broad seed warmups, post-hoc
repair, macro splicing, and rigid per-turn priors often increase short-run
cleanliness while hurting scaled search quality. The next improvement should
therefore increase full-candidate validity without removing any spell, passive,
or sublimation from the explorable space.

## Goal

Improve the global valid rate of fully generated candidates in the continuous
optimizer while preserving exact simulator validation, oracle checks, and the
full intended gameplay search space.

This design optimizes validity over the whole candidate, not only the first
violation encountered.

## Non-Goals

- Do not remove additional spells, passives, or sublimations from the search
  space.
- Do not replace exact simulator scoring or TypeScript oracle validation.
- Do not promote a policy based only on sub-1M smoke results.
- Do not treat higher valid rate as sufficient if scaled score or diversity
  collapses.
- Do not expose a new UI control for this policy in the first iteration.

## Decision

Add a default-on global validity guidance policy to the existing
`validated-contextual` continuous preset.

The policy changes proposal probabilities during candidate construction. It
does not make any currently available action impossible. A CLI/script-level
disable switch may exist for matched A/B validation, but normal UI-driven runs
should receive the policy automatically through the existing preset.

```text
validated-contextual preset
      |
      v
learned loadout/action-set + contextual swaps + plateau order-chain
      |
      v
global validity guidance
      |
      v
Rust/WASM candidate construction
      |
      v
exact simulator scoring and TypeScript oracle
```

## Components

### GlobalValidityState

Tracks an approximate construction-time state for a candidate:

- AP, MP, WP, BQ, and other relevant resources;
- per-turn cast limits and cooldown pressure;
- useful Huppermage runes or states when available to the generator;
- remaining action slots and rough future resource capacity.

This state is advisory. If it disagrees with exact simulation, exact simulation
wins.

### ActionFeasibilityScorer

Scores possible next actions from the current construction prefix. The score
should consider:

- immediate affordability and cast legality;
- resource scarcity and resource production;
- whether the action makes the remaining suffix more likely to fail;
- whether the action preserves useful diversity instead of only exploiting the
  current most common pattern.

The scorer must not encode another hard catalog reduction.

### ValidityGuidedSampler

Applies feasibility scores using a weighted lottery. Every action still has a
non-zero minimum probability when it belongs to the active search space.

The sampler should also preserve a configured share of full-space or current
sampler behavior so higher validity does not become deterministic convergence.

## Candidate Flow

```text
start candidate
      |
      v
for each turn/action slot:
  read GlobalValidityState
  score available actions
  sample with minimum non-zero probability
  update advisory state
      |
      v
complete candidate
      |
      v
exact simulator and oracle validation
```

Post-hoc repair remains separate. This design avoids relying on repairs because
previous repair variants often tied or lost at matched gates.

## Metrics

Checkpoint and streamed summaries should expose enough information to confirm
the policy is active and not silently narrowing the search:

- total guided candidates;
- guided valid rate for full candidates;
- overall valid rate;
- candidate counts and valid rates by proposal family where available;
- fallback or unguided mix share;
- simple diversity telemetry, such as spell-set diversity, action-count pattern
  diversity, or plan-signature diversity among evaluated or top candidates.

The primary success metric is full-candidate valid rate. First-violation counts
remain useful diagnostics but are not the objective.

## Validation Gates

### 200k Smoke

Purpose: wiring only.

Requirements:

- global validity guidance is active by default in `validated-contextual`;
- disable switch works for A/B runs;
- new metrics appear in summaries or checkpoints;
- top candidates remain TypeScript-oracle valid.

No search-quality conclusion may be drawn from this gate.

### Matched 1M Gate

Compare against the current `validated-contextual` preset with the same
scenario, seed, worker count, chunk size, and round count.

Requirements:

- full-candidate valid rate improves over baseline;
- top candidates remain TypeScript-oracle valid;
- final simulator-backed score does not show a severe regression;
- diversity telemetry does not collapse relative to baseline.

### Matched 5M/10M Gate

Purpose: catch false positives like prior 1M-only wins.

Requirements:

- full-candidate valid rate remains above baseline;
- final score is comparable or better;
- time-to-current-record does not materially regress;
- contextual and plateau proposal streams are not displaced by invalid or
  over-concentrated guided candidates;
- no additional catalog restriction is introduced.

## Rejection Criteria

Reject or disable the policy by default if:

- valid rate improves but scaled score drops materially;
- diversity collapses into a small number of repeated plan signatures;
- the policy behaves like a rigid per-turn prior;
- guided construction displaces contextual or plateau order-chain behavior that
  is already proven useful;
- exact oracle validation starts rejecting top candidates.

## Implementation Boundary

The likely integration path is the continuous Rust/WASM candidate construction
path, with TypeScript orchestration enabling it through the existing
`validated-contextual` preset. UI changes are intentionally out of scope except
for displaying already-streamed metrics if the current workspace can show them
without a new control.
