# combo-optimizer-workspace Specification

## Purpose
TBD - created by archiving change add-combo-optimizer-workspace-ui. Update Purpose after archive.
## Requirements
### Requirement: Optimizer workspace runs from one setup
The system SHALL provide an optimizer workspace page scoped to a selected setup snapshot.

#### Scenario: User opens optimizer workspace
- **WHEN** the user opens the optimizer workspace for a setup snapshot
- **THEN** the system displays the setup identity, class, key stats, resources, passives, target context, and default action context
- **AND** optimizer runs use that setup as their input source

#### Scenario: User changes optimizer criteria
- **WHEN** the user changes duration, scoring criterion, target element, sustainability requirement, search width, or result count
- **THEN** the next optimizer run uses the updated criteria
- **AND** the setup snapshot itself remains unchanged

### Requirement: Optimizer results are separated by exact duration
The system SHALL group optimizer results by exact candidate duration so one-turn, two-turn, and three-turn candidates are not ranked together by raw total damage.

#### Scenario: User searches multiple durations
- **WHEN** the user runs a search including one-turn, two-turn, and three-turn candidates
- **THEN** the system displays separate result sections for one-turn, two-turn, and three-turn candidates
- **AND** candidates in each section are ranked only against candidates with the same duration

#### Scenario: User inspects a duration group
- **WHEN** the user inspects a duration group
- **THEN** each result row displays its score, total damage, damage per turn, action count, final AP/MP/PW/BQ, and sustainability state

### Requirement: Optimizer workspace exposes bounded search controls
The system SHALL expose search-width controls so users can trade search breadth for responsiveness without manually limiting actions per turn.

#### Scenario: User changes search width
- **WHEN** the user changes the search-width control
- **THEN** optimizer result groups use that value as the core optimizer beam width
- **AND** results remain deterministic for identical setup and control inputs

#### Scenario: User searches multi-action turns
- **WHEN** the user runs an optimizer search
- **THEN** the system does not require an actions-per-turn criterion from the user
- **AND** simulator validity, resources, cast constraints, exact duration, and search width bound the search

### Requirement: Optimizer supports scoring criteria controls
The system SHALL allow users to search by total damage or by resolved-element damage for Fire, Water, Earth, or Air.

#### Scenario: User maximizes total damage
- **WHEN** the user selects total damage scoring
- **THEN** result rows are ranked by total combo damage within each duration group

#### Scenario: User maximizes target element damage
- **WHEN** the user selects a target element scoring criterion
- **THEN** result rows are ranked by damage attributed to that resolved element within each duration group
- **AND** Light damage resolved to that element contributes to the score

### Requirement: Optimizer supports sustainable cycle filtering
The system SHALL allow users to require sustainable cycles with a maximum duration of three turns, using replay validity and BQ/PW preservation as the first sustainability rule.

#### Scenario: User enables sustainable cycle filtering
- **WHEN** the user enables sustainable cycle filtering
- **THEN** the system returns only candidates whose replay is valid
- **AND** replay final PW and BQ are greater than or equal to replay initial PW and BQ
- **AND** rune, heart, and other Huppermage class state equivalence is not required by this first sustainability filter

#### Scenario: Candidate is not sustainable
- **WHEN** a candidate replay is invalid or ends with lower replay PW or BQ
- **THEN** the candidate is excluded from sustainable result groups

### Requirement: Users can compare pinned candidates
The system SHALL allow users to pin optimizer candidates into a comparison area.

#### Scenario: User pins candidates from different durations
- **WHEN** the user pins candidates from one-turn, two-turn, or three-turn result groups
- **THEN** the comparison area displays all pinned candidates together
- **AND** each pinned candidate clearly identifies its duration

#### Scenario: User compares pinned candidates
- **WHEN** pinned candidates are displayed
- **THEN** the comparison area shows total damage, damage per turn, damage per AP, damage by resolved element, final resources, action count, and sustainability state for each candidate

### Requirement: Optimizer candidates can be opened in the timeline builder
The system SHALL allow an optimizer candidate to be opened in the existing timeline builder for detailed inspection and editing.

#### Scenario: User opens candidate in builder
- **WHEN** the user chooses to open an optimizer candidate in the timeline builder
- **THEN** the builder loads the candidate's turn plan
- **AND** the builder uses the setup snapshot assumptions that produced the candidate

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

### Requirement: Save optimizer candidates for later comparison
The system SHALL preserve optimizer context when saving candidate combos for later comparison.

#### Scenario: User saves an optimizer candidate
- **WHEN** a user saves a candidate from the optimizer workspace
- **THEN** the saved combo records the selected set
- **AND** the saved combo records a summary of the active optimizer criteria
- **AND** the saved combo can be compared with other combos of the same exact duration

### Requirement: Preserve persisted optimizer data in localStorage
The system SHALL preserve saved optimizer runs and saved combos through the existing localStorage workspace serialization.

#### Scenario: User reloads after saving optimizer data
- **WHEN** the workspace is saved and restored from localStorage
- **THEN** optimizer runs and saved combos remain associated with their original build and setup snapshot

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

### Requirement: Show candidate spell icon rows
The system SHALL show the spell sequence for each optimizer candidate as compact spell icon rows directly in the optimizer result row.

#### Scenario: User scans optimizer candidates
- **WHEN** optimizer candidates are displayed
- **THEN** each candidate row includes three spell icon rows, one per possible turn
- **AND** spell names are available through icon titles or accessibility labels when available
- **AND** the user can compare candidate variations without opening each candidate in the builder

### Requirement: Communicate optimizer set scope
The system SHALL make the selected set visible as the scope of an optimizer search.

#### Scenario: User opens optimizer from a set
- **WHEN** a user opens the optimizer workspace from a set
- **THEN** the optimizer header identifies the selected set
- **AND** saved runs and combos remain associated with that set

### Requirement: Search combos from a selected set
The system SHALL use a selected set's stats and persistent context while allowing the optimizer to choose from all modeled spells.

#### Scenario: User launches optimizer from a set
- **WHEN** a user opens optimizer from a set
- **THEN** the optimizer uses the set's character stats, resources, passives, target, and action context
- **AND** the optimizer does not restrict available spells to the set's saved deck spell ids
- **AND** the optimizer may include any modeled spell whose simulation rules allow it
