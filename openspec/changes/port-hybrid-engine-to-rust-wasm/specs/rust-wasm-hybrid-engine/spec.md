## ADDED Requirements

### Requirement: Rust/WASM backend runs hybrid optimization in batches
The system SHALL provide a Rust/WASM hybrid optimizer backend that executes large batches of candidate generation, candidate mutation, candidate evaluation, best-candidate tracking, cache management, and metrics collection inside Rust.

#### Scenario: Large batch stays inside Rust
- **WHEN** a Rust/WASM optimizer run is started with a configured iteration budget
- **THEN** the backend performs candidate evaluation and search-loop updates inside Rust without crossing the TypeScript/WASM boundary for each candidate
- **AND** the TypeScript caller receives compact progress and final result summaries

#### Scenario: Backend returns optimizer-compatible results
- **WHEN** the Rust/WASM backend completes a run
- **THEN** the returned result can be converted to the existing optimizer result shape
- **AND** each returned candidate includes its plan, passive ids, score breakdown, simulation summary, sustainability metadata, and metrics needed by the UI

### Requirement: Rust/WASM backend preserves gameplay semantics
The Rust/WASM backend MUST evaluate every candidate using gameplay rules that match the TypeScript simulator for supported Huppermage optimizer inputs.

#### Scenario: Valid candidate matches TypeScript evaluation
- **GIVEN** a supported candidate plan, catalog, character state, passives, and optimizer scoring criterion
- **WHEN** the differential harness evaluates the candidate through TypeScript and Rust/WASM
- **THEN** validity, total damage, per-turn damage, resource transitions, Huppermage class state, score breakdown, and sustainability result match the TypeScript oracle

#### Scenario: Invalid candidate matches TypeScript violation
- **GIVEN** a candidate plan that violates a supported gameplay rule
- **WHEN** the differential harness evaluates the candidate through TypeScript and Rust/WASM
- **THEN** both backends reject the candidate
- **AND** the normalized violation type, turn index, action index, spell id, resource fields, and scope fields match the TypeScript oracle

### Requirement: Differential tests gate Rust trust
The system SHALL include a differential test harness that compares TypeScript and Rust/WASM gameplay evaluation before Rust-backed optimizer results are trusted.

#### Scenario: Fixed fixture suite passes
- **WHEN** the differential test suite runs fixed fixtures for Huppermage spells, passives, resources, runes, cooldowns, deck limits, cast limits, turn transitions, scoring, and sustainable cycles
- **THEN** every Rust/WASM evaluation matches the TypeScript oracle for the normalized fields under test

#### Scenario: Seeded generated suite passes
- **WHEN** the differential test suite generates candidate batches from deterministic seeds
- **THEN** TypeScript and Rust/WASM evaluate the same generated candidates
- **AND** every mismatch is reported with enough detail to identify the first divergent action and state field

#### Scenario: Long local soak can run outside CI
- **WHEN** a developer runs the local differential soak command
- **THEN** the harness can compare large generated batches beyond the CI budget
- **AND** the command reports mismatch counts, first mismatch details, throughput, and backend timing

### Requirement: Rust/WASM backend remains deterministic for fixed inputs
The Rust/WASM backend SHALL produce deterministic results for the same normalized optimizer request and seed.

#### Scenario: Same seed returns same Rust result
- **WHEN** the same Rust/WASM optimizer request is executed twice with the same seed
- **THEN** the best candidate id, top candidate ordering, score summaries, attempt counts, valid counts, invalid counts, and deterministic metrics match between runs

#### Scenario: Search strategy can differ from TypeScript
- **WHEN** Rust/WASM and TypeScript run the same optimizer request
- **THEN** the Rust/WASM backend is not required to produce the same candidate sequence as TypeScript
- **AND** every Rust-evaluated candidate MUST still satisfy the gameplay equivalence requirements

### Requirement: Rust/WASM backend supports long-run benchmarking
The system SHALL provide benchmarks that compare TypeScript and Rust/WASM optimizer performance on representative scenarios.

#### Scenario: Benchmarks report comparable metrics
- **WHEN** a benchmark is run for TypeScript and Rust/WASM backends on the same scenario
- **THEN** the report includes elapsed time, attempts per second, best score, valid rate, cache metrics, top-candidate count, and backend identifier

#### Scenario: Hundred-million iteration run is measurable
- **WHEN** a local benchmark is run with a 100M iteration budget on a supported Rust/WASM scenario
- **THEN** the benchmark can complete without unbounded memory growth
- **AND** it reports enough metrics to compare search quality and runtime against smaller TypeScript baselines
