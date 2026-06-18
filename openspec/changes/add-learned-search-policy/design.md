## Context

The current optimizer has exact scoring and high-volume Rust/WASM search. Its
weakness is not evaluation throughput; it is proposal relevance. The continuous
corpus now gives us examples of proposals that were tried, including whether
they were valid, whether they improved their source candidate, and whether
they improved the global best.

That is enough to test a policy offline. Offline evaluation is cheaper and
clearer than another long search run: if a policy cannot rank historical useful
edits above historical bad edits, it should not be trusted to spend live search
budget.

## Decision

Use an offline-first learned search policy pipeline:

```text
continuous SQLite
      |
      v
dataset export
      |
      v
offline train/evaluate split
      |
      v
ranking policy candidates
      |
      v
offline evidence gate
      |
      v
optional online Rust/WASM seed prioritization
```

The first policy does not need to be neural. A contextual ranking or bandit
baseline is the right floor because it is inspectable and cheap. Neural
policy/value models should only be proposed after the offline evaluator proves
that useful labels exist and simple baselines plateau.

## Dataset Shape

Each exported example should include:

- scenario id, setup hash, seed, session id, attempt;
- source candidate id and source score when available;
- candidate action sequence, passive ids, sublimation ids, and compact feature
  descriptors;
- source kind or mutation strategy;
- result score, validity, score delta versus source, and global-best
  improvement;
- violation category or descriptor when the simulator rejected the candidate.

For initial policy evaluation, labels are:

- `valid`: candidate passed exact simulation;
- `scoreDelta`: `result_score - source_score` when both exist;
- `improvedGlobalBest`: candidate beat the previous global best;
- `useful`: valid and either positive score delta or global-best improvement.

## Offline Metrics

The evaluator should report:

- top-k average score delta;
- top-k validity rate;
- global-best improvement recall when present;
- invalid selection rate;
- policy lift over current handcrafted mutation order;
- coverage by strategy and scenario.

Accuracy is not the main metric. Ranking a few high-value proposals above many
bad proposals is more useful than classifying the whole corpus evenly.

## Online Gate

Online integration is allowed only when the offline evaluator shows positive
lift on held-out sessions or seeds. The first online integration should be
bounded seed prioritization for Rust/WASM continuous search, never replacement
of exact simulation or final ranking.

Minimum lift for online integration:

- held-out top-k average score delta is higher than handcrafted ordering;
- held-out top-k validity rate is not lower than handcrafted ordering;
- held-out useful rate is higher than handcrafted ordering, or global-best
  recall is higher when global-best labels are present;
- the split is by session or seed, not row-level random leakage.

If those conditions are not met, the policy remains an offline diagnostic and
does not justify 10M or 100M online validation.

## Risks

- Sparse global-best labels: use score delta and validity as intermediate
  labels, but keep global-best improvement as the most important signal.
- Dataset bias: split by session or seed, not only random rows.
- Learned replay trap: the policy must rank edits or proposal families, not
  memorize exact candidates.
- Predicted score misuse: predictions are hints for simulation priority only.
