## MODIFIED Requirements

### Requirement: Save optimizer candidates for later comparison
The system SHALL preserve optimizer context when saving candidate combos for later comparison.

#### Scenario: User saves an optimizer candidate
- **WHEN** a user saves a candidate from the optimizer workspace
- **THEN** the saved combo records the selected set
- **AND** the saved combo records a summary of the active optimizer criteria
- **AND** the saved combo can be compared with other combos of the same exact duration
