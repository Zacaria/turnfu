# Constraint Path Discovery

This change adds an opt-in discovery layer for optimizer experiments. The layer is intentionally separate from final scoring:

- discovery score highlights rare or enabling states;
- final score remains simulator-backed damage or sustainable-cycle score;
- motif and curriculum candidates are search hints only;
- every final candidate still passes exact simulation.

## What Discovery Records

Discovery-enabled runs record compact descriptors for evaluated candidates:

- valid/invalid status;
- action, turn, passive, and sublimation counts;
- final resources and Huppermage class state;
- affordances such as `bq-ready`, `rune-cycle`, `long-plan`, and `sustainable`;
- violation boundary categories such as `resourceDebt`, `cooldownLock`, `missingTarget`, and `classStateGate`;
- separate discovery score and reasons.

## Hybrid Integration

The hybrid engine can use discovery data in three bounded ways:

- mine repeated useful state/action patterns as motifs;
- queue motif-derived seeds back into hybrid search;
- sample curriculum candidates for intermediate goals such as BQ generation, rune cycling, valid long plans, sustainable loops, and conditional unlocks.

These sources never bypass simulation, cache evaluation, pruning, repair limits, or final ranking.

## Benchmarking

Budgets below `1_000_000` attempts are smoke checks only. They are useful for
validating wiring, telemetry, and oracle safety, but they are not meaningful
search-quality evidence.

Compare baseline and discovery-guided hybrid runs with at least 1M attempts:

```bash
rtk pnpm bench:hybrid -- --scenario t2-a8-p2 --budget 1000000 --seed a,b,c,d,e --compare-discovery
```

Run only discovery mode with:

```bash
rtk pnpm bench:hybrid -- --scenario t3-a12-p3 --budget 1000000 --seed a,b,c,d,e --discovery
```

## Initial Local Evidence

Historical smoke check on this branch:

```bash
rtk pnpm bench:hybrid -- --scenario t2-a8-p2 --budget 100 --seed a --compare-discovery
```

Result summary:

| Mode | Score | Valid rate | Notes |
| --- | ---: | ---: | --- |
| Baseline | `93663.64` | `0.82` | Existing hybrid behavior and metrics only |
| Discovery | `93663.64` | `0.82` | Recorded 100 descriptors, 32 motifs, 11 motif seed candidates, 18 boundary samples |

This is a smoke check, not a benchmark for search quality. The useful signal is
that discovery mode preserves final score/ranking while exposing the new search
telemetry. Treat 1M attempts as the minimum budget before deciding whether
discovery guidance improves score per iteration.

## Neural Guidance Gate

Neural policy/value guidance remains out of scope for this change. Consider a follow-up only if:

- discovery-guided benchmarks plateau;
- a large corpus of simulator-evaluated candidates exists;
- descriptors and motifs show predictive value;
- a learned guide can beat the heuristic discovery baseline under the same exact final oracle.

See `docs/continuous-search-observations.md` before proposing neural guidance.
It records the failed promoted-seed and neighbor-trial reuse experiments that a
learned guide must improve on.
