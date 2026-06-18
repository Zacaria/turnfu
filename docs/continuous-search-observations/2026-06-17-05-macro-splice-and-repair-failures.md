## Contextual Macro Splice Replacement

Hypothesis: high-scoring candidates may contain reusable two-action macros that
are more structured than adjacent swaps but narrower than whole-turn grafting.
Instead of broad grafting, replace a same-length action span in a source
candidate with a frequent macro mined from other top candidates, then exact
score the variant offline. Only a context with repeated source-positive and
session-best improvements should justify any online Rust/WASM experiment.

Offline implementation: extend `pnpm contrast-pairs:search` with
`--macro-splices`. The diagnostic mines length-2 and length-3 contiguous action
macros from top valid candidates in the same database and creates exact-scored
same-length replacement variants. A tested insertion variant was removed before
keeping the diagnostic because it generated `14,309` candidates with `0` valid
variants in the broad gate.

Small smoke on `resource-aware-100-1m`, top `3` sources,
`80` variants/source:

| Strategy | Generated | Valid | Positive | Global-best | Average delta |
| --- | ---: | ---: | ---: | ---: | ---: |
| `splice-action-macro` | `237` | `27` | `0` | `0` | `-14595.17` |

Broad offline gate across ten recent `1M`/`10M` databases, top `10` sources per
DB, `256` variants/source, after removing insertion:

| Strategy | Generated | Valid | Positive | Global-best | Valid rate | Positive rate | Average delta | Best delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `splice-action-macro` | `24849` | `2695` | `157` | `44` | `0.1085` | `0.0583` | `-11929.40` | `3440.23` |

Read: broad macro replacement is mostly destructive and should not be promoted
as a general online proposal family. However, the context summaries exposed a
specific strong rule:

| Context | Generated | Valid | Positive | Global-best | Valid rate | Positive rate | Global-best rate | Average delta | Best delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `macro:replace:turn-boundary:2:debacle>fleche-de-lumiere` | `80` | `80` | `78` | `24` | `1.0000` | `0.9750` | `0.3000` | `279.15` | `479.68` |
| `macro:replace:turn-key:2:flux-denergie:default>debacle:default` | `560` | `80` | `78` | `24` | `0.1429` | `0.9750` | `0.3000` | `279.15` | `479.68` |
| `macro:replace:turn-boundary:3:flux-denergie>orbes-luisants` | `190` | `80` | `71` | `20` | `0.4211` | `0.8875` | `0.2500` | `232.69` | `618.60` |

The strongest context appeared in `8 / 10` databases with valid examples. It
had no examples in the two sampled `10M` holdouts, so it is promising but not
complete evidence for scale.

Temporary online implementation: add an opt-in Rust/WASM neighbor rule that
replaced the turn-2 span between `debacle` and `fleche-de-lumiere` with
`flux-denergie, debacle`, exposed as `--contextual-macro-splices`. Final
scoring and oracle validation stayed exact.

200k wiring smoke on `t3-full`, seed `contextual-macro-smoke`, workers `2`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Final score | Final valid rate | Macro neighbors | Evaluated macro neighbors | Oracle |
| ---: | ---: | ---: | ---: | --- |
| `175568.41` | `0.3331` | `0` | `0` | top 5 valid |

The smoke verified the CLI/oracle path but did not exercise the macro rule.

Matched 1M validation on `t3-full`, seed `resource-aware-1m`, workers `10`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final valid rate | Macro neighbors | Evaluated macro neighbors | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `173085.49` | `179375.26` | `0.3401` | `0` | `0` | top 5 valid |
| Contextual macro splice neighbor | `173085.49` | `179375.26` | `0.3401` | `0` | `0` | top 5 valid |

Conclusion: kill the online Rust/WASM macro-neighbor implementation. The
offline context is real in persisted top evidence, but the elite-neighbor path
never saw that context during the matched `1M` search, so the online hook tied
the baseline exactly and provided no quality mechanism. The temporary
`--contextual-macro-splices` flag was removed from Rust, TypeScript, the CLI,
and rebuilt WASM. Keep `--macro-splices` as an offline diagnostic because it
found repeatable positive contexts that may be useful for a different mechanism,
such as exact-scored source-candidate postprocessing or seed selection from
persisted evidence rather than live elite-neighbor generation.

