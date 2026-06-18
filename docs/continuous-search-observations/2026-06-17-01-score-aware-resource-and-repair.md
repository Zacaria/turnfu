## Score-Aware Resource-Aware Weighting

Hypothesis: forced resource-aware fresh construction improved search quality at
10M, but both default and forced runs plateaued by `5,000,000` attempts. A mild
score-aware weighting exponent might spend the valid resource-aware action slots
on higher-value actions without losing too much validity.

Temporary implementation: add `hybridResourceAwareWeightExponent` / CLI
`--resource-aware-weight-exponent`, clamped to `[0.25, 4.0]`. The default was
`1.0`, preserving current behavior. The exponent was applied only to the
resource-aware action sampler's existing action search weight.

100k gate on `t3-full`, seed `resource-aware-weight-smoke`, workers `2`, chunk
size `50_000`, max rounds `1`, `--resource-aware-fresh-chance 1`:

| Weight exponent | Final score | Valid rate | Throughput | Resource-aware candidates | Oracle |
| ---: | ---: | ---: | ---: | ---: | --- |
| `1.00` | `175247.45` | `0.3114` | `3,720.97 it/s` | `49,028` | top 5 valid |
| `1.25` | `175895.77` | `0.3089` | `3,667.07 it/s` | `49,322` | top 5 valid |
| `1.50` | `169057.88` | `0.2909` | `3,903.84 it/s` | `51,352` | top 5 valid |
| `2.00` | `173980.27` | `0.2346` | `4,774.44 it/s` | `58,596` | top 5 valid |

Gate conclusion: `1.5` and `2.0` are too aggressive. `1.25` was the only value
worth meaningful validation because it improved the 100k score while preserving
most validity.

1M validation on `t3-full`, seed `resource-aware-weight-1m`, workers `10`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Weight exponent | Score at 500k | Final score at 1M | Final round valid rate | Final round throughput | Final round resource-aware candidates | Oracle |
| ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `1.00` | `173779.04` | `179119.06` | `0.3390` | `8,308.48 it/s` | `238,539` | top 5 valid |
| `1.25` | `174424.70` | `178990.56` | `0.3287` | `7,851.84 it/s` | `246,911` | top 5 valid |

Conclusion: reject exponent amplification as a search-quality improvement. It
looked better at 100k and 500k, but failed the minimum meaningful 1M threshold
by `128.50` score and had lower validity. Keep the default exponent at `1.0`.
The broader lesson is that simply making the resource-aware sampler greedier for
high-weight actions reduces combinatorial diversity before it improves the final
simulator-backed score. The next non-neural hypothesis should change proposal
structure, not just make the existing per-action weighting sharper. The
experimental knob was removed after this rejection.

## Resource Prefix Beam Fresh Proposals

Hypothesis: instead of sharpening the single-action lottery, temporarily build a small
resource-constrained beam of action prefixes and sample complete prefixes. This
should improve proposal relevance by scoring a turn prefix as a unit, including
resource spend and sequence length, while keeping final ranking simulator-backed.

Success criteria before implementation:

- smoke must stay oracle-valid and not catastrophically reduce valid rate;
- matched `>=1M` validation must beat the forced resource-aware baseline on
  final score;
- validity may drop only if final simulator-backed score improves enough to
  justify spending fewer attempts on valid proposals.

100k smoke on `t3-full`, seed `resource-prefix-smoke`, workers `2`, chunk size
`50_000`, max rounds `1`:

| Mode | Final score | Valid rate | Throughput | Prefix-beam candidates | Resource-aware candidates | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware | `170815.54` | `0.3126` | `3,672.55 it/s` | `0` | `48,573` | top 5 valid |
| `25%` prefix beam + resource-aware fallback | `171155.18` | `0.2482` | `3,955.31 it/s` | `13,506` | `40,557` | top 5 valid |

Smoke read: the score signal was slightly positive, but validity dropped by
`6.44` percentage points. That was enough to run the minimum 1M gate, but the
1M success bar had to be strict.

1M validation on `t3-full`, seed `resource-prefix-1m`, workers `10`, chunk size
`50_000`, max rounds `2`:

| Mode | Score at 500k | Final score at 1M | Final round valid rate | Final round throughput | Final round prefix-beam candidates | Final round resource-aware candidates | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware | `174581.93` | `178536.87` | `0.3375` | `8,497.21 it/s` | `0` | `239,269` | top 5 valid |
| `25%` prefix beam + resource-aware fallback | `175158.13` | `177216.17` | `0.2776` | `10,266.10 it/s` | `67,859` | `202,359` | top 5 valid |

Conclusion: kill this implementation. The prefix beam looked better at 100k and
500k, but failed the 1M threshold by `1,320.70` score and materially damaged
validity. The mechanism is structurally different from the failed exponent
tweak, but the failure mode is similar: locally attractive action construction
reduces the useful proposal stream and does not compound into better final
simulator-backed score. Do not keep this opt-in path in production code. A
future prefix approach would need direct partial-plan simulation/value feedback,
not only action-weight and resource-spend heuristics.

## Constraint-Directed Repair Replacement

Hypothesis: current repair mostly truncates from the first invalid action,
which often preserves less structure than necessary. For `insufficientResource`
and `castLimitExceeded` violations, temporarily replace the offending action
with the highest-weight affordable action under the same soft resource/cast
constraints, then truncate the remaining suffix. This should keep more useful
prefix structure than deletion-only repair while avoiding exact candidate
replay.

Success criteria before implementation:

- smoke must stay oracle-valid and expose the new repair metric;
- matched `>=1M` validation must beat the current forced resource-aware baseline
  on final score;
- valid rate should not drop unless final simulator-backed score improves;
- repair metrics must show the new path is actually exercised.

Matched 1M baseline before implementation on `t3-full`, seed
`constraint-repair-1m`, workers `10`, chunk size `50_000`, max rounds `2`,
`--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final round valid rate | Final round throughput | Oracle |
| --- | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `173209.78` | `177659.06` | `0.3292` | `8,586.15 it/s` | top 5 valid |

100k smoke after temporary implementation on `t3-full`, seed
`constraint-repair-smoke`, workers `2`, chunk size `50_000`, max rounds `1`:

| Final score | Valid rate | Constraint-directed repairs | Truncation repairs | Oracle |
| ---: | ---: | ---: | ---: | --- |
| `170039.42` | `0.3056` | `4,646` | `53,177` | top 5 valid |

Matched 1M validation after temporary implementation on `t3-full`, seed
`constraint-repair-1m`, workers `10`, chunk size `50_000`, max rounds `2`,
`--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final round valid rate | Final round throughput | Final round constraint-directed repairs | Final round truncation repairs | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Constraint-directed replacement repair | `173209.78` | `177492.45` | `0.3252` | `8,537.34 it/s` | `25,136` | `250,357` | top 5 valid |

Conclusion: kill this implementation. The replacement repair path was exercised
heavily, but did not improve best-at-attempts, lost `166.61` final score at 1M,
and lowered valid rate. The mechanism was too local: replacing only the first
invalid action still leaves a weak suffix/prefix context and does not produce
global-best improvements. Do not keep this repair variant in production code.
Future repair work needs either simulator-evaluated repair candidates or a
learned/offline-ranked repair policy with held-out lift, not a single
highest-action-weight replacement heuristic.
