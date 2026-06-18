### Learned Loadout Prior

Hypothesis: top continuous-search evidence may contain a stable loadout prior.
If the best candidates repeatedly use the same passives and sublimations,
locking only the loadout while leaving action plans fully searched could reduce
proposal waste from poor loadout combinations. This is not exact candidate
replay: no action plan is replayed, and final ranking remains exact
simulator-backed.

Corpus diagnostic across recent `1M`/`10M` databases, sampling the top `20`
valid persisted candidates per database:

| Signal | Observation |
| --- | --- |
| Core passives | `carnage`, `extension-des-sens`, and `profusion-runique` appeared in `150 / 150` sampled top rows |
| Core sublimations | `armure-lourde-ii`, `concentration-elementaire`, and all three `expert-des-armes-legeres` tiers appeared in `150 / 150` sampled top rows |
| Best repeated loadout | The most frequent exact loadout appeared `19` times and had best score `184819.25` |

Temporary online implementation: add an opt-in Rust/WASM request flag exposed
as `--learned-loadout-prior`. The CLI narrows the available loadout to the
best repeated corpus loadout and Rust locks candidates to those available
passives/sublimations before evaluation, while suppressing passive/sublimation
elite-neighbor generation. Action search remains stochastic Rust/WASM search.

Locked passives:

| Passive |
| --- |
| `carnage` |
| `extension-des-sens` |
| `profusion-runique` |

Locked sublimations:

| Sublimation |
| --- |
| `alternance-ii` |
| `armure-lourde-ii` |
| `concentration-elementaire` |
| `expert-des-armes-legeres-i` |
| `expert-des-armes-legeres-ii` |
| `expert-des-armes-legeres-iii` |
| `longueur-i` |
| `longueur-ii` |
| `longueur-iii` |
| `puissance-brute-i` |
| `puissance-brute-iii` |
| `tellurisme-secondaire-iii` |

200k wiring smoke on `t3-full`, seed `learned-loadout-smoke`, workers `2`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`,
`--learned-loadout-prior`:

| Final score | Final valid rate | Oracle |
| ---: | ---: | --- |
| `182712.23` | `0.0033` | top 5 valid |

Matched 1M validation on `t3-full`, seed `learned-loadout-1m`, workers `10`,
chunk size `50_000`, max rounds `2`, `--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final valid rate | Oracle |
| --- | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `172999.75` | `178703.46` | `0.3467` | top 5 valid |
| Learned loadout prior | `182712.23` | `182712.23` | `0.0034` | top 5 valid |

Conclusion: keep the learned loadout prior as an opt-in quality mechanism. It
improved matched `1M` final score by `4008.77` despite dramatically reducing
valid rate. This confirms that validity rate alone is not the right objective:
locking a strong loadout makes the valid candidates much rarer but much more
valuable when found. The next validation step should be either an independent
matched `1M` repeat to check seed robustness or a matched `10M` scale run,
because this hypothesis has now passed the minimum `>=1M` quality gate.

