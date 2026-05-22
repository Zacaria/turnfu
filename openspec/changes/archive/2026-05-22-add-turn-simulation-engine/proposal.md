## Why

The optimizer can only be trusted if every action sequence is evaluated by a deterministic turn simulation engine with explicit validation and damage breakdowns. This change creates that engine on top of the structured Huppermage spell/effect catalog.

## What Changes

- Introduce a pure one-turn simulation engine for the MVP.
- Simulate a sequence of spell casts against an initial character and turn state.
- Validate resource availability, known spell IDs, per-turn cast limits, and modeled spell constraints.
- Apply spell costs and supported effects in a deterministic order.
- Compute raw damage using configurable base stats and a simple MVP damage formula.
- Return a complete simulation result including validity, total damage, final resources, action-by-action breakdown, and validation violations.
- Keep optimization separate from simulation, but provide enough API surface for exhaustive search and later genetic algorithms.
- Exclude GUI behavior, genetic optimization implementation, equipment, sublimations, position, line of sight, critical hit randomness, and multi-turn state persistence.

## Capabilities

### New Capabilities

- `turn-simulation-engine`: Covers deterministic one-turn sequence simulation, spell cast validation, resource transitions, raw damage calculation, and detailed simulation results.

### Modified Capabilities

- None.

## Impact

- New core simulation modules under the future `src/core/simulation` area.
- New domain integration with the Huppermage spell catalog from `catalog-huppermage-spells-effects`.
- New unit tests for valid sequences, invalid sequences, resource boundaries, cast limits, damage calculations, and action breakdowns.
- Provides the foundation for later exhaustive optimization and genetic optimization changes.
