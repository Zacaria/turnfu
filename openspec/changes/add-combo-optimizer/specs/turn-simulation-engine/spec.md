## MODIFIED Requirements

### Requirement: Simulator computes damage without target resistance
The system SHALL compute spell damage using base damage, applicable elemental mastery, applicable contextual masteries, critical multiplier, position multiplier, damage inflicted percentage, and block multiplier, while excluding target resistance from this change.

Light damage SHALL resolve its applicable elemental mastery from the highest effective mastery among Fire, Water, Earth, and Air at damage time.

#### Scenario: Spell damage is calculated
- **WHEN** a spell with base damage is cast by a character with applicable stats and action context
- **THEN** the simulator records the computed damage and formula breakdown for that action and includes it in total damage

#### Scenario: Light spell uses highest effective elemental mastery
- **GIVEN** a Light damage spell is cast while Water mastery is the highest effective mastery
- **WHEN** the simulator computes the damage formula
- **THEN** the formula uses Water mastery for the elemental mastery component
- **AND** the resulting damage is attributed to Water for elemental scoring

#### Scenario: Huppermage spell-specific damage mechanics are applied
- **WHEN** Rayon Crepusculaire is cast with the Fire rune condition satisfied
- **THEN** the spell damage includes 0.5 percent damage inflicted per percent of BQ remaining
- **WHEN** Lueur de l'Aube consumes the Fire rune
- **THEN** the simulator adds the delayed damage contribution to the action and turn total
- **WHEN** Halo Chatoyant is cast on an already marked target or with the Air rune condition satisfied
- **THEN** the mark damage is triggered and recorded in the action breakdown

#### Scenario: Huppermage life steal mechanics are recorded
- **WHEN** Epee de Lumiere deals damage while the Huppermage owns active runes
- **THEN** the simulator records life steal equal to 30 percent of dealt damage per active rune

## ADDED Requirements

### Requirement: Simulator exposes resolved damage elements
The system SHALL expose the resolved elemental attribution for each damage effect so optimizer and presentation layers can score damage by combat element without duplicating damage-resolution rules.

#### Scenario: Non-Light damage keeps its element
- **WHEN** a Fire damage effect is applied
- **THEN** the recorded damage effect is attributed to Fire

#### Scenario: Light damage records resolved element
- **WHEN** a Light damage effect is applied
- **THEN** the recorded damage effect keeps Light as its display element
- **AND** it records the resolved Fire, Water, Earth, or Air element used for elemental mastery and scoring
