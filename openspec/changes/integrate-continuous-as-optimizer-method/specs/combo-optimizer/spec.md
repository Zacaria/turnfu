## ADDED Requirements

### Requirement: Long-running optimizer methods expose verified candidate results
The system SHALL provide long-running optimizer methods with a result contract that can emit oracle-verified candidate payloads compatible with standard optimizer result inspection.

#### Scenario: Long-running method finds a top candidate
- **WHEN** a long-running optimizer method finds a candidate that improves or belongs in the displayed top results
- **THEN** the candidate is verified through the authoritative simulator/oracle before it is exposed as a normal optimizer result
- **AND** the exposed result includes the candidate plan, score, simulation result, damage by resolved element, final resources, and sustainability metadata

#### Scenario: Long-running method reports metrics without a candidate
- **WHEN** a long-running optimizer method reports attempts, validity rate, throughput, or checkpoint scores without an oracle-verified candidate payload
- **THEN** those metrics are exposed as progress metadata only
- **AND** they are not displayed as inspectable optimizer candidates

### Requirement: Continuous search honors optimizer criteria
The system SHALL run Continuous search using the same optimizer criteria semantics as existing optimizer methods.

#### Scenario: Continuous search uses target element scoring
- **WHEN** Continuous search is configured for resolved Air damage
- **THEN** candidates are ranked by simulator-backed Air damage using the same resolved-element scoring semantics as existing optimizer methods
- **AND** Light damage resolved to Air contributes to the score

#### Scenario: Continuous search requires sustainable cycles
- **WHEN** Continuous search is configured to require sustainable cycles
- **THEN** candidates exposed as normal optimizer results satisfy the same replay validity and PW/BQ preservation rules as existing optimizer methods
