## Plateau-Adaptive Restart Entropy

Hypothesis: the current best learned loadout plus learned action-set plus
contextual adjacent-swap search still plateaus late. The strongest `10M` run
reached `187597.94` at `3,500,000` attempts, stayed flat through `9,500,000`,
then jumped to `188558.81` at `10,000,000`. A plateau-triggered entropy policy
may make that kind of late escape earlier or more reliable without damaging the
validated proposal space.

First mechanism: opt-in plateau-adaptive restarts. The continuous CLI tracks
rounds since the global best improved. After a configured number of completed
non-improving rounds, the next round enters plateau mode and sends a lower
Rust/WASM `hybridStagnationLimitMultiplier`. Rust then restarts islands sooner,
preserving elites while increasing in-space resource-aware immigrants. Learned
loadout, learned action-set, resource-aware fresh construction, and contextual
adjacent swaps remain active; the spell catalog is not broadened.

Success criteria:

- smoke must show plateau telemetry is emitted and the Rust stagnation limit is
  reduced only in plateau-active rounds;
- matched validation must use the same scenario, seed, workers, chunk size, and
  rounds as the baseline;
- the first quality gate should use the smallest budget that triggers plateau
  mode, not a sub-`1M` smoke;
- final score must beat the current contextual baseline at the same budget, or
  plateau telemetry must show direct global-best improvement from active
  plateau rounds without final-score regression;
- top candidates must remain TypeScript-oracle valid;
- a tie or loss means this restart-entropy policy should be removed or refined,
  not scaled to `10M`.

100k wiring smoke on `t3-full`, seed `plateau-restart-smoke`, workers `2`,
chunk size `50_000`, max rounds `1`, with the current best flags plus
`--plateau-adaptive-restarts --plateau-trigger-rounds 0
--plateau-stagnation-multiplier 0.5`:

| Round | Final score | Valid rate | Plateau active | Plateau restarts | Plateau immigrants | Rust stagnation limit metric | Oracle |
| ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| `1` | `184827.13` | `0.3064` | yes | `1,863` | `44,712` | `480` | top 5 valid |

Smoke read: wiring passed. The forced plateau mode was active from round `1`,
the summary emitted plateau telemetry, and restarts/immigrants increased
materially while staying inside the learned loadout/action-set space. This is
not quality evidence because it is below `1M` and intentionally forced plateau
mode before any real stagnation.

Matched `5M` validation on `t3-full`, seed `learned-loadout-10m`, workers
`10`, chunk size `50_000`, max rounds `10`, with plateau trigger `2` and
stagnation multiplier `0.5`:

| Mode | Score at 3.5M | Final score at 5M | Final valid rate | Plateau active at 5M | Final round restarts | Final round immigrants | Final round stagnation limit metric | Plateau global-best improved | Oracle |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- | --- |
| Current contextual baseline | `187597.94` | `187597.94` | `0.4580` | no | `6,519` | `156,456` | `4,800` | n/a | top 5 valid |
| Plateau restarts, multiplier `0.5` | `187597.94` | `187597.94` | `0.3523` | yes | `9,609` | `230,616` | `2,400` | no | top 5 valid |

Conclusion: reject multiplier `0.5` as too aggressive. The plateau trigger and
telemetry worked, but the first active plateau round tied the baseline final
score, produced no global-best improvement, and damaged validity by `10.57`
percentage points. Do not scale this setting. The next refinement should keep
the same plateau-adaptive restart mechanism but use a milder multiplier before
deciding whether the mechanism itself is dead.

Matched `5M` refinement with the same setup but stagnation multiplier `0.75`:

| Mode | Final score at 5M | Final valid rate | Plateau active at 5M | Final round restarts | Final round immigrants | Final round stagnation limit metric | Plateau global-best improved | Oracle |
| --- | ---: | ---: | --- | ---: | ---: | ---: | --- | --- |
| Current contextual baseline | `187597.94` | `0.4580` | no | `6,519` | `156,456` | `4,800` | n/a | top 5 valid |
| Plateau restarts, multiplier `0.75` | `187597.94` | `0.4144` | yes | `7,769` | `186,456` | `3,600` | no | top 5 valid |

