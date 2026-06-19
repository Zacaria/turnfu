# Global Validity Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Project context hygiene forbids dispatching subagents from this long-running thread, so execute inline.

**Goal:** Add default-on global validity guidance to the validated continuous optimizer preset, improving full-candidate valid rate without reducing the explorable catalog.

**Architecture:** Add a request-level `hybridGlobalValidityGuidance` switch that the current UI preset passes by default and the CLI can disable for A/B runs. In Rust/WASM, route fresh candidate construction through a validity-guided sampler that uses advisory resource/cast/cooldown state to weight actions while preserving a non-zero fallback path for all available actions. Exact simulator scoring and TypeScript oracle validation remain unchanged.

**Tech Stack:** TypeScript, React/Vite UI helpers, Node test runner, Rust `optimizer-wasm`, wasm-pack build output.

---

## File Structure

- Modify `src/core/optimizer/rustWasmBackendTypes.ts`
  - Add `hybridGlobalValidityGuidance?: boolean` to the TypeScript request type.
- Modify `src/core/optimizer/rustWasmBackendTypes.test.ts`
  - Assert the optional request field survives normal object construction when set manually.
- Modify `src/ui/continuousOptimizerWorkspace.ts`
  - Add hidden `--global-validity-guidance` to the `validated-contextual` launch args.
- Modify `src/ui/continuousOptimizerWorkspace.test.ts`
  - Update expected validated preset args.
- Modify `scripts/search-rust-wasm-sqlite.ts`
  - Parse `--global-validity-guidance` and `--disable-global-validity-guidance`.
  - Pass `hybridGlobalValidityGuidance` into worker requests.
  - Include global validity metrics in the streamed summary.
- Modify `rust/optimizer-wasm/src/lib.rs`
  - Add `hybrid_global_validity_guidance` to `OptimizerRequest`.
  - Add advisory validity state/scoring helpers near the existing candidate samplers.
  - Add `create_global_validity_guided_candidate`.
  - Route fresh candidate generation through the guided sampler when enabled.
  - Emit metrics for guided candidates, fallback actions, and generated plan diversity.
  - Add Rust unit tests.
- Modify `docs/continuous-search-algorithm.md`
  - Document that `validated-contextual` now includes global validity guidance by default and can be disabled for A/B.

## Task 1: TypeScript Request Field and UI Default

**Files:**
- Modify: `src/core/optimizer/rustWasmBackendTypes.ts`
- Modify: `src/core/optimizer/rustWasmBackendTypes.test.ts`
- Modify: `src/ui/continuousOptimizerWorkspace.ts`
- Modify: `src/ui/continuousOptimizerWorkspace.test.ts`

- [ ] **Step 1: Add failing request-type test**

Append this test to `src/core/optimizer/rustWasmBackendTypes.test.ts`:

```ts
test("allows global validity guidance to be set on Rust/WASM requests", () => {
  const request = createRustWasmOptimizerRequest({
    catalog,
    character: {
      id: "request-test",
      className: "huppermage",
      resources: createResources({ ap: 12, mp: 6, wp: 6, bq: 500 }),
      stats: {
        generalMastery: 0,
        elementalMastery: {},
        damageInflictedPercent: 0,
      },
    },
    duration: 2,
    engines: ["hybrid"],
    budget: { iterations: 50 },
  });

  request.hybridGlobalValidityGuidance = true;

  assert.equal(request.hybridGlobalValidityGuidance, true);
  assert.equal(JSON.parse(JSON.stringify(request)).hybridGlobalValidityGuidance, true);
});
```

- [ ] **Step 2: Run the targeted failing test**

Run:

```bash
pnpm test src/core/optimizer/rustWasmBackendTypes.test.ts
```

Expected: FAIL with a TypeScript strip/type error or assertion compile failure because `hybridGlobalValidityGuidance` is not declared on `RustWasmOptimizerRequest`.

- [ ] **Step 3: Add the request field**

In `src/core/optimizer/rustWasmBackendTypes.ts`, update `RustWasmOptimizerRequest`:

