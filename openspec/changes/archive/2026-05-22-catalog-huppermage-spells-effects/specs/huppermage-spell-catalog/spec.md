## ADDED Requirements

### Requirement: Catalog exposes Huppermage spells as structured data
The system SHALL provide a Huppermage spell catalog where each spell has a stable id, display name, class name, level, element, costs, effects, constraints, and metadata.

#### Scenario: Spell entry is loaded
- **WHEN** the application loads a Huppermage spell from the catalog
- **THEN** the spell exposes structured fields instead of requiring parsing from a free-form text description

### Requirement: Catalog uses level 200 as the initial baseline
The system SHALL use level 200 as the initial normalized baseline for Huppermage spell values and SHALL identify entries that are not verified at level 200.

#### Scenario: Level 200 spell value is entered
- **WHEN** a Huppermage spell is added to the initial catalog
- **THEN** the entry records level 200 as its normalized level or marks the value as not verified for the level 200 baseline

### Requirement: Catalog provides an effect DSL
The system SHALL provide a small typed DSL for authoring spell, passive, and class-mechanic effects before normalizing them into catalog data consumed by the simulator.

#### Scenario: Spell effect is authored
- **WHEN** a spell is authored using the DSL
- **THEN** its costs, conditions, direct damage, resource deltas, constraints, tags, and unsupported mechanics can be validated as structured data

### Requirement: Spell costs are explicit
The system SHALL represent spell costs as explicit non-negative resource amounts for AP, MP, WP, and BQ.

#### Scenario: Spell has multiple resource costs
- **WHEN** a spell costs AP and BQ
- **THEN** both costs are represented independently and can be validated before the spell is cast

### Requirement: Spell effects are machine-readable
The system SHALL represent supported spell effects using typed effect records for direct damage, resource deltas, conditions, tags, and unsupported mechanics.

#### Scenario: Spell generates BQ
- **WHEN** a Huppermage spell generates BQ after being cast
- **THEN** the catalog represents that generation as a resource delta effect for BQ

### Requirement: Conditional effects are explicit
The system SHALL represent conditional effects as structured conditions wrapping supported effects rather than as free-form text.

#### Scenario: Effect requires minimum BQ
- **WHEN** a spell effect applies only when the caster has a minimum BQ amount
- **THEN** the DSL records the BQ condition and the nested effect as structured data

### Requirement: Passive and class mechanics are captured
The system SHALL allow Huppermage passives and class mechanics to be captured with the same provenance and DSL effect structure as spells, even when the MVP simulator does not consume them yet.

#### Scenario: Passive is extracted from screenshot
- **WHEN** a screenshot describes a Huppermage passive
- **THEN** the catalog can record the passive as a structured entry with effects, unsupported notes, and verification metadata

### Requirement: Unsupported mechanics are explicit
The system SHALL allow a spell entry to declare unsupported mechanics with a human-readable note without pretending they are simulated.

#### Scenario: Spell has positioning behavior not modeled in MVP
- **WHEN** a spell includes a placement, range, area, or line-of-sight mechanic outside MVP scope
- **THEN** the catalog records that mechanic as unsupported or unmodeled metadata

### Requirement: Catalog entries are auditable
The system SHALL include verification metadata for each spell, passive, or class-mechanic entry, including status and optional source, screenshot reference, observed level, extraction notes, or reviewer notes.

#### Scenario: Manual value is not verified
- **WHEN** a spell value was entered manually without confirmed source
- **THEN** the catalog marks the entry as unverified or demo rather than verified

### Requirement: Screenshot provenance is supported
The system SHALL support screenshot-based input by recording screenshot references as evidence for extracted Huppermage spells, passives, and class mechanics.

#### Scenario: Screenshot is used as source
- **WHEN** a catalog entry is extracted from an in-game screenshot
- **THEN** the entry records the screenshot reference and extraction status before it can be treated as verified

### Requirement: Catalog validation rejects malformed data
The system SHALL provide validation that detects duplicate entry ids, invalid resources, negative costs, missing names, unknown DSL primitives, unknown effect types, and invalid baseline-level metadata.

#### Scenario: Duplicate spell id exists
- **WHEN** two catalog entries use the same spell id
- **THEN** catalog validation reports an error before the data is used by the simulator

### Requirement: DSL validation rejects unsupported arbitrary logic
The system SHALL reject DSL entries that rely on arbitrary executable logic instead of approved DSL primitives.

#### Scenario: Entry uses arbitrary function body
- **WHEN** a catalog entry attempts to define an effect through an unregistered function or free-form executable code
- **THEN** validation rejects the entry and reports the unsupported DSL construct