Refinement conclusion: reject plateau-adaptive restart entropy. The milder
setting reduced the validity damage compared with `0.5`, but still tied the
baseline endpoint and produced no plateau-round global-best improvement. The
mechanism increases resource-aware immigrant volume, but that volume displaces
too much of the contextual/action-order stream that made the current baseline
strong. The next plateau hypothesis should bias toward contextual/order
neighbors or late local plan perturbations, not more full-candidate restarts.

## Plateau Local Order/Target Seeds

Hypothesis: the `10M` final jump from `187597.94` to `188558.81` kept the same
loadout, the same learned spell set, and the same `24`-action width. The visible
difference was local action order and target choice, especially in-turn
adjacent ordering and one `orbes-luisants` target. Instead of increasing full
candidate restarts, plateau mode should inject a small deterministic set of
local order/target perturbation seeds derived from the current global best.

Success criteria:

- plateau local seeds must activate only after the configured plateau trigger;
- matched `5M` validation must beat the current contextual baseline at `5M`
  (`187597.94`) or show direct plateau-seed global-best improvement without
  final-score regression;
- final top candidates must remain TypeScript-oracle valid;
- a tie without plateau-seed global-best improvement means this seed policy
  should be removed or refined, not scaled.

200k wiring smoke on `t3-full`, seed `plateau-order-smoke`, workers `2`,
chunk size `50_000`, max rounds `2`, with the current best flags plus
`--plateau-order-seeds --plateau-trigger-rounds 0
--plateau-order-seeds-per-worker 2`:

| Round | Final score | Valid rate | Plateau active | Seed candidates | Evaluated seeds | Valid seeds | Island-improving seeds | Plateau global-best improved | Oracle |
| ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- |
| `1` | `185637.19` | `0.4039` | no | `0` | `0` | `0` | `0` | no | top 5 valid |
| `2` | `186807.08` | `0.4221` | yes | `4` | `4` | `3` | `3` | yes | top 5 valid |

Smoke read: wiring passed. Plateau mode stayed off before a previous best
existed, then activated on the next round with the forced trigger. The policy
injected and evaluated all selected local seeds, with `3/4` valid and
island-improving. This remains below `1M`, so it is only wiring evidence.

Matched `5M` validation on `t3-full`, seed `learned-loadout-10m`, workers
`10`, chunk size `50_000`, max rounds `10`, with plateau trigger `2` and
`1` order/target seed per worker:

| Mode | Score at 3.5M | Final score at 5M | Final valid rate | Plateau active at 5M | Used seeds | Valid seeds | Island-improving seeds | Plateau seed global-best improvements | Oracle |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| Current contextual baseline | `187597.94` | `187597.94` | `0.4580` | no | n/a | n/a | n/a | n/a | top 5 valid |
| Plateau order/target seeds, trigger `2`, per-worker `1` | `187597.94` | `187597.94` | `0.4542` | yes | `10` | `8` | `8` | `0` | top 5 valid |

Gate read: do not scale trigger `2` / per-worker `1`. The policy activated
only on the final `5M` round, and although the selected local seeds were mostly
valid and island-improving, none produced a global-best improvement and the
endpoint only tied the baseline with slightly lower valid rate. This result is
not a quality improvement. A narrow refinement is still justified before
removal because the local seeds had high validity/island-improvement signal;
the next run should activate one round earlier and use more local seeds so the
same mechanism gets enough plateau exposure to prove or disprove itself.

Refinement success criteria: with the same matched `5M` setup, trigger `1` and
`2` order/target seeds per worker must beat `187597.94`, or show direct
plateau-seed global-best improvement without final-score regression. Another
tie with zero seed-driven global-best improvements means remove this policy
from source and keep only the observations.

Matched `5M` refinement with the same setup, plateau trigger `1`, and `2`
order/target seeds per worker:

