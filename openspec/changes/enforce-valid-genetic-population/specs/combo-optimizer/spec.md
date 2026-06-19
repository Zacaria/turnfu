## ADDED Requirements

### Requirement: Continuous genetic optimizer populations contain only valid individuals

The system SHALL only admit simulator-valid combos into Continuous genetic or
hybrid optimizer populations. Generated material that has not passed exact
simulator validation SHALL be treated as a proposal, not as an individual.

#### Scenario: Mutation produces an invalid proposal

- **GIVEN** a valid parent in a Continuous genetic or hybrid optimizer population
- **WHEN** mutation, crossover, repair, seed, or immigrant generation produces a
  proposal that fails exact simulator validation
- **THEN** the proposal is discarded, repaired, or projected before admission
- **AND** it is not selected, ranked, persisted as a population entry, used as a
  parent, retained as an elite, or exposed as a top optimizer result

#### Scenario: Generation fabricates children

- **GIVEN** the Continuous optimizer needs to fill a genetic or hybrid generation
- **WHEN** generated proposals fail exact simulator validation
- **THEN** the optimizer continues fabrication using bounded retry, projection,
  adaptive temperature, or fallback proposal sources until the fabrication
  budget is exhausted
- **AND** every individual admitted to the generation is simulator-valid

#### Scenario: Resume state contains legacy invalid population entries

- **GIVEN** a persisted or resumed hybrid optimizer state contains population
  entries not known to be simulator-valid
- **WHEN** the optimizer resumes
- **THEN** invalid or unverified entries are not admitted into the competitive
  population
- **AND** resumed parent selection operates only on valid individuals

#### Scenario: Projection repairs a failed proposal

- **GIVEN** a generated proposal fails validation at a specific simulator
  violation
- **WHEN** projection preserves a valid prefix, removes or replaces the violating
  action, or rebuilds the remaining suffix
- **THEN** the projected proposal is admitted only after exact simulator
  revalidation succeeds
- **AND** a failed projection is counted as a fabrication failure, not as an
  invalid individual

#### Scenario: Continuous top candidates come from oracle-validated individuals

- **WHEN** the Continuous runner receives top candidates from Rust/WASM workers
- **THEN** each displayed, ranked, checkpointed, or persisted top candidate is
  revalidated through the exact simulator or TypeScript oracle path
- **AND** any top proposal that fails oracle validation is skipped rather than
  displayed, persisted as evidence, or used as a competitive result

#### Scenario: Sustainable cycle is part of admission

- **GIVEN** Continuous is running with sustainable cycle required
- **WHEN** a proposal is simulator-valid for one execution but fails sustainable
  replay validation
- **THEN** it is rejected as a fabrication failure
- **AND** it is not counted as an admitted individual, resumed as population, or
  shown as a candidate

#### Scenario: Genetic reporting uses fabrication diagnostics

- **WHEN** Continuous genetic or hybrid optimizer progress is reported
- **THEN** validity rate is not presented as a population quality metric
- **AND** invalid generated material is reported, when needed, using fabrication
  diagnostics such as admitted individuals, discarded proposals, fabrication
  attempts, projection repairs, and factory exhaustions
