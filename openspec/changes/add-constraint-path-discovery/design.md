## Context

The optimizer already has deterministic scoring, stochastic experiment engines, a hybrid engine, repair queues, elite-neighbor search, and a Rust/WASM backend for high-volume runs. Those systems are good at evaluating and exploiting candidates once promising regions are visible.

The weak point is discovery. Final damage scoring can make setup actions look bad until the right rune, BQ, cooldown, target, passive, or sustainability condition appears later. The Trackmania research discussion points to a useful distinction: discovery, optimization, and consistency are separate problems. For this project, discovery should be a cheap, inspectable layer that feeds better candidates into the existing exact simulator and hybrid optimizer.

Neural-network guidance is intentionally deferred. The project has exact rules and exact simulator state, so a neural model is not needed for perception. It may become useful later as a learned policy/value guide after enough simulator-evaluated candidates exist.

## Goals / Non-Goals

**Goals:**

- Make enabling states and delayed utility visible to search before final damage proves them.
- Use simulator traces and rule violations to classify why candidates succeed, stall, or fail.
- Extract reusable motifs from high-value, near-miss, and repaired candidates.
- Feed discovered motifs back into hybrid search as bounded seeds, mutations, or macro-actions.
- Add curriculum objectives that deliberately search for useful capabilities such as BQ generation, rune cycling, sustainability, conditional unlocks, and valid long plans.
- Preserve strict final validation and ranking through the existing simulator-backed damage and sustainability criteria.

**Non-Goals:**

- Do not replace simulator scoring with heuristic scoring for final results.
- Do not require neural networks in the first implementation.
- Do not introduce opaque learned models before the heuristic discovery pipeline has measurable baselines.
- Do not make discovered motifs trusted rules; they remain candidate-generation hints that must pass simulation.
- Do not broaden the scope to unrelated UI workflows.

## Decisions

### Separate discovery score from final score

Discovery phases will use shaping rewards for enabling states, but final candidates will continue to rank by the configured optimizer criterion. This keeps exploration flexible without weakening result correctness.

Alternative considered: add setup rewards directly into the main score. That would make results harder to interpret because a returned candidate could win due to heuristic utility rather than real damage or sustainability.

### Use simulator traces as the discovery substrate

Discovery should derive state descriptors from existing simulation outputs: resources, runes, cooldowns, casts, target requirements, damage timing, violations, final state, and replay sustainability. This avoids building a parallel rules model.

Alternative considered: hand-code a separate abstract planner. That might be faster for specific rules, but it risks drifting from the simulator and duplicating rule semantics.

### Treat invalid candidates as labeled boundary data

Invalid candidates should contribute repair and curriculum signals. A violation such as insufficient BQ, missing target, cooldown lock, or replay resource debt identifies a nearby constraint boundary that search can explore deliberately.

Alternative considered: discard invalid candidates after counting them. That loses information the simulator already computed and keeps repair logic too generic.

### Mine motifs before introducing neural guidance

The first implementation should store inspectable motifs such as "rune setup before burst", "BQ recovery before spend", "target flip unlock", or "sustainable replay repair". Motifs can be counted, ranked, and reinserted into hybrid search.

Alternative considered: train a neural value model immediately. That adds a data pipeline, feature encoding, model versioning, and debugging ambiguity before there is a stable labeled corpus or a heuristic baseline to beat.

### Add curriculum objectives as controlled experiments

The experiment lab should support discovery runs that optimize intermediate capabilities independently from final damage. Examples include maximizing BQ recovery, reaching rare rune states, creating valid long plans, or finding sustainable loops. Successful candidates and motifs from these runs can seed the main hybrid search.

Alternative considered: rely on one all-purpose hybrid run. This keeps the interface simple but makes rare techniques hard to discover when their immediate damage is weak.

## Risks / Trade-offs

- Reward hacking -> Keep discovery rewards out of final ranking and report both discovery score and final simulator score.
- Motif bloat -> Bound motif storage by support count, validation rate, score contribution, and recency.
- Search slowdown -> Run discovery phases under explicit budgets and compare score-per-iteration against the current hybrid baseline.
- Rule drift -> Derive descriptors from simulator traces and validate every candidate with the exact simulator.
- Overfitting to Huppermage-specific tricks -> Mark motifs by required class state, passives, sublimations, and criteria so they can be filtered or retired.
- Neural-model temptation -> Require a candidate corpus and baseline plateau evidence before adding learned guidance.

## Migration Plan

1. Add descriptor extraction for simulated valid and invalid candidates.
2. Add discovery metrics without changing candidate generation.
3. Add bounded discovery rewards and curriculum objectives behind experiment options.
4. Add motif mining from validated candidates, repaired candidates, and recurring near-miss traces.
5. Feed motifs into hybrid search as optional seeds or mutations.
6. Benchmark discovery-guided hybrid search against current hybrid baselines across fixed seeds and budgets.
7. Decide separately whether the resulting candidate corpus justifies a neural-guidance proposal.

Rollback is simple: disable discovery-guided candidate sources and continue using the existing hybrid optimizer and exact scoring.

## Open Questions

- Which descriptors are most predictive: resource vectors, class state, violation type, motif sequence, or action-level deltas?
- Should motifs be persisted across sessions, or only inside a single experiment run at first?
- What minimum benchmark evidence should be required before considering neural policy/value guidance?
- How should discovery budgets be split between curriculum runs and the main hybrid run?
