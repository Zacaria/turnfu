## Why

The Continuous optimizer's genetic/hybrid WASM path currently generates many
unevaluated proposals, but the contract around which proposals may compete is
implicit. This change makes simulator validity the admission boundary so the
Continuous genetic population never selects, ranks, preserves, resumes, or
reports from invalid bases.

## What Changes

- Define Continuous genetic/hybrid populations as sets of simulator-valid
  individuals only.
- Treat mutation, crossover, repair, seed, elite-neighbor, restart, and
  immigrant outputs as proposals until exact simulator validation admits them.
- Add a valid individual factory around the Rust/WASM generation path used by
  Continuous with bounded retry, adaptive fabrication temperature, projection
  from the first violation, and exact revalidation before admission.
- Sanitize resume state so legacy or unverified population entries cannot become
  parents, elites, top candidates, or persisted competitive population entries.
- Replace Continuous genetic-facing validity-rate reporting with fabrication
  diagnostics such as admitted individuals, discarded proposals, fabrication
  attempts, projection repairs, and factory exhaustions.
- Add targeted tests for invalid proposal rejection, resume filtering,
  projection admission, deterministic seeded behavior, and simulator-validated
  top candidates.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `combo-optimizer`: Continuous genetic/hybrid optimizer populations must
  contain only simulator-valid individuals, with invalid generated material
  treated as failed fabrication rather than competitive candidates.

## Impact

- Rust/WASM optimizer population, resume, mutation, crossover, repair,
  projection, restart, and top-candidate paths used by Continuous in
  `rust/optimizer-wasm/src/lib.rs`.
- Continuous progress and benchmark reporting terms in TypeScript scripts and
  optimizer UI surfaces where they describe population quality.
- Rust and TypeScript tests covering population invariants and reporting
  terminology.
