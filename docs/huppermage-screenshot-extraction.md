# Huppermage Screenshot Extraction

This checklist keeps screenshot-derived catalog entries auditable before they are used by the simulator.

## Required Capture Fields

- Spell, passive, or class-mechanic name.
- Observed level shown by the game UI.
- Whether the entry is normalized to the level 200 baseline.
- AP, MP, WP, and BQ costs visible in the cost row.
- Range min/max and any visible line-of-sight or modifiable-range icons.
- Base damage, healing, armor, resource delta, and state values.
- Rune-specific effects and whether a rune is consumed.
- Per-turn usage limits and target restrictions.
- Any placement, zone, line-of-sight, random spell, or other mechanic that is not yet modeled.
- Screenshot path or image id.

## Status Rules

- Use `extracted` when the screenshot is readable and the entry was encoded from it.
- Use `needsReview` when a value or icon is ambiguous.
- Use `unverified` when data was entered manually without a source.
- Use `demo` only for intentionally fictional examples.
- Use `verified` only after a reviewer and source are recorded.

## Current Baseline

- Active spell values are normalized around level 200 where screenshots show level 200.
- Passives shown at level 110 are accepted as level-200-stable because the user confirmed their values and descriptions do not change at level 200.
- `Liaison Lumineuse` is interpreted as exchanging position with the `Feu-Follet`, based on user clarification.