| Mode | Final score at 5M | Final valid rate | Plateau-active rounds | Used seeds per active round | Valid seeds at 5M | Island-improving seeds at 5M | Plateau seed global-best improvements | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Current contextual baseline | `187597.94` | `0.4580` | n/a | n/a | n/a | n/a | n/a | top 5 valid |
| Plateau order/target seeds, trigger `1`, per-worker `2` | `187597.94` | `0.4469` | `4` | `20` | `16` | `16` | `0` | top 5 valid |

Refinement conclusion: reject plateau local order/target seeds. Earlier and
larger seed pressure produced repeated valid/island-improving seed evaluations,
but still no direct seed-driven global-best improvement and no endpoint lift.
It also reduced final valid rate by `1.11` percentage points versus the
baseline. The local perturbations look useful as island warmups, but not strong
enough to compound into better global discoveries under this seed-injection
shape. Remove the policy from source instead of scaling to `10M`.

## Plateau Local Refinement Cadence

Hypothesis: the failed seed-injection variants showed that local perturbations
can be valid and island-improving, but external warmup seeds did not compound
into global-best discoveries. A narrower in-space alternative is to leave the
candidate families unchanged and, only during cross-round plateau mode, spend
more Rust/WASM attempts on existing-population local refinements by tightening
the local and stagnation refinement intervals. This should preserve learned
loadout/action-set/contextual-swap relevance while increasing mutation entropy
around the current island populations.

Success criteria:

- opt-in only, via `--plateau-local-refinement`;
- plateau mode activates after configured global no-improvement rounds and is
  visible in checkpoint summaries;
- Rust/WASM metrics expose plateau refinement mode and effective refinement
  cadence;
- sub-`1M` smoke only proves wiring;
- matched `5M` validation must beat the current contextual baseline at `5M`
  (`187597.94`) or show direct plateau-round global-best improvement without
  final-score or oracle regression;
- a tie with no direct plateau-round global-best improvement means remove or
  refine before any `10M` scale run.

200k wiring smoke on `t3-full`, seed `plateau-local-refinement-smoke`, workers
`2`, chunk size `50_000`, max rounds `2`, with the current best flags plus
`--plateau-local-refinement --plateau-trigger-rounds 0`:

| Round | Final score | Valid rate | Plateau active | Plateau mode islands | Local refinements | Local interval metric | Stagnation interval metric | Plateau global-best improved | Oracle |
| ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- |
| `1` | `185637.19` | `0.3972` | no | `0` | `2,902` | `288` | `84` | no | top 5 valid |
| `2` | `186035.28` | `0.4373` | yes | `12` | `5,864` | `144` | `36` | yes | top 5 valid |

Smoke read: wiring passed. The first round stayed out of plateau mode because
there was no previous best. The second round activated all `12` Rust islands,
halved the effective local-refinement interval metrics, increased local
refinements, and kept TypeScript oracle validation green. This is below `1M`,
so it is not quality evidence.

Matched `5M` validation on `t3-full`, seed `learned-loadout-10m`, workers
`10`, chunk size `50_000`, max rounds `10`, with plateau trigger `1`:

| Mode | Score at 3.5M | Final score at 5M | Final valid rate | Plateau-active rounds | Plateau mode islands per active round | Final local refinements | Plateau global-best improved | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Current contextual baseline | `187597.94` | `187597.94` | `0.4580` | n/a | n/a | n/a | n/a | top 5 valid |
| Plateau local refinement cadence | `187329.53` | `187329.53` | `0.4675` | `5` | `60` | `29,376` | only at `2M`, below baseline path | top 5 valid |

Conclusion: reject plateau local-refinement cadence. Tightening refinement
cadence increased valid rate and produced a plateau-round improvement at `2M`,
but it displaced the baseline path that reaches `187597.94` at `3.5M`. The
variant finished `268.41` points below the matched baseline at `5M`. Do not
scale; remove the policy from source. This failure suggests that simply
increasing local mutation density around current islands is too exploitative
and can suppress the broader contextual/action-order path that produced the
current best.

## Plateau Elite-Retention Relaxation

Hypothesis: the failed restart and local-refinement variants show that stronger
restart pressure and stronger local exploitation both damage relevance. A
milder plateau entropy knob is to relax elite pressure only during plateau
rounds: retain a larger elite set on Rust/WASM restarts so more high-relevance
variants survive, while keeping the same learned loadout/action-set,
contextual swaps, population size, stagnation limit, immigrant batch size, and
candidate families.

