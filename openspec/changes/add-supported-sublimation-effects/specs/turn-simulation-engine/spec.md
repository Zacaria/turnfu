## ADDED Requirements

### Requirement: Simulator applies selected sublimation effects
The system SHALL apply selected supported sublimations as part of turn simulation without requiring GUI modules or optimizer-specific logic.

#### Scenario: Selected sublimation modifies damage
- **GIVEN** a simulated character build contains a selected supported damage sublimation
- **WHEN** a spell action satisfies the sublimation eligibility rules
- **THEN** the spell action damage uses the sublimation effect
- **AND** the applied effect is recorded in the action breakdown

#### Scenario: Unsupported selected sublimation is rejected before simulation
- **GIVEN** a simulated character build contains an unsupported sublimation
- **WHEN** turn simulation is requested
- **THEN** the simulator returns an invalid result or validation error identifying the unsupported sublimation

### Requirement: Simulator uses spell cast profiles for sublimation eligibility
The system SHALL use structured spell cast-profile metadata to decide whether melee, distance, zone, line, and diagonal sublimation conditions can apply.

#### Scenario: Cast profile is missing required metadata
- **WHEN** a selected sublimation requires cast-profile metadata that the current spell does not define
- **THEN** the simulator treats the sublimation as ineligible for that action
- **AND** it records a skipped reason rather than applying the effect optimistically
