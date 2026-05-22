## Why

The simulation and optimizer need a structured, testable source of Huppermage spell definitions before they can evaluate action sequences. Starting with a manually maintained catalog keeps the project reasonable while still establishing the data model required for later automation, sublimations, and richer Wakfu rules.

## What Changes

- Introduce a structured catalog for Huppermage spells and effects.
- Introduce a small domain-specific language (DSL) to express spell, passive, and class-mechanic effects in a readable, composable, and machine-validatable format.
- Represent spell identity, element, base damage, resource costs, resource effects, and MVP constraints in data rather than hard-coded simulation logic.
- Use level 200 as the first normalized data baseline for spell values and effects.
- Include provenance and verification fields so manually entered spell data can be audited and updated later.
- Support screenshot-based extraction as an input workflow: screenshots may provide raw evidence for spells, passives, and class mechanics, but extracted values must still be normalized into the DSL before simulator use.
- Support enough effect types for the MVP and near-term simulation:
  - direct damage
  - resource consumption through costs
  - resource generation or loss through effects
  - conditional effects
  - passive and class-mechanic hooks that can be recorded before they are fully simulated
  - per-turn cast limits when known
  - explicit unsupported or unmodeled mechanics
- Provide a level-200 Huppermage baseline dataset, using verified entries where screenshots or reliable sources are available and demo/unverified entries where data is incomplete.
- Exclude equipment, sublimations, positioning, line of sight, target restrictions, and multi-target behavior from the first catalog contract unless captured as unmodeled notes.

## Capabilities

### New Capabilities

- `huppermage-spell-catalog`: Covers the structured data model, validation rules, and initial manually maintained Huppermage spell/effect dataset used by the simulator.

### Modified Capabilities

- None.

## Impact

- New domain types for spells, passives, class mechanics, resources, costs, effects, constraints, DSL expressions, and catalog metadata.
- New manually maintained Huppermage catalog data file or module.
- New screenshot provenance fields for extracted spell/passive/class-mechanic information.
- New validation tests ensuring spell data is structurally valid and usable by the simulation engine.
- Provides the input contract for `add-turn-simulation-engine`.