```ts
  hybridResourceAwareFreshChance?: number;
  hybridContextualAdjacentSwaps?: boolean;
  hybridPlateauOrderChainNeighbors?: boolean;
  hybridGlobalValidityGuidance?: boolean;
  hybridLockedLoadout?: boolean;
```

- [ ] **Step 4: Re-run the request-type test**

Run:

```bash
pnpm test src/core/optimizer/rustWasmBackendTypes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update the UI preset test expectation**

In `src/ui/continuousOptimizerWorkspace.test.ts`, update the validated preset expected args to include the hidden flag:

```ts
    "--learned-action-set-prior",
    "--contextual-adjacent-swaps",
    "--global-validity-guidance",
  ]);
```

- [ ] **Step 6: Run the UI test and confirm it fails before implementation**

Run:

```bash
pnpm test src/ui/continuousOptimizerWorkspace.test.ts
```

Expected: FAIL because `createContinuousOptimizerLaunchArgs()` does not yet include `--global-validity-guidance`.

- [ ] **Step 7: Add the hidden default preset flag**

In `src/ui/continuousOptimizerWorkspace.ts`, update the `validated-contextual` args block:

```ts
  if (normalized.qualityPreset === "validated-contextual") {
    args.push(
      "--resource-aware-fresh-chance",
      "1",
      "--learned-loadout-prior",
      "--learned-action-set-prior",
      "--contextual-adjacent-swaps",
      "--global-validity-guidance",
    );
  }
```

- [ ] **Step 8: Verify TypeScript tests for Task 1**

Run:

```bash
pnpm test src/core/optimizer/rustWasmBackendTypes.test.ts src/ui/continuousOptimizerWorkspace.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/core/optimizer/rustWasmBackendTypes.ts src/core/optimizer/rustWasmBackendTypes.test.ts src/ui/continuousOptimizerWorkspace.ts src/ui/continuousOptimizerWorkspace.test.ts
git commit -m "feat: enable global validity guidance preset flag"
```

## Task 2: CLI Flag Parsing and Worker Request Wiring

**Files:**
- Modify: `scripts/search-rust-wasm-sqlite.ts`

- [ ] **Step 1: Add CLI parsing fields**

Near the existing continuous option constants in `scripts/search-rust-wasm-sqlite.ts`, after `contextualAdjacentSwapsEnabled`, add:

```ts
const globalValidityGuidanceRequested = process.argv.includes("--global-validity-guidance");
const globalValidityGuidanceDisabled = process.argv.includes("--disable-global-validity-guidance");
const globalValidityGuidanceEnabled = globalValidityGuidanceRequested && !globalValidityGuidanceDisabled;
```

- [ ] **Step 2: Set the base request field**

After the existing `if (contextualAdjacentSwapsEnabled)` block, add:

```ts
if (globalValidityGuidanceEnabled) {
  baseRequest.hybridGlobalValidityGuidance = true;
}
```

- [ ] **Step 3: Pass the field through per-worker request creation**

In the worker request literal, add the explicit field next to the other hybrid policy switches:

```ts
      hybridContextualAdjacentSwaps: contextualAdjacentSwapsEnabled,
      hybridGlobalValidityGuidance: globalValidityGuidanceEnabled,
      hybridPlateauOrderChainNeighbors: plateauModeActive,
```

- [ ] **Step 4: Add streamed summary fields**

In the `summary` object, near `resourceAwareFreshChance` and contextual/plateau fields, add:

```ts
    globalValidityGuidanceEnabled,
    globalValidityGuidedCandidates: metrics.hybridGlobalValidityGuidedCandidates ?? 0,
    globalValidityGuidedValidCandidates: metrics.hybridGlobalValidityGuidedValidCandidates ?? 0,
    globalValidityGuidedInvalidCandidates: metrics.hybridGlobalValidityGuidedInvalidCandidates ?? 0,
    globalValidityGuidedFallbackActions: metrics.hybridGlobalValidityGuidedFallbackActions ?? 0,
    globalValidityPlanSignatures: metrics.hybridGlobalValidityPlanSignatures ?? 0,
