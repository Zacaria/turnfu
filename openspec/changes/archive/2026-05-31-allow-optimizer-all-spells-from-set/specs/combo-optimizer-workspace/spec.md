## MODIFIED Requirements

### Requirement: Search combos from a selected set
The system SHALL use a selected set's stats and persistent context while allowing the optimizer to choose from all modeled spells.

#### Scenario: User launches optimizer from a set
- **WHEN** a user opens optimizer from a set
- **THEN** the optimizer uses the set's character stats, resources, passives, target, and action context
- **AND** the optimizer does not restrict available spells to the set's saved deck spell ids
- **AND** the optimizer may include any modeled spell whose simulation rules allow it
