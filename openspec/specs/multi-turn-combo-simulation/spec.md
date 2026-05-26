# multi-turn-combo-simulation Specification

## Purpose
TBD - created by archiving change add-multi-turn-combo-simulation. Update Purpose after archive.
## Requirements
### Requirement: Core simulates multi-turn combo plans
The system SHALL provide a deterministic combo simulator that evaluates an ordered list of turn plans from a single initial character configuration.

#### Scenario: Two valid turns are simulated
- **GIVEN** a combo plan contains two valid turn plans
- **WHEN** the combo is simulated
- **THEN** the result is valid
- **AND** it contains one turn result per planned turn
- **AND** combo total damage is the sum of turn damages

### Requirement: Combo simulation transitions state between turns
The system SHALL transition the final state of each turn into the next turn's initial state using explicit MVP turn-transition rules.

#### Scenario: Next turn starts from carried Huppermage state
- **WHEN** a turn ends with Huppermage BQ, runes, last generated rune, Feu-Follets, stored BQ, active passives, or deck usage
- **THEN** the next turn starts with that persistent Huppermage class state

#### Scenario: One-turn Heart expires at next turn start
- **WHEN** a turn ends while an active Heart is present
- **THEN** the next turn starts without an active Heart by default

#### Scenario: Next turn refreshes turn resources
- **WHEN** a new turn starts after a previous turn
- **THEN** AP and PM are refreshed from the configured base resources
- **AND** PW and BQ are carried from the previous turn's final state

### Requirement: Combo simulation preserves partial results on invalid turns
The system SHALL stop at the first invalid turn action while preserving completed turn results and the failed turn's partial simulation result.

#### Scenario: Second turn is invalid
- **GIVEN** the first turn is valid
- **AND** the second turn contains an invalid action
- **WHEN** the combo is simulated
- **THEN** the combo result is invalid
- **AND** completed first-turn results remain available
- **AND** violations identify the failing turn and action

### Requirement: GUI builds multi-turn combos
The system SHALL allow the user to create, select, remove, and edit multiple ordered turns in a combo.

#### Scenario: User adds a turn
- **WHEN** the user adds a new turn
- **THEN** the combo contains an additional empty turn
- **AND** the new turn can receive timeline actions
- **AND** the combo simulation is recalculated

### Requirement: GUI inspects multi-turn combo progression
The system SHALL expose a global inspection cursor across all simulated turns.

#### Scenario: User inspects a later turn step
- **WHEN** the user selects a step belonging to a later turn
- **THEN** the GUI displays that step's resources, stats, Huppermage state, applied effects, turn damage, and cumulative combo damage

### Requirement: GUI displays combo-level totals
The system SHALL display combo-level damage and per-turn summaries in addition to selected-action details.

#### Scenario: Multi-turn combo is valid
- **WHEN** a valid combo has multiple simulated turns
- **THEN** the GUI displays total combo damage
- **AND** each turn summary displays its own damage and action count

