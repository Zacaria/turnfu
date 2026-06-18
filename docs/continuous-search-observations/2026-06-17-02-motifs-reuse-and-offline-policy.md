## Motif Prefix Seed Synthesis

Hypothesis: high-scoring spell prefixes recorded in `continuous_motifs` are
compact evidence that can guide warmup without replaying full candidates. A
motif-derived seed should preserve only the spell prefix plus recorded
passive/sublimation ids, then let the Rust/WASM hybrid search mutate and score
normally. This changes proposal structure while avoiding exact promoted seed
replay.

Temporary implementation: add opt-in continuous CLI flags `--motif-seeds` and
`--motif-seeds-per-worker`. The variant lists ranked motif evidence, synthesizes
prefix-only `seedCandidates`, labels them as `motif:<id>:<hash>`, and reports
`motifSeedCandidates`, `evaluatedMotifSeedCandidates`,
`validMotifSeedCandidates`, `islandImprovedMotifSeedCandidates`, and
`globalImprovedMotifSeedCandidates`. Defaults remain unchanged.

Success criteria before scaling:

- smoke must show motif seeds are actually consumed after round one;
- matched `>=1M` validation must beat the forced resource-aware baseline on
  final simulator-backed score;
- valid rate should not materially drop;
- final top candidates must remain TypeScript-oracle valid;
- direct seed metrics should be treated as diagnostic only unless they beat the
  previous global best.

200k smoke on `t3-full`, seed `motif-seeds-smoke`, workers `2`, chunk size
`50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--motif-seeds --motif-seeds-per-worker 2`:

| Round | Final score | Valid rate | Motif seeds used | Motif seeds evaluated | Valid motif seeds | Island-improved motif seeds | Global-best motif seeds | Oracle |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | `173980.27` | `0.3095` | `0` | `0` | `0` | `0` | `0` | top 5 valid |
| 2 | `176038.33` | `0.3314` | `2` | `2` | `2` | `2` | `0` | top 5 valid |

Smoke conclusion: wiring passed. The reset corpus has no round-one motifs, and
round two consumed valid motif seeds as expected.

Matched 1M validation on `t3-full`, seed `motif-seeds-1m`, workers `10`, chunk
size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final round valid rate | Motif seeds evaluated | Valid motif seeds | Island-improved motif seeds | Global-best motif seeds | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `174155.55` | `177735.36` | `0.3382` | `0` | `0` | `0` | `0` | top 5 valid |
| Motif prefix seeds | `174155.55` | `177978.25` | `0.3385` | `10` | `10` | `10` | `0` | top 5 valid |

Conclusion: keep the opt-in mechanism for further validation. The 1M result
improved final score by `242.89` and slightly improved validity, while preserving
oracle validity. The signal is promising but not yet strong enough to jump to
10M: motif seeds were valid and island-improving, but none directly beat the
previous global best. Next, repeat the 1M gate on another matched seed or test a
sharper motif synthesis variant that diversifies prefixes across workers before
considering a 10M scale check.

Repeat matched 1M validation on `t3-full`, seed `motif-seeds-repeat-1m`,
workers `10`, chunk size `50_000`, max rounds `2`,
`--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final round valid rate | Motif seeds evaluated | Valid motif seeds | Island-improved motif seeds | Global-best motif seeds | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `173213.22` | `180664.37` | `0.3402` | `0` | `0` | `0` | `0` | top 5 valid |
| Motif prefix seeds | `173213.22` | `180664.37` | `0.3409` | `10` | `10` | `10` | `0` | top 5 valid |

Repeat conclusion: motif prefix seeds are not a regression, but the score lift
is not stable yet. Across two matched 1M seeds, motif synthesis produced one
win (`+242.89`) and one tie, with slightly higher validity in both runs and no
direct global-best seed improvement. Keep the opt-in mechanism and telemetry,
but do not scale to 10M until a sharper variant shows either direct global-best
motif seed improvements or repeated final-score lift across more seeds.

### Motif Prefix-Ladder Variant

Hypothesis: the first motif seed implementation underused motif evidence
because it produced one full-prefix candidate and then duplicated it across
workers. A prefix-ladder variant should synthesize separate seed candidates for
prefix lengths `1..N`, preserving motif order while giving workers different
partial-plan depths.

Temporary implementation: add `--motif-seed-prefix-variants` on top of
`--motif-seeds`, generating one candidate per prefix length for each motif. The
variant kept final scoring exact and used the same seed-candidate evaluation
telemetry as plain motif seeds.

200k smoke on `t3-full`, seed `motif-prefix-variants-smoke`, workers `2`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--motif-seeds --motif-seeds-per-worker 2 --motif-seed-prefix-variants`:

| Round | Final score | Valid rate | Motif seeds generated | Motif seeds evaluated | Valid motif seeds | Island-improved motif seeds | Global-best motif seeds | Oracle |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | `172097.47` | `0.3079` | `0` | `0` | `0` | `0` | `0` | top 5 valid |
| 2 | `175434.41` | `0.3425` | `4` | `3` | `3` | `3` | `0` | top 5 valid |

Smoke conclusion: wiring passed and the prefix ladder generated more diverse
motif seeds than the single-prefix implementation.

Matched 1M validation on `t3-full`, seed `motif-prefix-1m`, workers `10`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final round valid rate | Motif seeds generated | Motif seeds evaluated | Valid motif seeds | Island-improved motif seeds | Global-best motif seeds | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `173852.81` | `178132.04` | `0.3392` | `0` | `0` | `0` | `0` | `0` | top 5 valid |
| Motif prefix ladder | `173852.81` | `178132.04` | `0.3407` | `4` | `20` | `20` | `20` | `0` | top 5 valid |