Success criteria:

- opt-in only, via `--plateau-elite-retention`;
- plateau mode activates after configured global no-improvement rounds and is
  visible in checkpoint summaries;
- Rust/WASM metrics expose plateau elite-retention mode and effective retained
  elite count;
- sub-`1M` smoke only proves wiring;
- matched `5M` validation must beat the current contextual baseline at `5M`
  (`187597.94`) or show direct plateau-round global-best improvement without
  final-score, valid-rate, or oracle regression;
- a tie or loss means remove/refine before any `10M` scale run.

200k wiring smoke on `t3-full`, seed `plateau-order-chain-smoke`, workers `2`,
chunk size `50_000`, max rounds `2`, with the current best flags plus
`--plateau-order-chain-neighbors --plateau-trigger-rounds 0`:

| Round | Final score | Valid rate | Plateau active | Plateau mode islands | Order-chain neighbors | Plateau global-best improved | Oracle |
| ---: | ---: | ---: | --- | ---: | ---: | --- | --- |
| `1` | `185637.19` | `0.3944` | no | `0` | `0` | no | top 5 valid |
| `2` | `186446.31` | `0.4288` | yes | `12` | `3,207` | yes | top 5 valid |

Smoke read: wiring passed. The policy stayed inert before plateau mode,
activated all `12` Rust islands once forced, generated order-chain neighbors,
and kept TypeScript oracle validation green. This remains below `1M`, so it is
not quality evidence.

Matched `5M` validation on `t3-full`, seed `learned-loadout-10m`, workers
`10`, chunk size `50_000`, max rounds `10`, with plateau trigger `1`:

| Mode | Score at 2.5M | Score at 3M | Final score at 5M | Final valid rate | Plateau-active rounds | Order-chain neighbors in active rounds | Plateau global-best improved | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| Current contextual baseline | `187329.53` | `187485.13` | `187597.94` | `0.4580` | n/a | n/a | n/a | top 5 valid |
| Plateau order-chain neighbors | `188256.13` | `188558.81` | `188558.81` | `0.4650` | `4` | `13,394`; `8,890`; `8,805`; `8,436` | at `2M`, followed by global-best lifts at `2.5M` and `3M` | top 5 valid |

Gate read: first strong pass. The variant reached the current known `10M` best
score by `3M`, finished `960.87` above the matched `5M` baseline, and did not
regress oracle status or final valid rate. This is not enough for promotion by
itself: run an independent matched `5M` repeat before any `10M` scale claim.

Independent matched `5M` repeat on `t3-full`, seed
`plateau-order-chain-repeat-5m`, workers `10`, chunk size `50_000`, max rounds
`10`:

| Mode | Score at 3M | Score at 3.5M | Final score at 5M | Final valid rate | Plateau-active rounds | Order-chain neighbors in active rounds | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Repeat contextual baseline | `187329.53` | `187329.53` | `187329.53` | `0.4563` | n/a | n/a | top 5 valid |
| Repeat plateau order-chain neighbors | `187597.94` | `188558.81` | `188558.81` | `0.4588` | `3` | `12,134`; `8,504`; `8,421` | top 5 valid |

Repeat read: confirmed. The plateau order-chain variant again reached the
current known `10M` best materially earlier, this time by `3.5M`, and finished
`1,229.28` above the matched repeat baseline at `5M` without oracle regression.
Proceed to the required `10M` scale check against `188558.81`.

Clean `10M` scale check on `t3-full`, seed `learned-loadout-10m`, workers
`10`, chunk size `50_000`, max rounds `20`, with plateau trigger `1`:

| Mode | Score at 3M | Final score at 10M | Final valid rate | Plateau-active rounds after 3M | Final round order-chain neighbors | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Current contextual baseline | `187485.13` | `188558.81` | `0.4609` | n/a | n/a | top 5 valid |
| Plateau order-chain neighbors | `188558.81` | `188558.81` | `0.4645` | `14` | `8,949` | top 5 valid |