### Oracle-Preselected Macro Splice Seeds

Follow-up hypothesis: the previous online macro-neighbor test failed because
the live elite-neighbor queue never saw the offline-supported context. A
different mechanism could read persisted top candidate evidence at the start of
each round, generate only the strong macro replacement
`debacle > [flux-denergie, debacle] > fleche-de-lumiere`, exact-score the source
and variant with the TypeScript oracle, and inject only source-positive variants
as Rust/WASM request seed candidates.

Temporary implementation: add an opt-in continuous CLI flag
`--oracle-macro-splices` with `--oracle-macro-splices-per-worker`. The
implementation generated macro splice candidates from
`continuous_candidate_evaluations`, kept only variants whose TypeScript oracle
score exceeded the exact TypeScript source score, injected them as labeled seed
candidates, and recorded outcomes as `oracle-macro-splice` reuse-trial evidence.
Final scoring and oracle validation stayed exact.

200k wiring smoke on `t3-full`, seed `oracle-macro-smoke`, workers `2`, chunk
size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--oracle-macro-splices --oracle-macro-splices-per-worker 2`:

| Final score | Final valid rate | Oracle macro candidates | Used | Evaluated | Oracle |
| ---: | ---: | ---: | ---: | ---: | --- |
| `175523.83` | `0.3352` | `0` | `0` | `0` | top 5 valid |

Read: the CLI/oracle path was safe, but the short smoke did not have mature
enough persisted evidence to create macro seeds.

Matched 1.5M validation on `t3-full`, seed `oracle-macro-1m5`, workers `10`,
chunk size `50_000`, max rounds `3`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Score at 1M | Final score at 1.5M | Final valid rate | Oracle macro candidates | Used | Evaluated | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `172558.83` | `176701.57` | `178759.64` | `0.3332` | `0` | `0` | `0` | top 5 valid |
| Oracle macro splice seeds | `172558.83` | `176701.57` | `178759.64` | `0.3332` | `0` | `0` | `0` | top 5 valid |

Conclusion: kill the online oracle macro seed implementation. Even after
`1.5M` attempts and three rounds, this matched seed did not produce any
source-positive macro splice candidates from persisted evidence, so the variant
tied the baseline exactly and did not create a quality mechanism. The temporary
`--oracle-macro-splices` implementation was removed from the CLI. The useful
lesson is narrower: the macro context is an offline postprocessing signal for
some corpora, not a reliable continuous online seed source under the tested
round cadence.

### Oracle Macro Top-Candidate Postprocessing

Follow-up hypothesis: the previous macro seed path might have failed because
the source-positive context appeared in final candidate pools, not at the start
of the next round as persisted seed evidence. A bounded exact postprocessor
could apply the same strong macro replacement to the current round's top
Rust/WASM candidates, exact-score the variants with the TypeScript oracle, and
merge only source-positive variants into the final top-candidate ranking.

Temporary implementation: add `--oracle-macro-postprocess` to the continuous
CLI. When enabled, each round examined the top Rust/WASM candidates plus the
previous persisted best, generated only the
`debacle > [flux-denergie, debacle] > fleche-de-lumiere` replacement, exact
scored each variant, kept only source-positive variants, and reported
postprocess generated/valid/positive/global-improved counts. Final candidate
ranking and oracle validation remained exact.

200k wiring smoke on `t3-full`, seed `oracle-macro-postprocess-smoke`, workers
`2`, chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--oracle-macro-postprocess`:

| Final score | Final valid rate | Generated | Valid | Positive | Global-best | Oracle |
| ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `176127.24` | `0.3326` | `0` | `0` | `0` | `0` | top 5 valid |

