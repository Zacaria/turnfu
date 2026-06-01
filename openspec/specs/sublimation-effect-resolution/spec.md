# sublimation-effect-resolution Specification

## Purpose
TBD - created by archiving change add-supported-sublimation-effects. Update Purpose after archive.
## Requirements
### Requirement: System applies supported build-level sublimation effects
The system SHALL apply selected supported sublimations from the build to simulation initialization, action evaluation, and turn-end resolution according to structured sublimation effect definitions.

#### Scenario: Flat stat sublimation affects first action
- **GIVEN** a build selects a supported sublimation that grants critical-hit percentage
- **WHEN** a turn simulation starts
- **THEN** the first action sees the modified critical-hit percentage
- **AND** expected critical damage uses the modified value

#### Scenario: Resource sublimation affects available resources
- **GIVEN** a build selects a supported sublimation that grants AP, MP, WP, or BQ at combat start
- **WHEN** a turn simulation starts
- **THEN** the initial remaining resources include the supported sublimation resource change

### Requirement: System resolves action-conditioned sublimation eligibility
The system SHALL apply supported action-conditioned sublimation effects only when the current spell metadata satisfies the sublimation condition.

#### Scenario: Distance condition is satisfied
- **GIVEN** a selected supported sublimation applies to distance spells
- **WHEN** a spell can satisfy the required distance threshold from its range metadata
- **THEN** the sublimation effect applies to that spell action

#### Scenario: Distance condition is not satisfiable
- **GIVEN** a selected supported sublimation applies to distance spells
- **WHEN** a spell's maximum usable range cannot satisfy the required distance threshold
- **THEN** the sublimation effect does not apply to that spell action

#### Scenario: Diagonal condition requires diagonal-capable cast
- **GIVEN** a selected supported sublimation applies to diagonal casts
- **WHEN** a spell cannot be cast diagonally according to its cast profile
- **THEN** the sublimation effect does not apply to that spell action

#### Scenario: Zone condition requires zone-capable spell
- **GIVEN** a selected supported sublimation applies to zone spells
- **WHEN** a spell is not tagged or profiled as zone-capable
- **THEN** the sublimation effect does not apply to that spell action

### Requirement: System records sublimation effect explanations
The system SHALL record applied and skipped supported sublimation effects in simulation breakdowns.

#### Scenario: Sublimation effect applies
- **WHEN** a supported sublimation modifies an action's damage or stats
- **THEN** the action breakdown identifies the sublimation, effect, and eligibility reason

#### Scenario: Supported sublimation is skipped for an action
- **WHEN** a selected supported sublimation is valid for the build but ineligible for the current action
- **THEN** the breakdown exposes that the sublimation was skipped for that action
- **AND** the skipped reason is available to presentation layers

### Requirement: System applies deterministic PA and PM carryover
The system SHALL resolve supported PA and PM carryover sublimations at turn end from remaining resources and carry the resulting resources into the next simulated turn.

#### Scenario: Remaining AP is carried to next turn
- **GIVEN** a selected supported sublimation carries unused AP
- **WHEN** a turn ends with carryable AP remaining
- **THEN** the combo simulator records the carryover effect
- **AND** the following turn starts with the carried AP according to the sublimation rule

#### Scenario: No resource remains to carry
- **GIVEN** a selected supported sublimation carries unused AP or PM
- **WHEN** a turn ends with no matching resource remaining
- **THEN** no carryover resource is added to the following turn

### Requirement: System blocks unsupported event-critical and death-trigger sublimations
The system SHALL keep first-critical-hit, critical-event, and death-trigger sublimations unavailable for selection until their required event model exists, even when they are visible in the catalog.

#### Scenario: First-critical-hit sublimation is selected
- **WHEN** a user attempts to select a first-critical-hit sublimation
- **THEN** build selection rejects it with a planned critical-event-model reason

#### Scenario: Death-trigger sublimation is selected
- **WHEN** a user attempts to select a sublimation that depends on enemy death
- **THEN** build selection rejects it with an ignored death-trigger reason

