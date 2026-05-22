# turn-simulation-engine Specification

## Purpose
TBD - created by archiving change add-turn-simulation-engine. Update Purpose after archive.
## Requirements
### Requirement: Simulator evaluates one-turn action sequences
The system SHALL provide a deterministic one-turn simulator that evaluates a provided sequence of spell actions against an initial character state and spell catalog.

#### Scenario: Valid sequence is simulated
- **WHEN** the simulator receives a character state, a spell catalog, and a valid sequence of spell actions
- **THEN** it returns a valid simulation result with total damage, final resources, and an action breakdown

### Requirement: Simulator validates spell identity
The system SHALL reject an action sequence when an action references a spell id that is not present in the spell catalog.

#### Scenario: Unknown spell id is used
- **WHEN** a sequence contains an action with an unknown spell id
- **THEN** the simulator returns an invalid result with a violation identifying the unknown spell

### Requirement: Simulator validates resource costs before casting
The system SHALL validate AP, MP, WP, and BQ costs against the current turn resources before each spell cast.

#### Scenario: Spell costs more AP than available
- **WHEN** the current turn state has insufficient AP for the next spell
- **THEN** the simulator returns an invalid result and does not apply that spell's cost, damage, or effects

### Requirement: Simulator enforces per-turn cast limits
The system SHALL enforce spell per-turn cast limits when a spell entry defines such a constraint.

#### Scenario: Spell exceeds max casts per turn
- **WHEN** a sequence casts a spell more times than its configured per-turn limit
- **THEN** the simulator returns an invalid result with a cast-limit violation

### Requirement: Simulator applies costs and effects in deterministic order
The system SHALL process each valid spell cast by validating constraints, paying costs, calculating damage, and applying supported effects in that order.

#### Scenario: Spell pays AP and generates BQ
- **WHEN** a valid spell costs AP and has a BQ generation effect
- **THEN** the action breakdown shows AP reduced and BQ increased according to the deterministic processing order

### Requirement: Simulator computes damage without target resistance
The system SHALL compute spell damage using base damage, applicable elemental mastery, applicable contextual masteries, critical multiplier, position multiplier, damage inflicted percentage, and block multiplier, while excluding target resistance from this change.

#### Scenario: Spell damage is calculated
- **WHEN** a spell with base damage is cast by a character with applicable stats and action context
- **THEN** the simulator records the computed damage and formula breakdown for that action and includes it in total damage

### Requirement: Simulator evolves caster stats during the turn
The system SHALL keep current turn stats in simulation state and SHALL apply supported caster stat modifier effects before later actions are evaluated.

#### Scenario: Damage bonus is gained before next spell
- **WHEN** a first action applies a caster damage inflicted modifier and a later action deals damage
- **THEN** the later action uses the updated damage inflicted value from the current turn state

### Requirement: Simulator tracks Huppermage class state
The system SHALL track Huppermage-specific state under `classState.huppermage` without placing class-specific fields at the root of the generic turn state.

#### Scenario: Huppermage state is initialized
- **WHEN** a Huppermage turn simulation starts without a previously generated rune
- **THEN** the Huppermage class state contains inactive runes, `lastGeneratedRune` set to null, and zero active Feu-Follets

### Requirement: Simulator updates Huppermage runes
The system SHALL update Huppermage active runes and last generated rune when elemental fire, water, earth, or air spells are cast.

#### Scenario: Elemental spells generate runes
- **WHEN** a Huppermage casts fire and water elemental spells during a turn
- **THEN** the Huppermage class state marks Incandescent and Aquatic runes active and records Aquatic as the last generated rune

### Requirement: Simulator tracks active Feu-Follets
The system SHALL represent Feu-Follet state as a count of active Feu-Follets and SHALL use action target kind to distinguish placing a new Feu-Follet from recovering an active one.

#### Scenario: Feu-Follet is placed and recovered
- **WHEN** a Feu-Follet spell targets an empty cell and later targets an active Feu-Follet
- **THEN** the Huppermage class state increments then decrements the active Feu-Follet count and records both transitions in the action breakdown

### Requirement: Simulator applies Sauvegarde Runique Feu-Follet storage
The system SHALL support the `sauvegarde-runique` passive by storing the three inactive runes on a newly placed Feu-Follet when the Huppermage has exactly one active rune.

#### Scenario: Stored runes are recovered in elemental order
- **GIVEN** a Huppermage has only the Air rune active and `sauvegarde-runique` active
- **WHEN** the Huppermage places a Feu-Follet and later recovers it
- **THEN** the Feu-Follet stores Fire, Water, and Earth runes
- **AND** recovery applies stored runes in Fire, Water, Earth, Air order
- **AND** the last generated rune becomes Earth

### Requirement: Simulator applies Extension des Sens BQ regeneration
The system SHALL support simplified `extension-des-sens` BQ regeneration from the active Huppermage heart.

#### Scenario: Fire and Earth hearts regenerate BQ from assumed positioning conditions
- **GIVEN** `extension-des-sens` is active
- **WHEN** the Huppermage casts an elemental spell while Fire heart is active
- **THEN** the simulator grants 20 BQ per AP of the spell
- **WHEN** the Huppermage casts a spell while Earth heart is active
- **THEN** the simulator grants 20 BQ per AP of the spell

#### Scenario: Air heart regenerates BQ from movement effects
- **GIVEN** `extension-des-sens` is active and Air heart is active
- **WHEN** a spell applies one movement effect
- **THEN** the simulator grants 20 BQ per AP of the spell
- **WHEN** a spell applies two rune-conditioned movement effects
- **THEN** the simulator grants two times 20 BQ per AP of the spell

#### Scenario: Water heart regenerates BQ from light/elemental alternation
- **GIVEN** `extension-des-sens` is active and Water heart is active
- **WHEN** the Huppermage alternates from an elemental spell to a Light spell
- **THEN** the simulator grants 20 BQ per AP of the Light spell
- **WHEN** a neutral spell occurs between the elemental and Light spell
- **THEN** the neutral spell breaks the alternation and the Light spell does not receive the alternation BQ gain

### Requirement: Simulator returns detailed invalid results
The system SHALL return invalid simulation results with structured violations and the state reached before the failed action.

#### Scenario: Sequence becomes invalid after previous valid casts
- **WHEN** a sequence contains valid early actions followed by an invalid action
- **THEN** the result includes the breakdown for completed actions and a violation for the failed action

### Requirement: Simulator is independent from optimization and GUI
The system SHALL expose simulation behavior independently from GUI components and optimization strategies.

#### Scenario: Optimizer calls simulator
- **WHEN** an optimizer evaluates candidate sequences
- **THEN** it can call the simulator without importing GUI modules or duplicating spell rule calculations

