## ADDED Requirements

### Requirement: Learned search policy exports simulator-evaluated evidence
The system SHALL export continuous search evidence into a reproducible offline
dataset for policy evaluation.

#### Scenario: Dataset row includes proposal outcome labels
- **WHEN** continuous search evidence is exported for learned policy evaluation
- **THEN** each row includes candidate structure, scenario context, proposal source, validity, result score, source score when available, score delta when computable, and global-best improvement when known
- **AND** invalid rows include the available violation category or descriptor evidence

#### Scenario: Dataset split is deterministic
- **WHEN** a dataset export is split for offline evaluation
- **THEN** rows are assigned deterministically by session, seed, or another stable grouping key
- **AND** the evaluator can avoid training and testing on the same continuous run context

### Requirement: Learned search policy is evaluated offline before online use
The system SHALL prove offline ranking lift before using a learned policy to
spend live Rust/WASM search budget.

#### Scenario: Offline evaluator compares against handcrafted ordering
- **WHEN** a candidate-ranking policy is evaluated offline
- **THEN** the system reports top-k score delta, top-k validity rate, global-best improvement recall when available, invalid selection rate, and lift over the current handcrafted mutation ordering

#### Scenario: Online integration is evidence-gated
- **WHEN** an offline policy fails to improve ranking metrics over handcrafted ordering on held-out data
- **THEN** the policy is not integrated into live continuous search
- **AND** no larger 10M or 100M validation run is treated as justified by that policy

### Requirement: Learned guidance remains a search hint
The system SHALL keep learned predictions separate from exact simulator scoring.

#### Scenario: Policy-ranked candidate is evaluated online
- **WHEN** a policy-ranked candidate is injected into Rust/WASM continuous search
- **THEN** the candidate is still evaluated by the simulator path
- **AND** final optimizer ranking remains based on exact simulator-backed score and oracle validation, not predicted value
