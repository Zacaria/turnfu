## 1. Experiment API

- [x] 1.1 Add failing tests for deterministic seeded experiment runs, common result shape, and progress snapshots.
- [x] 1.2 Implement shared experiment types, seeded random utilities, candidate serialization, and progress/result structures.
- [x] 1.3 Implement a memoized complete-plan evaluator that reuses existing combo simulation, scoring, and sustainability checks.

## 2. Search Engines

- [x] 2.1 Add failing tests proving weak setup turns can win when complete plans are evaluated.
- [x] 2.2 Implement the random baseline engine.
- [x] 2.3 Implement Monte Carlo tree search using completed rollout scoring.
- [x] 2.4 Implement novelty search using trace-level novelty descriptors rather than hard-coded Wakfu setup buckets.
- [x] 2.5 Implement simulated annealing over complete-plan mutations.
- [x] 2.6 Implement genetic search over complete-plan populations.

## 3. Comparison Runner

- [x] 3.1 Add failing tests for running all engine kinds under the same seed and budget.
- [x] 3.2 Implement engine selection and comparison runner orchestration.
- [x] 3.3 Export the experiment lab API from the optimizer package.

## 4. Verification

- [x] 4.1 Run focused optimizer experiment tests.
- [x] 4.2 Run the full project test suite and OpenSpec validation for the new change.
