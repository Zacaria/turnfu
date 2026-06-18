### Learned Action-Set Prior

Hypothesis: after the learned loadout prior removes loadout noise, remaining
proposal waste may come from spells that never appear in the strongest
locked-loadout evidence. Narrowing only the available spell catalog to the
stable top-corpus action set should improve proposal relevance without replaying
exact action order, counts, targets, passives, sublimations, or full candidates.

Implementation: add opt-in CLI flag `--learned-action-set-prior`, which sets
`availableSpellIds` to the 12 spells observed in the top locked-loadout
`10M` candidates:

- `coeur-de-lumiere`
- `debacle`
- `eboulement`
- `epee-de-lumiere`
- `fleche-de-lumiere`
- `flux-denergie`
- `halo-chatoyant`
- `lueur-de-laube`
- `ombres-dansantes`
- `orbes-luisants`
- `papillons-diurnes`
- `runification`

Success criteria:

- smoke must show the flag is active through `availableSpellCount` and keep
  top candidates oracle-valid;
- matched `>=1M` validation must beat learned-loadout-only on final score with
  the same scenario, seed, workers, chunk size, and round count;
- lower validity is acceptable only if final simulator-backed score improves;
- a tie or loss means the action-set prior should not be scaled.

200k wiring smoke on `t3-full`, seed `learned-action-set-smoke`, workers `2`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--learned-loadout-prior --learned-action-set-prior`:

| Round | Final score | Valid rate | Available spell count | Oracle |
| ---: | ---: | ---: | ---: | --- |
| 1 | `185282.26` | `0.4012` | `12` | top 5 valid |
| 2 | `185680.35` | `0.4214` | `12` | top 5 valid |

Smoke read: wiring passed. This score is not a search-quality conclusion
because it is below `1M`, but the mechanism clearly changed proposal
construction and preserved oracle validity.

Matched `1M` validation on `t3-full`, seed `learned-action-set-1m`, workers
`10`, chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
against the learned-loadout-only baseline:

| Mode | Score at 500k | Final score at 1M | Best at attempts | Final valid rate | Available spell count | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Learned loadout prior | `182712.23` | `182712.23` | `500,000` | `0.0032` | `29` | top 5 valid |
| Learned loadout + action-set prior | `185282.26` | `186138.94` | `1,000,000` | `0.4231` | `12` | top 5 valid |

Conclusion: keep and repeat the learned action-set prior. This is the first
mechanism after the learned loadout prior that improves final score, proposal
validity, and best-at-attempts at the `1M` quality gate. The final score lift
was `+3426.71` over learned-loadout-only, and the valid rate moved from rare
valid discoveries (`0.0032`) to a much healthier `0.4231`. This is not exact
candidate replay because only the available spell catalog is narrowed; action
order, turn structure, targets, loadout scoring, and final ranking remain
Rust/WASM search plus exact TypeScript oracle validation. The next gate should
be an independent matched `1M` repeat before spending a `10M` run.

Independent matched `1M` repeat on `t3-full`, seed
`learned-action-set-repeat-1m`, workers `10`, chunk size `50_000`, max rounds
`2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Best at attempts | Final valid rate | Available spell count | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Learned loadout prior | `182712.23` | `182712.23` | `500,000` | `0.0032` | `29` | top 5 valid |
| Learned loadout + action-set prior | `185282.26` | `186138.94` | `1,000,000` | `0.4223` | `12` | top 5 valid |

Repeat conclusion: promote the learned action-set prior to the next scale gate.
It reproduced the same `+3426.71` score lift on an independent seed and again
converted the locked-loadout search from very rare valid proposals to roughly
`42%` valid proposals. The mechanism is now strong enough for a matched `10M`
run against the learned-loadout-only baseline before considering it a new
default quality-oriented continuous setting.

