## Contextual Adjacent Swap Rule-Set Refinement

Hypothesis: the kept contextual adjacent-swap rule set might be too broad. The
offline contrast-pair evidence showed that the strongest single rule,
`turn-pair:3:debacle>orbes-luisants`, had higher average source-relative delta
than the current online ordered-pair selector. Narrowing the online selector to
that rule could reduce weaker swap noise and make the 1M score lift more
repeatable.

Offline implementation: extend `pnpm contrast-pairs:search` with adjacent
swap rule-set summaries. The evaluated rule sets were:

- `current-online`: `pair:debacle>orbes-luisants` plus
  `pair:orbes-luisants>halo-chatoyant`;
- `turn3-debacle-orbes`: only `turn-pair:3:debacle>orbes-luisants`;
- `debacle-orbes-only`: `pair:debacle>orbes-luisants`;
- `right-orbes`: any swap whose right spell is `orbes-luisants`;
- `current-plus-right-orbes`: current rules plus `right:orbes-luisants`.

Broad offline rule-set pass across the same ten recent 1M/10M databases, top
`10` sources per DB, `128` variants per source:

| Rule set | Valid | Positive | Global-best | DBs with valid | Positive rate | Global-best rate | Average delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| all `swap-adjacent-actions` | `1190` | `280` | `86` | `10` | `0.2353` | `0.0723` | `-931.22` |
| `current-online` | `270` | `261` | `86` | `9` | `0.9667` | `0.3185` | `+481.33` |
| `turn3-debacle-orbes` | `90` | `90` | `41` | `9` | `1.0000` | `0.4556` | `+1100.49` |
| `debacle-orbes-only` | `180` | `171` | `67` | `9` | `0.9500` | `0.3722` | `+686.98` |
| `right-orbes` | `280` | `171` | `67` | `10` | `0.6107` | `0.2393` | `+432.65` |
| `current-plus-right-orbes` | `370` | `261` | `86` | `10` | `0.7054` | `0.2324` | `+344.44` |

Per-DB read:

- `turn3-debacle-orbes` was positive in all `90 / 90` valid examples and had
  worst per-DB average delta `+1083.10`;
- `current-online` had a lower average delta but more coverage, with worst
  per-DB positive rate `0.9333`;
- `right-orbes` and `current-plus-right-orbes` both failed on
  `resource-aware-100-10m`, producing `0 / 10` positives and average delta
  `-251.54`.

Online refinement test: temporarily narrow `--contextual-adjacent-swaps` to
only `turn-pair:3:debacle>orbes-luisants`, then validate on the repeat seed
where the broader selector tied. Baseline reused the existing matched
`contextual-swap-default-repeat-1m` run because the contextual flag is off and
the baseline path is unchanged.

200k smoke on `t3-full`, seed `contextual-narrow-smoke`, workers `2`, chunk
size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--contextual-adjacent-swaps`:

| Round | Final score | Valid rate | Contextual neighbors | Oracle |
| ---: | ---: | ---: | ---: | --- |
| 1 | `172523.85` | `0.3099` | `115` | top 5 valid |
| 2 | `178637.26` | `0.3424` | `147` | top 5 valid |

Matched 1M validation on `t3-full`, seed `contextual-swap-repeat-1m`, workers
`10`, chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final round valid rate | Contextual neighbors | Final round throughput | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `172645.83` | `178865.36` | `0.3390` | `0` | `8408.08 it/s` | top 5 valid |
| Narrow contextual rule | `172645.83` | `178865.36` | `0.3397` | `736` | `8243.70 it/s` | top 5 valid |

Conclusion: reject the narrowed online rule. Despite excellent offline
source-relative precision, narrowing did not improve final 1M score and had
lower final-round validity than the broader contextual selector on the same
seed (`0.3397` vs `0.3432`). The source was restored to the broader
`current-online` rule set. Keep the offline rule-set evaluator because it
clearly rejects over-broad `right-orbes` variants and can guide a future
adaptive selector, but do not replace the current online opt-in with the narrow
rule.

## Contextual Adjacent Swap Direct Telemetry

Hypothesis: before building an adaptive contextual-swap selector, the continuous
Rust/WASM search needs direct telemetry showing whether contextual neighbors are
only enqueued or actually evaluated, valid, island-improving, and previous-best
improving. Without this, an adaptive backoff policy would be guessing.

Implementation: label contextual adjacent-swap neighbor candidates internally
and report separate summary fields:

- `evaluatedContextualAdjacentSwapCandidates`;
- `validContextualAdjacentSwapCandidates`;
- `islandImprovedContextualAdjacentSwapCandidates`;
- `globalImprovedContextualAdjacentSwapCandidates`.

These labels are excluded from the existing seed-warmup metric counters so that
trial/motif warmup telemetry remains distinct from neighbor telemetry.

200k smoke on `t3-full`, seed `contextual-telemetry-smoke`, workers `2`, chunk
size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--contextual-adjacent-swaps`:

