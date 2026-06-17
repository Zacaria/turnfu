## ADDED Requirements

### Requirement: Discovery extracts rule-state descriptors
The system SHALL derive compact discovery descriptors from simulator evaluations of valid and invalid optimizer candidates.

#### Scenario: Valid candidate descriptor is recorded
- **WHEN** a candidate is simulated successfully during a discovery-enabled optimizer run
- **THEN** the system records a descriptor containing resources, class state, action sequence features, damage timing, and final-state affordances
- **AND** the descriptor is associated with the exact simulator-backed score used for final validation

#### Scenario: Invalid candidate descriptor is recorded
- **WHEN** a candidate fails simulation during a discovery-enabled optimizer run
- **THEN** the system records the violation category and relevant partial state
- **AND** the failed candidate can be used as repair or curriculum input without being eligible as a final result

### Requirement: Discovery rewards enabling states
The system SHALL support bounded discovery rewards for setup states that may enable delayed payoff while preserving strict final result ranking.

#### Scenario: Setup state receives discovery credit
- **WHEN** a candidate reaches an enabling state such as rune diversity, BQ recovery, WP preservation, conditional spell access, or sustainable replay readiness
- **THEN** the discovery phase can assign temporary discovery credit to that candidate
- **AND** the final optimizer result remains ranked by the configured simulator-backed damage or sustainability criterion

#### Scenario: Discovery score is observable separately
- **WHEN** a discovery-enabled run reports a candidate or metric snapshot
- **THEN** the system exposes discovery score separately from final simulator score
- **AND** callers can determine whether a candidate is promising because of heuristic discovery credit or exact final score

### Requirement: Discovery mines reusable motifs
The system SHALL identify reusable motifs from successful, repaired, and near-miss candidates and make those motifs available as bounded search hints.

#### Scenario: Motif is mined from repeated useful structure
- **WHEN** multiple evaluated candidates share a state/action pattern that leads to improved final score, repaired validity, or useful enabling state
- **THEN** the system can record that pattern as a motif with support count, validation rate, and score contribution metadata

#### Scenario: Motif seeds candidate generation
- **WHEN** hybrid search consumes discovered motifs
- **THEN** motif-derived candidates are still simulated normally
- **AND** invalid or low-value motif candidates do not bypass pruning, repair limits, or final ranking rules

### Requirement: Discovery supports curriculum objectives
The system SHALL support discovery curriculum objectives that search for intermediate capabilities before feeding useful candidates back into final optimization.

#### Scenario: Curriculum run targets an intermediate capability
- **WHEN** a discovery run is configured to target an objective such as BQ generation, rune cycling, valid long plans, sustainable loops, or conditional unlocks
- **THEN** the system evaluates candidates against that curriculum objective during discovery
- **AND** any candidate returned as a final optimizer result is still validated with the configured final criterion

#### Scenario: Curriculum discoveries seed final search
- **WHEN** a curriculum run discovers candidates or motifs with useful validated structure
- **THEN** the main hybrid search can use those candidates or motifs as bounded seeds
- **AND** the system reports how much of the final search budget was spent on curriculum-derived inputs

### Requirement: Neural guidance remains optional and evidence-gated
The system SHALL NOT require neural-network guidance for constraint-path discovery and SHALL treat any learned guide as a future optional extension.

#### Scenario: Discovery runs without learned model
- **WHEN** the optimizer runs with constraint-path discovery enabled
- **THEN** it can extract descriptors, apply bounded discovery rewards, mine motifs, and run curriculum objectives without loading or training a neural model

#### Scenario: Learned guidance is considered later
- **WHEN** a future change proposes neural policy or value guidance
- **THEN** it must use simulator-evaluated candidate data as training evidence
- **AND** it must preserve exact simulator validation for final candidates
