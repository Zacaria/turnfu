## ADDED Requirements

### Requirement: Optimizer supports selectable execution backends
The system SHALL allow optimizer callers to select between the existing TypeScript backend and the Rust/WASM hybrid backend when the requested engine is supported by that backend.

#### Scenario: TypeScript backend remains available
- **WHEN** an optimizer run is requested without selecting Rust/WASM
- **THEN** the existing TypeScript backend is used
- **AND** the public optimizer result shape remains compatible with existing UI callers

#### Scenario: Rust backend can be selected for hybrid runs
- **WHEN** an optimizer run requests the hybrid engine with the Rust/WASM backend selected
- **THEN** the optimizer routes the request through the Rust/WASM backend adapter
- **AND** the returned result is normalized to the same public optimizer result shape used by TypeScript runs

#### Scenario: Unsupported backend request fails explicitly
- **WHEN** a caller selects Rust/WASM for an optimizer engine or option set that the Rust backend does not support
- **THEN** the optimizer rejects the request with an explicit unsupported-backend error
- **AND** it does not silently fall back to TypeScript unless the caller requested fallback behavior

### Requirement: Optimizer backend results expose backend identity
The system SHALL expose which backend produced an optimizer result so benchmarks and UI diagnostics can distinguish TypeScript and Rust/WASM runs.

#### Scenario: Backend identity is reported
- **WHEN** an optimizer run completes
- **THEN** the result metadata identifies the execution backend
- **AND** benchmark scripts include the backend identity in their output rows

### Requirement: Rust-backed optimizer preserves scoring contract
The system SHALL require Rust/WASM optimizer results to use the same scoring semantics as the TypeScript optimizer for total damage, target resolved-element damage, and sustainable-cycle filtering.

#### Scenario: Rust result is scored with existing criteria
- **WHEN** a Rust/WASM hybrid run returns a candidate
- **THEN** the candidate score breakdown follows the same criterion semantics as TypeScript
- **AND** Light damage resolved to a target element contributes to target-element scoring exactly as it does in TypeScript

#### Scenario: Rust result honors sustainability filter
- **WHEN** a Rust/WASM hybrid run is configured to require sustainable cycles
- **THEN** candidates that fail the TypeScript-equivalent sustainability rule are excluded from valid optimizer results