| Round | Score | Valid rate | Enqueued contextual neighbors | Evaluated | Valid | Island-improved | Previous-best improved | Oracle |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | `171155.18` | `0.3044` | `327` | `201` | `201` | `1` | `201` | top 5 valid |
| 2 | `177492.45` | `0.3341` | `417` | `346` | `346` | `1` | `18` | top 5 valid |

Read: the wiring works, and round-two telemetry is the useful signal because it
compares against an existing persisted best. First-round previous-best
improvement is expected to count every valid contextual candidate because a
reset run has no previous persisted best yet.

Conclusion: keep the telemetry. This is not search-quality evidence by itself,
but it gives the next hypothesis the required direct signal to test adaptive
contextual-swap throttling or selection without conflating neighbor behavior
with seed warmups.

## Adaptive Contextual Swap Backoff

Hypothesis: contextual adjacent swaps should be enabled only after a previous
meaningful round proves they are still producing previous-best improvements.
If a round evaluates enough contextual swaps but none beat the previous
persisted best, the next round should disable contextual swaps and spend the
elite-neighbor budget elsewhere.

Temporary implementation: add `--contextual-adjacent-swap-policy adaptive` on
top of `--contextual-adjacent-swaps`. The policy ignored the first reset round
because there is no persisted previous best yet. From later rounds, it kept
contextual swaps enabled if evaluated contextual swaps were below the evidence
threshold or if at least one evaluated contextual swap beat the previous
persisted best.

300k smoke on `t3-full`, seed `contextual-adaptive-smoke`, workers `2`, chunk
size `50_000`, max rounds `3`, `--resource-aware-fresh-chance 1`,
`--contextual-adjacent-swaps --contextual-adjacent-swap-policy adaptive`:

| Round | Score | Contextual enabled | Evaluated | Valid | Island-improved | Previous-best improved | Oracle |
| ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| 1 | `174155.55` | yes | `201` | `201` | `2` | `201` | top 5 valid |
| 2 | `178238.63` | yes | `316` | `314` | `8` | `12` | top 5 valid |
| 3 | `179451.72` | yes | `305` | `302` | `25` | `4` | top 5 valid |

Smoke read: the policy wiring worked, but it did not back off because the
meaningful prior round had previous-best improvements.

Matched 1.5M validation on `t3-full`, seed `contextual-adaptive-1m5`, workers
`10`, chunk size `50_000`, max rounds `3`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Score at 1M | Final score at 1.5M | Final round valid rate | Final round contextual enabled | Final round previous-best contextual improvements | Oracle |
| --- | ---: | ---: | ---: | ---: | --- | ---: | --- |
| Always-on contextual swaps | `172097.47` | `177492.45` | `180661.07` | `0.3369` | yes | `12` | top 5 valid |
| Adaptive contextual swaps | `172097.47` | `177492.45` | `180661.07` | `0.3369` | yes | `12` | top 5 valid |

Conclusion: kill the adaptive backoff implementation. It tied always-on exactly
because the direct telemetry showed contextual swaps were still producing
previous-best improvements in every meaningful round, so the backoff condition
never triggered. Keeping the option would add dead weight without improving
search quality. The temporary CLI policy was removed; keep only the direct
contextual-neighbor telemetry.

## Weighted Action Completion And Replacement

Hypothesis: top candidates might plateau because a turn is locally
under-completed or because one action can be replaced by a higher-priority
spell. Before changing online Rust/WASM neighbor priority, test the family
offline by extending `pnpm contrast-pairs:search -- --action-edits` to generate
exact-scored variants:

- `append-weighted-action`: append one of the highest Rust-style weighted spell
  actions to any underfilled turn;
- `replace-with-weighted-action`: replace each existing action with one of the
  highest Rust-style weighted spell actions.

Success gate: the family needed positive source-relative deltas, non-trivial
validity, and at least one context with positive/global-best signal across the
same multi-database evidence style used for adjacent swaps. A wiring smoke on
one database was allowed below 1M because this was an offline diagnostic, not a
search-quality claim.

5-source smoke on `resource-aware-100-1m`, top `5` sources,
`80` variants/source:

| Strategy | Generated | Valid | Positive | Global-best | Average delta |
| --- | ---: | ---: | ---: | ---: | ---: |
| `append-weighted-action` | `120` | `0` | `0` | `0` | `0` |
| `replace-with-weighted-action` | `140` | `0` | `0` | `0` | `0` |

Broad offline gate across ten recent `1M`/`10M` databases, top `10` sources per
DB, `256` variants/source:

