## ADDED Requirements

### Requirement: Setup snapshots capture repeatable assumptions
The system SHALL represent a setup snapshot as a reusable immutable input containing character class, final stats, equipment notes, deck/passives, target context, default action context, and initial class state.

#### Scenario: User creates a setup snapshot
- **WHEN** the user saves the current build assumptions as a setup snapshot
- **THEN** the system records the final stats, resources, equipment notes, passives, spell deck, target context, default action context, and initial class state
- **AND** future optimizer runs can reference that snapshot without depending on later builder edits

#### Scenario: User inspects a setup snapshot
- **WHEN** the user opens a setup snapshot
- **THEN** the system displays the snapshot's class, key stats, resources, equipment notes, passives, deck summary, target context, and initial class state summary

### Requirement: Setup snapshots support versioned comparison
The system SHALL distinguish different versions of a setup so optimizer runs and saved combos remain tied to the assumptions that produced them.

#### Scenario: User edits an existing setup
- **WHEN** the user changes assumptions from an existing setup snapshot
- **THEN** the system creates or identifies a new setup version
- **AND** existing optimizer runs keep referencing the original setup version

#### Scenario: User compares runs from different setup versions
- **WHEN** optimizer runs reference different setup versions
- **THEN** the system identifies the setup version used by each run
- **AND** the comparison view can warn that the results do not share identical assumptions

### Requirement: Setup snapshots can initialize tools
The system SHALL allow setup snapshots to initialize compatible tools such as the turn builder and optimizer workspace.

#### Scenario: User opens optimizer from a setup
- **WHEN** the user opens the optimizer workspace from a setup snapshot
- **THEN** the optimizer receives character, catalog, target, default action context, and initial class state inputs derived from that setup

#### Scenario: User opens builder from a setup
- **WHEN** the user opens the timeline builder from a setup snapshot
- **THEN** the builder uses the snapshot's stats, resources, passives, deck, target context, and initial class state as its starting assumptions
