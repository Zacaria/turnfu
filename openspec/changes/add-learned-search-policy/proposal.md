## Why

Continuous Rust/WASM search now records enough evidence to analyze candidate
generation quality, but the tested feedback loops have not improved final
simulator-backed score:

- exact promoted replay hurt quality at 10M attempts;
- naive neighbor reuse did not create global-best improvements;
- adaptive strategy suppression correctly filtered a known-bad mutation family
  but did not improve score at 1.5M attempts.

More raw search is unlikely to compound until candidate proposals become more
relevant. The next step is to turn the continuous corpus into an offline
learning dataset and prove that a learned or statistical policy can rank useful
edits better than the current handcrafted mutation order before integrating it
into live search.

## What Changes

- Add a learned search policy capability with an offline-first workflow.
- Export supervised examples from continuous SQLite databases:
  candidate structure, mutation source, result score, validity, score delta,
  global-best improvement, and violation category when available.
- Add an offline evaluator that measures whether a policy ranks high-value
  edits ahead of low-value or invalid edits.
- Start with non-neural ranking baselines such as contextual bandit features or
  score-delta heuristics before adding a neural model.
- Gate any online Rust/WASM integration on offline evidence that the policy
  improves top-k expected score delta and validity over handcrafted mutations.
- Preserve exact simulator validation and TypeScript oracle checks for final
  results.

## Non-Goals

- Do not train or ship a neural model in the first step.
- Do not replace final simulator scoring with predicted values.
- Do not run more 10M/100M searches until the offline evaluator shows a better
  candidate-ranking signal.
- Do not make invalid candidates eligible as final results.

## Impact

- Affected code: continuous SQLite export scripts, policy evaluation scripts,
  documentation, and later optional Rust/WASM seed-priority integration.
- Data impact: creates reproducible offline datasets from existing
  `continuous_candidate_evaluations`, `continuous_reuse_trials`, checkpoints,
  motifs, and boundary samples.
- Validation impact: introduces an offline evidence gate before spending large
  compute budgets on learned guidance.
