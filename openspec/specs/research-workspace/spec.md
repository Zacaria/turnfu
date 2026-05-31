# research-workspace Specification

## Purpose
TBD - created by archiving change add-research-workspace-pages. Update Purpose after archive.
## Requirements
### Requirement: Research library lists builds
The system SHALL provide a research library page that lists user-created builds across classes, gameplay ideas, and build families.

#### Scenario: User opens the research library
- **WHEN** the user opens the research library page
- **THEN** the system displays a scannable list of builds
- **AND** each build includes its user-defined name, class when known, gameplay label, saved setup count, saved combo count, and last updated status

#### Scenario: User filters builds by class
- **WHEN** the user selects a class filter
- **THEN** the system displays only builds matching that class
- **AND** builds without a matching class are hidden until the filter is cleared

### Requirement: Users can create named builds
The system SHALL allow users to create any number of builds and name each build freely.

#### Scenario: User creates a Huppermage build
- **WHEN** the user creates a build with a custom name and selects Huppermage
- **THEN** the system saves the build in the research library
- **AND** the build can contain setup snapshots, optimizer runs, and saved combos

#### Scenario: User views unsupported classes
- **WHEN** the user creates a build
- **THEN** the system displays Huppermage and other Wakfu classes
- **AND** only Huppermage is selectable
- **AND** unsupported classes are visibly disabled until implemented

### Requirement: Build page groups related theorycraft work
The system SHALL provide a build page that groups setup versions, optimizer runs, saved combos, and notes for one gameplay idea.

#### Scenario: User opens a build
- **WHEN** the user opens a build from the research library
- **THEN** the system displays the build name, class, gameplay intent, setup version list, optimizer run list, and saved combo list
- **AND** the user can navigate from the build to a setup version, optimizer run, saved combo, or builder view

#### Scenario: Build has no saved work yet
- **WHEN** a build has no setup versions, optimizer runs, or saved combos
- **THEN** the system displays empty states for those sections
- **AND** each empty state exposes the next relevant action

### Requirement: Research workspace persists locally
The system SHALL persist research workspace data in `localStorage` for the first implementation.

#### Scenario: User refreshes the app
- **WHEN** the user creates or updates builds and then refreshes the app
- **THEN** the system restores the saved builds, setup snapshots, optimizer run references, and saved combo references from `localStorage`

#### Scenario: No local data exists
- **WHEN** the app starts without existing workspace data
- **THEN** the system initializes a usable default workspace
- **AND** the default workspace includes at least one Huppermage build path

### Requirement: Research navigation preserves context
The system SHALL preserve the selected build and setup context when navigating between library, build, setup, optimizer, and builder pages.

#### Scenario: User opens the builder from a setup
- **WHEN** the user opens the builder from a setup inside a build
- **THEN** the builder is initialized from that setup
- **AND** navigation back to the build keeps the originating build selected

#### Scenario: User returns from a saved combo
- **WHEN** the user returns from a saved combo detail page
- **THEN** the system restores the previous build context
- **AND** the saved combo remains associated with its source setup

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

### Requirement: Compare saved combos within a set and exact duration
The system SHALL compare saved combos within one selected set and one selected exact duration.

#### Scenario: User opens saved combo comparison
- **WHEN** a user opens the saved combo comparison page for a build
- **THEN** the page offers a set selector
- **AND** the page offers exact duration selectors for one, two, and three turns
- **AND** the table only lists saved combos matching the selected set and exact duration
- **AND** each listed combo shows its saved criteria summary

### Requirement: Present sets as stat contexts for combo search
The system SHALL present a set as the stat and context input for combo search without implying that its saved deck limits optimizer spell choice.

#### Scenario: User reviews a set before optimizing
- **WHEN** a user opens a set detail page
- **THEN** the page shows the set's key stats and resources
- **AND** the page does not label the saved deck as optimizer hypotheses
- **AND** the optimizer action remains available from the set
