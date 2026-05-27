## MODIFIED Requirements

### Requirement: Present sets as stat contexts for combo search
The system SHALL present a set as the stat and context input for combo search without implying that its saved deck limits optimizer spell choice.

#### Scenario: User reviews a set before optimizing
- **WHEN** a user opens a set detail page
- **THEN** the page shows the set's key stats and resources
- **AND** the page does not label the saved deck as optimizer hypotheses
- **AND** the optimizer action remains available from the set