| Strategy | Generated | Valid | Positive | Global-best | Valid rate | Positive rate | Average delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `append-weighted-action` | `2400` | `0` | `0` | `0` | `0` | `0` | `0` |
| `replace-with-weighted-action` | `18706` | `1526` | `0` | `0` | `0.0816` | `0` | `-20469.07` |

Conclusion: reject this as an online search mechanism. Weighted append is
structurally invalid on the sampled top candidates, and weighted replacement is
occasionally valid but consistently score-destructive. Do not prioritize
weighted action completion/replacement in Rust/WASM without a new affordability
or source-relative selector that changes the mechanism.

Implementation note: action edits are kept behind the opt-in diagnostic flag
`--action-edits` so they do not consume the default adjacent-swap contrast
budget.

## Plan Turn And Suffix Grafting

Hypothesis: instead of editing individual actions, recombine whole validated
turns or suffixes from other high-scoring candidates. This tests whether the
continuous corpus contains reusable partial plans that can compound into better
full combos before adding any online Rust/WASM seed prioritization.

Offline implementation: extend `pnpm contrast-pairs:search -- --plan-grafts`
with two exact-scored variant families:

- `graft-single-turn`: replace one turn with the same-index turn from another
  top scored candidate in the same database;
- `graft-turn-suffix`: keep the prefix and replace the remaining turns with a
  donor suffix from another top scored candidate.

Success gate: broad grafting needed either a positive average source-relative
delta in a stable context or direct session-best/global-best improvements. Rare
positive deltas were not enough, because online seed warmups already failed
when they produced source-relative positives without moving the final score.

Small smoke on `resource-aware-100-1m`, top `5` sources,
`120` variants/source, `--plan-grafts`:

| Strategy | Generated | Valid | Positive | Global-best | Average delta |
| --- | ---: | ---: | ---: | ---: | ---: |
| `graft-single-turn` | `13` | `13` | `0` | `0` | `-1336.83` |
| `graft-turn-suffix` | `43` | `43` | `0` | `0` | `-1293.31` |

Broad offline gate across ten recent `1M`/`10M` databases, top `10` sources per
DB, `256` variants/source, `--plan-grafts`:

| Strategy | Generated | Valid | Positive | Global-best | Valid rate | Positive rate | Average delta | Best delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `graft-single-turn` | `204` | `204` | `12` | `0` | `1` | `0.0588` | `-217.74` | `3440.23` |
| `graft-turn-suffix` | `708` | `708` | `25` | `0` | `1` | `0.0353` | `-37.30` | `3440.23` |

Read: grafting is valid-by-construction in practice, and there are rare
source-relative positives, but the signal is too sparse and never improves the
session best. The best deltas repeated the same sub-best candidate pattern and
did not create global-best evidence.

Conclusion: do not promote broad turn/suffix grafting to online Rust/WASM seed
prioritization. A future grafting hypothesis would need a sharper selector that
predicts the rare positive cases and proves global-best recall offline.
Implementation remains an opt-in contrast diagnostic via `--plan-grafts`.

## Held-Out Adjacent-Swap Context Selection

Hypothesis: the contextual adjacent-swap rule set should be selected from
continuous evidence instead of hand-picked. A leave-one-database-out selector
could train on source-relative adjacent-swap contexts from all other databases
and evaluate the selected context union on the held-out database. If it beats
the current online rule set offline, then it may justify a sharper online
Rust/WASM selector.

Offline implementation: extend `pnpm contrast-pairs:search` with an internal
per-variant adjacent-swap evaluation table and a held-out context-policy
summary. Each fold trains on all but one database, selects up to four contexts
with enough valid support, positive average delta, positive global-best rate,
and high positive rate, then compares the selected union against
`current-online`.

Broad offline gate across ten recent `1M`/`10M` databases, top `10` sources per
DB, `256` variants/source:

| Policy | Generated | Valid | Positive | Global-best | Valid rate | Positive rate | Global-best rate | Average delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Held-out selected contexts | `300` | `180` | `155` | `58` | `0.6000` | `0.8611` | `0.3222` | `479.53` |
| `current-online` | `260` | `240` | `235` | `72` | `0.9231` | `0.9792` | `0.3000` | `488.13` |

Lift versus `current-online`:

- positive rate: `-0.1181`;
- valid rate: `-0.3231`;
- average delta: `-8.60`;
- absolute global-best count: `-14`;
- global-best rate: `+0.0222`.

Read: the broad selector optimized rate by selecting fewer candidates, but it
lost absolute global-best recall and average delta. Worse, the selected context
set repeatedly included broad structural contexts such as `turn-slot:3:6` and
`left:debacle`. Both `10M` holdouts exposed this as a miss: selected candidates
had average delta `-1261.75` with zero positives, while the current online rule
set had no valid candidates on those holdouts.

