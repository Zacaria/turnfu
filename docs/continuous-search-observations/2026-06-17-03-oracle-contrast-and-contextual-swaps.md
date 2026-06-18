## Oracle-Preselected Loadout Sweep

Hypothesis: blind one-hop loadout neighbors failed because they injected
source-negative proposals. A bounded loadout sweep could instead generate
multiple passive/sublimation replacements around top evidence candidates, score
them with the TypeScript oracle before injection, and seed only proposals with a
positive source-relative score delta. This directly creates contrast-pair
evidence and avoids spending Rust/WASM warmup slots on known-negative
candidates.

Temporary implementation: add `--oracle-loadout-trials` and
`--oracle-loadout-candidates-per-source`. Each round generated deterministic
passive/sublimation replacement variants from continuous candidate evidence,
kept only oracle-scored candidates with `score > sourceScore`, injected those as
seed warmups, and persisted the oracle score as reuse-trial `resultScore` when
Rust seed evaluation did not surface a score.

200k smoke on `t3-full`, seed `oracle-loadout-smoke`, workers `2`, chunk size
`50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--oracle-loadout-trials --oracle-loadout-candidates-per-source 96
--reuse-trials-per-worker 2`:

| Round | Final score | Valid rate | Oracle-selected trials | Evaluated trials | Valid trials | Island-improved trials | Global-best trials | Oracle |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | `172789.51` | `0.3103` | `0` | `0` | `0` | `0` | `0` | top 5 valid |
| 2 | `176523.04` | `0.3394` | `4` | `4` | `4` | `4` | `0` | top 5 valid |

Smoke persisted positive source-relative deltas:

| Strategy | Source score | Result score | Delta |
| --- | ---: | ---: | ---: |
| `oracle-replace-sublimation` | `170250.08` | `171362.37` | `+1112.29` |
| `oracle-replace-sublimation` | `170250.08` | `170679.78` | `+429.70` |
| `oracle-replace-sublimation` | `170250.08` | `170676.46` | `+426.38` |
| `oracle-replace-sublimation` | `169876.32` | `170042.89` | `+166.57` |

Matched 1M validation on `t3-full`, seed `oracle-loadout-1m`, workers `10`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final round valid rate | Oracle-selected trials | Evaluated trials | Global-best trials | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `172471.23` | `178518.50` | `0.3429` | `0` | `0` | `0` | top 5 valid |
| Oracle-preselected loadout sweep | `172471.23` | `178518.50` | `0.3429` | `0` | `0` | `0` | top 5 valid |

Conclusion: kill the oracle-preselected loadout sweep. It proved the contrast
pair idea can find positive source-relative proposals on a smoke seed, but the
matched 1M validation found no positive candidates to inject and tied the
baseline exactly. The mechanism is not reliable enough to keep as an online
knob. Future contrast-pair work should broaden beyond loadout replacement and
run as an offline dataset builder before online integration.

## Offline Contrast-Pair Generator

Hypothesis: instead of guessing online proposal families, run a bounded offline
contrast-pair generator over existing continuous candidate evidence. Generate
deterministic variants, score each variant with the exact TypeScript evaluator
against the exact TypeScript score of its source candidate, and only consider
online integration for families that produce repeated positive source-relative
and DB-best improvements.

Implementation: add `pnpm contrast-pairs:search`, which reads top valid
`continuous_candidate_evaluations` rows from one or more SQLite databases and
evaluates deterministic variants from these families:

- adjacent action swaps;
- action rotation;
- moving first/last actions across turns;
- dropping one action;
- passive replacement;
- sublimation replacement.

Smoke on `.optimizer/oracle-loadout-smoke.sqlite`, top `5` sources,
`64` variants per source:

| Strategy | Generated | Valid | Positive | DB-best | Positive rate | Best delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `swap-adjacent-actions` | `105` | `60` | `15` | `13` | `0.2500` | `+1121.27` |
| `drop-action` | `115` | `80` | `0` | `0` | `0.0000` | `-4136.54` |
| `replace-passive` | `60` | `32` | `0` | `0` | `0.0000` | `0.00` |
| `rotate-turn-actions` | `15` | `15` | `0` | `0` | `0.0000` | `-7905.08` |

Broad offline run across ten recent 1M/10M databases, top `10` sources per DB,
`128` variants per source:

| Strategy | Generated | Valid | Positive | DB-best | Positive rate | Best delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `swap-adjacent-actions` | `2100` | `1190` | `280` | `86` | `0.2353` | `+1121.27` |
| `replace-sublimation` | `203` | `156` | `2` | `2` | `0.0128` | `+67.49` |
| `drop-action` | `2310` | `1590` | `0` | `0` | `0.0000` | `-3850.31` |
| `replace-passive` | `7397` | `4912` | `0` | `0` | `0.0000` | `0.00` |
| `rotate-turn-actions` | `300` | `300` | `0` | `0` | `0.0000` | `-7549.48` |

Per-DB read: adjacent swaps produced positive variants in `9 / 10` databases;
the only miss was the stronger `resource-aware-100-10m` corpus. The broad
aggregate produced `282` positive variants and `88` DB-best variants overall.

