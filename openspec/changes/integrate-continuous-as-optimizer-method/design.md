## Context

The application has two optimizer surfaces today:

- The setup-scoped Optimizer page, which has mature controls, grouped result summaries, candidate detail views, spell icon rows, pinning, saving, and timeline-builder handoff.
- The Continuous page, which can start the long-running Rust/WASM SQLite search but only exposes coarse progress, best score, attempts, valid rate, and learned evidence summaries.

That split makes Continuous discoveries less useful than classic optimizer discoveries. Users need to inspect the exact combo, score breakdown, resources, and sustainability details in the same workflow regardless of which search method produced the candidate.

Continuous search is also not a different user goal. It is a different proposal strategy for the same goal: find the best valid combo for the current setup, duration, objective, and constraints.

## Goals / Non-Goals

**Goals:**

- Add Continuous as a first-class method in the existing Optimizer page.
- Reuse the existing optimizer result summary/detail UI for Continuous candidates.
- Map current optimizer controls to Continuous run arguments, including duration, score criterion, target element, sustainable cycle, setup/set context, workers, chunk size, and learned policy defaults.
- Preserve exact simulator-backed validation before candidates enter the normal optimizer result list.
- Make the primary UI language task-focused: "Method: Continuous" instead of "Preset: Validated contextual".
- Keep corpus/evidence diagnostics accessible without making them the primary run workflow.

**Non-Goals:**

- Do not change the scoring semantics for total damage, resolved-element damage, or sustainable-cycle filtering.
- Do not make unverified stochastic candidates visible as normal optimizer results.
- Do not introduce neural policy training in this change.
- Do not require the user to manage low-level learned-policy flags for the normal workflow.

## Decisions

### Continuous Is an Optimizer Method

The Optimizer page will expose Continuous alongside existing search methods. This keeps duration, scoring, target element, sustainability, result count, save, pin, and detail inspection in one place.

Alternative considered: keep the dedicated Continuous page and improve it until it matches the Optimizer page. That duplicates result rendering, persistence, and builder handoff, and it keeps the user choosing between pages rather than choosing an algorithm.

### Verified Candidates Feed the Existing Result Model

Continuous runs will publish oracle-verified top candidates in a shape that can be converted to the existing optimizer candidate/result view models. The stream may still include metrics-only progress events, but any candidate displayed in the normal result list must include enough simulator-backed data for score breakdowns, resolved-element damage, final resources, sustainability metadata, and turn-by-turn inspection.

Alternative considered: display only score checkpoints in the Optimizer page and link to Continuous diagnostics. That would not solve the core usability problem because the user still could not inspect or save the discovered combo like a classic optimizer result.

### Learning Policy Defaults Are Internal

The normal Continuous method will use the best validated learned policy by default. Low-level policy switches such as learned loadout prior, learned action-set prior, and contextual adjacent swaps belong in diagnostics or advanced controls, not in the primary optimizer method selector.

Alternative considered: expose "presets" in the Optimizer page. The term is vague and tied to implementation flags, so it does not help users choose a run strategy.

### Dedicated Continuous Page Becomes Diagnostics

If retained, the existing Continuous page should focus on corpus status, evidence, learned-policy diagnostics, and long-running run history. Starting a normal combo search should happen from the Optimizer page.

Alternative considered: delete the Continuous page. That could remove useful evidence/corpus visibility while algorithm work is still active.

## Risks / Trade-offs

- Candidate payloads may be larger than metrics-only stream events -> limit streamed candidates to top verified changes and hydrate older results from SQLite when possible.
- Long-running Continuous runs can outlive a UI session -> persist enough run metadata and candidate snapshots to resume progress display without losing verified discoveries.
- Mapping setup-scoped optimizer controls into scenario-oriented Continuous CLI arguments may expose gaps in current scenario definitions -> keep the first implementation scoped to supported Huppermage setup scenarios and fail visibly when a control cannot be represented.
- The existing result model may assume bounded synchronous runs -> separate run lifecycle/progress state from result display so Continuous can append verified candidates over time.
- Advanced learned-policy controls may still be useful for research -> keep them out of the primary workflow but available in diagnostics or developer-facing configuration.

## Migration Plan

1. Introduce the Continuous method behind the existing Optimizer page without removing the current Continuous page.
2. Teach the Continuous stream/storage path to emit or hydrate verified optimizer candidate payloads.
3. Reuse existing result rendering, pinning, saving, and builder handoff for Continuous candidates.
4. Demote the standalone Continuous page to diagnostics after the Optimizer method path is verified.
5. Remove or rename "preset" UI language from primary flows.

Rollback is straightforward: keep existing optimizer methods untouched and hide the Continuous method option if candidate hydration or streaming proves unstable.

## Open Questions

- Should the Optimizer page expose worker count and chunk size directly for Continuous, or keep them as advanced settings?
- Should Continuous runs use the existing optimizer result count as the number of displayed verified candidates, or keep a larger persisted top-k in SQLite and only display the requested count?
- How should the UI distinguish "best found so far" from "search complete" for open-ended Continuous runs without implying final optimality?
