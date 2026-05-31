## ADDED Requirements

### Requirement: Persist optimizer runs
The system SHALL allow a user to save the current optimizer search as a build-scoped optimizer run reference.

#### Scenario: User saves current optimizer criteria
- **WHEN** the user saves an optimizer run from a setup-scoped optimizer workspace
- **THEN** the system stores an optimizer run reference with the originating build id, setup snapshot id, readable label, criteria summary, and creation timestamp
- **AND** the owning build references the saved run
- **AND** the build page lists the saved run under optimizer runs

### Requirement: Persist optimizer candidates as saved combos
The system SHALL allow a user to save an optimizer candidate as a build-scoped saved combo reference.

#### Scenario: User saves an optimizer candidate
- **WHEN** the user saves an optimizer candidate from the optimizer workspace
- **THEN** the system stores the candidate combo plan with the originating build id, setup snapshot id, readable name, total damage, and creation timestamp
- **AND** the owning build references the saved combo
- **AND** the build page lists the saved combo under saved combos

### Requirement: Preserve persisted optimizer data in localStorage
The system SHALL preserve saved optimizer runs and saved combos through the existing localStorage workspace serialization.

#### Scenario: User reloads after saving optimizer data
- **WHEN** the workspace is saved and restored from localStorage
- **THEN** optimizer runs and saved combos remain associated with their original build and setup snapshot
