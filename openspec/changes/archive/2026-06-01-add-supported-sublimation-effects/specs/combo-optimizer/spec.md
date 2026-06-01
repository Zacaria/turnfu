## ADDED Requirements

### Requirement: Optimizer scores supported sublimation effects
The system SHALL evaluate and rank optimizer candidates using simulator results that include selected supported sublimation effects.

#### Scenario: Sublimation increases candidate damage
- **GIVEN** a build selects a supported sublimation that increases eligible spell damage
- **WHEN** the optimizer evaluates candidate plans
- **THEN** candidate scores include the simulator-applied sublimation damage
- **AND** candidates with ineligible spells do not receive that sublimation damage

### Requirement: Optimizer respects sublimation carryover in sustainability checks
The system SHALL include simulator-applied PA and PM carryover sublimation effects when validating multi-turn candidates and sustainable cycles.

#### Scenario: Carryover changes replay resources
- **GIVEN** a build selects a supported AP carryover sublimation
- **WHEN** the optimizer replays a candidate for sustainability
- **THEN** the replay starts each affected turn with the carried AP from the previous turn
- **AND** sustainability is evaluated from the simulator's carried final state
