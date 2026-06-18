# Continuous Search Observations

This note records the search-quality observations from the continuous
Rust/WASM optimizer work on 2026-06-17 and 2026-06-18. It is intentionally a
failure log: future work should not repeat these hypotheses without stronger
evidence.

## Validation Rules

- Budgets below `1_000_000` attempts are smoke checks only. They can validate
  wiring, telemetry, persistence, and oracle safety, but they are not evidence
  for search quality.
- For relevance/quality decisions, start at `1_000_000` attempts and prefer
  `10_000_000` or larger once a hypothesis survives the first pass.
- Compare against a matched baseline with the same scenario, seed, workers,
  chunk size, and round count.
- Keep final top-candidate TypeScript oracle validation in the result summary.

## Failed Or Weak Hypotheses

### Discovery Telemetry Alone Does Not Improve Final Score

Discovery mode recorded useful descriptors, motifs, and boundary samples, but
the final score did not improve just because evidence existed. The key failure
mode was that the findings were observed but not converted into a proven
search-quality feedback loop.

Conclusion: discovery data is diagnostic until a reuse policy proves that it
raises exact simulator-backed scores.

### Exact Promoted Candidate Replay Hurts Quality

Continuous exact candidate replay was tested against a no-reuse continuous
baseline at `10_000_000` attempts on `t3-full`, seed `ab-10m`, workers `10`,
chunk size `100_000`, max rounds `10`.

| Mode | Final score | Best at attempts | Valid rate | Throughput | Oracle |
| --- | ---: | ---: | ---: | ---: | --- |
| No promoted seed reuse | `190204.01` | `6,000,000` | `0.3414` | `13,506 it/s` | top 5 valid |
| Exact promoted seed replay | `184889.23` | `10,000,000` | `0.3242` | `14,163.89 it/s` | top 5 valid |

Conclusion: exact replay is not a learning system. It biases search toward
already-seen candidates and reduced score/validity in the validation that
actually exercised it.

Action taken: remove the materialized `continuous_promoted_seeds` table and
replace exact replay with explicit `continuous_reuse_trials` evidence.

### Storing Seeds Is Not Useful If Reuse Is Disabled

When promoted seed reuse is disabled, storing promoted seed payloads adds
database and UI surface area without improving the final score. Motifs and
candidate evaluations are still useful as evidence; materialized promoted
seeds are not.

Conclusion: store evidence and trial outcomes, not replay payloads.

### Neighbor Reuse Trials Do Not Improve Global Best

After exact replay was removed, a smaller hypothesis was tested: generate
bounded neighbor mutations from top evidence and inject them as labeled
Rust/WASM seed warmups via `--reuse-trials`.

Initial 1M smoke, seed `smoke-reuse-trials`, workers `2`, chunk size
`250_000`, max rounds `2`:

| Mode | Final score | Valid rate | Trial signal |
| --- | ---: | ---: | --- |
| Baseline | `182467.32` | `0.3395` | no trials |
| Reuse trials | `183764.64` | `0.3402` | 2 trials used, none recorded as top |

This looked weakly positive, but the instrumentation was insufficient: trial
scores were only inferred if they appeared in final top candidates.

After adding direct Rust seed-warmup evaluation summaries and fixing island
duplication, a matched 1M A/B was run with seed `validate-reuse-trial-eval`,
workers `10`, chunk size `50_000`, max rounds `2`:

| Mode | Final score | Valid rate | Evaluated trials | Valid trials | Global-best trial improvements |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline | `178961.76` | `0.3234` | `0` | `0` | `0` |
| Reuse trials | `178961.76` | `0.3236` | `9` | `3` | `0` |

Persisted trial outcomes showed the scored mutations were below their source
candidate, for example `174155.55 -> 163519.74` and `172856.18 -> 162449.96`.
Several trial mutations were invalid or filtered.

Conclusion: the current neighbor mutation policy is not worth scaling. It can
perturb the search, but it did not produce global-best improvements.

### Request Seed Warmups Were Accidentally Multiplied Across Islands

Instrumentation revealed that request `seedCandidates` were consumed once per
hybrid island. In a 60-island run, 10 selected reuse trials produced 59 seed
warmup evaluations. This polluted both quality and measurement.

Action taken:

- distribute request seed candidates across islands instead of duplicating
  them;
- add a Rust regression test that `1_000` iterations across 6 islands consumes
  3 request seed candidates exactly 3 times;
- rename the seed improvement signal to `hybridSeedWarmupIslandImprovedCandidates`
  because it is island-local, not global-best evidence.

### Raw Scale Alone Is Not Enough