```

- [ ] **Step 5: Run a TypeScript smoke test**

Run:

```bash
pnpm test src/ui/continuousOptimizerWorkspace.test.ts src/core/optimizer/rustWasmBackendTypes.test.ts
```

Expected: PASS. This does not execute the CLI top level but checks the shared request type and UI launch path.

- [ ] **Step 6: Commit Task 2**

```bash
git add scripts/search-rust-wasm-sqlite.ts
git commit -m "feat: wire global validity guidance CLI flag"
```

## Task 3: Rust Request Field and Basic Metrics

**Files:**
- Modify: `rust/optimizer-wasm/src/lib.rs`

- [ ] **Step 1: Add failing Rust tests for request parsing and fresh metrics**

Add these tests near the existing `clamps_configured_resource_aware_fresh_chance` and `configured_resource_aware_fresh_chance_controls_candidate_batches` tests:

```rust
    #[test]
    fn parses_global_validity_guidance_request_flag() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"global-validity-flag",
              "duration":1,
              "iterations":1,
              "maxActionsPerTurn":2,
              "maxPassiveCount":0,
              "availableSpellIds":["cheap"],
              "availablePassiveIds":[],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"cheap",
                  "cost":{"ap":1},
                  "effects":[{"type":"damage","base":10,"element":"fire"}],
                  "constraints":[],
                  "tags":[]
                }
              ],
              "character":{"id":"test","resources":{"ap":4,"mp":3,"wp":2,"bq":100}},
              "hybridGlobalValidityGuidance":true
            }"#,
        )
        .expect("request should parse");

        assert!(request.hybrid_global_validity_guidance);
    }

    #[test]
    fn global_validity_guidance_marks_fresh_candidates() {
        let mut request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"global-validity-metrics",
              "duration":1,
              "iterations":8,
              "maxActionsPerTurn":4,
              "maxPassiveCount":0,
              "availableSpellIds":["cheap","expensive"],
              "availablePassiveIds":[],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"cheap",
                  "cost":{"ap":1},
                  "effects":[{"type":"damage","base":10,"element":"fire"}],
                  "constraints":[],
                  "tags":[]
                },
                {
                  "kind":"spell",
                  "id":"expensive",
                  "cost":{"ap":10},
                  "effects":[{"type":"damage","base":100,"element":"fire"}],
                  "constraints":[],
                  "tags":["burst"]
                }
              ],
              "character":{"id":"test","resources":{"ap":4,"mp":3,"wp":2,"bq":100}},
              "hybridResourceAwareFreshChance":1,
              "hybridGlobalValidityGuidance":true
            }"#,
        )
        .expect("request should parse");
        request.max_candidates = Some(5);

        let result = run_hybrid_search(&request).expect("hybrid search should run");

        assert!(result.metrics.get("hybridGlobalValidityGuidedCandidates").copied().unwrap_or(0) > 0);
        assert!(result.metrics.get("hybridResourceAwareCandidates").copied().unwrap_or(0) > 0);
    }
```

- [ ] **Step 2: Run the failing Rust tests**

Run:

```bash
pnpm wasm:test parses_global_validity_guidance_request_flag
```

Expected: FAIL because `OptimizerRequest` does not have `hybrid_global_validity_guidance`.

- [ ] **Step 3: Add the Rust request field**

In `OptimizerRequest`, after `hybrid_plateau_order_chain_neighbors`, add:

```rust
    #[serde(default)]
    pub hybrid_global_validity_guidance: bool,
```

- [ ] **Step 4: Add metric constants as local string usage**

No separate constants exist today. Use these exact metric names in `increment_metric` calls:

```rust
"hybridGlobalValidityGuidedCandidates"
"hybridGlobalValidityGuidedValidCandidates"
"hybridGlobalValidityGuidedInvalidCandidates"
"hybridGlobalValidityGuidedFallbackActions"
"hybridGlobalValidityPlanSignatures"
```

- [ ] **Step 5: Route fresh construction to a temporary guided wrapper**

In `create_hybrid_fresh_candidate`, replace:

```rust
        create_resource_aware_candidate(request, catalog, actions, rng)
```

with:

```rust
        if request.hybrid_global_validity_guidance {
            increment_metric(metrics, "hybridGlobalValidityGuidedCandidates", 1);
            create_global_validity_guided_candidate(request, catalog, actions, rng, metrics)
        } else {
            create_resource_aware_candidate(request, catalog, actions, rng)
        }
