## ADDED Requirements

### Requirement: Treat sets as the primary combo-search input
The system SHALL present a build's saved stat configurations as sets, and optimizer searches SHALL be launched from a selected set.

#### Scenario: User opens a build
- **WHEN** a user opens a build
- **THEN** the build page lists its sets before optimizer runs and saved combos
- **AND** each set row provides an optimizer action scoped to that set

### Requirement: Create balanced-element set variants
The system SHALL allow a user to create a new set variant with balanced elemental masteries from an existing set.

#### Scenario: User creates a balanced set
- **WHEN** a user creates a balanced-element set from an existing set
- **THEN** the new set belongs to the same build
- **AND** the new set has equal Fire, Water, Earth, and Air mastery
- **AND** the source set remains unchanged
- **AND** optimizer searches can be launched from the new set
