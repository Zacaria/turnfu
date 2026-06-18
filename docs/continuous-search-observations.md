# Continuous Search Observations

The detailed observation log has been split into chronological files for context management.
Filenames start with date-hour sequence prefixes so the research thread sorts in thinking order.

See [continuous-search-algorithm.md](continuous-search-algorithm.md) for the
current Continuous architecture and validation contract.

## Chronological Log

- [2026-06-17-00-validation-and-early-failures.md](continuous-search-observations/2026-06-17-00-validation-and-early-failures.md) - Validation And Early Failures
- [2026-06-17-01-score-aware-resource-and-repair.md](continuous-search-observations/2026-06-17-01-score-aware-resource-and-repair.md) - Score-Aware Resource And Repair
- [2026-06-17-02-motifs-reuse-and-offline-policy.md](continuous-search-observations/2026-06-17-02-motifs-reuse-and-offline-policy.md) - Motifs Reuse And Offline Policy
- [2026-06-17-03-oracle-contrast-and-contextual-swaps.md](continuous-search-observations/2026-06-17-03-oracle-contrast-and-contextual-swaps.md) - Oracle Contrast And Contextual Swaps
- [2026-06-17-04-contextual-refinements-and-saturation.md](continuous-search-observations/2026-06-17-04-contextual-refinements-and-saturation.md) - Contextual Refinements And Saturation
- [2026-06-17-05-macro-splice-and-repair-failures.md](continuous-search-observations/2026-06-17-05-macro-splice-and-repair-failures.md) - Macro Splice And Repair Failures
- [2026-06-18-00-learned-loadout.md](continuous-search-observations/2026-06-18-00-learned-loadout.md) - Learned Loadout
- [2026-06-18-01-learned-action-set.md](continuous-search-observations/2026-06-18-01-learned-action-set.md) - Learned Action Set
- [2026-06-18-02-contextual-action-set-new-best.md](continuous-search-observations/2026-06-18-02-contextual-action-set-new-best.md) - Contextual Action Set New Best
- [2026-06-18-03-plateau-adaptive-entropy.md](continuous-search-observations/2026-06-18-03-plateau-adaptive-entropy.md) - Plateau-Adaptive Entropy

## Current Best

As of the latest entry, the strongest validated Rust/WASM continuous setting is learned loadout plus learned action-set plus contextual adjacent swaps plus plateau order-chain neighbors: `188558.81` reached by `3M` and held through `10M`, TypeScript oracle `5/5`.

The score record remains `188558.81`, but the validated time-to-record improved
materially from `10M` to `3M` on seed `learned-loadout-10m`.