```

- [ ] **Step 6: Add a temporary wrapper that delegates to resource-aware construction**

Place this function immediately after `create_resource_aware_candidate`:

```rust
fn create_global_validity_guided_candidate(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    actions: &[CandidateAction],
    rng: &mut SeededRandom,
    _metrics: &mut BTreeMap<String, u32>,
) -> OptimizerCandidateInput {
    create_resource_aware_candidate(request, catalog, actions, rng)
}
```

This makes Task 3 pass before adding scoring complexity.

- [ ] **Step 7: Run Rust tests for Task 3**

Run:

```bash
pnpm wasm:test parses_global_validity_guidance_request_flag
pnpm wasm:test global_validity_guidance_marks_fresh_candidates
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add rust/optimizer-wasm/src/lib.rs
git commit -m "feat: add global validity guidance request flag"
```

## Task 4: Advisory Validity State and Scoring Helpers

**Files:**
- Modify: `rust/optimizer-wasm/src/lib.rs`

- [ ] **Step 1: Add failing unit test for affordable weighting and fallback**

Add this test near `samples_resource_aware_candidates_from_affordable_actions`:

```rust
    #[test]
    fn global_validity_guidance_prefers_affordable_actions_without_excluding_fallback() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"global-validity-sampler",
              "duration":1,
              "iterations":100,
              "maxActionsPerTurn":4,
              "maxPassiveCount":0,
              "availableSpellIds":["cheap","expensive"],
              "availablePassiveIds":[],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"cheap",
                  "cost":{"ap":1},
                  "effects":[{"type":"damage","base":10,"element":"fire"}],
                  "constraints":[],
                  "tags":["utility"]
                },
                {
                  "kind":"spell",
                  "id":"expensive",
                  "cost":{"ap":10},
                  "effects":[{"type":"damage","base":100,"element":"fire"}],
                  "constraints":[],
                  "tags":["burst"]
                }
              ],
              "character":{"id":"test","resources":{"ap":4,"mp":3,"wp":2,"bq":100}},
              "hybridGlobalValidityGuidance":true
            }"#,
        )
        .expect("request should parse");
        let catalog = read_search_catalog(&request).expect("catalog should parse");
        let actions = get_search_actions(&request, &catalog);
        let mut rng = SeededRandom::new("global-validity-sampler");
        let mut metrics = BTreeMap::new();

        let candidate = create_global_validity_guided_candidate(
            &request,
            &catalog,
            &actions,
            &mut rng,
            &mut metrics,
        );

        assert!(!candidate.plan.turns[0].actions.is_empty());
        assert!(candidate.plan.turns[0].actions.iter().any(|action| action.spell_id == "cheap"));
        assert!(metrics.get("hybridGlobalValidityGuidedFallbackActions").copied().unwrap_or(0) >= 0);
    }
```

- [ ] **Step 2: Run the test before implementation**

Run:

```bash
pnpm wasm:test global_validity_guidance_prefers_affordable_actions_without_excluding_fallback
```

Expected: PASS with the temporary wrapper but weak coverage. Keep this test; the next steps strengthen the implementation without changing the assertion.

- [ ] **Step 3: Add `GlobalValidityState`**

Place this struct near the existing sampler helpers, before `create_random_candidate`:

```rust
#[derive(Clone, Debug)]
struct GlobalValidityState {
    base_resources: ResourcePool,
    resources: ResourcePool,
    casts_by_spell_id: BTreeMap<String, u32>,
    target_casts_by_spell_id: BTreeMap<String, u32>,
    cooldowns_by_spell_id: BTreeMap<String, u32>,
}

impl GlobalValidityState {
    fn new(base_resources: ResourcePool) -> Self {
        Self {
            base_resources,
            resources: base_resources,
            casts_by_spell_id: BTreeMap::new(),
            target_casts_by_spell_id: BTreeMap::new(),
            cooldowns_by_spell_id: BTreeMap::new(),
        }
    }