A previous `100_000_000` Rust/WASM `t3-full` run completed successfully and
validated top candidates, but did not beat the known reference score. More
generations can prove infrastructure capacity, but they do not automatically
improve relevance.

Conclusion: do not jump to 100M for a hypothesis that fails at 1M unless the
1M run shows a direct quality mechanism worth scaling.

## Promising Hypotheses

### Resource-Aware Fresh Candidate Construction Improves 1M Quality

Hypothesis: increasing the share of resource-aware fresh candidates should
improve proposal relevance because those candidates are constructed against a
soft AP/MP/WP/BQ budget instead of sampling arbitrary full turns and relying on
repair afterward.

Implementation: add `hybridResourceAwareFreshChance` to the Rust/WASM hybrid
request and expose it in continuous search as
`--resource-aware-fresh-chance`. The default remains the existing `0.12`;
setting `1` forces fresh candidates and restart immigrants through the
resource-aware sampler while leaving crossover, repair, elite neighbors, final
scoring, and oracle validation unchanged.

100k smoke on `t3-full`, seed `resource-aware-smoke`, workers `2`, chunk size
`50_000`, max rounds `1`:

| Mode | Final score | Valid rate | Resource-aware candidates | Throughput | Oracle |
| --- | ---: | ---: | ---: | ---: | --- |
| Default `0.12` | `174155.55` | `0.2854` | `6,038` | `4,755 it/s` | top 5 valid |
| Forced `1.0` | `172097.47` | `0.3135` | `48,654` | `3,417 it/s` | top 5 valid |

The smoke proved the mechanism changed proposal validity, but the score was
lower, so it was not quality evidence.

Matched 1M validation on `t3-full`, seed `resource-aware-1m`, workers `10`,
chunk size `50_000`, max rounds `2`:

| Mode | Final score | Round 2 valid rate | Resource-aware candidates in round 2 | Throughput round 2 | Oracle |
| --- | ---: | ---: | ---: | ---: | --- |
| Default `0.12` | `178144.88` | `0.3206` | `28,289` | `7,453.64 it/s` | top 5 valid |
| Forced `1.0` | `179375.26` | `0.3401` | `239,934` | `5,808.96 it/s` | top 5 valid |

Conclusion: this is the first tested mechanism in this thread that improved
both proposal validity and final simulator-backed score at the 1M evidence
gate. The cost is lower throughput. Keep the mechanism, but tune the chance
before scaling: compare intermediate rates such as `0.35`, `0.5`, and `0.75`
against default, then consider 10M only for the best 1M survivor.

Tuning pass on the same `t3-full`, seed `resource-aware-1m`, workers `10`,
chunk size `50_000`, max rounds `2`:

| Resource-aware fresh chance | Final score | Round 2 valid rate | Resource-aware candidates in round 2 | Throughput round 2 | Oracle |
| ---: | ---: | ---: | ---: | ---: | --- |
| `0.12` | `178144.88` | `0.3206` | `28,289` | `7,453.64 it/s` | top 5 valid |
| `0.35` | `179274.58` | `0.3231` | `83,771` | `7,498.05 it/s` | top 5 valid |
| `0.50` | `177922.16` | `0.3244` | `120,902` | `7,515.85 it/s` | top 5 valid |
| `0.75` | `177492.45` | `0.3321` | `178,916` | `7,060.68 it/s` | top 5 valid |
| `1.00` | `179375.26` | `0.3401` | `239,934` | `5,808.96 it/s` | top 5 valid |

Conclusion: the relationship is not monotonic for score. `1.0` is the score
winner and has the strongest validity effect, while `0.35` is nearly as good
with much better throughput. `0.5` and `0.75` are not worth scaling on this
seed because higher validity did not translate to higher score. The next scale
check, if we spend 10M, should compare default `0.12` against `1.0`; optionally
include `0.35` only if compute budget allows an efficiency contender.

10M scale check on `t3-full`, seed `resource-aware-10m`, workers `10`, chunk
size `100_000`, max rounds `10`:

| Resource-aware fresh chance | Final score | Best at attempts | Final round valid rate | Final round throughput | Final round resource-aware candidates | Oracle |
| ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `0.12` | `184163.12` | `5,000,000` | `0.3390` | `16,688.67 it/s` | `54,190` | top 5 valid |
| `1.00` | `184819.25` | `5,000,000` | `0.3553` | `10,474.61 it/s` | `456,143` | top 5 valid |