Matched `10M` scale validation on `t3-full`, seed `learned-loadout-10m`,
workers `10`, chunk size `50_000`, max rounds `20`,
`--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Score at 1M | Score at 2.5M | Final score at 10M | Best at attempts | Final valid rate | Available spell count | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Learned loadout prior | `182712.23` | `182712.23` | `183590.76` | `184819.25` | `7,500,000` | `0.0475` | n/a | top 5 valid |
| Learned loadout + action-set prior | `185282.26` | `186053.44` | `187329.53` | `187393.07` | `6,500,000` | `0.4614` | `12` | top 5 valid |

Scale conclusion: promote the learned action-set prior as the new strongest
quality-oriented continuous setting. It improved the matched `10M` endpoint by
`2573.82` over learned-loadout-only and by `4128.90` over the resource-aware
baseline from the previous learned-loadout scale gate. It also reversed the
major caveat of learned loadout alone: valid proposal rate increased from
`0.0475` to `0.4614`, while final score improved. This is a proposal-relevance
win, not just a validity win, because the exact simulator-backed score improved
and the final top candidates remained TypeScript-oracle valid. The next
research step should use learned loadout plus learned action-set as the baseline
and look for action-order or turn-structure mechanisms that beat `187393.07`
without reintroducing exact candidate replay.

### Learned Action-Key Prior

Hypothesis: the learned action-set prior still expands the 12 learned spells
into 19 spell/target action keys, while the top learned-action-set `10M`
candidate evidence uses only 13 action keys. Filtering to the stable action-key
set may remove low-value target variants and unused spells while still avoiding
exact candidate replay. This narrows the proposal alphabet, not the action
order, turn structure, or final ranking.

Top learned-action-set `10M` evidence used these action keys:

- `coeur-de-lumiere`
- `debacle`
- `eboulement`
- `epee-de-lumiere`
- `fleche-de-lumiere`
- `flux-denergie`
- `halo-chatoyant`
- `halo-chatoyant@emptyCell`
- `ombres-dansantes`
- `orbes-luisants`
- `orbes-luisants@feuFollet`
- `papillons-diurnes`
- `runification`

Temporary implementation: add request field `availableActionKeys` and CLI flag
`--learned-action-key-prior`. Rust/WASM still built search actions from
`availableSpellIds`, then filtered the generated spell/target action keys to
the allowed list. Final scoring and oracle validation remained unchanged.

Success criteria:

- smoke must show `availableActionKeyCount: 13`, exercise the Rust filter, and
  keep top candidates oracle-valid;
- matched `>=1M` validation must beat learned loadout plus learned action-set
  on final score with the same scenario, seed, workers, chunk size, and round
  count;
- improving validity without final-score lift is not enough;
- a tie or loss means the action-key prior should be removed or left as a
  rejected experiment, not scaled.

200k wiring smoke on `t3-full`, seed `learned-action-key-smoke`, workers `2`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--learned-loadout-prior --learned-action-set-prior
--learned-action-key-prior`:

| Round | Final score | Valid rate | Available spell count | Available action-key count | Oracle |
| ---: | ---: | ---: | ---: | ---: | --- |
| 1 | `184827.13` | `0.2989` | `12` | `13` | top 5 valid |
| 2 | `185282.26` | `0.3510` | `12` | `13` | top 5 valid |

Smoke read: wiring passed and the Rust action-key filter was active, but the
score and valid rate were both lower than the learned-action-set smoke. Because
smoke is below the minimum quality budget, the hypothesis still needed a
matched `1M` gate before rejection.

Matched `1M` validation on `t3-full`, seed `learned-action-key-1m`, workers
`10`, chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final valid rate | Available action-key count | Oracle |
| --- | ---: | ---: | ---: | ---: | --- |
| Learned loadout + action-set prior | `185282.26` | `186138.94` | `0.4204` | n/a | top 5 valid |
| Learned loadout + action-set + action-key prior | `185282.26` | `186053.44` | `0.3551` | `13` | top 5 valid |