    fn start_turn(&mut self) {
        self.resources.ap = self.base_resources.ap;
        self.resources.mp = self.base_resources.mp;
        self.casts_by_spell_id.clear();
        self.target_casts_by_spell_id.clear();
        self.cooldowns_by_spell_id = self
            .cooldowns_by_spell_id
            .iter()
            .map(|(spell_id, turns)| (spell_id.clone(), turns.saturating_sub(1)))
            .filter(|(_spell_id, turns)| *turns > 0)
            .collect();
    }
}
```

- [ ] **Step 4: Add action scoring helper**

Place this function after `GlobalValidityState`:

```rust
fn score_global_validity_action(
    entry: &SearchCatalogEntry,
    action: &CandidateAction,
    state: &GlobalValidityState,
) -> f64 {
    if state
        .cooldowns_by_spell_id
        .get(action.spell_id.as_str())
        .copied()
        .unwrap_or(0)
        > 0
    {
        return 0.02;
    }
    if entry
        .rules
        .max_casts_per_turn
        .is_some_and(|limit| state.casts_by_spell_id.get(action.spell_id.as_str()).copied().unwrap_or(0) >= limit)
    {
        return 0.02;
    }
    if entry
        .rules
        .max_casts_per_target
        .is_some_and(|limit| counts_as_soft_target_cast(action) && state.target_casts_by_spell_id.get(action.spell_id.as_str()).copied().unwrap_or(0) >= limit)
    {
        return 0.02;
    }
    if can_afford_cost(state.resources, entry.cost) {
        let base = get_action_search_weight(entry).max(0.01);
        let resource_margin = (state.resources.ap - f64::from(entry.cost.ap.max(0))).max(0.0)
            + (state.resources.mp - f64::from(entry.cost.mp.max(0))).max(0.0)
            + (state.resources.wp - f64::from(entry.cost.wp.max(0))).max(0.0);
        base * (1.0 + resource_margin.min(6.0) * 0.04)
    } else {
        0.05
    }
}
```

- [ ] **Step 5: Add state application helper**

Place this after the scorer:

```rust
fn apply_global_validity_action(
    entry: &SearchCatalogEntry,
    action: &CandidateAction,
    state: &mut GlobalValidityState,
) {
    state.resources = apply_soft_action_resources(state.resources, entry);
    *state
        .casts_by_spell_id
        .entry(action.spell_id.clone())
        .or_insert(0) += 1;
    if counts_as_soft_target_cast(action) {
        *state
            .target_casts_by_spell_id
            .entry(action.spell_id.clone())
            .or_insert(0) += 1;
    }
    if let Some(turns) = entry
        .rules
        .cooldown_turns
        .filter(|turns| *turns > 0)
    {
        state.cooldowns_by_spell_id.insert(action.spell_id.clone(), turns);
    }
}
```

- [ ] **Step 6: Add the weighted selection helper**

Place this after `apply_global_validity_action`:

```rust
fn pick_global_validity_weighted_action(
    weighted_actions: &[(CandidateAction, f64)],
    rng: &mut SeededRandom,
) -> CandidateAction {
    let total_weight = weighted_actions
        .iter()
        .map(|(_action, weight)| weight.max(0.02))
        .sum::<f64>();
    let mut cursor = rng.next() * total_weight;

    for (action, weight) in weighted_actions {
        cursor -= weight.max(0.02);
        if cursor <= 0.0 {
            return action.clone();
        }
    }

    weighted_actions
        .last()
        .map(|(action, _weight)| action.clone())
        .expect("global validity weighted action list should not be empty")
}
```

- [ ] **Step 7: Run the targeted Rust test**

Run:

```bash
pnpm wasm:test global_validity_guidance_prefers_affordable_actions_without_excluding_fallback
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

```bash
git add rust/optimizer-wasm/src/lib.rs
git commit -m "feat: score globally valid actions"
```

## Task 5: Implement Guided Candidate Construction and Diversity Metrics

**Files:**
- Modify: `rust/optimizer-wasm/src/lib.rs`

- [ ] **Step 1: Replace the temporary wrapper implementation**

Replace the body of `create_global_validity_guided_candidate` with:

