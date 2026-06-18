# Continuous Rust/WASM Optimizer Learning Design

## Goal

Build a compounding optimizer mode that can run for hours or days, preserve what
it learns, and reuse that knowledge in later search chunks.

The first version targets Rust/WASM search only. TypeScript remains the exact
reference/oracle where needed, but the long-running loop, resume state, corpus
storage, and reuse path are built around the Rust/WASM optimizer.

The UI exposes this capability as an optimizer method named `Continuous`.

## Current Evidence

The original promoted-seed reuse direction has been tested and retired. See
`docs/continuous-search-algorithm.md` for the current algorithm and
`docs/continuous-search-observations.md` for the validation log:

- exact promoted candidate replay reduced `t3-full` score at 10M attempts;
- materialized promoted seed storage is dead weight when replay is disabled;
- labeled neighbor reuse trials did not produce global-best improvements at
  1M attempts;
- request seed warmups must be distributed across Rust/WASM islands to avoid
  duplicated trial evaluation.

Treat the reuse path below as historical design context unless a future change
replaces it with a proven evidence-to-quality feedback loop.

## Problem

The current bounded optimizer can evaluate many candidates, but most of the
useful information disappears when the process exits. The discovery prototype
records descriptors, motifs, and constraint-boundary samples during a run, yet
those findings do not persist or compound across multiple runs.

At high budgets, online discovery adds measurable overhead and does not reliably
improve final exact score. The issue is not only the number of generations. The
system needs a durable corpus and a feedback loop that promotes findings only
after they prove useful against exact simulator-backed scores.

## Non-Goals

- Do not add neural guidance in this version.
- Do not make discovery score part of final candidate ranking.
- Do not target the TypeScript hybrid backend for the continuous worker in v1.
- Do not require the browser UI to keep a long search alive.
- Do not store every raw candidate forever without retention rules.

## User-Facing Model

The optimizer offers two practical modes:

- `Hybrid`: bounded in-browser search that returns results from the current
  run.
- `Continuous`: persistent Rust/WASM search that starts or resumes a named
  session and improves a corpus over time.

For `Continuous`, the UI shows:

- session name and scenario/setup summary
- running, paused, or stopped status
- total attempts, valid rate, elapsed time, and workers
- current exact best candidate and score
- score history by checkpoint
- top promoted seeds or motifs
- last checkpoint time
- controls to start, pause, resume, and inspect results

The UI must make clear that `Continuous` is a long-running optimizer. It is
expected to improve over time and may run outside the browser page lifecycle.

## Architecture

### Continuous Search Orchestrator

Extend `scripts/search-rust-wasm-sqlite.ts` into the first continuous learning
orchestrator.

Responsibilities:

- create or resume a session from SQLite
- launch Rust/WASM worker chunks
- save worker resume state after each chunk
- persist candidate and discovery artifacts
- update checkpoint history
- load promoted seeds and motifs before each chunk
- emit compact progress summaries for CLI and UI consumers

The orchestrator remains runnable from CLI so long searches can continue without
the UI.

### SQLite Learning Corpus

The database stores search state and learned artifacts. Existing session,
worker state, and checkpoint tables should be preserved and expanded rather than
replaced.

Core tables:

```sql
sessions(
  id,
  scenario_id,
  setup_hash,
  seed,
  status,
  worker_count,
  total_attempts,
  valid_candidates,
  invalid_candidates,
  best_score,
  best_candidate_id,
  created_at,
  updated_at
)

worker_states(
  session_id,
  worker_index,
  resume_state_json,
  attempts,
  valid_candidates,
  invalid_candidates,
  updated_at
)

candidate_evaluations(
  id,
  session_id,
  candidate_hash,
  candidate_json,
  score,
  valid,
  violation_category,
  final_state_json,
  descriptor_json,
  source_kind,
  source_ref,
  attempt,
  created_at
)

checkpoints(
  id,
  session_id,
  attempts,
  score,
  best_candidate_id,
  valid_rate,
  summary_json,
  created_at
)

motifs(
  id,
  session_id,
  motif_key,
  motif_json,
  support_count,
  best_score,
  average_score,
  rediscovery_count,
  confidence,
  promoted,
  updated_at
)

boundary_samples(
  id,
  session_id,
  candidate_id,
  violation_category,
  repair_attempted,
  repair_succeeded,
  repaired_candidate_id,
  created_at
)

promoted_seeds(
  id,
  session_id,
  source_kind,
  source_ref,
  candidate_json,
  score,
  confidence,
  usage_count,
  last_used_at,
  created_at
)
```

