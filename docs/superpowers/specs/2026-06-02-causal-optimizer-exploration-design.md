# Causal Optimizer Exploration Design

## Goal

Improve the hybrid optimizer so it can discover delayed utility patterns on its
own, instead of depending on hand-written seeds for known combos.

The target problem is broader than Feu-Follet. Some strong rotations require a
setup action whose value appears only later: create a class state, store a rune,
unlock a temporary option, recover AP, then spend the gained resource on burst.
The optimizer currently scores mostly final damage and samples atomic actions,
so low-damage utility actions are easy to miss.

## Current Issue

The current hybrid engine evaluates candidates through `simulateCombo`, keeps
high-scoring candidates, and generates offspring through random sampling,
crossover, mutation, local refinement, repair candidates, and elite neighbors.

This works well for direct damage lines, but it has two structural blind spots:

- The search action space can omit target variants that are only implied by
  conditional effects, such as `targetIs: emptyCell` or `targetIs: feuFollet`.
- Utility actions often have low immediate score and low sampling weight, even
  when they create states that enable a later payoff.

Feu-Follet is the concrete validation case: placing and recovering it can create
a delayed AP/rune payoff, but the design must remain general enough to discover
other mechanics.

## Proposed Architecture

Add a causal exploration layer between simulation and hybrid search.

```text
candidate
  -> simulateCombo
  -> final score
  -> causal trace
  -> novelty and motif archive
  -> guided mutation / local refinement / immigrant generation
```

The causal layer does not encode "Feu-Follet is good". It observes generalized
effects:

- resource produced
- resource consumed
- class state created
- class state removed
- option unlocked
- option consumed
- state converted into resource
- state converted into damage
- resource enabling a later expensive action

## Components

### Search Action Expansion

Generate semantically valid target variants from the catalog, not only from
constraints.

The action builder should inspect constraints and conditional effects. If a spell
has an effect gated by `targetIs: emptyCell`, `targetIs: feuFollet`, `targetIs:
ally`, or similar target conditions, the search space should include that target
variant.

This is a correctness prerequisite. The causal layer cannot discover a pattern
if the required action variant is absent from the candidate action list.

### Causal Trace Extractor

Create a compact per-candidate trace from simulation breakdowns. Each action
should produce a summary like:

```ts
type CausalActionDelta = {
  actionIndex: number;
  turnIndex: number;
  actionKey: string;
  resourcesBefore: Record<string, number>;
  resourcesAfter: Record<string, number>;
  producedFeatures: string[];
  consumedFeatures: string[];
  unlockedFeatures: string[];
  scoreDeltaEstimate: number;
};
```

Features should use stable, generic names:

```text
resource.ap:+2
resource.bq:+150
class.rune.aquatic.active
class.feuFollet.active
class.feuFollet.storedRunes
class.temporaryUnlockedSpellElement.fire
cooldown.fleche-de-lumiere.available
```

The extractor should start with features that already exist in simulation state:
resources, Huppermage runes, Feu-Follet state, temporary unlocked element,
cooldowns, and applied effects.

### Temporal Causality Links

Build links between producers and later consumers.

```ts
type CausalLink = {
  producerActionIndex: number;
  consumerActionIndex: number;
  feature: string;
  distanceActions: number;
  distanceTurns: number;
  observedGain: number;
};
```

The model must support both short and long horizons:

- same turn, a few actions later
- next turn
- T1 setup into T3 payoff

Distance should affect confidence, not eligibility. A long-distance link needs
more repeated evidence before it strongly influences search, but it should not be
discarded.

### Novelty Archive

Keep a compact archive of rare or underexplored causal features and links.

Examples:

```text
class.feuFollet.storedRunes
resource.ap:+2 after class.feuFollet.active
temporaryUnlockedSpellElement.fire consumed by fire spell
high-cost light spell enabled by earlier resource gain
```

Candidates can receive a secondary novelty score when they reach uncommon states
or produce uncommon links. This score should not replace final damage score; it
should preserve exploratory candidates that may lead to later breakthroughs.

### Motif Archive

Promote repeated useful links into motifs.

```ts
type CausalMotif = {
  producerActionKey: string;
  consumerActionKey?: string;
  feature: string;
  horizon: "same-turn" | "next-turn" | "long";
  observations: number;
  averageGain: number;
  confidence: number;
};
```

Motifs become search operators:

- insert a producer before a known consumer
- preserve a setup action when mutating a candidate
- test a consumer after a rare state is created
- move a setup action earlier if its payoff appears too late
- create immigrants biased toward underexplored motifs

## Hybrid Engine Integration

The hybrid engine should use causal exploration in four places:

1. **Evaluation**
   After simulation, extract causal traces and update novelty/motif archives.

2. **Selection**
   Rank candidates by final score first, but retain a small exploration slice for
   high-novelty or promising causal candidates.

3. **Elite Neighbors**
   When a candidate improves or exposes a useful motif, enqueue causal neighbors:
   producer insertion, consumer insertion, setup preservation, and timing shifts.

4. **Immigrants**
   During stagnation restarts, generate a mix of random candidates,
   resource-aware candidates, diverse candidates, and motif-biased candidates.

## Credit Assignment

Use a conservative delayed-credit model.

```text
credit = observedGain * confidence * distanceWeight
```

Distance weight should decay slowly and never eliminate a link by itself.
Confidence should grow with repeated observations and shrink when the same setup
often fails to produce payoff.

This avoids overfitting to accidental correlations while still allowing T1 to T3
setups to be discovered.

## Testing Strategy

Add focused tests before relying on benchmark results.

- Search action expansion includes target variants inferred from `targetIs`
  conditional effects.
- The trace extractor records resource gains, class-state changes, stored runes,
  unlocked options, and consumed states.
- A synthetic utility spell scenario is discovered even when the utility action
  has no damage.
- A delayed T1 to T3 setup receives causal credit after repeated observations.
- A Feu-Follet validation scenario can discover a place/recover/burst line
  without a Feu-Follet-specific seed.

## Rollout Plan

Implement in increments:

1. Expand target-aware action generation.
2. Add causal trace extraction without changing optimizer behavior.
3. Add novelty archive and metrics.
4. Add causal neighbors and motif-biased immigrants behind local helpers.
5. Tune retention ratios and confidence thresholds through tests and benchmarks.

## Non-Goals

- Do not hardcode Feu-Follet-specific optimizer behavior.
- Do not replace the existing hybrid engine.
- Do not make causal novelty dominate final combo score.
- Do not require exhaustive planning over all possible state transitions.

## Open Design Decisions

- Exact feature vocabulary for non-Huppermage classes can be added later.
- Retention ratio for novelty candidates should start small and be benchmarked.
- Motif confidence thresholds should be conservative until there is enough test
  coverage to avoid noisy causal attribution.
