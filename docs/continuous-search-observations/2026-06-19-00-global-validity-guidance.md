## Global Validity Guidance Smoke

Hypothesis: fresh candidates are currently too often shaped by local action
weights and the initial bias of the run. A global validity guide can improve
proposal construction by scoring each next action against the candidate state
being built, including AP/MP/WP/BQ affordability, per-turn limits,
per-target limits, and cooldowns. This must stay a weighted proposal policy:
every available action keeps non-zero probability so the algorithm still
explores the full configured spell space.

The validated contextual preset now enables this guidance by default through
`--global-validity-guidance`. Matched A/B validation can disable it with
`--disable-global-validity-guidance`.

Success criteria for this smoke:

- CLI summary must report `globalValidityGuidanceEnabled: true`;
- Rust/WASM metrics must count guided fresh candidates and guided plan
  signatures;
- fallback action count should stay low;
- top candidates must remain TypeScript-oracle valid;
- this sub-`1M` run is wiring evidence only, not search-quality evidence.

200k smoke on `t3-full`, seed `global-validity-smoke`, workers `2`, chunk
size `50_000`, max rounds `2`, with learned loadout, learned action-set,
contextual adjacent swaps, resource-aware fresh chance `1`, and
`--global-validity-guidance`:

```text
pnpm search:rust-wasm -- \
  --session global-validity-smoke \
  --db .optimizer/global-validity-smoke.sqlite \
  --scenario t3-full \
  --seed global-validity-smoke \
  --workers 2 \
  --chunk-size 50000 \
  --max-rounds 2 \
  --resource-aware-fresh-chance 1 \
  --learned-loadout-prior \
  --learned-action-set-prior \
  --contextual-adjacent-swaps \
  --global-validity-guidance
```

| Round attempts | Score | Valid candidates | Valid rate | Guidance enabled | Guided candidates | Guided valid | Guided invalid | Fallback actions | Plan signatures |
| ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| `100,000` | `144415.27` | `357` | `0.0036` | yes | `99,712` | `69` | `99,643` | `0` | `99,712` |
| `200,000` | `144415.27` | `66` | `0.0007` | yes | `100,000` | `66` | `99,934` | `0` | `100,000` |

Smoke read: wiring passed. The CLI flag reached Rust/WASM, guided fresh
candidate telemetry was emitted in both rounds, and no global-validity fallback
actions were needed. The low valid rate is not a quality conclusion because the
run is below `1M`, uses only two workers, and exists to verify the default-on
path plus telemetry.

Next validation should be a matched `1M+` A/B run with the same seed, workers,
chunk size, rounds, and oracle settings, comparing the default guided preset
against `--disable-global-validity-guidance`.