Conclusion: this is the first offline gate in this thread that identifies a
specific proposal family with repeated positive source-relative and DB-best
evidence. It does not prove online search-quality improvement yet, but it
justifies one narrow online experiment: oracle-preselect adjacent action swaps,
inject only positive exact-scored variants as seed warmups, and validate with a
matched `>=1M` A/B before considering any scale-up.

## Oracle-Preselected Adjacent Swap Online Validation

Hypothesis: because the offline contrast-pair generator found adjacent action
swaps as the only repeatedly positive proposal family, an online variant could
score adjacent swaps with the exact TypeScript oracle, inject only
source-positive variants as Rust/WASM seed warmups, and improve final search
quality without replaying full promoted candidates.

200k smoke on `t3-full`, seed `oracle-swap-smoke`, workers `2`, chunk size
`50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--oracle-adjacent-swap-trials --reuse-trials-per-worker 2`:

| Round | Final score | Valid rate | Oracle-selected swaps | Evaluated trials | Valid trials | Global-best trials | Oracle |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | `172097.47` | `0.3200` | `0` | `0` | `0` | `0` | top 5 valid |
| 2 | `178613.71` | `0.3468` | `4` | `4` | `4` | `4` | top 5 valid |

Smoke persisted four exact source-positive adjacent swaps from `172097.47` to
`173180.57`, delta `+1083.10` each. That proved the online wiring and source
relative oracle filter worked.

Matched 1M validation on `t3-full`, seed `oracle-swap-1m`, workers `10`, chunk
size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final round valid rate | Oracle-selected swaps | Evaluated trials | Positive source deltas | Global-best trials | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `172523.85` | `178756.78` | `0.3453` | `0` | `0` | `0` | `0` | top 5 valid |
| Oracle-preselected adjacent swaps | `172523.85` | `178756.78` | `0.3434` | `19` | `18` | `19` | `6` | top 5 valid |

Persisted 1M source-relative evidence for `oracle-swap-adjacent-actions`:

| Trials | Evaluated | Positive deltas | Global-best trials | Average delta | Best delta |
| ---: | ---: | ---: | ---: | ---: | ---: |
| `19` | `19` | `19` | `6` | `+369.64` | `+1121.26` |

Conclusion: kill the online adjacent-swap seed-warmup implementation. The
proposal family is genuinely useful as offline evidence, but injecting
oracle-positive swaps as one-shot warmups did not improve the final
simulator-backed score at the minimum 1M gate and slightly reduced validity.
The temporary `--oracle-adjacent-swap-trials` implementation was removed after
validation. Keep `pnpm contrast-pairs:search` as a diagnostic/offline evidence
builder. The next adjacent-swap hypothesis would need a different compounding
mechanism, such as learning which contexts make swaps useful or turning them
into a broader proposal-family selector, not simply seeding the exact
oracle-positive swaps.

## Context-Aware Adjacent Swap Offline Gate

Hypothesis: the failed online adjacent-swap warmup was too broad. Adjacent swaps
as a family contain both strong positives and dead weight, so proposal relevance
may improve by learning the context where a swap is useful: turn, slot, ordered
spell pair, unordered spell pair, and left/right spell identity.

Implementation: extend `pnpm contrast-pairs:search` with adjacent-swap context
aggregation and `--quiet` summary output. This is offline evidence only; it
does not inject candidates into Rust/WASM search and does not justify a search
quality claim by itself.

Success criteria for the offline gate:

- supported context buckets must beat the all-swap positive rate;
- supported context buckets must beat the all-swap global-best rate;
- the signal must repeat across databases, not only one smoke corpus;
- any future online mechanism must still pass a matched `>=1M` A/B.

Smoke on `.optimizer/oracle-loadout-smoke.sqlite`, top `5` sources,
`64` variants per source, `--min-context-valid 3`:

| Context | Valid | Positive | Global-best | Positive rate | Global-best rate | Average delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| all `swap-adjacent-actions` | `60` | `15` | `13` | `0.2500` | `0.2167` | `-881.05` |
| `turn-pair:3:debacle>orbes-luisants` | `5` | `5` | `5` | `1.0000` | `1.0000` | `+1121.27` |
| `left:debacle` | `10` | `10` | `10` | `1.0000` | `1.0000` | `+738.10` |
| `right:orbes-luisants` | `15` | `10` | `10` | `0.6667` | `0.6667` | `+492.07` |

Broad offline run across the same ten recent 1M/10M databases used for the
previous contrast-pair pass, top `10` sources per DB, `128` variants per source,
`--min-context-valid 20`:

| Context | Valid | Positive | Global-best | Positive rate | Global-best rate | Average delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| all `swap-adjacent-actions` | `1190` | `280` | `86` | `0.2353` | `0.0723` | `-931.22` |
| `turn-pair:3:debacle>orbes-luisants` | `90` | `90` | `41` | `1.0000` | `0.4556` | `+1100.49` |
| `pair:debacle>orbes-luisants` | `180` | `171` | `67` | `0.9500` | `0.3722` | `+686.98` |
| `turn-slot:3:6` | `100` | `90` | `41` | `0.9000` | `0.4100` | `+864.26` |
| `right:orbes-luisants` | `280` | `171` | `67` | `0.6107` | `0.2393` | `+432.65` |

