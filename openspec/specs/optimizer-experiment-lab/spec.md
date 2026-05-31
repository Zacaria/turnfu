# optimizer-experiment-lab Specification

## Purpose
TBD - created by archiving change add-optimizer-experiment-lab. Update Purpose after archive.
## Requirements
### Requirement: Experiment runner compares optimizer engines
The system SHALL provide a core experiment runner that executes one or more optimizer search engines under a shared setup, scoring criterion, duration, seed, and budget.

#### Scenario: Multiple engines are compared with the same budget
- **WHEN** an experiment is run with random, MCTS, novelty, annealing, and genetic engines
- **THEN** the system returns one result per engine
- **AND** each result includes the engine name, budget used, attempts, valid candidate count, invalid candidate count, best candidate, and progress snapshots

### Requirement: Engines evaluate complete simulated plans
The system SHALL score search candidates by simulating complete combo plans for the requested duration through the existing combo simulator and scoring helpers.

#### Scenario: Weak setup prefixes can still win
- **WHEN** an engine evaluates a candidate whose first turn has lower damage but later turns produce the best final score
- **THEN** the completed candidate can be returned as the best result
- **AND** the candidate is not rejected only because the first turn score is low

### Requirement: Experiment runs are deterministic by seed
The system SHALL make stochastic optimizer experiments repeatable when the same seed, setup, engine list, and budget are provided.

#### Scenario: Same seed reproduces the same best plan
- **WHEN** the same experiment is run twice with the same seed and budget
- **THEN** each engine returns the same best candidate plan and score in both runs

### Requirement: Experiment runner reports progress
The system SHALL expose progress snapshots during long-running optimizer experiments.

#### Scenario: Progress callback receives best candidate updates
- **WHEN** an experiment discovers valid candidates while running
- **THEN** the progress callback receives snapshots containing attempts, valid candidates, invalid candidates, best score, best candidate if present, and engine metrics

### Requirement: Experiment evaluations use memoization
The system SHALL avoid re-simulating duplicate complete candidates within an experiment run.

#### Scenario: Duplicate plan is evaluated once
- **WHEN** an engine submits the same complete plan multiple times under the same setup and criterion
- **THEN** the experiment evaluator reuses the cached evaluation after the first simulation
- **AND** the result reports cache hits and cache misses

### Requirement: Search engines include exploration algorithms
The system SHALL include random baseline, Monte Carlo tree search, novelty search, simulated annealing, and genetic search engines behind the shared experiment API.

#### Scenario: Requested engines are available
- **WHEN** a caller requests all supported engine kinds
- **THEN** the experiment runner executes each requested engine kind without requiring UI imports
