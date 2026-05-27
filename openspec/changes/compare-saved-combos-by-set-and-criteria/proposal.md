## Why

Saved combos are currently grouped by duration, but the comparison page still mixes multiple sets and does not show which optimizer criteria produced each saved combo. That makes it hard to compare alternate combo versions from the same stat set.

## What Changes

- Store a criteria summary on saved optimizer combos.
- Save candidate combos with the current optimizer controls as their criteria summary.
- Rework saved combo comparison around one selected set and one exact duration at a time.
- Show the saved combo criteria next to each comparable row.

## Capabilities

### Modified Capabilities

- `combo-optimizer-workspace`: saved candidates retain the criteria used when saved.
- `research-workspace`: combo comparison is scoped by set and exact duration.

## Impact

- Affected UI: optimizer save action and saved combo comparison page.
- Affected state model: optional criteria summary on saved combo references.
- Affected tests: saved combo comparison helper and workspace persistence.