Conclusion: do not promote the broad held-out selector online. It is a useful
diagnostic because it reveals context leakage: broad structural keys can look
good on many `1M` corpora but fail on stronger `10M` holdouts. The next
selector must restrict itself to action-identity contexts such as ordered pairs
and turn-specific ordered pairs before any online Rust/WASM integration.

Refinement: restrict the held-out selector to action-identity contexts only:
`pair:*` and `turn-pair:*`. This avoids broad structural keys such as slots,
left spell, and right spell.

Identity-only held-out result on the same ten databases:

| Policy | Generated | Valid | Positive | Global-best | Valid rate | Positive rate | Global-best rate | Average delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Identity-only selected contexts | `260` | `240` | `235` | `72` | `0.9231` | `0.9792` | `0.3000` | `488.13` |
| `current-online` | `260` | `240` | `235` | `72` | `0.9231` | `0.9792` | `0.3000` | `488.13` |

Conclusion: the identity-only selector is safe but not an improvement. Its
selected contexts collapse to the same effective candidate union as the current
online ordered-pair rule set, so it does not justify an online Rust/WASM change
or a matched `1M` A/B.

## Resource-Aware Turn Saturation

Hypothesis: top exact candidates in recent `1M` and `10M` corpora consistently
use `8,8,8` actions, while the resource-aware fresh sampler chooses a random
target action count between roughly `55%` and `100%` of the maximum. An opt-in
saturating variant might improve proposal relevance by continuing each
resource-aware turn until no affordable action remains.

Corpus read before implementation:

| Database sample | Top-10 action-count pattern |
| --- | --- |
| `resource-aware-100-1m` | `8,8,8` for all top 10 |
| `resource-aware-default-1m` | `8,8,8` for all top 10 |
| `resource-aware-100-10m` | `8,8,8` for all top 10 |
| `resource-aware-default-10m` | `8,8,8` for all top 10 |
| `contextual-swap-default-1m` | `8,8,8` for all top 10 |
| `contextual-swap-variant-1m` | `8,8,8` for all top 10 |

Temporary implementation: add a Rust/WASM request flag and continuous CLI flag
`--resource-aware-saturate-turns`. When enabled, resource-aware fresh sampling
used `maxActionsPerTurn` as the target count and still stopped if no affordable
action remained. Final scoring and oracle validation were unchanged.

Matched 200k smoke on `t3-full`, seed `resource-aware-saturate-smoke`,
workers `2`, chunk size `50_000`, max rounds `2`,
`--resource-aware-fresh-chance 1`:

| Mode | Round 1 score | Final score at 200k | Final valid rate | Oracle |
| --- | ---: | ---: | ---: | --- |
| Baseline resource-aware | `169057.88` | `174529.31` | `0.3375` | top 5 valid |
| Saturated resource-aware | `167818.24` | `172789.51` | `0.2001` | top 5 valid |

Conclusion: kill the implementation before `1M`. The hypothesis was plausible
from top-candidate density, but saturation overfilled invalid or low-quality
turns and materially damaged validity and score in the wiring smoke. The
temporary flag was removed from Rust, TypeScript, the CLI, and rebuilt WASM.

## Resource-Aware Cooldown Tracking

Hypothesis: the resource-aware fresh sampler tracks per-turn cast limits and
soft resources, but not cross-turn spell cooldowns. Several high-value spells
have `cooldownTurns`, including `fleche-de-lumiere`, which appears in top
candidates only sparingly. An opt-in cooldown-aware sampler might improve
proposal relevance by avoiding fresh candidates that exact simulation rejects
for recasting cooldown spells too soon.

Temporary implementation: add a Rust/WASM request flag and continuous CLI flag
`--resource-aware-track-cooldowns`. When enabled, resource-aware fresh sampling
kept a soft cooldown map, applied cooldowns when a spell was selected, and aged
cooldowns at turn end with the same aging rule as the exact simulator. Final
scoring and oracle validation were unchanged.

Matched 200k smoke on `t3-full`, seed `resource-aware-cooldown-smoke`,
workers `2`, chunk size `50_000`, max rounds `2`,
`--resource-aware-fresh-chance 1`:

| Mode | Round 1 score | Final score at 200k | Final valid rate | Oracle |
| --- | ---: | ---: | ---: | --- |
| Baseline resource-aware | `173198.96` | `178364.06` | `0.3405` | top 5 valid |
| Cooldown-aware resource-aware | `172328.15` | `176532.71` | `0.4270` | top 5 valid |

Conclusion: kill the implementation before `1M`. Cooldown tracking improved
validity substantially, but it reduced final simulator-backed score in the
matched smoke. For this project, validity is useful only when it translates to
better proposals. The temporary flag was removed from Rust, TypeScript, the
CLI, and rebuilt WASM.
