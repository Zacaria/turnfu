## ADDED Requirements

### Requirement: Inspect saved optimizer runs
The system SHALL provide a page for inspecting a saved optimizer run from its owning build.

#### Scenario: User opens a saved optimizer run
- **WHEN** the user opens a saved optimizer run from the build page
- **THEN** the system shows the run label, criteria summary, originating setup, and creation timestamp
- **AND** the system shows saved combos associated with the same setup snapshot

### Requirement: Compare saved combos by exact duration
The system SHALL provide a saved combo comparison page that groups combos by exact plan duration.

#### Scenario: User compares saved combos
- **WHEN** the user opens saved combo comparison for a build
- **THEN** saved combos are grouped into separate one-turn, two-turn, and three-turn sections
- **AND** combos inside a duration group are sorted by total damage descending
- **AND** one-turn, two-turn, and three-turn combos are not ranked against each other

### Requirement: Open saved combos in the builder
The system SHALL allow saved combos to be opened in the existing combo builder with their originating setup context.

#### Scenario: User opens a saved combo
- **WHEN** the user opens a saved combo from run detail or combo comparison
- **THEN** the builder is initialized from the combo's setup snapshot
- **AND** the builder timeline contains the saved combo plan