Scale read: promote. The variant did not beat the current score record, but it
reached the same `188558.81` score by `3M` instead of `10M`, held it through the
full `10M` run, preserved TypeScript oracle `5/5`, and ended with a slightly
higher valid rate than the baseline. The independent matched `5M` repeat also
reached `188558.81` by `3.5M` while its baseline stayed at `187329.53`.

200k wiring/refinement smokes on `t3-full`, seed
`plateau-elite-neighbor-priority-smoke`, workers `2`, chunk size `50_000`, max
rounds `2`, with the current best flags plus
`--plateau-elite-neighbor-priority --plateau-trigger-rounds 0`:

| Variant | Round 2 score | Round 2 valid rate | Priority selections | Repair candidates | Elite-neighbor candidates | Local refinements | Oracle | Read |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Aggressive, preempt every repair when both queues exist | `186807.08` | `0.2843` | `43,226` | `8,607` | `43,226` | n/a | top 5 valid | wiring passed, relevance collapsed |
| Preserve first repair, preempt after one consecutive repair | `187180.17` | `0.3579` | `27,682` | `27,852` | `27,682` | `15` | top 5 valid | still too aggressive; local refinement nearly disappeared |
| Preempt after three consecutive repairs | `186035.28` | `0.4276` | `0` | `37,349` | `14,896` | `3,114` | top 5 valid | relevance recovered but policy became inert |
| Preempt after two consecutive repairs | `186807.08` | `0.4096` | `17,998` | `37,326` | `17,998` | n/a | top 5 valid | nonzero policy signal with tolerable smoke validity |

Smoke read: threshold `2` is the only variant worth a matched run. Threshold
`1` and the original aggressive form shifted too much budget away from repair
and local refinement. Threshold `3` avoided damage but did not activate.

Matched `5M` validation for threshold `2` on `t3-full`, seed
`learned-loadout-10m`, workers `10`, chunk size `50_000`, max rounds `10`,
with plateau trigger `1`:

| Mode | Score at 3.5M | Final score at 5M | Final valid rate | Plateau-active rounds | Priority selections in active rounds | Plateau global-best improved | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Current contextual baseline | `187597.94` | `187597.94` | `0.4580` | n/a | n/a | n/a | top 5 valid |
| Plateau elite-neighbor priority, repair streak `2` | `187393.07` | `187393.07` | `0.4409` | `4` | `78,264`; `76,199`; `88,807`; `77,679`; `87,517` | at `2M` and `3.5M`, but below baseline path | top 5 valid |

Conclusion: reject and remove from source. The policy produced real plateau
activity and two global-best lifts, but it still trailed the contextual
baseline by `204.87` at `5M`, had a weaker final valid rate, and did not reach
the known `187597.94` plateau. This reinforces the prior conclusion: generic
plateau entropy knobs can move search families around, but they are not yet
choosing the right evidence-backed families. The next hypothesis should use
continuous corpus evidence to select context-specific proposal pressure rather
than hardwiring another global plateau entropy increase.

## Plateau Order-Chain Neighbors

Hypothesis: the `10M` jump to `188558.81` preserves the learned loadout and
action set, but changes several in-turn order relationships. Previous external
order/target seeds were valid and island-improving, yet did not compound into a
global-best lift. A narrower in-space policy is to keep the normal search path
unchanged and, only during global plateau mode, add a small number of two-step
adjacent-swap order neighbors when Rust/WASM enqueues elite neighbors for an
island improvement. This can cross shallow order valleys without increasing
restart, repair, or generic mutation cadence.

Success criteria:

- opt-in only, via `--plateau-order-chain-neighbors`;
- plateau mode activates after configured global no-improvement rounds and is
  visible in checkpoint summaries;
- Rust/WASM metrics expose plateau order-chain mode and generated order-chain
  neighbor counts;
- sub-`1M` smoke only proves wiring;
- matched `5M` validation must beat the current contextual baseline at `5M`
  (`187597.94`) or show direct plateau-round global-best improvement without
  final-score, valid-rate, or oracle regression;
- a tie or loss means remove/refine before any `10M` scale run.