```rust
fn create_global_validity_guided_candidate(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    actions: &[CandidateAction],
    rng: &mut SeededRandom,
    metrics: &mut BTreeMap<String, u32>,
) -> OptimizerCandidateInput {
    let entries_by_id = catalog
        .iter()
        .map(|entry| (entry.id.as_str(), entry))
        .collect::<BTreeMap<_, _>>();
    let base_resources = read_request_resources(&request.character);
    let mut state = GlobalValidityState::new(base_resources);
    let mut turns = Vec::new();

    for _turn_index in 0..request.duration {
        state.start_turn();
        let min_actions = std::cmp::max(
            1,
            ((request.max_actions_per_turn as f64) * 0.55).floor() as u32,
        );
        let target_action_count = rng.integer(min_actions, request.max_actions_per_turn);
        let mut turn_actions = Vec::new();

        for _action_index in 0..target_action_count {
            let weighted_actions = actions
                .iter()
                .filter_map(|action| {
                    entries_by_id
                        .get(action.spell_id.as_str())
                        .map(|entry| ((*action).clone(), score_global_validity_action(entry, action, &state)))
                })
                .collect::<Vec<_>>();
            if weighted_actions.is_empty() {
                increment_metric(metrics, "hybridGlobalValidityGuidedFallbackActions", 1);
                let action = rng.pick(actions).clone();
                turn_actions.push(action);
                continue;
            }
            let action = pick_global_validity_weighted_action(&weighted_actions, rng);
            if let Some(entry) = entries_by_id.get(action.spell_id.as_str()) {
                apply_global_validity_action(entry, &action, &mut state);
            } else {
                increment_metric(metrics, "hybridGlobalValidityGuidedFallbackActions", 1);
            }
            turn_actions.push(action);
        }

        turns.push(CandidateTurn { actions: turn_actions });
    }

    let candidate = OptimizerCandidateInput {
        passive_ids: pick_random_passives(request, catalog, rng),
        sublimation_ids: pick_random_sublimations(request, rng),
        plan: CandidatePlan { turns },
        source_label: Some("fresh:global-validity-guided".to_string()),
    };
    increment_metric(metrics, "hybridGlobalValidityPlanSignatures", 1);
    candidate
}
```

- [ ] **Step 2: Track guided valid/invalid outcomes**

In `evaluate_and_track_hybrid_candidate`, after the candidate is evaluated and before returning, add:

```rust
    if candidate
        .source_label
        .as_deref()
        .is_some_and(|label| label == "fresh:global-validity-guided")
    {
        if evaluation.valid {
            increment_metric(&mut accumulator.metrics, "hybridGlobalValidityGuidedValidCandidates", 1);
        } else {
            increment_metric(&mut accumulator.metrics, "hybridGlobalValidityGuidedInvalidCandidates", 1);
        }
    }
```

Use the local variable names already present in `evaluate_and_track_hybrid_candidate`; if the function names the evaluation result `result`, use `result.valid`.

- [ ] **Step 3: Run targeted Rust tests**

Run:

```bash
pnpm wasm:test global_validity_guidance_marks_fresh_candidates
pnpm wasm:test global_validity_guidance_prefers_affordable_actions_without_excluding_fallback
pnpm wasm:test samples_resource_aware_candidates_from_affordable_actions
```

Expected: PASS.

- [ ] **Step 4: Run the broader Rust wasm suite**

Run:

```bash
pnpm wasm:test
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add rust/optimizer-wasm/src/lib.rs
git commit -m "feat: guide fresh candidates toward global validity"
```

## Task 6: Build WASM and Validate TypeScript Integration

**Files:**
- Generated/modified: `src/wasm/optimizer_wasm_pkg/*`
- Modify only if generated package files change.

- [ ] **Step 1: Build the WASM package**

Run:

```bash
pnpm wasm:build
```

Expected: wasm-pack completes and updates `src/wasm/optimizer_wasm_pkg`.

- [ ] **Step 2: Run TypeScript tests that exercise Rust/WASM request integration**

Run:

