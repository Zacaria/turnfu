## Why

Optimizer candidates can have similar damage numbers while differing by only one or two spell choices. Users currently need to open a candidate in the builder to inspect those variations, which slows comparison.

## What Changes

- Show each optimizer candidate's spell sequence as spell icons directly in the result row.
- Render exactly three icon rows, one per turn, so one-, two-, and three-turn candidates remain scannable.
- Use catalog spell names as icon titles and accessibility labels.

## Capabilities

### New Capabilities

### Modified Capabilities

- `combo-optimizer-workspace`: Optimizer result rows expose compact spell icon rows for faster comparison.

## Impact

- Affected UI: optimizer workspace candidate rows.
- Affected tests: optimizer workspace view helper tests.
