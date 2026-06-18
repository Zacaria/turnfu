## ADDED Requirements

### Requirement: Optimizer workspace exposes Continuous as a search method
The system SHALL allow users to run Continuous search from the setup-scoped optimizer workspace as a selectable optimizer method.

#### Scenario: User selects Continuous method
- **WHEN** the user opens the optimizer workspace for a setup snapshot
- **THEN** the method controls include Continuous alongside the existing optimizer methods
- **AND** the user can select Continuous without leaving the optimizer workspace

#### Scenario: User configures a sustainable two-turn air search
- **WHEN** the user selects two turns, resolved Air damage scoring, sustainable-cycle filtering, and Continuous as the method
- **THEN** starting the optimizer run launches Continuous search with those criteria
- **AND** the run remains scoped to the selected setup snapshot and set context

### Requirement: Continuous optimizer results use the standard optimizer result workflow
The system SHALL display oracle-verified Continuous candidates through the same summary, detail, comparison, saving, and builder handoff workflow as existing optimizer results.

#### Scenario: Continuous run publishes a verified candidate
- **WHEN** a Continuous run publishes an oracle-verified candidate for the active optimizer criteria
- **THEN** the optimizer workspace displays the candidate in the appropriate exact-duration result group
- **AND** the result row shows score, total damage, damage per turn, action count, final AP/MP/PW/BQ, sustainability state, and spell icon rows

#### Scenario: User inspects a Continuous candidate
- **WHEN** the user opens the details for a Continuous candidate
- **THEN** the optimizer workspace shows the same turn-by-turn combo details and score breakdown available for non-Continuous optimizer candidates
- **AND** the candidate can be pinned, saved as a combo, or opened in the timeline builder using the originating setup context

### Requirement: Continuous progress is visible without replacing results
The system SHALL show Continuous run progress while preserving the standard optimizer candidate result surface.

#### Scenario: Continuous run is still searching
- **WHEN** a Continuous run is active and has not reached its configured stopping point
- **THEN** the optimizer workspace shows current attempts, valid rate, best verified score, and running/stopped state
- **AND** previously verified candidates remain inspectable while the search continues

#### Scenario: Continuous run has no verified candidates yet
- **WHEN** a Continuous run has reported progress but has not published an oracle-verified candidate
- **THEN** the optimizer workspace shows progress metrics
- **AND** the result area communicates that no verified candidate is available yet

### Requirement: Continuous policy controls are not primary preset controls
The system SHALL avoid exposing low-level Continuous policy bundles as primary "preset" controls in the optimizer workflow.

#### Scenario: User selects Continuous in the normal optimizer workflow
- **WHEN** the user selects Continuous as the optimizer method
- **THEN** the system uses the validated learned policy defaults
- **AND** the primary controls do not require the user to choose a "preset" before starting the run

#### Scenario: User needs research diagnostics
- **WHEN** the user opens Continuous diagnostics or advanced settings
- **THEN** the system may expose learned-policy details such as loadout priors, action-set priors, contextual swaps, corpus evidence, or manual policy overrides
- **AND** those controls are visually separated from the normal optimizer method selection
