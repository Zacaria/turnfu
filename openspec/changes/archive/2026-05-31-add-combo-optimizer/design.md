## Context

The current application has a deterministic Huppermage catalog, one-turn simulation, multi-turn combo simulation, and a GUI for manually assembling plans. `simulateCombo` already applies turn-end resolution and carries Huppermage resources/state across turns, which makes it the right foundation for optimization.

The missing layer is search and scoring. Users want to ask for strong combos by turn count, total damage, elemental damage, and cycle sustainability. A correctness issue must be addressed before scoring by element: Light damage is currently modeled as a `light` damage element, but Wakfu Light damage should resolve through the highest effective elemental mastery at damage time. Elemental optimizer scoring must count Light damage in that resolved element bucket.

## Goals / Non-Goals

**Goals:**

- Add a pure core optimizer API that can run without GUI imports.
- Search candidate combo plans with a hard maximum of three turns.
- Rank valid candidates by total damage, target-element damage, and sustainability.
- Define a sustainable cycle as a combo that can be replayed from its own final state without accumulating BQ/PW debt.
- Correct Light damage resolution and expose damage attribution for scoring.
- Keep the first search deterministic and explainable.

**Non-Goals:**

- Genetic algorithms.
- Sublimations, equipment-specific constraints, placement/pathfinding, enemy resistance modeling, or multi-target optimization.
- GUI integration beyond keeping result types consumable by future UI work.
- Perfect optimality for huge search spaces; the first implementation may use pruning/beam limits as long as results are deterministic and documented.

## Decisions

### Decision: Fix Light damage in simulation before optimizer scoring

Light damage SHALL resolve against the highest effective mastery among Fire, Water, Earth, and Air at the moment the damage effect is evaluated. The simulator should record both the displayed damage element (`light`) and the resolved scoring/combat element so optimizer scoring can attribute it correctly.

Alternative considered: leave simulation unchanged and special-case Light scoring in the optimizer. Rejected because the damage number itself depends on the resolved mastery, so the simulator is the source of truth.

### Decision: Optimizer consumes `simulateCombo`

The optimizer will build candidate `ComboPlan` values and evaluate them through `simulateCombo`. It will not duplicate resource, rune, deck, passive, or damage rules.

Alternative considered: incremental optimizer state transitions without calling the simulator. Rejected for the first version because it would duplicate rules and make optimizer results harder to trust.

### Decision: Bounded deterministic search first

The first optimizer will support a hard `maxTurns` limit of 1 to 3. It can use exhaustive expansion for small spaces and deterministic pruning such as beam width or candidate limits when the branching factor is too large.

Alternative considered: start with a genetic algorithm. Rejected because deterministic search is easier to validate, debug, and explain against simulation results.

### Decision: Sustainability is validated by replay

A candidate cycle is sustainable when the same plan can be simulated from the first run's final carried state and the second run does not end with less PW or BQ than it started with. This captures practical continuity without requiring exact equality for runes, hearts, Feu-Follets, or transient state.

Alternative considered: require exact state equality after each cycle. Rejected because Huppermage state can differ while the plan remains practically repeatable and resource-stable.

### Decision: Score breakdowns are first-class results

Optimizer results will include total damage, damage by resolved element, sustainability status, and enough metadata to explain why a candidate ranked highly or was rejected.

Alternative considered: return only best `ComboPlan`. Rejected because optimization needs inspection and future UI comparison.

## Risks / Trade-offs

- Search space explosion -> Use max turns, deck-filtered actions, per-turn action limits, and deterministic pruning controls.
- False sustainability from only checking BQ/PW -> Keep the replay validity requirement; invalid replay rejects the cycle even if resources look sufficient.
- Light attribution ambiguity on mastery ties -> Define a deterministic tie-breaker before implementation.
- Optimizer overfits to simulator gaps -> Keep unsupported Wakfu mechanics out of scope and surface assumptions in result metadata.
- Performance regressions -> Add tests with small catalogs and expose candidate limits before searching the full Huppermage catalog.
