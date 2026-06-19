## Context

The Continuous method runs the Rust/WASM hybrid genetic optimizer in chunks and
feeds it resume state, reuse trials, motifs, and learned seeds. That optimizer
already evaluates generated candidates through the simulator and usually pushes
only valid `HybridPopulationEntry` values into the population. The invariant is
still too soft: `HybridPopulationEntry` stores a `valid` flag, resume state can
carry legacy population entries, proposal queues are easy to confuse with
admitted individuals, and Continuous reporting still frames validity as a
population-quality rate.

This design makes the distinction explicit:

- A proposal is unevaluated material produced by a seed, mutation, crossover,
  repair, projection, or immigrant source.
- A fabrication attempt tries to turn a proposal into an individual.
- An individual is admitted only after exact simulator validation.
- A population is a competitive set of individuals and is valid-only by
  contract.

## Goals / Non-Goals

**Goals:**

- Ensure all Continuous parents, elites, ranked entries, top candidates,
  persisted resume population entries, and resumed parent pools are
  simulator-valid.
- Centralize Continuous admission through a valid individual factory used by
  initial seeding, generation fill, repair queues, elite neighbors, and
  immigrant paths.
- Use bounded retry, adaptive fabrication temperature, and projection repair to
  keep generation fill robust when proposals frequently fail.
- Keep projection as a helper that must revalidate through the exact simulator
  before admission.
- Report Continuous fabrication diagnostics without presenting a validity rate
  as a genetic population quality metric.

**Non-Goals:**

- Do not claim score improvement or tune for benchmark wins in this pass.
- Do not bypass the simulator with heuristic validity checks.
- Do not rewrite the whole optimizer or introduce a learned policy.
- Do not rename historical SQLite schema columns without a separate migration or
  compatibility plan.

## Decisions

### Valid entries by construction

`HybridPopulationEntry` should represent an admitted valid individual. If JSON
compatibility requires keeping a legacy `valid` field temporarily, construction
and resume normalization must reject false or unverified entries before the
value reaches ranking, selection, elitism, or persistence. Ranking and
truncation helpers should defensively preserve the valid-only contract.

Alternative considered: keep `valid: bool` as a normal runtime state and filter
only at selection. That still lets invalid entries appear in competitive
population data and contradicts the product contract.

### Proposal queues, not individual queues

Mutation, crossover, repair, elite-neighbor, restart, and immigrant helpers
remain proposal producers. They may return invalid material, but their results
must go through the factory admission path before population insertion.

Alternative considered: make each proposal generator internally validate. That
duplicates admission logic and makes diagnostics inconsistent across sources.

### Factory with bounded retry and adaptive temperature

The Continuous WASM loop should request valid individuals from a small factory
layer. The factory attempts proposals under a per-child and per-generation budget. It
increases fabrication temperature after repeated failed attempts or generation
fill pressure, changing proposal sources/operators toward more disruptive
mutations, projection, and immigrants. It decreases temperature when fabrication
is easy. Temperature affects proposal generation only; it is not a score or
public population metric.

Alternative considered: retry the same mutation operator until success. That is
deterministic but wastes evaluations in sparse valid neighborhoods and can
repeat the same violation.

### Projection from simulator feedback

When a proposal fails validation, projection should use the first simulator
violation to build a new proposal: preserve the valid prefix, remove or replace
the violating action, optionally rebuild the remaining turn or suffix with
resource-aware actions, then run exact simulator validation. Projection repairs
are counted as diagnostics only after the projected proposal is attempted.

Alternative considered: accept prefix-only candidates without exact
revalidation. That would bypass the central invariant and is not allowed.

### Diagnostics replace validity-rate reporting

Continuous genetic-facing reporting should expose fabrication terms such as
`admittedIndividuals`, `fabricationAttempts`, `discardedProposals`,
`projectionRepairs`, and `factoryExhaustions`. Existing historical storage
fields may remain where needed for compatibility, but the Continuous optimizer
should not present a valid rate as evidence of population quality.

The Continuous TypeScript runner must also revalidate top candidates through the
TypeScript oracle before checkpoint ranking, UI payload emission, and evidence
persistence. A Rust/WASM top candidate that fails that exact oracle validation
is skipped rather than displayed or stored as competitive evidence.

Alternative considered: keep `validRate` and document it as attempts divided by
valid admissions. That preserves the confusing framing the change is meant to
remove.

## Risks / Trade-offs

- [Risk] Factory retry/projection can increase simulator evaluations. →
  Mitigation: enforce per-child and per-generation budgets and degrade
  gracefully with a smaller valid population or restart behavior.
- [Risk] Filtering legacy resume entries can reduce resumed population size. →
  Mitigation: refill through the same factory path and report factory
  exhaustions as diagnostics when the budget is spent.
- [Risk] Removing public validity-rate wording may affect existing dashboards or
  scripts. → Mitigation: keep historical schema compatibility and adjust
  genetic-facing labels without broad SQLite renames.
- [Risk] Adaptive temperature can accidentally break deterministic seeded runs.
  → Mitigation: derive all temperature decisions from deterministic counters and
  seeded RNG state, then add fixed-seed tests.

## Migration Plan

1. Add the valid-only population contract and diagnostics to the Rust/WASM data
   model used by Continuous with compatibility handling for legacy resume
   payloads.
2. Route all Continuous hybrid population admission through the factory while
   leaving proposal generators as proposal-only helpers.
3. Adjust Continuous reporting terminology without changing historical SQLite
   column names unless a migration is added.
4. Add focused tests before widening benchmark or UI changes.

## Open Questions

- Whether the legacy `valid` JSON field can be removed immediately or should be
  kept as a compatibility field that is always true for emitted population
  entries.
