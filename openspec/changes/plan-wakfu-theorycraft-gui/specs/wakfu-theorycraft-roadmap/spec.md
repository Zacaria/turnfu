## ADDED Requirements

### Requirement: MVP scope is explicit
The project roadmap SHALL define an initial MVP limited to Huppermage, one turn, no equipment, no sublimations, manually maintained spell data, and raw damage maximization.

#### Scenario: MVP boundary is reviewed
- **WHEN** a contributor reads the roadmap capability
- **THEN** the contributor can identify which Wakfu mechanics are included in the MVP and which are excluded

### Requirement: Architecture separates core logic from GUI
The project roadmap SHALL require domain modeling, spell catalog data, turn simulation, optimization, and GUI presentation to be separated into distinct architectural areas.

#### Scenario: New implementation change is planned
- **WHEN** a change adds behavior to the simulator or optimizer
- **THEN** the behavior is specified outside GUI components and can be tested without rendering the GUI

### Requirement: Simulation precedes optimization
The project roadmap SHALL sequence implementation so the spell catalog and deterministic turn simulation engine exist before exhaustive or genetic optimization is implemented.

#### Scenario: Optimization work is proposed
- **WHEN** an optimization change is prepared
- **THEN** it depends on simulation results instead of recalculating spell rules internally

### Requirement: Roadmap supports progressive Wakfu fidelity
The project roadmap SHALL describe progressive phases for real Wakfu constraints, sublimations, multi-turn objectives, multi-objective scoring, and advanced visualizations.

#### Scenario: Future scope is evaluated
- **WHEN** a new mechanic is requested
- **THEN** it can be mapped to a roadmap phase without expanding the MVP unexpectedly

### Requirement: Genetic optimization is deferred
The project roadmap SHALL defer genetic optimization until the action space becomes too large for practical exhaustive search or until multi-turn, sublimation, or multi-objective optimization requires it.

#### Scenario: Genetic algorithm is considered
- **WHEN** exhaustive search remains fast and explainable for the current scope
- **THEN** the project continues using exhaustive search rather than introducing genetic optimization prematurely
