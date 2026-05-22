## ADDED Requirements

### Requirement: Simulator exposes per-action stat snapshots
The system SHALL include caster statistics before and after each successful action in the action breakdown so presentation layers can inspect stat evolution without recalculating simulation rules.

#### Scenario: Action modifies caster stats
- **WHEN** a successful action applies a supported caster stat modifier
- **THEN** the action breakdown includes stats before and after the action
- **AND** later action breakdown entries use the updated stats as their before snapshot

#### Scenario: GUI inspects intermediate turn state
- **WHEN** a GUI reads a simulation result at a timeline step
- **THEN** it can obtain the current stats for that step from the simulation result