```bash
pnpm test src/core/optimizer/rustWasmBackendTypes.test.ts src/core/optimizer/optimizerExperiment.test.ts src/ui/continuousOptimizerWorkspace.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run the full TypeScript test suite**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 4: Commit Task 6**

```bash
git add src/wasm/optimizer_wasm_pkg src/core/optimizer/rustWasmBackendTypes.ts src/core/optimizer/rustWasmBackendTypes.test.ts src/ui/continuousOptimizerWorkspace.ts src/ui/continuousOptimizerWorkspace.test.ts scripts/search-rust-wasm-sqlite.ts rust/optimizer-wasm/src/lib.rs
git commit -m "build: update optimizer wasm package"
```

If `pnpm wasm:build` produces no file changes, skip this commit and note that the checked-in package was already current.

## Task 7: Documentation and Smoke Validation

**Files:**
- Modify: `docs/continuous-search-algorithm.md`
- Add only if the 200k smoke is run and produces useful output: `docs/continuous-search-observations/2026-06-19-00-global-validity-guidance.md`.

- [ ] **Step 1: Update the validated preset docs**

In `docs/continuous-search-algorithm.md`, update the current preset block to:

```text
--resource-aware-fresh-chance 1
--learned-loadout-prior
--learned-action-set-prior
--contextual-adjacent-swaps
--global-validity-guidance
--plateau-order-chain-neighbors
--plateau-trigger-rounds 1
```

- [ ] **Step 2: Add a short policy description**

Add this paragraph near the Rust/WASM island policy table:

```markdown
| Global validity guidance | Default-on for the validated contextual preset; weights fresh candidate construction by whole-candidate feasibility signals while keeping non-zero probability for every available action. |
```

- [ ] **Step 3: Add A/B disable note**

Add this note near the validation contract:

```markdown
For matched A/B validation, pass `--disable-global-validity-guidance` with the same seed, workers, chunk size, and rounds to compare against the previous validated-contextual proposal stream.
```

- [ ] **Step 4: Run docs-adjacent checks**

Run:

```bash
pnpm test src/ui/continuousOptimizerWorkspace.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run a 200k smoke only if runtime budget allows**

Run:

```bash
pnpm search:rust-wasm -- --session global-validity-smoke --db .optimizer/global-validity-smoke.sqlite --scenario t3-full --seed global-validity-smoke --workers 2 --chunk-size 50000 --max-rounds 2 --resource-aware-fresh-chance 1 --learned-loadout-prior --learned-action-set-prior --contextual-adjacent-swaps --global-validity-guidance
```

Expected:

- streamed summary includes `globalValidityGuidanceEnabled: true`;
- summary includes `globalValidityGuidedCandidates`;
- top candidates remain oracle-valid if oracle output is enabled by the script path;
- no search-quality conclusion is drawn from this smoke.

- [ ] **Step 6: Commit Task 7**

```bash
git add docs/continuous-search-algorithm.md
git commit -m "docs: document global validity guidance"
```

If the smoke observation file is added, include it in the same commit:

```bash
git add docs/continuous-search-algorithm.md docs/continuous-search-observations/2026-06-19-00-global-validity-guidance.md
git commit -m "docs: document global validity guidance"
```

## Final Verification

- [ ] Run Rust tests:

```bash
pnpm wasm:test
```

- [ ] Rebuild WASM:

```bash
pnpm wasm:build
```

- [ ] Run TypeScript tests:

```bash
pnpm test
```

- [ ] Run production build:

```bash
pnpm build
```

- [ ] Check Git status:

```bash
git status --short
```

Expected: clean worktree after final commits.

## Spec Coverage Self-Review

- Default-on in existing UI path: Task 1 adds hidden preset arg.
- CLI A/B disable: Task 2 parses disable and avoids setting the request field.
- No catalog reduction: Tasks 4 and 5 use weights and a minimum non-zero action probability instead of filtering catalog entries.
- Whole-candidate validity objective: Tasks 3 and 5 track full guided candidate valid/invalid outcomes after exact evaluation.
- Metrics: Tasks 2, 3, and 5 add request, Rust, and streamed summary metrics.
- Validation gates: Task 7 documents smoke behavior; final verification covers local correctness. Matched 1M/5M/10M runs remain research operations after implementation.
- No UI control: Task 1 changes launch args only; it does not add visible controls.