Conclusion: reject and remove the learned action-key prior. The filter was too
narrow: it removed target variants and `lueur-de-laube`, but that reduced both
validity and final score at the `1M` gate. The loss was small (`-85.50`), but
the predeclared success criterion was final-score lift over the action-set
baseline. Do not scale this to `10M`. The useful lesson is that the 12-spell
action-set prior is broad enough to preserve productive target/search diversity,
while filtering down to the observed top action keys overfits the current
corpus. The temporary request field and CLI flag were removed after validation.

### Learned Turn-Width Prior

Hypothesis: the current best learned-loadout plus learned-action-set `10M`
corpus still uses the broader `t3-full` max of 12 actions per turn, but every
top valid persisted row in the sampled corpus uses exactly `8,8,8` actions.
Capping `maxActionsPerTurn` to 8 may improve proposal relevance by preventing
overlong plans while still leaving action choice, action order, targets, and
final scoring fully searched.

Corpus read from `.optimizer/learned-action-set-variant-10m.sqlite`, top valid
rows:

| Sample | Action-count pattern |
| --- | --- |
| Top `29` valid rows | `8,8,8` for all sampled candidates |

Implementation: add opt-in CLI flag `--learned-turn-width-prior`, which sets
the Rust/WASM request `maxActionsPerTurn` to `8` for continuous search. This is
not exact replay: it narrows the per-turn width bound only.

Success criteria:

- smoke must show `effectiveMaxActionsPerTurn: 8` and keep top candidates
  oracle-valid;
- matched `>=1M` validation must beat learned loadout plus learned action-set
  with the default `t3-full` width 12 on final score;
- higher valid rate or speed without final-score lift is not enough;
- a tie or loss means the turn-width prior should be removed or left rejected,
  not scaled.

200k wiring smoke on `t3-full`, seed `learned-turn-width-smoke`, workers `2`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--learned-loadout-prior --learned-action-set-prior
--learned-turn-width-prior`:

| Round | Final score | Valid rate | Effective max actions per turn | Oracle |
| ---: | ---: | ---: | ---: | --- |
| 1 | `185282.26` | `0.5698` | `8` | top 5 valid |
| 2 | `185680.35` | `0.6258` | `8` | top 5 valid |

Smoke read: wiring passed and the turn-width cap increased validity, but the
score did not beat the prior action-set smoke. Because smoke is below the
minimum quality budget, the hypothesis still needed a matched `1M` gate.

Matched `1M` validation on `t3-full`, seed `learned-turn-width-1m`, workers
`10`, chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final valid rate | Effective max actions per turn | Oracle |
| --- | ---: | ---: | ---: | ---: | --- |
| Learned loadout + action-set prior | `185282.26` | `186053.44` | `0.4204` | `12` | top 5 valid |
| Learned loadout + action-set + turn-width prior | `185282.26` | `186408.37` | `0.6244` | `8` | top 5 valid |

Conclusion: keep and repeat the learned turn-width prior. It improved the
matched `1M` final score by `354.93` while also increasing valid rate. This is
a modest but real proposal-relevance lift at the minimum quality gate. The next
gate should be an independent matched `1M` repeat before considering a `10M`
scale run.

Independent matched `1M` repeat on `t3-full`, seed
`learned-turn-width-repeat-1m`, workers `10`, chunk size `50_000`, max rounds
`2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final valid rate | Effective max actions per turn | Oracle |
| --- | ---: | ---: | ---: | ---: | --- |
| Learned loadout + action-set prior | `185282.26` | `186138.94` | `0.4191` | `12` | top 5 valid |
| Learned loadout + action-set + turn-width prior | `185282.26` | `185680.35` | `0.6246` | `8` | top 5 valid |

Repeat conclusion: reject and remove the learned turn-width prior. The first
`1M` seed showed a small score lift, but the independent repeat lost `458.59`
final score despite higher validity. This is the same pattern as several prior
over-constraining hypotheses: validity improved, but proposal relevance did not
reliably improve final simulator-backed score. Do not scale to `10M`. The
temporary CLI flag was removed after validation.

