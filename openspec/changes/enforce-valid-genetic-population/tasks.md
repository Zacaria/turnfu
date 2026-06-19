## 1. OpenSpec Contract

- [x] 1.1 Validate the OpenSpec proposal, design, and combo-optimizer spec delta for `enforce-valid-genetic-population`.

## 2. Valid Population Model

- [x] 2.1 Harden `HybridPopulationEntry` so it represents a simulator-valid individual by construction or by compatibility-normalized admission.
- [x] 2.2 Add resume population sanitization so invalid or unverified legacy entries cannot become parents, elites, ranked entries, or persisted competitive population entries.
- [x] 2.3 Add defensive population invariant checks around ranking, truncation, parent selection, and top-candidate tracking.

## 3. Valid Individual Factory

- [x] 3.1 Introduce a hybrid valid individual factory that evaluates every proposal through exact simulator validation before admission.
- [x] 3.2 Add bounded per-child and per-generation fabrication retry budgets with deterministic seeded behavior.
- [x] 3.3 Add adaptive fabrication temperature that escalates proposal sources/operators when generation fill is difficult and de-escalates after successful fabrication.
- [x] 3.4 Add projection repair from the first simulator violation with exact revalidation before admission.
- [x] 3.5 Route seeds, mutation, crossover, repair queue entries, elite neighbors, restarts, and immigrants through the factory before population insertion.
- [x] 3.6 Revalidate Continuous worker top candidates through the exact oracle before checkpoint ranking, UI emission, and evidence persistence.
- [x] 3.7 Treat failed sustainable-cycle replay as failed fabrication for Continuous admission and resume population reporting.

## 4. Reporting

- [x] 4.1 Replace genetic-facing validity-rate wording with fabrication diagnostics such as `fabricationAttempts`, `discardedProposals`, `projectionRepairs`, and `factoryExhaustions`.
- [x] 4.2 Preserve historical SQLite compatibility unless a migration or compatibility justification is included.
- [x] 4.3 Replace Continuous UI and stream progress wording with fabrication diagnostics such as `admittedIndividuals`, `discardedProposals`, `fabricationAttempts`, `projectionRepairs`, and `factoryExhaustions`.

## 5. Tests and Verification

- [x] 5.1 Add tests proving invalid proposals are not admitted to the population.
- [x] 5.2 Add tests proving invalid resume population entries are filtered or refused before selection.
- [x] 5.3 Add tests proving repair/projection proposals are admitted only after exact simulator validation.
- [x] 5.4 Add fixed-seed tests proving deterministic factory behavior.
- [x] 5.5 Add tests proving top candidates remain simulator/oracle validated.
- [x] 5.6 Run targeted Rust/WASM and TypeScript tests plus strict OpenSpec validation.
- [x] 5.7 Re-run targeted Continuous UI/runner tests and strict OpenSpec validation after applying the Continuous-scope correction.