Matched 1M validation on `t3-full`, seed `resource-aware-1m`, workers `10`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final valid rate | Generated | Valid | Positive | Global-best | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `173085.49` | `179375.26` | `0.3401` | `0` | `0` | `0` | `0` | top 5 valid |
| Oracle macro postprocess | `173085.49` | `179375.26` | `0.3401` | `0` | `0` | `0` | `0` | top 5 valid |

Conclusion: kill the top-candidate postprocessor. It tied the matched `1M`
baseline exactly and did not generate any variants from the current top-candidate
pool. Together with the failed live-neighbor and persisted-seed attempts, this
means the macro splice signal should remain an offline diagnostic only. The
positive contexts exist in some stored corpora, but none of the tested online
or final-round integration points expose them reliably enough to improve search
quality.

### Target-Choice Retarget Edits

Hypothesis: some high-scoring candidates may use the right spell identity but
the wrong target form. A same-spell retargeting diagnostic could expose
source-positive edits without the much larger disruption of replacing the
action itself. If target-choice contexts showed repeated positive deltas or
global-best improvements, they could later inform a bounded proposal policy.

Temporary offline implementation: add an opt-in `--target-edits` diagnostic to
`pnpm contrast-pairs:search`. The diagnostic replaced an existing action with a
same-spell action variant using another target kind, exact-scored the result,
and summarized target contexts separately from broader action replacement
contexts.

Small smoke on `resource-aware-100-1m`, top `5` sources,
`120` variants/source:

| Strategy | Generated | Valid | Positive | Global-best | Valid rate | Positive rate | Average delta | Best delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `retarget-action` | `65` | `61` | `0` | `0` | `0.9385` | `0.0000` | `-4869.04` | `0.00` |

Broad offline gate across ten recent `1M`/`10M` databases, top `10` sources per
DB, `256` variants/source:

| Strategy | Generated | Valid | Positive | Global-best | Valid rate | Positive rate | Average delta | Best delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `retarget-action` | `1306` | `1239` | `6` | `0` | `0.9487` | `0.0048` | `-4728.87` | `3440.23` |

Best target context:

| Context | Generated | Valid | Positive | Global-best | Valid rate | Positive rate | Average delta | Best delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `target:change:emptyCell>default` | `225` | `158` | `6` | `0` | `0.7022` | `0.0380` | `130.64` | `3440.23` |

Conclusion: do not promote target retargeting to online search. It has high
validity, but relevance is extremely weak: only `6 / 1239` valid variants were
source-positive, no context produced global-best improvements, and the overall
average delta was strongly negative. The useful lesson is that target changes
are mostly a suppression/avoidance signal, not an improvement proposal family.

### Focused Single-Action Repair

Hypothesis: the existing hybrid repair queue is too destructive because, for
multi-turn candidates, it drops the whole suffix of a turn from the first
violating action onward. A focused repair that removes only the first violating
action might preserve later high-value actions, converting invalid work into
more relevant valid candidates.

Temporary online implementation: add an opt-in Rust/WASM request flag exposed
as `--focused-repair`. When enabled, invalid candidates with a concrete first
violation generated a repair candidate by deleting only the violating action,
falling back to the existing suffix-truncation repair when focused repair was
not possible. Final ranking and oracle validation stayed exact.

