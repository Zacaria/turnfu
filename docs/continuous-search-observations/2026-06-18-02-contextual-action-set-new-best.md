### Learned Action-Set Plus Contextual Adjacent Swaps

Hypothesis: contextual adjacent swaps previously failed under the learned
loadout-only prior because valid proposals were rare and the contextual
neighbors were enqueued but not evaluated. The learned action-set prior changes
that search regime: it raises valid proposal rate to roughly `42%` at `1M` and
`46%` at `10M`. Under that narrower but still productive spell catalog, an
action-order prior may become proposal-relevant instead of sitting unused in
the neighbor queue.

This is not the same mechanism as learned-loadout plus contextual swaps. The
baseline is now the current strongest quality setting: learned loadout plus
learned action-set with forced resource-aware fresh construction.

Success criteria:

- matched `>=1M` validation must beat learned loadout plus learned action-set
  on final score with the same scenario, seed, workers, chunk size, and round
  count;
- top candidates must remain TypeScript-oracle valid;
- contextual telemetry must show whether contextual candidates were evaluated;
- a tie or loss means this combination should not be scaled to `10M`;
- higher validity without final-score lift is not enough.

Matched `1M` validation on `t3-full`, seed `action-set-contextual-1m`,
workers `10`, chunk size `50_000`, max rounds `2`,
`--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Best at attempts | Final valid rate | Contextual candidates | Evaluated contextual | Valid contextual | Positive source-delta contextual | Global-best contextual | Final round throughput | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Learned loadout + action-set prior | `185282.26` | `186138.94` | `1,000,000` | `0.4206` | `0` | `0` | `0` | `0` | `0` | `8,250.13 it/s` | top 5 valid |
| Learned loadout + action-set + contextual swaps | `185637.19` | `186807.08` | `1,000,000` | `0.4218` | `598` | `584` | `239` | `11` | `21` | `8,144.83 it/s` | top 5 valid |

Conclusion: keep and repeat learned action-set plus contextual adjacent swaps.
This combination passed the minimum `1M` gate with a `+668.14` final-score lift
over the current learned-action-set baseline, while preserving oracle validity
and nearly identical throughput. Unlike the learned-loadout-only contextual
test, contextual neighbors were actually evaluated (`584` in the final round)
and produced direct improvement telemetry (`11` positive source-delta
contextual candidates and `21` global-best contextual candidates). Do not scale
to `10M` yet; the next gate is an independent matched `1M` repeat because many
earlier mechanisms won once at `1M` and failed on repeat or scale.

Independent matched `1M` repeat on `t3-full`, seed
`action-set-contextual-repeat-1m`, workers `10`, chunk size `50_000`, max
rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Best at attempts | Final valid rate | Contextual candidates | Evaluated contextual | Valid contextual | Positive source-delta contextual | Global-best contextual | Final round throughput | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Learned loadout + action-set prior | `185282.26` | `186053.44` | `1,000,000` | `0.4212` | `0` | `0` | `0` | `0` | `0` | `8,161.22 it/s` | top 5 valid |
| Learned loadout + action-set + contextual swaps | `185637.19` | `186807.08` | `1,000,000` | `0.4243` | `559` | `544` | `220` | `3` | `14` | `8,000.78 it/s` | top 5 valid |

Repeat conclusion: promote learned action-set plus contextual adjacent swaps to
the `10M` scale gate. It survived two independent matched `1M` validations
with final-score lifts of `+668.14` and `+753.64`, kept all top candidates
oracle-valid, and showed that contextual candidates are now evaluated under the
learned action-set regime. The next validation should compare against the
current documented `10M` learned-action-set baseline (`187393.07`, seed
`learned-loadout-10m`) before treating this as the new quality-oriented
continuous default.

Matched `10M` scale validation on `t3-full`, seed `learned-loadout-10m`,
workers `10`, chunk size `50_000`, max rounds `20`,
`--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Score at 1M | Score at 2.5M | Final score at 10M | Best at attempts | Final valid rate | Evaluated contextual at 10M | Final round throughput | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Learned loadout + action-set prior | `185282.26` | `186053.44` | `187329.53` | `187393.07` | `6,500,000` | `0.4614` | `0` | n/a | top 5 valid |
| Learned loadout + action-set + contextual swaps | `185637.19` | `186807.08` | `187329.53` | `188558.81` | `10,000,000` | `0.4609` | `295` | `6,672.46 it/s` | top 5 valid |

Scale conclusion: promote learned action-set plus contextual adjacent swaps as
the new strongest quality-oriented continuous setting. It improved the matched
`10M` endpoint by `1165.74` over learned loadout plus learned action-set
alone, preserved the learned action-set validity rate, and kept all top
candidates TypeScript-oracle valid. The mechanism is a real proposal-relevance
improvement: it won two independent `1M` gates and then found a new best at the
`10M` scale gate. The caveat is that contextual improvements were concentrated
early, then the run plateaued at `187597.94` from `3,500,000` to `9,500,000`
before a final-round jump to `188558.81`; the next hypothesis should target
late-plateau escape rather than further narrowing the spell/action set.
