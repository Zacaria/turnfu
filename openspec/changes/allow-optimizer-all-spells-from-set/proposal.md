## Why

Sets should define stats and persistent character state, not a spell shortlist for optimizer search. The optimizer currently inherits the set deck as `availableSpellIds`, which prevents it from discovering combos that use any other Huppermage spell.

## What Changes

- Let optimizer searches launched from a set use all catalog spells.
- Keep set stats, resources, passives, target, and action context as the search context.
- Remove deck-as-hypothesis presentation from the set detail page so the UI does not imply the deck constrains optimizer search.

## Capabilities

### Modified Capabilities

- `combo-optimizer-workspace`: optimizer searches from a set are not limited by the set's saved deck spell ids.
- `research-workspace`: set detail copy distinguishes stats/context from optimizer spell availability.

## Impact

- Affected UI: set detail page and set summary copy.
- Affected optimizer workspace mapping: no deck-filtered `availableSpellIds` from set snapshots.
- Affected tests: optimizer workspace option mapping.
