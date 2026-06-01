# sublimation-build-catalog Specification

## Purpose
TBD - created by archiving change add-sublimation-catalog-and-build-slots. Update Purpose after archive.
## Requirements
### Requirement: System catalogs sublimations with support status
The system SHALL represent sublimation catalog entries with identity, display name, category, level, cumulative maximum, source metadata, and support status.

#### Scenario: Unsupported sublimation is visible
- **WHEN** a user browses the sublimation catalog
- **THEN** unsupported sublimations are visible
- **AND** each unsupported sublimation exposes a reason explaining why it cannot be selected yet

#### Scenario: Ignored sublimation is visible but blocked
- **WHEN** a sublimation is marked ignored because it depends on enemy death or another excluded mechanic
- **THEN** the catalog shows the sublimation as ignored
- **AND** build selection rejects it with the ignored reason

### Requirement: Build enforces sublimation slot limits
The system SHALL treat selected sublimations as part of the build and enforce slot limits of 10 normal sublimations, 1 epic sublimation, and 1 relic sublimation.

#### Scenario: Slot limits are satisfied
- **WHEN** a build selects up to 10 normal sublimations, 1 epic sublimation, and 1 relic sublimation
- **THEN** sublimation slot validation succeeds if all selected sublimations are otherwise valid

#### Scenario: Normal slot limit is exceeded
- **WHEN** a build selects more than 10 normal sublimations
- **THEN** sublimation slot validation fails with a normal slot limit violation

#### Scenario: Epic or relic slot limit is exceeded
- **WHEN** a build selects more than 1 epic sublimation or more than 1 relic sublimation
- **THEN** sublimation slot validation fails with the matching epic or relic slot limit violation

### Requirement: Build caps duplicate sublimation levels
The system SHALL aggregate selected copies of the same sublimation family by level and cap the effective level at that family cumulative maximum.

#### Scenario: Duplicate levels exceed cumulative maximum
- **GIVEN** a sublimation family has cumulative maximum 4
- **WHEN** a build selects two level-3 copies of that family
- **THEN** the effective level for that family is 4
- **AND** the raw selected level total remains inspectable as 6

### Requirement: Build ignores rune prerequisites
The system SHALL NOT reject a selected sublimation because of rune or equipment-prerequisite requirements.

#### Scenario: Rune prerequisite is present
- **WHEN** a supported sublimation has rune prerequisites in its source data
- **THEN** the build validator ignores those prerequisites
- **AND** validation depends only on support status, slot limits, cumulative maximums, and compatibility rules

### Requirement: Build validates HP-condition compatibility
The system SHALL model HP-threshold sublimations as build assumptions and reject mutually exclusive HP requirements in the same build.

#### Scenario: High-HP and berserk conditions conflict
- **WHEN** a build selects one sublimation requiring at least 90 percent HP and another requiring less than 20 percent HP
- **THEN** build validation fails with an HP-condition conflict

#### Scenario: Compatible HP conditions are selected
- **WHEN** a build selects multiple sublimations whose HP assumptions can be true at the same time
- **THEN** HP-condition validation succeeds