Initial 200k wiring smoke on `t3-full`, seed
`plateau-elite-neighbor-priority-smoke`, workers `2`, chunk size `50_000`, max
rounds `2`, with the current best flags plus
`--plateau-elite-neighbor-priority --plateau-trigger-rounds 0`:

| Round | Final score | Valid rate | Plateau active | Priority mode islands | Priority selections | Repair candidates | Elite-neighbor candidates | Oracle |
| ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| `1` | `185637.19` | `0.3967` | no | `0` | `0` | `35,460` | `14,136` | top 5 valid |
| `2` | `186807.08` | `0.2843` | yes | `12` | `43,226` | `8,607` | `43,226` | top 5 valid |

Smoke read: wiring passed but the policy was too aggressive. It nearly
replaced repair work with elite-neighbor processing and collapsed valid rate.
Refine before any matched run: preserve the first repair in each repair burst,
then allow plateau priority to preempt subsequent repair attempts when an
elite-neighbor candidate is queued. The refined smoke must avoid the validity
collapse before moving to `5M`.

200k wiring smoke on `t3-full`, seed `plateau-elite-retention-smoke`, workers
`2`, chunk size `50_000`, max rounds `2`, with the current best flags plus
`--plateau-elite-retention --plateau-trigger-rounds 0`:

| Round | Final score | Valid rate | Plateau active | Plateau mode islands | Elite-count metric | Plateau global-best improved | Oracle |
| ---: | ---: | ---: | --- | ---: | ---: | --- | --- |
| `1` | `185637.19` | `0.3946` | no | `0` | `0` | no | top 5 valid |
| `2` | `186035.28` | `0.4212` | yes | `12` | `288` | yes | top 5 valid |

Smoke read: wiring passed. The first round stayed out of plateau mode because
there was no previous best. The second round activated all `12` Rust islands,
reported the increased elite-retention metric, and kept TypeScript oracle
validation green. This is below `1M`, so it is not quality evidence.

Matched `5M` validation on `t3-full`, seed `learned-loadout-10m`, workers
`10`, chunk size `50_000`, max rounds `10`, with plateau trigger `1`:

| Mode | Score at 3.5M | Final score at 5M | Final valid rate | Plateau-active rounds | Plateau mode islands per active round | Elite-count metric | Plateau global-best improved | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Current contextual baseline | `187597.94` | `187597.94` | `0.4580` | n/a | n/a | n/a | n/a | top 5 valid |
| Plateau elite-retention relaxation | `187597.94` | `187597.94` | `0.4580` | `4` | `60` | `1,440` | at `2M` and `3M`, matching baseline path | top 5 valid |

Conclusion: reject as neutral. This was the least damaging plateau-entropy
variant so far: it preserved the baseline trajectory and final valid rate
instead of damaging them. But it produced no endpoint lift at `5M`, and the
plateau-round improvements only matched the known baseline path rather than
proving a new escape. Do not scale to `10M`; remove the policy from source and
keep the observation. The useful signal is negative: broad entropy knobs are
not enough, and the next step should use corpus evidence to choose which
existing family to emphasize instead of applying a generic plateau knob.

## Plateau Elite-Neighbor Priority

Hypothesis: the current best late jump does not appear as an external
seed-candidate win; it comes through the normal Rust search path. Per-round
metrics show repair work dominates plateau chunks, while queued elite
neighbors include contextual/order/replacement perturbations around known good
population members. During plateau mode, prefer queued elite neighbors over
repair bursts when both queues are non-empty, keeping the same learned
loadout/action-set/contextual swaps and all existing candidate families.

Success criteria:

- opt-in only, via `--plateau-elite-neighbor-priority`;
- plateau mode activates after configured global no-improvement rounds and is
  visible in checkpoint summaries;
- Rust/WASM metrics expose plateau elite-neighbor priority mode and priority
  selection counts;
- sub-`1M` smoke only proves wiring;
- matched `5M` validation must beat the current contextual baseline at `5M`
  (`187597.94`) or show direct plateau-round global-best improvement without
  final-score, valid-rate, or oracle regression;
- a tie or loss means remove/refine before any `10M` scale run.
