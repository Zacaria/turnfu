## ADDED Requirements

### Requirement: Optimizer workspace runs from one setup
The system SHALL provide an optimizer workspace page scoped to a selected setup snapshot.

#### Scenario: User opens optimizer workspace
- **WHEN** the user opens the optimizer workspace for a setup snapshot
- **THEN** the system displays the setup identity, class, key stats, resources, passives, target context, and default action context
- **AND** optimizer runs use that setup as their input source

#### Scenario: User changes optimizer criteria
- **WHEN** the user changes duration, scoring criterion, target element, sustainability requirement, or result count
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
