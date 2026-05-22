## ADDED Requirements

### Requirement: GUI builds one-turn action timelines
The system SHALL provide a GUI for constructing an ordered one-turn action timeline from available Huppermage spells.

#### Scenario: Action is added to the timeline
- **WHEN** the user selects a spell and adds it to the timeline
- **THEN** the timeline contains a new action referencing that spell id
- **AND** the simulation result is recalculated from the updated sequence

#### Scenario: Action order is changed
- **WHEN** the user moves an action earlier or later in the timeline
- **THEN** the sequence order changes
- **AND** the simulation result is recalculated using the new order

### Requirement: GUI configures initial turn state
The system SHALL allow the user to configure the initial Huppermage state needed by the current simulator.

#### Scenario: Initial resources and class state are configured
- **WHEN** the user changes initial AP, MP, WP, BQ, active runes, active passives, active Heart, or base stats
- **THEN** the next simulation uses those configured values
- **AND** the displayed timeline snapshots update accordingly

### Requirement: GUI configures action context
The system SHALL allow each timeline action to configure the action inputs supported by the simulator.

#### Scenario: Action context is changed
- **WHEN** the user changes target kind, critical flag, position, range mode, berserk flag, or block flag for an action
- **THEN** the corresponding action in the simulated sequence is updated
- **AND** damage and state displays reflect the changed context

### Requirement: GUI provides a discrete turn timeline cursor
The system SHALL provide a discrete cursor with one position for the initial state and one position after each successful action.

#### Scenario: User inspects a timeline step
- **WHEN** the user moves the cursor to a timeline step
- **THEN** the GUI displays the resources, Huppermage state, current stats, and applied effects for that step

### Requirement: GUI visualizes Huppermage state progression
The system SHALL display Huppermage-specific state at the selected cursor step.

#### Scenario: Huppermage state changes during the turn
- **WHEN** a simulated action changes runes, last generated rune, active Feu-Follets, stored Feu-Follet runes, Heart state, or BQ regeneration state
- **THEN** the selected step inspector displays the resulting values

### Requirement: GUI visualizes calculated damage
The system SHALL display total turn damage, damage by action, and damage formula detail when available.

#### Scenario: Damage action is selected
- **WHEN** the selected step includes an action with damage effects
- **THEN** the GUI displays the action damage, total damage so far, and formula breakdown values from the simulator

### Requirement: GUI shows simulation violations
The system SHALL show structured simulation violations without hiding the state reached before the failed action.

#### Scenario: Timeline becomes invalid
- **WHEN** the timeline contains an invalid action sequence
- **THEN** the GUI displays the violation message and the failed action
- **AND** the cursor can still inspect all completed actions before the failure

### Requirement: GUI does not duplicate simulation rules
The system SHALL use the core catalog and simulation modules as the source of truth for spell rules, state transitions, resources, and damage.

#### Scenario: GUI renders a simulation result
- **WHEN** the GUI needs to display resources, stats, state, violations, or damage
- **THEN** it consumes the simulation result instead of recalculating Wakfu rules in UI components
