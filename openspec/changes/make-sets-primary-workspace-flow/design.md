## Context

The data model already has `SetupSnapshot` records that represent immutable final stats, deck, passives, target, and default action context. The naming and page flow still say "setup", which obscures the intended mental model: users create/select a set, then search combos from that set.

## Design

### Terminology

Keep the underlying TypeScript type names for now to avoid a broad refactor, but change user-facing copy from "setup" to "set" where it describes workspace navigation.

### Balanced Set Creation

Add a pure workspace helper that creates a new set from an existing set and balances fire/water/earth/air mastery.

The first version preserves the source set's total four-element mastery budget by averaging the existing fire/water/earth/air values, rounding to the nearest integer, and applying that value to each of the four elements. Light and neutral mastery remain unchanged.

### Navigation

The build page remains the parent workspace for a gameplay concept, but the first decision is now the set. Each set row exposes:

- open set details;
- open builder from that set;
- launch optimizer from that set;
- create a balanced-element variant from that set.

## Non-Goals

- Full set editor with arbitrary stat forms on the build page.
- Item modeling.
- Renaming all internal `SetupSnapshot` symbols in one broad refactor.
- Changing optimizer scoring rules.
