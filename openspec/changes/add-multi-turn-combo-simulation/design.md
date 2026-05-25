## Context

The app currently has a deterministic `simulateTurn` API and a GUI for building one Huppermage turn. The next product need is not automatic optimization yet, but complete combo modeling: multiple turns, state carry-over, and totals that make later saved-combo comparison meaningful.

## Goals / Non-Goals

**Goals:**

- Introduce a core multi-turn combo API without duplicating one-turn simulation rules.
- Preserve the current one-turn simulator as the source of truth for action validation, damage, and Huppermage mechanics.
- Define the first explicit turn transition contract.
- Extend the GUI so users can build, select, and inspect several turns in one combo.
- Expose combo-level damage and per-turn summaries.

**Non-Goals:**

- Local save/load of combos.
- Side-by-side combo comparison.
- Automatic optimization.
- Full Wakfu buff-duration modeling.
- Spatial board state, enemy state, or target persistence.

## Decisions

### Decision: `simulateCombo` wraps `simulateTurn`

The multi-turn engine will call `simulateTurn` for each turn with `includeTurnEnd: true` except where the implementation needs a specific transition. This keeps damage, costs, rune rules, Feu-Follet behavior, and violations centralized in the existing simulator.

### Decision: turn transition resets resources from base plus carry-over

At the start of turn N+1:

- AP and PM reset to the character's base configured resources.
- WP is carried from the previous final state.
- BQ is carried from the previous final state after end-of-turn Huppermage resolution.
- Persistent Huppermage class state is carried.
- One-turn Heart state expires by default at the next turn start; explicit multi-turn Heart duration will be modeled by a later duration system.
- Current stats reset to the base configured stats, then selected passive static modifiers are re-applied by `simulateTurn`.

This is intentionally conservative: it avoids pretending one-turn stat modifiers have correct multi-turn duration modeling before we implement explicit durations.

### Decision: combo steps are flattened for inspection

The GUI will maintain turns as nested data, but the inspector will consume a flattened list of steps:

- combo initial step;
- one step per completed action;
- optional invalid step metadata if a turn fails.

Each step includes turn index, action index, cumulative combo damage, turn damage, resources, stats, Huppermage state, and violations when present.

### Decision: UI keeps one selected turn plus one selected global step

The planner will show tabs/buttons for turns and a timeline for the selected turn. The top summary and inspector use the global combo result. This keeps the UI close to the existing one-turn workflow while allowing complete combo inspection.

## Risks / Trade-offs

- Buff durations are simplified: one-turn stat changes and active Heart do not carry into the next turn unless a later duration system represents them explicitly. This is acceptable for the first multi-turn foundation and should be made visible in tests.
- `simulateTurn` currently owns initial passive application. The combo transition must pass base stats/resources plus carried class state to avoid double-counting mutable turn stats.
- GUI complexity increases. The first version should avoid side-by-side comparison and focus on reliable multi-turn editing.

## Migration Plan

1. Add combo plan/result/types and a `simulateCombo` API.
2. Add tests for two-turn damage, state carry-over, resource reset, and invalid later turns.
3. Add UI helpers to map combo results into flattened inspection steps.
4. Replace single `timeline` UI state with `turns` plus selected turn.
5. Add controls to add/remove/select turns and display combo totals.
6. Validate tests, build, OpenSpec strict validation, and browser behavior.