### Learned Per-Turn Spell-Set Prior

Hypothesis: the learned action-set prior improved relevance by narrowing the
global spell catalog to `12` spells, while the failed action-key and turn-width
priors over-constrained target variants or total turn width. A middle path is
to keep the `12`-spell catalog but bias newly generated actions by turn using
the spell identities that repeatedly appear in the top learned-action-set `10M`
corpus. This should reduce cross-turn spell noise without fixing order, target,
action count, loadout, or final ranking.

Corpus read from `.optimizer/learned-action-set-variant-10m.sqlite`, top `29`
valid rows:

| Turn | Stable or dominant spell evidence |
| ---: | --- |
| `1` | `coeur-de-lumiere`, `debacle`, `eboulement`, `flux-denergie`, `halo-chatoyant`, `orbes-luisants`, `papillons-diurnes` appeared in every sampled row; `orbes-luisants` appeared twice per row |
| `2` | `coeur-de-lumiere`, `debacle`, `epee-de-lumiere`, `fleche-de-lumiere`, `halo-chatoyant`, `ombres-dansantes`, `runification` appeared in every sampled row; `flux-denergie` appeared in `24 / 29`, `eboulement` in `5 / 29` |
| `3` | `coeur-de-lumiere`, `eboulement`, `halo-chatoyant`, `ombres-dansantes`, `orbes-luisants` appeared in every sampled row; `halo-chatoyant` appeared twice per row, `debacle` appeared in `48 / 29` total casts |

Success criteria:

- smoke must show the learned per-turn prior is active, preserve oracle-valid
  top candidates, and exercise Rust/WASM action selection;
- matched `>=1M` validation must beat learned loadout plus learned action-set
  on final score with the same scenario, seed, workers, chunk size, and round
  count;
- higher validity without final-score lift is not enough;
- a tie or loss means the per-turn prior should be removed or left rejected,
  not scaled.

200k wiring smoke on `t3-full`, seed `learned-turn-spell-smoke`, workers `2`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--learned-loadout-prior --learned-action-set-prior
--learned-turn-spell-prior`:

| Round | Final score | Valid rate | Turn spell set sizes | Throughput | Oracle |
| ---: | ---: | ---: | --- | ---: | --- |
| `1` | `186053.44` | `0.6353` | `[7,9,8]` | `1,952.60 it/s` | top 5 valid |
| `2` | `186408.37` | `0.7245` | `[7,9,8]` | `1,742.79 it/s` | top 5 valid |

Smoke read: wiring passed and the per-turn prior materially changed proposal
validity. The result is not a quality conclusion because it is below the
minimum `1M` budget.

Matched `1M` validation on `t3-full`, seed `learned-turn-spell-1m`, workers
`10`, chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final valid rate | Turn spell set sizes | Final round throughput | Oracle |
| --- | ---: | ---: | ---: | --- | ---: | --- |
| Learned loadout + action-set prior | `185282.26` | `186138.94` | `0.4235` | `[]` | `7,955.72 it/s` | top 5 valid |
| Learned loadout + action-set + per-turn spell prior | `186053.44` | `186408.37` | `0.7289` | `[7,9,8]` | `2,587.39 it/s` | top 5 valid |

Conclusion: keep and repeat the learned per-turn spell-set prior. It improved
the matched `1M` endpoint by `269.43` and substantially increased valid rate,
but at a large throughput cost. This is a proposal-relevance candidate, not a
scale-proven default. The next gate is an independent matched `1M` repeat.

Independent matched `1M` repeat on `t3-full`, seed
`learned-turn-spell-repeat-1m`, workers `10`, chunk size `50_000`, max rounds
`2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final valid rate | Turn spell set sizes | Final round throughput | Oracle |
| --- | ---: | ---: | ---: | --- | ---: | --- |
| Learned loadout + action-set prior | `185282.26` | `186053.44` | `0.4191` | `[]` | `8,232.35 it/s` | top 5 valid |
| Learned loadout + action-set + per-turn spell prior | `186053.44` | `186408.37` | `0.7276` | `[7,9,8]` | `2,480.02 it/s` | top 5 valid |

