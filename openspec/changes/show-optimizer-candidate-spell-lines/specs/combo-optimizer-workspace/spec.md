## ADDED Requirements

### Requirement: Show candidate spell icon rows
The system SHALL show the spell sequence for each optimizer candidate as compact spell icon rows directly in the optimizer result row.

#### Scenario: User scans optimizer candidates
- **WHEN** optimizer candidates are displayed
- **THEN** each candidate row includes three spell icon rows, one per possible turn
- **AND** spell names are available through icon titles or accessibility labels when available
- **AND** the user can compare candidate variations without opening each candidate in the builder
