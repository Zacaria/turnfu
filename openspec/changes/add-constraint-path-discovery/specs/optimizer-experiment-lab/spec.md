## ADDED Requirements

### Requirement: Experiment lab reports discovery-guided search
The system SHALL allow optimizer experiments to run discovery-guided search phases and report their contribution separately from exact final scoring.

#### Scenario: Discovery metrics are reported
- **WHEN** an experiment runs with constraint-path discovery enabled
- **THEN** the result includes metrics for descriptor count, motif count, repair-derived candidates, curriculum-derived candidates, discovery-score leaders, and final-score leaders
- **AND** the experiment still reports attempts, valid candidates, invalid candidates, best candidate, cache metrics, and progress snapshots

#### Scenario: Discovery-guided run is compared to baseline
- **WHEN** an experiment compares the existing hybrid engine with a discovery-guided hybrid configuration under the same setup, seed, criterion, and budget
- **THEN** each engine result is reported independently
- **AND** final best candidates for both engines are validated by the same simulator-backed scoring helpers