Repeat conclusion: keep the opt-in learned per-turn spell-set prior and
consider a matched `10M` scale gate only if the compute cost is acceptable. The
mechanism survived two matched `1M` gates with final-score lifts of `+269.43`
and `+354.93`, while keeping top candidates TypeScript-oracle valid. The main
caveat is throughput: final-round speed was roughly `3.2x` slower than the
action-set baseline. Because this is a generation prior rather than a reuse
trial or seed warmup, there are no direct source-relative proposal-delta or
global-best trial counters; the evidence is endpoint score, valid rate, and
oracle validation.

Matched `10M` scale validation on `t3-full`, seed `learned-loadout-10m`,
workers `10`, chunk size `50_000`, max rounds `20`,
`--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Score at 1M | Score at 2.5M | Final score at 10M | Best at attempts | Final valid rate | Final round throughput | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Learned loadout + action-set prior | `185282.26` | `186053.44` | `187329.53` | `187393.07` | `6,500,000` | `0.4614` | n/a | top 5 valid |
| Learned loadout + action-set + per-turn spell prior | `186053.44` | `186408.37` | `187329.53` | `187329.53` | `2,500,000` | `0.7485` | `2,521.23 it/s` | top 5 valid |

Scale conclusion: reject and remove the learned per-turn spell-set prior. It
was a repeatable `1M` win, but it failed the current-best `10M` scale gate by
`63.54` score and plateaued from `2,500,000` through `10,000,000` attempts. The
mechanism improved validity dramatically, but narrowed long-run diversity and
did not improve the final simulator-backed score. Do not promote this as a
quality-oriented setting. A future variant would need a diversity valve, such
as probabilistic turn-set escape or adaptive turn-set selection, before another
scale run. The temporary Rust/WASM request field and CLI flag were removed
after validation.

### Learned Action-Set Worker Escape

Hypothesis: learned loadout plus learned action-set is the current strongest
quality baseline, but it plateaued at `6,500,000` attempts in the matched `10M`
run. The failed per-turn prior showed that narrowing further improves early
validity but harms long-run diversity. A small worker-level escape valve could
preserve most proposal relevance while reserving a bounded share of attempts
for the broader spell catalog under the same learned loadout. This tests
diversity without replaying candidates and without changing final scoring.

Temporary implementation plan: add an opt-in continuous CLI flag
`--learned-action-set-escape-workers N`. When used with
`--learned-action-set-prior`, the last `N` workers use the full available spell
catalog while the other workers keep the `12`-spell learned action set. The
initial hypothesis uses `N=1` with `10` workers, so `90%` of attempts remain on
the proven learned action-set prior and `10%` explore off-prior spells.

Success criteria:

- smoke must show the escape worker count is active and keep top candidates
  oracle-valid;
- matched `>=1M` validation must beat learned loadout plus learned action-set
  on final score with the same scenario, seed, workers, chunk size, and round
  count;
- lower valid rate is acceptable only if final simulator-backed score improves;
- a tie or loss means the escape-worker flag should be removed or left
  rejected, not scaled.

200k wiring smoke on `t3-full`, seed `action-set-escape-smoke`, workers `2`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--learned-loadout-prior --learned-action-set-prior
--learned-action-set-escape-workers 1`:

| Round | Final score | Valid rate | Learned-action-set workers | Full-catalog workers | Oracle |
| ---: | ---: | ---: | ---: | ---: | --- |
| `1` | `185282.26` | `0.2016` | `1` | `1` | top 5 valid |
| `2` | `185680.35` | `0.2121` | `1` | `1` | top 5 valid |

