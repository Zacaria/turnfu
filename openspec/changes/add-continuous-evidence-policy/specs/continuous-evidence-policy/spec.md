## ADDED Requirements

### Requirement: Continuous reuse uses adaptive strategy evidence
The system SHALL use stored continuous reuse-trial outcomes to decide which
mutation strategies should receive future reuse-trial budget.

#### Scenario: Underperforming strategy is suppressed
- **GIVEN** a reuse mutation strategy has enough scored trial outcomes
- **AND** those outcomes have no global-best improvements
- **AND** their average result score is below their source score
- **WHEN** continuous search generates reuse trials with adaptive policy enabled
- **THEN** the system suppresses that strategy from the selected reuse-trial candidates

#### Scenario: Useful strategy is prioritized
- **GIVEN** a reuse mutation strategy has produced global-best improvements or positive source-relative score deltas
- **WHEN** continuous search selects reuse-trial candidates
- **THEN** the system prioritizes that strategy ahead of neutral or weaker strategies
- **AND** all selected candidates are still evaluated by the Rust/WASM simulator path

#### Scenario: Policy decision is observable
- **WHEN** continuous search emits a round summary
- **THEN** the summary includes the reuse policy mode, suppressed strategies, and strategy evidence used by the selector
- **AND** final score and oracle validation remain reported separately from policy evidence