Independent matched `1M` repeat on `t3-full`, seed
`learned-loadout-repeat-1m`, workers `10`, chunk size `50_000`, max rounds `2`,
`--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Final score at 1M | Final valid rate | Oracle |
| --- | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `172097.47` | `178565.07` | `0.3450` | top 5 valid |
| Learned loadout prior | `182712.23` | `183590.76` | `0.0035` | top 5 valid |

Repeat conclusion: the learned loadout prior improved matched `1M` final score
by `5025.69` on a second independent seed. This makes the mechanism robust
enough to justify the next scale gate: a matched `10M` run against the same
resource-aware baseline. The key caveat remains that the mechanism trades away
valid rate for much higher value among rare valid candidates.

Matched `10M` scale validation on `t3-full`, seed `learned-loadout-10m`,
workers `10`, chunk size `50_000`, max rounds `20`,
`--resource-aware-fresh-chance 1`:

| Mode | Score at 500k | Score at 1M | Score at 5M | Final score at 10M | Best at attempts | Final valid rate | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Forced resource-aware baseline | `174439.81` | `177492.45` | `182930.10` | `183264.17` | `6,500,000` | `0.3176` | top 5 valid |
| Learned loadout prior | `182712.23` | `182712.23` | `184464.32` | `184819.25` | `7,500,000` | `0.0475` | top 5 valid |

Scale conclusion: promote the learned loadout prior as the strongest current
quality-oriented opt-in mechanism. It improved the matched `10M` endpoint by
`1555.08` and beat the baseline from the first `500k` checkpoint onward, while
keeping final candidates TypeScript-oracle valid. The mechanism still trades a
much lower valid rate for higher-value valid candidates, so the next iteration
should not chase validity rate directly. It should instead use this locked
loadout as the new quality baseline and search for action-plan relevance under
that loadout. Candidate next hypotheses include learned-loadout plus contextual
adjacent swaps, or offline contrast mining restricted to the locked-loadout
corpus before changing Rust/WASM proposal order.

### Learned Loadout Plus Contextual Adjacent Swaps

Hypothesis: after loadout search is narrowed by the learned prior, action order
becomes the next proposal-relevance bottleneck. The contextual adjacent-swap
prioritizer previously passed one matched `1M` gate and tied a repeat gate, so
combining it with the learned loadout prior might improve action-plan relevance
under the fixed loadout.

Matched `1M` validation reused the learned-loadout-only `10M` run's first two
checkpoints as the baseline and compared a fresh combined run with the same
`t3-full` scenario, seed `learned-loadout-10m`, workers `10`, chunk size
`50_000`, max rounds `2`, and `--resource-aware-fresh-chance 1`.

| Mode | Score at 500k | Final score at 1M | Final valid rate | Contextual neighbors | Evaluated contextual neighbors | Global-best contextual neighbors | Oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Learned loadout prior | `182712.23` | `182712.23` | `0.0033` | `0` | `0` | `0` | top 5 valid |
| Learned loadout + contextual swaps | `182712.23` | `182712.23` | `0.0033` | `9` | `0` | `0` | top 5 valid |

Conclusion: do not scale this combination. It tied the learned-loadout baseline
exactly at `1M`, and direct telemetry showed that contextual swap neighbors were
enqueued but not evaluated under the locked-loadout dynamics. The mechanism did
not actually influence the final proposal stream. Keep contextual swaps as an
independent opt-in mechanism, but do not combine or scale them with the learned
loadout prior unless a new implementation makes those action-order candidates
reach evaluation and produce previous-best or global-best improvements.

### Locked-Loadout Offline Action-Plan Contrast Read

Follow-up diagnostic: mine the learned-loadout `10M` corpus for action-plan
edits before designing another online Rust/WASM mechanism. This is offline
evidence only, not a search-quality claim.

Default adjacent-swap contrast pass on `.optimizer/learned-loadout-variant-10m.sqlite`,
top `20` sources, `256` variants per source:

| Family or rule | Generated | Valid | Positive | Global-best | Valid rate | Positive rate | Average delta | Best delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All adjacent swaps | `420` | `220` | `8` | `0` | `0.5238` | `0.0364` | `-1428.56` | `354.94` |
| Current ordered-pair rule | `20` | `8` | `8` | `0` | `0.4000` | `1.0000` | `354.94` | `354.94` |
| `debacle>orbes-luisants` only | `20` | `8` | `8` | `0` | `0.4000` | `1.0000` | `354.94` | `354.94` |
| `right:orbes-luisants` | `60` | `28` | `8` | `0` | `0.4667` | `0.2857` | `-8.28` | `354.94` |

Expanded diagnostic on the same corpus with `--macro-splices --plan-grafts
--action-edits --target-edits`, top `20` sources, `512` variants per source:

| Family or context | Generated | Valid | Positive | Global-best | Valid rate | Positive rate | Average delta | Best delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All expanded variants | n/a | `1230` | `124` | `0` | n/a | n/a | n/a | n/a |
| Best suffix graft context | `361` | `361` | `96` | `0` | `1.0000` | `0.2659` | `-25.09` | `621.43` |
| All suffix grafts | `413` | `413` | `100` | `0` | `1.0000` | `0.2421` | `-29.67` | `621.43` |
| Best macro splice context | `152` | `69` | `0` | `0` | `0.4539` | `0.0000` | `-1525.30` | `-1050.85` |

Conclusion: do not promote a locked-loadout action-plan edit online yet.
Source-positive deltas exist, especially for suffix grafting and the current
ordered adjacent-swap pair, but this corpus produced zero global-best variants
for the tested action-plan families. That matches the failed online combination:
positive local edits are not enough if they do not reach evaluation or move the
global best. The next action-plan hypothesis needs a stronger mechanism than
one-shot seed or neighbor insertion, such as a Rust/WASM proposal generator that
constructs complete locked-loadout plans around the strongest observed suffix
patterns, and it should start with a new offline gate that shows repeated
global-best evidence across more than one locked-loadout corpus.
