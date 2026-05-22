## Why

The project needs a global product and architecture direction before implementation starts, because the final goal spans GUI theorycrafting, turn simulation, combinatorial optimization, Wakfu-specific rules, sublimations, and future multi-turn optimization. This epic establishes a deliberately reduced first path so the project can grow from a tested MVP instead of attempting to model the full game immediately.

## What Changes

- Define the long-term scope for a Wakfu theorycraft GUI focused on modeling turns, visualizing actions, testing action combinations, and finding optimized action sequences.
- Establish the MVP boundary: Huppermage only, one turn only, no equipment, no sublimations, manually entered spell data, and a single objective of raw damage maximization.
- Define the staged roadmap from MVP to richer Wakfu constraints, sublimations, multi-turn optimization, multi-objective scoring, and advanced visualizations.
- Establish core domain boundaries: character stats, resources, spell catalog, turn state, action sequence, simulation result, optimization result, and GUI panels.
- Set the architectural direction: pure simulation engine, optimizer separated from simulation, data-driven spell/effect model, GUI as configuration and visualization layer.
- Identify the first implementation changes:
  - `catalog-huppermage-spells-effects`
  - `add-turn-simulation-engine`

## Capabilities

### New Capabilities

- `wakfu-theorycraft-roadmap`: Covers the epic-level product scope, MVP boundaries, staged roadmap, architecture boundaries, and sequencing of future implementation changes.

### Modified Capabilities

- None.

## Impact

- OpenSpec planning artifacts for the whole application.
- Future application modules under `src/core`, `src/ui`, and test suites once implementation begins.
- Future GUI stack decision, expected to start with Vite, React, TypeScript, and Vitest unless a later change overrides this.
- Future data contracts for Huppermage spell/effect catalog, turn simulation, and optimization.
