## ADDED Requirements

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