200k wiring smoke on `t3-full`, seed `focused-repair-smoke`, workers `2`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--focused-repair`:

| Final score | Final valid rate | Repair candidates | Repair queued | Oracle |
| ---: | ---: | ---: | ---: | --- |
| `176293.84` | `0.2588` | `34012` | `33931` | top 5 valid |

Matched 1M validation on `t3-full`, seed `focused-repair-1m`, workers `10`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final valid rate | Repair candidates | Repair queued | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `172394.82` | `177492.45` | `0.3349` | `173985` | `173610` | top 5 valid |
| Focused single-action repair | `172394.82` | `176720.22` | `0.2579` | `171351` | `171356` | top 5 valid |

Conclusion: kill focused single-action repair. It tied the baseline at `500k`
but lost by `772.23` score at `1M` and significantly reduced the final valid
rate. Preserving the later suffix after a violation appears to keep too many
still-infeasible or low-quality continuations in the repair stream. The
temporary `--focused-repair` implementation was removed from Rust, TypeScript,
the CLI, and rebuilt WASM. The broader repair direction still needs a stronger
constraint-directed mechanism, such as replacement with an affordable action or
resource-producing prefix repair, rather than single-action deletion.

### Replacement Repair for Insufficient Resources

Hypothesis: instead of deleting the violating action, repair could replace an
insufficient-resource action with a cheaper available action that fits the
reported resource availability and preserves the rest of the turn. This should
be more constraint-directed than single-action deletion and less destructive
than suffix truncation.

Temporary online implementation: add an opt-in Rust/WASM request flag exposed
as `--replacement-repair`. For `insufficientResource` first violations, the
repair path selected a deterministic replacement from available search actions:
the replacement had to fit the reported available amount for the violated
resource and avoid increasing other resource costs relative to the original
action. Candidates were ranked by existing action search weight with a small
resource-production bonus. Final ranking and oracle validation stayed exact.

200k wiring smoke on `t3-full`, seed `replacement-repair-smoke`, workers `2`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--replacement-repair`:

| Final score | Final valid rate | Repair candidates | Repair queued | Oracle |
| ---: | ---: | ---: | ---: | --- |
| `176352.42` | `0.2958` | `35010` | `34962` | top 5 valid |

Matched 1M validation on `t3-full`, seed `replacement-repair-1m`, workers `10`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final valid rate | Repair candidates | Repair queued | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `174155.55` | `178262.95` | `0.3410` | `177482` | `177194` | top 5 valid |
| Replacement repair | `174155.55` | `178184.49` | `0.3006` | `175761` | `175663` | top 5 valid |

Conclusion: kill replacement repair. It tied the baseline at `500k` but lost
by `78.46` score at `1M` and reduced final valid rate. Replacing a violating
action with a locally cheaper action is still too local: it does not account
for later class-state, target, cooldown, and damage-context consequences, and
it appears to divert the repair stream away from the stronger suffix-truncation
baseline. The temporary `--replacement-repair` implementation was removed from
Rust, TypeScript, the CLI, and rebuilt WASM.

### Prefix-Resample Repair

Hypothesis: local repair edits keep too many bad continuations. A partial-plan
repair could preserve the valid prefix before the first violation, then resample
the current suffix and later turns with the resource-aware sampler. This tests a
small online prefix-search mechanism without replacing final exact scoring.

Temporary online implementation: add an opt-in Rust/WASM request flag exposed
as `--prefix-resample-repair`. When a candidate failed with a concrete first
violation, the repair path kept actions before the violating action, generated a
deterministic resource-aware suffix from a candidate/violation-derived seed,
replaced the rest of the current turn and later turns, and queued the repaired
candidate. Final ranking and oracle validation stayed exact.

200k wiring smoke on `t3-full`, seed `prefix-resample-repair-smoke`, workers
`2`, chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--prefix-resample-repair`:

| Final score | Final valid rate | Repair candidates | Repair queued | Oracle |
| ---: | ---: | ---: | ---: | --- |
| `177492.45` | `0.1183` | `34996` | `34996` | top 5 valid |

Matched 1M validation on `t3-full`, seed `prefix-resample-1m`, workers `10`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final valid rate | Repair candidates | Repair queued | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `173213.22` | `177918.85` | `0.3406` | `177025` | `176669` | top 5 valid |
| Prefix-resample repair | `173213.22` | `177492.45` | `0.1119` | `169259` | `169259` | top 5 valid |

Conclusion: kill prefix-resample repair. It tied the baseline at `500k` but
lost by `426.40` score at `1M` and collapsed final valid rate. Resampling the
suffix from a preserved prefix does not make the suffix compatible with the
actual class state created by the prefix; it mostly injects full-plan
resource-aware suffixes into mismatched mid-plan states. The temporary
`--prefix-resample-repair` implementation was removed from Rust, TypeScript,
the CLI, and rebuilt WASM.