Smoke read: wiring passed and the worker split was active. The score is not a
quality conclusion because the run was below `1M` and used a deliberately large
`50%` escape share to exercise the path.

Matched `1M` validation on `t3-full`, seed `action-set-escape-1m`, workers
`10`, chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final valid rate | Learned-action-set workers | Full-catalog workers | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Learned loadout + action-set prior | `185282.26` | `186138.94` | `0.4219` | `10` | `0` | top 5 valid |
| Learned loadout + action-set + one escape worker | `185282.26` | `186138.94` | `0.3802` | `9` | `1` | top 5 valid |

Conclusion: reject and remove the learned action-set worker escape. A `10%`
full-catalog worker slice preserved oracle validity but did not improve the
matched `1M` final score and reduced valid rate. The mechanism was too blunt:
off-prior full-catalog exploration consumed budget without creating a better
candidate at the minimum quality gate. Do not scale this to `10M`. Future
diversity work needs a narrower escape source, such as specific held-out spell
families or adaptive escape only after plateau evidence, not a raw full-catalog
worker.

### Learned Action-Set Resource-Aware Mix

Hypothesis: forced resource-aware fresh construction (`1.0`) was the best
quality setting before the learned action-set prior, but the learned action-set
already removes most spell-catalog noise. Under the `12`-spell prior, forcing
all fresh/restart candidates through the resource-aware sampler may
over-concentrate the proposal stream. A lower resource-aware fresh chance could
restore random candidate diversity while staying inside the proven learned
loadout and learned action-set.

This is not a repeat of the earlier resource-aware tuning, because the search
space is now conditioned by the learned loadout and learned action-set priors.
The first test uses `--resource-aware-fresh-chance 0.35` because it was the
best efficiency contender before learned priors, while `1.0` remains the
current learned-action-set quality baseline.

Success criteria:

- matched `>=1M` validation must beat learned loadout plus learned action-set
  with `--resource-aware-fresh-chance 1` on final score using the same scenario,
  seed, workers, chunk size, and round count;
- lower valid rate is acceptable only if final simulator-backed score improves;
- a tie or loss means this generation-mix setting should not be scaled;
- top candidates must remain TypeScript-oracle valid.

Matched `1M` validation on `t3-full`, seed `action-set-mix-1m`, workers `10`,
chunk size `50_000`, max rounds `2`:

| Resource-aware fresh chance | Score at 500k | Final score at 1M | Final valid rate | Final round throughput | Oracle |
| ---: | ---: | ---: | ---: | ---: | --- |
| `1.00` | `185282.26` | `185680.35` | `0.4219` | `8,226.56 it/s` | top 5 valid |
| `0.35` | `185282.26` | `186138.94` | `0.3655` | `12,807.10 it/s` | top 5 valid |

Conclusion: keep and repeat the `0.35` generation mix. The first matched `1M`
gate improved final score by `458.59` and substantially improved throughput,
with lower validity. This is not enough to scale because earlier hypotheses
often failed independent repeats.

Independent matched `1M` repeat on `t3-full`, seed
`action-set-mix-repeat-1m`, workers `10`, chunk size `50_000`, max rounds `2`:

| Resource-aware fresh chance | Score at 500k | Final score at 1M | Final valid rate | Final round throughput | Oracle |
| ---: | ---: | ---: | ---: | ---: | --- |
| `1.00` | `185282.26` | `186138.94` | `0.4205` | `8,043.50 it/s` | top 5 valid |
| `0.35` | `185282.26` | `186053.44` | `0.3705` | `12,691.83 it/s` | top 5 valid |

Repeat conclusion: reject `0.35` as a quality setting. It improved speed and
won the first `1M` gate, but the independent repeat lost `85.50` final score
despite remaining oracle-valid. The lower resource-aware mix is useful as an
efficiency knob, not a proven final-score improvement. Do not scale it to
`10M` under the learned action-set baseline.
