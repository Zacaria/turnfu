## ADDED Requirements

### Requirement: Simulator semantics are reproducible by Rust/WASM
The system SHALL maintain a Rust/WASM implementation of supported turn and combo simulation semantics that can be compared against the TypeScript simulator.

#### Scenario: One-turn simulation matches TypeScript
- **GIVEN** a supported Huppermage one-turn action sequence, catalog, character state, passives, and default action context
- **WHEN** the sequence is simulated by TypeScript and Rust/WASM
- **THEN** validity, total damage, remaining resources, current stats, Huppermage class state, action breakdown summaries, and violations match after normalization

#### Scenario: Multi-turn simulation matches TypeScript
- **GIVEN** a supported Huppermage combo plan with multiple turns
- **WHEN** the combo is simulated by TypeScript and Rust/WASM
- **THEN** per-turn initial character state, turn result, final carried resources, cooldown aging, persistent class state, total damage, and violations match after normalization

### Requirement: Differential comparison reports actionable divergence
The system SHALL report Rust/WASM simulation mismatches with enough context to debug the first semantic divergence from TypeScript.

#### Scenario: First divergent action is reported
- **WHEN** a TypeScript and Rust/WASM simulation comparison fails
- **THEN** the failure report identifies the fixture or seed, turn index, action index, spell id, compared field path, TypeScript value, and Rust/WASM value

#### Scenario: Numeric comparison is normalized
- **WHEN** a differential comparison checks damage or score values
- **THEN** the comparison uses the same rounded outputs exposed by the TypeScript simulator
- **AND** any tolerated numeric deviation must be declared by field in the test harness

### Requirement: TypeScript remains gameplay oracle until Rust is promoted
The system SHALL treat TypeScript simulation as the canonical gameplay oracle until a later migration explicitly promotes Rust.

#### Scenario: Rust backend is experimental before promotion
- **WHEN** Rust/WASM simulation support exists but has not been promoted by a later change
- **THEN** TypeScript remains the reference for expected gameplay behavior
- **AND** Rust/WASM mismatches are fixed in Rust or explicitly deferred before Rust results can be trusted for default optimizer runs
