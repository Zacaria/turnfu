## Why

The current hybrid optimizer is strong at exploiting high-scoring candidates, but final damage alone can under-value setup actions whose payoff appears only after several constraints align. We want a practical discovery layer that finds new valid paths through Huppermage rules before considering heavier neural guidance.

## What Changes

- Add a constraint-path discovery capability that treats simulator states, rule violations, and delayed utility as first-class search signals.
- Add discovery-phase rewards for enabling states such as rune setup, BQ/WP recovery, conditional spell access, sustainable replay readiness, and rare but valid rule states.
- Mine reusable motifs from successful and near-successful candidates, then feed those motifs back into hybrid search as bounded macro-actions or candidate seeds.
- Use invalid candidates as constraint-boundary data for repair and curriculum objectives rather than discarding them as pure failures.
- Keep final optimizer ranking strict: returned best candidates are still ordered by simulator-backed damage criteria and sustainability rules.
- Defer neural-network guidance to a later optional phase, after a corpus of simulator-evaluated candidates exists and practical heuristic discovery has plateaued.

## Capabilities

### New Capabilities
- `constraint-path-discovery`: Discovery-oriented optimizer behavior for learning enabling states, motifs, repair paths, and curriculum objectives through rule constraints.

### Modified Capabilities
- `optimizer-experiment-lab`: Experiments can include discovery-guided hybrid search phases and report discovery metrics while preserving exact simulator validation.

## Impact

- Affected code: `src/core/optimizer`, Rust/WASM hybrid search under `rust/optimizer-wasm`, optimizer experiment metrics, and benchmark/differential scripts.
- API impact: likely adds internal discovery metrics and optional experiment configuration; final optimizer result contracts should remain simulator-backed.
- Search impact: introduces a two-stage scoring model where exploration can use shaping rewards, but final candidate ranking uses the existing damage and sustainability criteria.
- Risk: discovery rewards can bias search toward interesting but low-value states. Mitigation is to keep rewards temporary, bounded, observable, and always gated by final exact validation.
