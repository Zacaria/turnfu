## ADDED Requirements

### Requirement: Simulator supports expected critical damage
The system SHALL support expected critical damage evaluation using the current caster critical-hit percentage, non-critical damage branch, and critical damage branch.

#### Scenario: Expected critical damage is calculated
- **GIVEN** a character has 25 percent critical-hit chance
- **WHEN** a spell damage effect is evaluated in expected critical mode
- **THEN** the recorded damage result equals 75 percent of the non-critical branch plus 25 percent of the critical branch
- **AND** the turn total uses the expected damage result

#### Scenario: Critical chance is clamped
- **GIVEN** a character has critical-hit percentage below 0 or above 100
- **WHEN** expected critical damage is calculated
- **THEN** the effective critical chance is clamped to the inclusive range 0 to 100 percent

### Requirement: Simulator preserves forced critical evaluation
The system SHALL allow deterministic forced critical and forced non-critical damage evaluation modes in addition to expected critical mode.

#### Scenario: Forced non-critical damage is calculated
- **WHEN** a spell damage effect is evaluated in forced non-critical mode
- **THEN** the damage result uses the non-critical branch only
- **AND** critical mastery does not contribute to the damage result

#### Scenario: Forced critical damage is calculated
- **WHEN** a spell damage effect is evaluated in forced critical mode
- **THEN** the damage result uses the critical branch only
- **AND** critical mastery contributes to the damage result

### Requirement: Simulator explains critical damage branches
The system SHALL include critical evaluation details in each damage formula breakdown.

#### Scenario: Formula breakdown is inspected
- **WHEN** a damage effect is recorded
- **THEN** the formula breakdown identifies the selected critical evaluation mode
- **AND** it includes the effective critical-hit chance
- **AND** it includes non-critical, critical, and final damage results when expected mode is used
