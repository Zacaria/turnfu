## Context

Sublimations are build-level choices like passives. They do not change during a combo, but many of them are not immediately simulatable because they depend on gameplay events, placement, health bands, or critical-hit events.

The first sublimation change should therefore model the catalog and selection rules without pretending all effects are implemented. The UI should make unsupported sublimations visible, explain their status, and block invalid selection.

## Goals / Non-Goals

**Goals:**

- Add a sublimation catalog model with normal, epic, and relic categories.
- Add build slots and validation for 10 normal, 1 epic, and 1 relic sublimations.
- Aggregate duplicate sublimation levels with each sublimation's cumulative maximum.
- Represent support status: supported, planned, and ignored.
- Model HP assumptions well enough to block impossible high-HP and berserk combinations.

**Non-Goals:**

- Apply sublimation effects to simulation results.
- Validate rune or equipment prerequisites.
- Import the complete Wakfu catalog automatically in this change.
- Simulate actual HP changes during combat.

## Decisions

### Decision: Catalog entries are visible even when unsupported

Every known sublimation can appear in the catalog with status metadata. Unsupported entries are disabled for selection with a blocking reason.

Alternative considered: only catalog supported sublimations. Rejected because it hides scope and makes it harder to track what remains to model.

### Decision: Build validation owns slot and compatibility rules

The build model will validate normal, epic, and relic slot counts, support status, ignored status, cumulative max, and mutually exclusive HP assumptions before simulation starts.

Alternative considered: let the simulator reject invalid sublimations later. Rejected because slot and selection validity are build concerns, not action-sequence concerns.

### Decision: HP-dependent sublimations use assumptions

The build will carry an HP assumption band instead of deriving HP from combat. High-HP and berserk requirements can then be checked for compatibility without modeling incoming damage.

Alternative considered: mark all HP sublimations as unsupported. Rejected because many are usable in theorycraft when the player deliberately plans to start healthy or berserk.

## Risks / Trade-offs

- Catalog data can drift from the game -> store source and verification metadata on entries.
- Support status may become stale -> require tests for disabled reasons and make status explicit in UI.
- HP assumptions simplify reality -> label them as build assumptions and do not imply combat HP simulation.

## Migration Plan

1. Add sublimation catalog and build selection types.
2. Add validation helpers and unit tests.
3. Add setup defaults and persistence fields.
4. Add UI controls that show all entries and disable unsupported selections.

## Open Questions

- Which data source should be treated as the primary import path for the first catalog pass: Wakfuli export, Wakfu.Guide categories, or a manually curated hybrid?