Conclusion: kill the prefix-ladder variant. It improved validity and seed
warmup diagnostics, but failed the predeclared final-score gate by tying the
baseline and produced no direct global-best seed improvements. The temporary
`--motif-seed-prefix-variants` implementation was removed after validation.

## Loadout Neighbor Reuse Trials

Hypothesis: action-order reuse trials failed because they disrupted a strong
plan. A one-hop loadout neighbor might create better source-relative proposal
evidence by keeping the high-scoring action plan intact and replacing only one
passive or sublimation. If build choices have local interaction gaps, exact
seed-warmup scoring should expose positive score deltas or global-best trial
improvements.

Temporary implementation: add opt-in `--reuse-trial-families loadout`, with
`replace-passive` and `replace-sublimation` trial strategies. The default reuse
trial family stayed `action` during the experiment, preserving existing
behavior unless the new flag was supplied.

200k smoke on `t3-full`, seed `loadout-reuse-smoke`, workers `2`, chunk size
`50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--reuse-trials --reuse-trials-per-worker 2 --reuse-policy off
--reuse-trial-families loadout`:

| Round | Final score | Valid rate | Loadout trials used | Evaluated trials | Valid trials | Island-improved trials | Global-best trials | Oracle |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | `172583.29` | `0.3159` | `0` | `0` | `0` | `0` | `0` | top 5 valid |
| 2 | `176570.04` | `0.3228` | `4` | `4` | `4` | `4` | `0` | top 5 valid |

Smoke source-relative deltas were all negative:

| Strategy | Source score | Result score | Delta |
| --- | ---: | ---: | ---: |
| `replace-passive` | `172583.29` | `154714.85` | `-17868.44` |
| `replace-passive` | `171001.69` | `164909.95` | `-6091.74` |
| `replace-sublimation` | `172583.29` | `166409.16` | `-6174.13` |
| `replace-sublimation` | `171001.69` | `170788.50` | `-213.19` |

Matched 1M validation on `t3-full`, seed `loadout-reuse-1m`, workers `10`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final round valid rate | Evaluated trials | Valid trials | Island-improved trials | Global-best trials | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `172956.91` | `179375.26` | `0.3383` | `0` | `0` | `0` | `0` | top 5 valid |
| Loadout reuse trials | `172956.91` | `178184.49` | `0.3382` | `19` | `16` | `16` | `0` | top 5 valid |

Persisted 1M source-relative evidence:

| Strategy | Trials | Evaluated | Positive deltas | Global-best trials | Average delta | Best delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `replace-passive` | `5` | `5` | `0` | `0` | `-21586.86` | `-6091.74` |
| `replace-sublimation` | `5` | `2` | `0` | `0` | `-5529.56` | `-4884.99` |

Conclusion: kill the loadout-neighbor reuse implementation. It produced valid
island-improving warmups, but all source-relative scored trials were negative,
none improved global best, and final 1M score lost `1190.77` against the forced
resource-aware baseline. The temporary `--reuse-trial-families loadout` code was
removed after validation.

## Offline Learned-Policy Gate On Reuse Evidence

Hypothesis: after the action-order, adaptive reuse, and loadout-neighbor trial
runs, the accumulated continuous corpus might contain enough labeled proposal
evidence for the offline strategy baseline to rank useful proposals ahead of the
handcrafted order. If this held-out gate passed, it could justify a bounded
online policy-ranked seed integration. If it failed, neural and online learned
policy work should remain blocked.

Dataset construction: concatenate learned-policy exports from the reuse-trial
databases with direct proposal outcomes:

- `.optimizer/reuse-policy-off-1m.sqlite`
- `.optimizer/reuse-policy-adaptive-1m.sqlite`
- `.optimizer/loadout-reuse-smoke.sqlite`
- `.optimizer/loadout-reuse-variant-1m.sqlite`

First combined export, `--split-key session` with the default split, produced
`118` total rows and `22` evaluated proposal rows, but all proposal rows landed
in train (`0` test rows). The evaluator therefore fell back to all proposal
rows:

| Policy | Rows evaluated | Top-k avg score delta | Top-k validity | Useful rate | Global-best recall |
| --- | ---: | ---: | ---: | ---: | ---: |
| Handcrafted | `22` | `-10475.10` | `1.0000` | `0.0000` | n/a |
| Strategy baseline | `22` | `-8057.25` | `1.0000` | `0.0000` | n/a |

Fallback conclusion: the strategy baseline avoided some of the worst negative
trials, but still selected no useful proposals and had no global-best labels.

Held-out rerun with `--split-key session --test-modulo 2 --test-remainder 1`
produced `7` train proposal rows and `15` test proposal rows:

| Policy | Rows evaluated | Top-k avg score delta | Top-k validity | Useful rate | Global-best recall |
| --- | ---: | ---: | ---: | ---: | ---: |
| Handcrafted | `15` | `-10475.10` | `1.0000` | `0.0000` | n/a |
| Strategy baseline | `15` | `-10475.10` | `1.0000` | `0.0000` | n/a |

Held-out lift:

| Metric | Lift |
| --- | ---: |
| Top-k average score delta | `+0.0020` |
| Top-k validity rate | `0.0000` |
| Useful rate | `0.0000` |
| Global-best recall | n/a |

Conclusion: the offline learned-policy gate fails. The corpus contains negative
proposal evidence but not useful/global-best examples, so it does not justify
online policy-ranked seed prioritization or neural policy work. The next useful
step is to create a proposal generator that deliberately produces evaluated
positive/negative contrast pairs, rather than training on the current mostly
negative reuse-trial stream.