Per-DB repeatability check:

- `turn-pair:3:debacle>orbes-luisants` appeared in `9 / 10` databases and was
  positive in all `90 / 90` valid examples;
- `pair:debacle>orbes-luisants` appeared across all ten databases, with
  `171 / 180` positive valid examples;
- `turn-slot:3:6` appeared across all ten databases, but failed on the stronger
  `resource-aware-100-10m` corpus, where it produced `0 / 10` positives and an
  average delta of `-1261.75`.

Conclusion: keep context-aware adjacent swap analysis as an offline diagnostic.
It passes the offline relevance gate much more clearly than the broad
strategy-level signal: context can separate high-value swaps from harmful swap
noise. Do not reintroduce exact swap seed warmups yet. The next online
hypothesis, if pursued, should use context as a proposal-family selector or
generator rule and should explicitly guard against the 10M corpus miss before
running another matched `>=1M` validation.

## Contextual Adjacent Swap Neighbor Prioritization

Hypothesis: broad adjacent swaps already exist in the elite-neighbor queue, but
the queue spends limited neighbor-evaluation budget in a broad order. Instead
of replaying exact oracle-positive swaps, prioritize only offline-supported
adjacent-swap contexts inside the Rust/WASM elite-neighbor generator:

- `turn-pair:3:debacle>orbes-luisants`;
- `pair:debacle>orbes-luisants`;
- `turn-pair:3:orbes-luisants>halo-chatoyant`;
- `pair:orbes-luisants>halo-chatoyant`.

This changes proposal order rather than final scoring. The exact simulator and
TypeScript oracle remain the authority for final ranking. The slot-only context
`turn-slot:3:6` was deliberately not used as a rule because it failed on the
stronger `resource-aware-100-10m` corpus.

Implementation: add opt-in request field `hybridContextualAdjacentSwaps` and
continuous CLI flag `--contextual-adjacent-swaps`. When enabled, contextual
swaps are enqueued before passive, sublimation, broad order, and replacement
neighbors. Duplicate suppression then prevents the later broad order-neighbor
pass from re-adding the same candidate. Round summaries report
`contextualAdjacentSwapsEnabled` and
`contextualAdjacentSwapNeighborCandidates`.

Success criteria before keeping:

- smoke must exercise the new metric and keep top candidates oracle-valid;
- matched `>=1M` validation must beat the forced resource-aware baseline on
  final simulator-backed score;
- a 500k lead is not sufficient because several earlier hypotheses failed by
  the 1M endpoint.

200k smoke on `t3-full`, seed `contextual-swap-smoke`, workers `2`, chunk size
`50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--contextual-adjacent-swaps`:

| Round | Final score | Valid rate | Contextual neighbors | Oracle |
| ---: | ---: | ---: | ---: | --- |
| 1 | `169193.54` | `0.3115` | `322` | top 5 valid |
| 2 | `175276.81` | `0.3353` | `349` | top 5 valid |

Matched 1M validation on `t3-full`, seed `contextual-swap-1m`, workers `10`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final round valid rate | Contextual neighbors | Final round throughput | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `172583.29` | `177659.06` | `0.3417` | `0` | `8237.05 it/s` | top 5 valid |
| Contextual adjacent swaps | `174847.59` | `179080.58` | `0.3447` | `2022` | `8186.88 it/s` | top 5 valid |

Conclusion: keep the opt-in contextual adjacent-swap prioritizer. This is the
first adjacent-swap online mechanism that survived the 1M gate: final score
improved by `1421.52`, valid rate improved by `0.0030`, throughput was
essentially unchanged, and the final top candidates remained oracle-valid. Do
not jump to `100_000_000` from one seed. The next validation step should repeat
the matched 1M gate on another seed or compare against the current best at 10M
only if compute budget allows, because the offline evidence included one
stronger 10M corpus where some slot-derived contexts did not generalize.

Repeat matched 1M validation on `t3-full`, seed
`contextual-swap-repeat-1m`, workers `10`, chunk size `50_000`, max rounds `2`,
`--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final round valid rate | Contextual neighbors | Final round throughput | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `172645.83` | `178865.36` | `0.3390` | `0` | `8408.08 it/s` | top 5 valid |
| Contextual adjacent swaps | `172645.83` | `178865.36` | `0.3432` | `1923` | `8098.24 it/s` | top 5 valid |

Repeat conclusion: keep the opt-in implementation, but do not scale it to 10M
yet. Across two matched 1M seeds, contextual swaps produced one score win
(`+1421.52`) and one score tie, with higher validity in both variants and
oracle-valid final candidates. The mechanism is safe and promising, but the
score lift is not repeatable enough to justify a larger compute spend on this
exact rule set. The next sharper hypothesis should either broaden the
contextual rule set using held-out context evidence or turn contextual swaps
into an adaptive proposal-family selector that can back off when the source
corpus resembles the known 10M miss.
