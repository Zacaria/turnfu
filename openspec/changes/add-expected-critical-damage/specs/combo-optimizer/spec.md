## ADDED Requirements

### Requirement: Optimizer ranks expected critical damage
The system SHALL rank candidates using simulator-backed expected critical damage when the simulation is configured for expected critical mode.

#### Scenario: Expected total damage is maximized
- **WHEN** the optimizer evaluates candidates in expected critical mode with total damage scoring
- **THEN** candidates are ordered by the simulator's expected total damage descending
- **AND** the optimizer does not recalculate critical expectations separately from the simulator

#### Scenario: Expected element damage is maximized
- **WHEN** the optimizer evaluates candidates in expected critical mode with target resolved-element scoring
- **THEN** the element score uses expected damage amounts recorded by the simulator
- **AND** Light damage still contributes according to its resolved combat element
