## ADDED Requirements

### Requirement: Optimizer searches bounded combo plans
The system SHALL provide a deterministic combo optimizer that searches candidate Huppermage combo plans up to a configured maximum number of turns.

#### Scenario: Optimizer respects the turn limit
- **WHEN** the optimizer is configured with a maximum of 3 turns
- **THEN** every returned candidate contains no more than 3 turns
- **AND** every candidate has been evaluated through the combo simulator

### Requirement: Optimizer ranks by damage criteria
The system SHALL rank valid combo candidates by configured damage criteria including total damage and target resolved-element damage.

#### Scenario: Total damage is maximized
- **WHEN** the optimizer is configured to maximize total damage
- **THEN** candidates are ordered by combo total damage descending
- **AND** each result exposes the score used for ranking

#### Scenario: Target element damage is maximized
- **WHEN** the optimizer is configured to maximize Fire damage
- **THEN** candidates are ordered by resolved Fire damage descending
- **AND** direct Fire damage and Light damage resolved to Fire are counted in the Fire score
- **AND** Light damage resolved to another element is not counted in the Fire score

### Requirement: Optimizer validates sustainable cycles
The system SHALL support filtering candidates to cycles that remain sustainable across repeated execution.

#### Scenario: Candidate is sustainable
- **GIVEN** a candidate combo is valid for its first execution
- **WHEN** the same combo is simulated again from the carried final state of the first execution
- **THEN** the candidate is sustainable only if the replay is valid
- **AND** the replay final PW is greater than or equal to the replay initial PW
- **AND** the replay final BQ is greater than or equal to the replay initial BQ

#### Scenario: Candidate spends unrecovered BQ
- **GIVEN** a candidate combo is valid for its first execution
- **WHEN** replaying the same combo ends with less BQ than it started with
- **THEN** the candidate is rejected when sustainable cycles are required

### Requirement: Optimizer explains scored results
The system SHALL return optimizer results with the candidate plan, simulation result, score breakdown, damage by resolved element, and sustainability metadata.

#### Scenario: Result is inspected
- **WHEN** a candidate is returned by the optimizer
- **THEN** the result includes total damage
- **AND** it includes damage grouped by resolved element
- **AND** it identifies whether sustainability was required and whether the candidate satisfied it

### Requirement: Optimizer remains independent from GUI
The system SHALL expose combo optimization behavior from core modules without importing GUI components.

#### Scenario: Optimizer is called from tests
- **WHEN** a test imports the optimizer from the core module entrypoint
- **THEN** it can evaluate candidates without importing UI modules