Conclusion: the mechanism survived the 10M scale check. Forced resource-aware
fresh construction improved final score by `656.13` and maintained a materially
higher valid rate. It is slower, but relevance is the primary metric for this
project. Keep `hybridResourceAwareFreshChance` as a real search-quality control
and use `1.0` as the current quality-oriented continuous default candidate for
further validation. The next improvement should make resource-aware generation
more score-aware, because both 10M runs plateaued by `5,000,000` attempts.

## Current Read

The search system now has better persistence and measurement, but not yet a
compounding quality loop. The useful corpus pieces are:

- exact candidate evaluations;
- checkpoint best history;
- motifs as evidence;
- labeled reuse trial outcomes;
- direct seed-warmup evaluation summaries.

The failed pieces are:

- exact promoted candidate replay;
- materialized promoted seed storage;
- naive neighbor mutations around current best candidates;
- treating island-local improvement as global quality improvement;
- using sub-1M budgets for search-quality conclusions.

## Implications For Neural Work

Neural guidance is worth considering only after defining a supervised signal
that the current heuristics failed to capture. Based on the failures above, a
useful neural experiment should not learn "replay this candidate." It should
instead learn one of:

- a value model that predicts whether a partial plan can beat the current
  global best after exact simulation;
- a policy that proposes action/passive/sublimation edits with higher expected
  simulator score than the current handcrafted mutations;
- a repair model that targets invalid boundary candidates and predicts edits
  likely to become valid without losing too much score;
- a bandit/ranking layer that chooses between mutation families based on
  measured trial outcomes.

Any neural candidate remains a search hint only. Final ranking must stay
simulator-backed and TypeScript-oracle validated.

## Next Useful Experiment

Before training a neural guide, add one more non-neural baseline:

- learn strategy-level success rates from `continuous_reuse_trials`;
- suppress mutation strategies whose scored trials underperform their source;
- prioritize strategies that produce global-best improvements, not merely
  island-local improvements;
- validate with a matched 1M A/B before considering 10M.

Implementation note: `--reuse-trials` now defaults to
`--reuse-policy adaptive`, which aggregates reuse-trial outcomes by strategy,
suppresses strategies with enough negative source-relative evidence, and
reports `reusePolicySuppressedStrategies` plus `reuseStrategyEvidence` in each
round summary. Use `--reuse-policy off` for the matched non-adaptive control.

Important validation detail: from a reset corpus, a 2-round run reaches 1M
attempts but does not give the adaptive policy a chance to act. Round 1 has no
candidate evidence to mutate; round 2 creates and records reuse-trial evidence;
round 3 is the first round where policy suppression can use that evidence.
The first policy-active validation pair should therefore use at least 3 rounds:

```bash
pnpm search:rust-wasm -- --session reuse-policy-off-1m --db .optimizer/reuse-policy-off-1m.sqlite --scenario t3-full --seed reuse-policy-1m --workers 10 --chunk-size 50000 --max-rounds 3 --reuse-trials --reuse-policy off --reset
pnpm search:rust-wasm -- --session reuse-policy-adaptive-1m --db .optimizer/reuse-policy-adaptive-1m.sqlite --scenario t3-full --seed reuse-policy-1m --workers 10 --chunk-size 50000 --max-rounds 3 --reuse-trials --reuse-policy adaptive --reset
```

That gives each side `1_500_000` attempts and lets the adaptive session learn
from round-two trial evidence before round three.

Initial validation on 2026-06-17 used the equivalent resumed 3-round flow:

| Mode | Final score at 1M | Final score at 1.5M | Policy action in active round | Valid active-round trials | Global-best trial improvements |
| --- | ---: | ---: | --- | ---: | ---: |
| Reuse policy off | `177492.45` | `179886.39` | none | `4 / 10` | `0` |
| Adaptive reuse policy | `177492.45` | `179886.39` | suppressed `rotate-turn-actions` | `0 / 10` | `0` |

Conclusion: the adaptive selector correctly stopped spending budget on a
known-negative strategy, but it did not improve final score or produce
global-best trial improvements. This is a useful safety filter, not yet a
compounding quality loop.

If that still fails, move to a neural policy/value proposal with explicit
training data, labels, validation split, and exact-oracle acceptance criteria.

That proposal now starts offline. Use:

```bash
pnpm learned-policy:export -- --db .optimizer/reuse-policy-adaptive-1m.sqlite --out .optimizer/learned-policy-dataset.jsonl --split-key session
pnpm learned-policy:evaluate -- --dataset .optimizer/learned-policy-dataset.jsonl --top-k 10
```

The current tiny adaptive corpus is not sufficient for online learned guidance:
the evaluator sees only negative `rotate-turn-actions` scored examples and
reports zero lift over handcrafted ordering. Online integration is gated on
held-out top-k score-delta and validity lift, not on model availability.
