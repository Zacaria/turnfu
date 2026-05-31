## Context

The current optimizer exposes deterministic exhaustive and beam-search modes. That is useful for fast UI recommendations, but it is biased toward strong partial prefixes because the beam ranks partial plans by the same score used for completed plans. Wakfu optimization needs a separate experiment layer that can spend more time evaluating complete plans, including plans with weak setup turns, passive/deck variations, and unusual action sequences.

The existing simulator remains the source of truth. Search engines should propose candidate plans and setups; the experiment runner should evaluate them through `simulateCombo`, `scoreComboSimulation`, and optional sustainability replay. This avoids duplicating Huppermage mechanics inside each search algorithm.

## Goals / Non-Goals

**Goals:**

- Add a core optimizer experiment API that can run multiple engines behind one interface.
- Implement comparable engines for random baseline, MCTS, novelty search, simulated annealing, and genetic search.
- Evaluate complete candidate plans rather than pruning solely on setup-turn damage.
- Emit progress snapshots suitable for a future UI or background worker.
- Keep searches deterministic when given the same seed and budget.
- Add memoization for repeated complete-plan evaluation and reusable state signatures.

**Non-Goals:**

- Replacing the current interactive beam optimizer.
- Guaranteeing global optimality for large search spaces.
- Adding worker threads, persistence, or GUI rendering in this change.
- Modeling new Wakfu mechanics beyond what the simulator already supports.

## Decisions

### Decision: Add an experiment runner beside the current optimizer

The new API will live in a separate optimizer module and export `runOptimizerExperiment`. The current `optimizeCombo` API remains unchanged.

Alternative considered: extend `optimizeCombo` with many strategy-specific options. Rejected because the existing API is tuned for synchronous deterministic recommendations, while experiments need progress, seeds, budgets, and engine metrics.

### Decision: Engines propose complete plans and share one evaluator

Each engine receives a deterministic random source, action pool, budget, and evaluator. Candidate plans are scored only after simulation of the full requested duration. Engines may internally construct plans incrementally, but they must not reject weak prefixes solely because their immediate damage is low.

Alternative considered: give engines direct access to simulator internals and incremental score heuristics. Rejected because it would reintroduce hand-authored assumptions about which Wakfu states matter.

### Decision: Use a common result and progress model

Every engine will report attempts, valid candidates, invalid candidates, best candidate, elapsed iterations, and engine-specific metrics. A shared comparison runner can execute multiple engines with the same seed and budget.

Alternative considered: return engine-specific result shapes. Rejected because comparing performance would become UI-specific glue code.

### Decision: Include random baseline

Random search will be implemented as the baseline engine. MCTS, novelty, annealing, and genetic engines must be compared against it under identical budgets.

Alternative considered: implement only advanced engines. Rejected because without a baseline, complex algorithms can look useful even when they are underperforming simple sampling.

### Decision: Memoize evaluations by full candidate key

The first memoization layer will cache complete plan evaluations by setup identity, criterion, sustainability requirement, and serialized plan. The cache can later evolve into transposition tables over simulator state signatures.

Alternative considered: memoize hand-picked sub-combo buckets. Rejected because those buckets encode fragile assumptions about which states matter.

## Risks / Trade-offs

- [Risk] Stochastic engines can produce noisy comparisons. → Mitigation: require deterministic seeds and expose repeated-run metrics.
- [Risk] Advanced engines may not beat random search initially. → Mitigation: ship the random baseline and comparison surface first so this is visible.
- [Risk] Complete-plan evaluation is expensive. → Mitigation: cache duplicate evaluations and keep budgets explicit.
- [Risk] MCTS can still bias toward short-term reward if rollout scoring is wrong. → Mitigation: reward completed rollouts only, not raw prefix damage.
- [Risk] Engine options can grow messy. → Mitigation: keep a small shared budget/config surface and put specialized knobs behind engine-specific options.