The schema may be normalized differently during implementation, but it must
support these facts: candidate identity, exact score, validity, state evidence,
motif support, repair evidence, seed provenance, and checkpoint history.

### Candidate Retention

The corpus should not store every candidate indefinitely. The orchestrator
stores:

- every new global best candidate
- top-K candidates per checkpoint
- rare valid-state candidates
- invalid candidates that produce useful boundary samples
- candidates generated from promoted seeds or motifs
- sampled background candidates for distribution analysis

Retention is configurable per session. Defaults should favor relevance over
storage volume.

### Mining

Add a mining command over the SQLite corpus.

The miner ranks motifs, boundary repairs, and seeds by:

- exact score contribution
- support count
- rediscovery rate across chunks
- repair success rate
- recency
- diversity from current promoted seeds

The miner promotes only findings with evidence. A one-off high discovery score
does not become a strong search prior unless it is backed by exact-score or
repair evidence.

### Reuse

Before each search chunk, the orchestrator loads promoted seeds and motifs from
the database.

Reuse mechanisms:

- seed a portion of workers from promoted candidates
- preserve proven setup actions during mutation
- bias repair generation toward categories with high repair success
- generate immigrants from underused high-confidence motifs
- periodically retest older promoted seeds to detect stale priors

Reuse must remain bounded. The search still needs randomness, mutation, and
fresh exploration so the corpus does not collapse into one local optimum.

## UI Integration

Add `Continuous` as an optimizer method in the existing optimizer controls.

The first UI version does not need to run the Rust/WASM process inside the
browser. It can connect to persisted session state and show progress/results
from the SQLite-backed continuous search.

Required UI behavior:

- selecting `Continuous` switches controls to session-oriented fields
- users can choose or create a session
- progress is shown from persisted checkpoints
- best candidates are displayed with the same exact-score presentation as other
  optimizer results
- promoted seeds and motifs are visible as compact diagnostics
- if the background worker is not running, the UI shows the last known state and
  offers the command or control path to resume it

If a local app/server API is introduced for start/pause/resume, it should wrap
the same orchestrator logic rather than duplicating search behavior in UI code.

## Data Flow

1. User starts or resumes a `Continuous` session.
2. Orchestrator loads session, worker resume states, and promoted priors.
3. Rust/WASM workers evaluate a search chunk.
4. Results are exact scored and summarized.
5. Orchestrator persists worker state, candidates, descriptors, boundary
   samples, motifs, and checkpoint history.
6. Miner updates motif confidence and promoted seed sets.
7. Next chunk consumes promoted priors plus fresh random exploration.
8. UI reads session progress and displays current best exact results.

## Error Handling

- Worker failure preserves the last successful checkpoint.
- Corrupt resume state disables only the affected worker and records an error in
  session metadata.
- Schema migrations are explicit and idempotent.
- Candidate JSON parse errors quarantine the row instead of crashing the whole
  session.
- UI must treat stale session state as paused or unknown, not failed.

## Testing Strategy

Core tests:

- schema creation and migration are idempotent
- sessions resume from stored worker states
- candidate hashing deduplicates identical candidates
- checkpoints preserve best-score history
- mining promotes only evidence-backed motifs/seeds
- reuse loads promoted seeds without changing exact final ranking
- retention keeps required best/checkpoint candidates

Integration tests:

- small Rust/WASM continuous run writes session, checkpoint, worker state, and
  candidate rows
- resumed run advances attempts from the previous state
- UI control mapping can represent `Continuous` sessions without losing existing
  `Hybrid` behavior

## Rollout

1. Add OpenSpec change for persistent continuous learning.
2. Extend SQLite schema and CLI orchestrator.
3. Persist relevant candidates, checkpoints, descriptors, and motifs.
4. Add mining and promoted seed selection.
5. Feed promoted seeds/motifs into Rust/WASM chunks.
6. Add `Continuous` UI mode backed by persisted session state.
7. Run 10M and 100M searches as corpus-building sessions, not blind benchmarks.

## Success Criteria

The feature is successful when:

- a continuous Rust/WASM session can run, stop, and resume without losing search
  state
- the DB records enough evidence to explain why a seed or motif was promoted
- later chunks can consume promoted findings from earlier chunks
- final candidates remain exact simulator-ranked
- `Continuous` is visible in the UI as a distinct optimizer mode
- long runs produce a useful score history and inspectable learning corpus

The first performance goal is not attempts per second. It is compounding
relevance: future chunks should increasingly spend search budget on candidates
with evidence-backed potential while still preserving exploration.
