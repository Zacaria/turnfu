## Context

The optimizer already returns candidate plans with spell ids. The UI has access to the catalog and can translate those ids into readable spell names without changing the core optimizer result shape.

## Design

Add a small UI adapter helper that maps a `ComboPlan` and catalog to exactly three icon rows:

- row 1: turn-one spell icons;
- row 2: turn-two spell icons;
- row 3: turn-three spell icons.

Candidate rows render these icon rows below the existing metrics. Icons wrap inside each row to keep the layout readable on narrow columns. Spell names remain available through `title` and accessibility labels.

## Non-Goals

- Showing full spell effect details or visible spell names inside optimizer rows.
- Persisting these display lines.
- Changing optimizer ranking or search behavior.
