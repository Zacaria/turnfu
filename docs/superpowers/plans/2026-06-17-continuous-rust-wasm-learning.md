# Continuous Rust/WASM Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first shippable slice of the `Continuous` optimizer: a Rust/WASM-backed persistent learning corpus plus UI-facing view models for a dedicated continuous search page.

**Architecture:** Extract SQLite corpus responsibilities out of the current long-running Rust/WASM search script into focused modules, then have the script persist candidates, checkpoints, motifs, boundary evidence, and promoted seeds. Add UI domain types/view-model builders for a dedicated `Continuous` page without requiring the browser to own the long-running worker lifecycle.

**Tech Stack:** TypeScript, Node `node:sqlite`, Node test runner with `--experimental-strip-types`, Rust/WASM optimizer JSON APIs, existing Vite/React UI domain helpers.

---

## File Structure

- Create `scripts/continuous-search-store.ts`: SQLite schema, migrations, session/checkpoint/candidate/motif/boundary/promoted-seed persistence helpers.
- Create `scripts/continuous-search-store.test.ts`: focused Node tests for schema creation, dedupe, checkpoint history, evidence promotion, and retention.
- Modify `scripts/search-rust-wasm-sqlite.ts`: replace inline schema helpers with the store module and persist top candidate/evidence rows after each chunk.
- Create `src/ui/continuousOptimizerWorkspace.ts`: browser-safe domain types and view-model builders for the dedicated `Continuous` page.
- Create `src/ui/continuousOptimizerWorkspace.test.ts`: UI/domain tests for session summaries, best-combo/evidence split, status labels, and controls metadata.
- Modify `src/ui/researchNavigation.ts`: add a route shape for the dedicated continuous optimizer page.
- Modify `src/ui/researchWorkspace.ts` and related tests only if route/page state requires workspace persistence support.
- Modify `package.json`: add a targeted script-test command only if direct script tests become too awkward to run manually.

Do not move the Rust/WASM algorithm in this slice. The implementation should persist and reuse data around the existing Rust/WASM search loop.

## Task 1: Add SQLite Corpus Store

**Files:**
- Create: `scripts/continuous-search-store.ts`
- Test: `scripts/continuous-search-store.test.ts`

- [ ] **Step 1: Write failing schema and session tests**

Create `scripts/continuous-search-store.test.ts` with:

```ts
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  createContinuousSearchSchema,
  ensureContinuousSearchSession,
  listContinuousSearchCheckpoints,
  recordContinuousSearchCheckpoint,
} from "./continuous-search-store.ts";

function createTempDatabase(): { db: DatabaseSync; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "continuous-search-store-"));
  const db = new DatabaseSync(join(dir, "search.sqlite"));
  return {
    db,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("creates schema idempotently and resumes matching sessions", () => {
  const { db, cleanup } = createTempDatabase();
  try {
    createContinuousSearchSchema(db);
    createContinuousSearchSchema(db);

    const created = ensureContinuousSearchSession(db, {
      id: "session-a",
      fingerprint: "fingerprint-a",
      scenarioId: "t3-full",
      setupHash: "setup-a",
      seed: "continuous",
      workerCount: 4,
    });
    const resumed = ensureContinuousSearchSession(db, {
      id: "session-a",
      fingerprint: "fingerprint-a",
      scenarioId: "t3-full",
      setupHash: "setup-a",
      seed: "continuous",
      workerCount: 4,
    });

    assert.equal(created.id, "session-a");
    assert.equal(resumed.id, "session-a");
    assert.equal(resumed.totalAttempts, 0);
  } finally {
    cleanup();
  }
});

test("rejects mismatched session fingerprints", () => {
  const { db, cleanup } = createTempDatabase();
  try {
    createContinuousSearchSchema(db);
    ensureContinuousSearchSession(db, {
      id: "session-a",
      fingerprint: "fingerprint-a",
      scenarioId: "t3-full",
      setupHash: "setup-a",
      seed: "continuous",
      workerCount: 4,
    });

    assert.throws(
      () => ensureContinuousSearchSession(db, {
        id: "session-a",
        fingerprint: "fingerprint-b",
        scenarioId: "t3-full",
        setupHash: "setup-a",
        seed: "continuous",
        workerCount: 4,
      }),
      /fingerprint mismatch/,
    );
  } finally {
    cleanup();
  }
});

test("records checkpoint history in attempt order", () => {
  const { db, cleanup } = createTempDatabase();
  try {
    createContinuousSearchSchema(db);
    ensureContinuousSearchSession(db, {
      id: "session-a",
      fingerprint: "fingerprint-a",
      scenarioId: "t2-a8-p2",
      setupHash: "setup-a",
      seed: "continuous",
      workerCount: 2,
    });

    recordContinuousSearchCheckpoint(db, {
      sessionId: "session-a",
      totalAttempts: 100,
      score: 42,
      validRate: 0.5,
      bestCandidateId: null,
      summary: { totalAttempts: 100, score: 42 },
    });
    recordContinuousSearchCheckpoint(db, {
      sessionId: "session-a",
      totalAttempts: 200,
      score: 84,
      validRate: 0.6,
      bestCandidateId: null,
      summary: { totalAttempts: 200, score: 84 },
    });

    assert.deepEqual(
      listContinuousSearchCheckpoints(db, "session-a").map((checkpoint) => [checkpoint.totalAttempts, checkpoint.score]),
      [[100, 42], [200, 84]],
    );
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
rtk node --test --experimental-strip-types scripts/continuous-search-store.test.ts
```

Expected: FAIL because `scripts/continuous-search-store.ts` does not exist.

- [ ] **Step 3: Implement schema/session/checkpoint helpers**

Create `scripts/continuous-search-store.ts` with these exports:

```ts
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type ContinuousSearchSession = {
  id: string;
  fingerprint: string;
  scenarioId: string;
  setupHash: string;
  seed: string;
  status: "running" | "paused" | "stopped" | "error";
  workerCount: number;
  totalAttempts: number;
  validCandidates: number;
  invalidCandidates: number;
  bestScore: number | null;
  bestCandidateId: number | null;
};

export type EnsureContinuousSearchSessionInput = {
  id: string;
  fingerprint: string;
  scenarioId: string;
  setupHash: string;
  seed: string;
  workerCount: number;
};

export type ContinuousSearchCheckpoint = {
  id: number;
  sessionId: string;
  totalAttempts: number;
  score: number;
  validRate: number;
  bestCandidateId: number | null;
  summary: unknown;
  createdAt: string;
};

export type RecordContinuousSearchCheckpointInput = {
  sessionId: string;
  totalAttempts: number;
  score: number;
  validRate: number;
  bestCandidateId: number | null;
  summary: unknown;
};

export function createContinuousSearchSchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS continuous_sessions (
      id TEXT PRIMARY KEY,
      fingerprint TEXT NOT NULL,
      scenario_id TEXT NOT NULL,
      setup_hash TEXT NOT NULL,
      seed TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      worker_count INTEGER NOT NULL,
      total_attempts INTEGER NOT NULL DEFAULT 0,
      valid_candidates INTEGER NOT NULL DEFAULT 0,
      invalid_candidates INTEGER NOT NULL DEFAULT 0,
      best_score REAL,
      best_candidate_id INTEGER,
      last_summary_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS continuous_worker_states (
      session_id TEXT NOT NULL,
      worker_index INTEGER NOT NULL,
      resume_state_json TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      valid_candidates INTEGER NOT NULL DEFAULT 0,
      invalid_candidates INTEGER NOT NULL DEFAULT 0,
      metrics_json TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_id, worker_index)
    );

    CREATE TABLE IF NOT EXISTS continuous_candidate_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      candidate_hash TEXT NOT NULL,
      candidate_json TEXT NOT NULL,
      score REAL NOT NULL,
      valid INTEGER NOT NULL,
      violation_category TEXT,
      final_state_json TEXT,
      descriptor_json TEXT,
      source_kind TEXT NOT NULL,
      source_ref TEXT,
      attempt INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, candidate_hash)
    );

    CREATE TABLE IF NOT EXISTS continuous_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      total_attempts INTEGER NOT NULL,
      score REAL NOT NULL,
      valid_rate REAL NOT NULL,
      best_candidate_id INTEGER,
      summary_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS continuous_motifs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      motif_key TEXT NOT NULL,
      motif_json TEXT NOT NULL,
      support_count INTEGER NOT NULL DEFAULT 0,
      best_score REAL NOT NULL DEFAULT 0,
      average_score REAL NOT NULL DEFAULT 0,
      rediscovery_count INTEGER NOT NULL DEFAULT 0,
      confidence REAL NOT NULL DEFAULT 0,
      promoted INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, motif_key)
    );

    CREATE TABLE IF NOT EXISTS continuous_boundary_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      candidate_id INTEGER,
      violation_category TEXT NOT NULL,
      repair_attempted INTEGER NOT NULL DEFAULT 0,
      repair_succeeded INTEGER NOT NULL DEFAULT 0,
      repaired_candidate_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS continuous_promoted_seeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      source_ref TEXT,
      candidate_json TEXT NOT NULL,
      score REAL NOT NULL,
      confidence REAL NOT NULL,
      usage_count INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export function ensureContinuousSearchSession(
  database: DatabaseSync,
  input: EnsureContinuousSearchSessionInput,
): ContinuousSearchSession {
  const row = database.prepare(`
    SELECT id, fingerprint, scenario_id, setup_hash, seed, status, worker_count,
           total_attempts, valid_candidates, invalid_candidates, best_score, best_candidate_id
    FROM continuous_sessions
    WHERE id = ?
  `).get(input.id) as Record<string, unknown> | undefined;

  if (row) {
    if (row.fingerprint !== input.fingerprint) {
      throw new Error(`Session '${input.id}' fingerprint mismatch. Use --reset to discard persisted search state.`);
    }
    return mapSessionRow(row);
  }

  database.prepare(`
    INSERT INTO continuous_sessions (id, fingerprint, scenario_id, setup_hash, seed, worker_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(input.id, input.fingerprint, input.scenarioId, input.setupHash, input.seed, input.workerCount);

  return ensureContinuousSearchSession(database, input);
}

export function recordContinuousSearchCheckpoint(
  database: DatabaseSync,
  input: RecordContinuousSearchCheckpointInput,
): void {
  database.prepare(`
    INSERT INTO continuous_checkpoints (
      session_id, total_attempts, score, valid_rate, best_candidate_id, summary_json
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    input.sessionId,
    input.totalAttempts,
    input.score,
    input.validRate,
    input.bestCandidateId,
    JSON.stringify(input.summary),
  );
}

export function listContinuousSearchCheckpoints(
  database: DatabaseSync,
  sessionId: string,
): ContinuousSearchCheckpoint[] {
  const rows = database.prepare(`
    SELECT id, session_id, total_attempts, score, valid_rate, best_candidate_id, summary_json, created_at
    FROM continuous_checkpoints
    WHERE session_id = ?
    ORDER BY total_attempts ASC, id ASC
  `).all(sessionId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    sessionId: String(row.session_id),
    totalAttempts: Number(row.total_attempts),
    score: Number(row.score),
    validRate: Number(row.valid_rate),
    bestCandidateId: row.best_candidate_id === null ? null : Number(row.best_candidate_id),
    summary: JSON.parse(String(row.summary_json)),
    createdAt: String(row.created_at),
  }));
}

export function hashContinuousCandidate(candidate: unknown): string {
  return createHash("sha256").update(JSON.stringify(candidate)).digest("hex");
}

function mapSessionRow(row: Record<string, unknown>): ContinuousSearchSession {
  return {
    id: String(row.id),
    fingerprint: String(row.fingerprint),
    scenarioId: String(row.scenario_id),
    setupHash: String(row.setup_hash),
    seed: String(row.seed),
    status: row.status as ContinuousSearchSession["status"],
    workerCount: Number(row.worker_count),
    totalAttempts: Number(row.total_attempts),
    validCandidates: Number(row.valid_candidates),
    invalidCandidates: Number(row.invalid_candidates),
    bestScore: row.best_score === null ? null : Number(row.best_score),
    bestCandidateId: row.best_candidate_id === null ? null : Number(row.best_candidate_id),
  };
}
```

- [ ] **Step 4: Run schema/session tests**

Run:

```bash
rtk node --test --experimental-strip-types scripts/continuous-search-store.test.ts
```

Expected: PASS for 3 tests.

## Task 2: Persist Candidates, Boundaries, Motifs, and Promoted Seeds

**Files:**
- Modify: `scripts/continuous-search-store.ts`
- Test: `scripts/continuous-search-store.test.ts`

- [ ] **Step 1: Add failing persistence tests**

Append tests that assert candidate dedupe and promoted-seed ranking:

```ts
import {
  listContinuousSearchPromotedSeeds,
  recordContinuousSearchCandidate,
  recordContinuousSearchMotif,
  promoteContinuousSearchSeeds,
} from "./continuous-search-store.ts";

test("deduplicates candidate evaluations by candidate hash", () => {
  const { db, cleanup } = createTempDatabase();
  try {
    createContinuousSearchSchema(db);
    ensureContinuousSearchSession(db, {
      id: "session-a",
      fingerprint: "fingerprint-a",
      scenarioId: "t2-a8-p2",
      setupHash: "setup-a",
      seed: "continuous",
      workerCount: 2,
    });

    const first = recordContinuousSearchCandidate(db, {
      sessionId: "session-a",
      candidate: { plan: { turns: [] }, passiveIds: [], sublimationIds: [] },
      score: 100,
      valid: true,
      violationCategory: null,
      finalState: null,
      descriptor: { affordances: ["bq-ready"] },
      sourceKind: "checkpoint-top",
      sourceRef: "100",
      attempt: 100,
    });
    const second = recordContinuousSearchCandidate(db, {
      sessionId: "session-a",
      candidate: { plan: { turns: [] }, passiveIds: [], sublimationIds: [] },
      score: 100,
      valid: true,
      violationCategory: null,
      finalState: null,
      descriptor: { affordances: ["bq-ready"] },
      sourceKind: "checkpoint-top",
      sourceRef: "200",
      attempt: 200,
    });

    assert.equal(first, second);
  } finally {
    cleanup();
  }
});

test("promotes high-confidence motif seeds", () => {
  const { db, cleanup } = createTempDatabase();
  try {
    createContinuousSearchSchema(db);
    ensureContinuousSearchSession(db, {
      id: "session-a",
      fingerprint: "fingerprint-a",
      scenarioId: "t3-full",
      setupHash: "setup-a",
      seed: "continuous",
      workerCount: 2,
    });

    recordContinuousSearchMotif(db, {
      sessionId: "session-a",
      motifKey: "rune-setup",
      motif: { actions: ["cycle-elementaire"] },
      supportCount: 12,
      bestScore: 150_000,
      averageScore: 120_000,
      rediscoveryCount: 4,
    });

    promoteContinuousSearchSeeds(db, {
      sessionId: "session-a",
      minConfidence: 0.5,
      maxSeeds: 4,
    });

    const seeds = listContinuousSearchPromotedSeeds(db, "session-a");
    assert.equal(seeds.length, 1);
    assert.equal(seeds[0].sourceKind, "motif");
    assert.equal(seeds[0].score, 150_000);
    assert.ok(seeds[0].confidence >= 0.5);
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
rtk node --test --experimental-strip-types scripts/continuous-search-store.test.ts
```

Expected: FAIL because the candidate/motif/promoted-seed functions do not exist.

- [ ] **Step 3: Implement persistence helpers**

Add exports to `scripts/continuous-search-store.ts`:

```ts
export type RecordContinuousSearchCandidateInput = {
  sessionId: string;
  candidate: unknown;
  score: number;
  valid: boolean;
  violationCategory: string | null;
  finalState: unknown;
  descriptor: unknown;
  sourceKind: string;
  sourceRef: string | null;
  attempt: number;
};

export type RecordContinuousSearchMotifInput = {
  sessionId: string;
  motifKey: string;
  motif: unknown;
  supportCount: number;
  bestScore: number;
  averageScore: number;
  rediscoveryCount: number;
};

export type ContinuousSearchPromotedSeed = {
  id: number;
  sessionId: string;
  sourceKind: string;
  sourceRef: string | null;
  candidate: unknown;
  score: number;
  confidence: number;
  usageCount: number;
};

export function recordContinuousSearchCandidate(
  database: DatabaseSync,
  input: RecordContinuousSearchCandidateInput,
): number {
  const hash = hashContinuousCandidate(input.candidate);
  database.prepare(`
    INSERT INTO continuous_candidate_evaluations (
      session_id, candidate_hash, candidate_json, score, valid, violation_category,
      final_state_json, descriptor_json, source_kind, source_ref, attempt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id, candidate_hash) DO UPDATE SET
      score = MAX(score, excluded.score),
      source_ref = excluded.source_ref,
      attempt = excluded.attempt
  `).run(
    input.sessionId,
    hash,
    JSON.stringify(input.candidate),
    input.score,
    input.valid ? 1 : 0,
    input.violationCategory,
    input.finalState === null ? null : JSON.stringify(input.finalState),
    input.descriptor === null ? null : JSON.stringify(input.descriptor),
    input.sourceKind,
    input.sourceRef,
    input.attempt,
  );
  const row = database.prepare(`
    SELECT id FROM continuous_candidate_evaluations
    WHERE session_id = ? AND candidate_hash = ?
  `).get(input.sessionId, hash) as { id: number };
  return row.id;
}

export function recordContinuousSearchMotif(
  database: DatabaseSync,
  input: RecordContinuousSearchMotifInput,
): void {
  const confidence = calculateMotifConfidence(input);
  database.prepare(`
    INSERT INTO continuous_motifs (
      session_id, motif_key, motif_json, support_count, best_score,
      average_score, rediscovery_count, confidence, promoted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id, motif_key) DO UPDATE SET
      motif_json = excluded.motif_json,
      support_count = excluded.support_count,
      best_score = MAX(continuous_motifs.best_score, excluded.best_score),
      average_score = excluded.average_score,
      rediscovery_count = excluded.rediscovery_count,
      confidence = excluded.confidence,
      promoted = CASE WHEN excluded.confidence >= 0.5 THEN 1 ELSE continuous_motifs.promoted END,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    input.sessionId,
    input.motifKey,
    JSON.stringify(input.motif),
    input.supportCount,
    input.bestScore,
    input.averageScore,
    input.rediscoveryCount,
    confidence,
    confidence >= 0.5 ? 1 : 0,
  );
}

export function promoteContinuousSearchSeeds(
  database: DatabaseSync,
  input: { sessionId: string; minConfidence: number; maxSeeds: number },
): void {
  const motifs = database.prepare(`
    SELECT motif_key, motif_json, best_score, confidence
    FROM continuous_motifs
    WHERE session_id = ? AND confidence >= ?
    ORDER BY confidence DESC, best_score DESC
    LIMIT ?
  `).all(input.sessionId, input.minConfidence, input.maxSeeds) as Record<string, unknown>[];

  for (const motif of motifs) {
    database.prepare(`
      INSERT INTO continuous_promoted_seeds (
        session_id, source_kind, source_ref, candidate_json, score, confidence
      ) VALUES (?, 'motif', ?, ?, ?, ?)
    `).run(
      input.sessionId,
      motif.motif_key,
      String(motif.motif_json),
      Number(motif.best_score),
      Number(motif.confidence),
    );
  }
}

export function listContinuousSearchPromotedSeeds(
  database: DatabaseSync,
  sessionId: string,
): ContinuousSearchPromotedSeed[] {
  const rows = database.prepare(`
    SELECT id, session_id, source_kind, source_ref, candidate_json, score, confidence, usage_count
    FROM continuous_promoted_seeds
    WHERE session_id = ?
    ORDER BY confidence DESC, score DESC, id ASC
  `).all(sessionId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    sessionId: String(row.session_id),
    sourceKind: String(row.source_kind),
    sourceRef: row.source_ref === null ? null : String(row.source_ref),
    candidate: JSON.parse(String(row.candidate_json)),
    score: Number(row.score),
    confidence: Number(row.confidence),
    usageCount: Number(row.usage_count),
  }));
}

function calculateMotifConfidence(input: RecordContinuousSearchMotifInput): number {
  const support = Math.min(1, input.supportCount / 10);
  const rediscovery = Math.min(1, input.rediscoveryCount / 4);
  const score = Math.min(1, input.bestScore / 150_000);
  return Math.round(((support * 0.4) + (rediscovery * 0.3) + (score * 0.3)) * 1000) / 1000;
}
```

- [ ] **Step 4: Run store tests**

Run:

```bash
rtk node --test --experimental-strip-types scripts/continuous-search-store.test.ts
```

Expected: PASS for all store tests.

## Task 3: Wire Store Into Rust/WASM Continuous Search Script

**Files:**
- Modify: `scripts/search-rust-wasm-sqlite.ts`
- Test: `scripts/continuous-search-store.test.ts`

- [ ] **Step 1: Replace inline schema helpers with store imports**

At the top of `scripts/search-rust-wasm-sqlite.ts`, import:

```ts
import {
  createContinuousSearchSchema,
  ensureContinuousSearchSession,
  recordContinuousSearchCandidate,
  recordContinuousSearchCheckpoint,
  recordContinuousSearchMotif,
  promoteContinuousSearchSeeds,
} from "./continuous-search-store.ts";
```

Keep the existing `worker_states` behavior for this slice if a full rename would destabilize resume. The new `continuous_*` tables are additive.

- [ ] **Step 2: Create additive continuous session**

After opening the DB, call:

```ts
createContinuousSearchSchema(db);
const continuousSession = ensureContinuousSearchSession(db, {
  id: sessionId,
  fingerprint,
  scenarioId,
  setupHash: fingerprint,
  seed,
  workerCount,
});
void continuousSession;
```

Leave existing `createSchema`, `ensureSession`, and worker resume helpers in place for compatibility during the first slice.

- [ ] **Step 3: Persist checkpoint top candidates**

After `topCandidates` is computed, add:

```ts
const persistedTopCandidateIds = topCandidates.slice(0, 20).map((candidate, index) =>
  recordContinuousSearchCandidate(db, {
    sessionId,
    candidate,
    score: candidate.score.score,
    valid: true,
    violationCategory: null,
    finalState: null,
    descriptor: {
      passiveCount: candidate.passiveIds.length,
      sublimationCount: candidate.sublimationIds.length,
      actionCount: countActions(candidate),
      checkpointRank: index + 1,
    },
    sourceKind: "checkpoint-top",
    sourceRef: String(totalAttempts),
    attempt: totalAttempts,
  })
);
```

- [ ] **Step 4: Persist continuous checkpoint and simple motifs**

After the existing `insertCheckpoint(db, summary);`, add:

```ts
recordContinuousSearchCheckpoint(db, {
  sessionId,
  totalAttempts,
  score: bestCandidate?.score.score ?? 0,
  validRate: validCandidates / Math.max(1, attempts),
  bestCandidateId: persistedTopCandidateIds[0] ?? null,
  summary,
});

for (const candidate of topCandidates.slice(0, 10)) {
  const motifKey = candidate.plan.turns
    .flatMap((turn) => turn.actions.map((action) => action.spellId))
    .slice(0, 4)
    .join(">");
  if (!motifKey) {
    continue;
  }
  recordContinuousSearchMotif(db, {
    sessionId,
    motifKey,
    motif: {
      spellPrefix: motifKey.split(">"),
      passiveIds: candidate.passiveIds,
      sublimationIds: candidate.sublimationIds.slice(0, 4),
    },
    supportCount: 1,
    bestScore: candidate.score.score,
    averageScore: candidate.score.score,
    rediscoveryCount: 1,
  });
}

promoteContinuousSearchSeeds(db, {
  sessionId,
  minConfidence: 0.5,
  maxSeeds: 8,
});
```

This first motif extraction is deliberately simple. It creates persistent evidence from high-scoring candidates without altering Rust/WASM search behavior yet.

- [ ] **Step 5: Run fast continuous search smoke**

Run:

```bash
rtk pnpm search:rust-wasm -- --session continuous-smoke --scenario t2-a8-p2 --chunk-size 100 --max-rounds 1 --workers 1 --reset
```

Expected: command exits `0`, prints one JSON summary, and writes `.optimizer/rust-wasm-search.sqlite`.

- [ ] **Step 6: Verify DB rows exist**

Run:

```bash
rtk node --experimental-strip-types -e '
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(".optimizer/rust-wasm-search.sqlite");
for (const table of ["continuous_sessions", "continuous_checkpoints", "continuous_candidate_evaluations", "continuous_motifs"]) {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
  console.log(`${table}: ${row.count}`);
}
db.close();
'
```

Expected: each table count is greater than `0`.

## Task 4: Add Continuous UI Domain Model

**Files:**
- Create: `src/ui/continuousOptimizerWorkspace.ts`
- Test: `src/ui/continuousOptimizerWorkspace.test.ts`

- [ ] **Step 1: Write failing UI domain tests**

Create `src/ui/continuousOptimizerWorkspace.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  createContinuousOptimizerPageViewModel,
  createDefaultContinuousOptimizerControls,
  normalizeContinuousOptimizerControls,
} from "./continuousOptimizerWorkspace.ts";

test("normalizes continuous optimizer controls for long running Rust/WASM search", () => {
  const controls = normalizeContinuousOptimizerControls({
    sessionId: " ",
    scenarioId: "t3-full",
    workerCount: 0,
    chunkSize: 0,
    dbPath: "",
  });

  assert.equal(controls.sessionId, "hupper-continuous");
  assert.equal(controls.workerCount, 1);
  assert.equal(controls.chunkSize, 1_000);
  assert.equal(controls.dbPath, ".optimizer/rust-wasm-search.sqlite");
});

test("creates a page view model with best combos and learned evidence separated", () => {
  const view = createContinuousOptimizerPageViewModel({
    controls: createDefaultContinuousOptimizerControls(),
    session: {
      id: "session-a",
      status: "running",
      totalAttempts: 1_000_000,
      validRate: 0.71,
      bestScore: 143_582.03,
      workerCount: 6,
      updatedAt: "2026-06-17T12:00:00.000Z",
    },
    checkpoints: [
      { totalAttempts: 500_000, score: 120_000, validRate: 0.7 },
      { totalAttempts: 1_000_000, score: 143_582.03, validRate: 0.71 },
    ],
    promotedSeeds: [
      { label: "rune-setup", score: 143_000, confidence: 0.82, usageCount: 3 },
    ],
    motifs: [
      { label: "cycle>light", supportCount: 12, confidence: 0.8, bestScore: 143_000, promoted: true },
    ],
  });

  assert.equal(view.statusLabel, "Running");
  assert.equal(view.bestCombos.bestScore, 143_582.03);
  assert.equal(view.bestCombos.checkpoints.length, 2);
  assert.equal(view.learnedEvidence.promotedSeeds[0].label, "rune-setup");
  assert.equal(view.learnedEvidence.motifs[0].promoted, true);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
rtk node --test --experimental-strip-types src/ui/continuousOptimizerWorkspace.test.ts
```

Expected: FAIL because `continuousOptimizerWorkspace.ts` does not exist.

- [ ] **Step 3: Implement UI domain model**

Create `src/ui/continuousOptimizerWorkspace.ts`:

```ts
export type ContinuousOptimizerStatus = "idle" | "running" | "paused" | "stopped" | "error";

export type ContinuousOptimizerControls = {
  sessionId: string;
  scenarioId: "t2-a8-p2" | "t3-a12-p3" | "t3-full";
  workerCount: number;
  chunkSize: number;
  dbPath: string;
};

export type ContinuousOptimizerSessionSummary = {
  id: string;
  status: ContinuousOptimizerStatus;
  totalAttempts: number;
  validRate: number;
  bestScore: number | null;
  workerCount: number;
  updatedAt: string | null;
};

export type ContinuousOptimizerCheckpointSummary = {
  totalAttempts: number;
  score: number;
  validRate: number;
};

export type ContinuousOptimizerPromotedSeedSummary = {
  label: string;
  score: number;
  confidence: number;
  usageCount: number;
};

export type ContinuousOptimizerMotifSummary = {
  label: string;
  supportCount: number;
  confidence: number;
  bestScore: number;
  promoted: boolean;
};

export type ContinuousOptimizerPageInput = {
  controls: ContinuousOptimizerControls;
  session: ContinuousOptimizerSessionSummary | null;
  checkpoints: ContinuousOptimizerCheckpointSummary[];
  promotedSeeds: ContinuousOptimizerPromotedSeedSummary[];
  motifs: ContinuousOptimizerMotifSummary[];
};

export type ContinuousOptimizerPageViewModel = {
  controls: ContinuousOptimizerControls;
  statusLabel: string;
  operations: {
    canStart: boolean;
    canPause: boolean;
    canResume: boolean;
  };
  bestCombos: {
    bestScore: number | null;
    totalAttempts: number;
    validRate: number;
    checkpoints: ContinuousOptimizerCheckpointSummary[];
  };
  learnedEvidence: {
    promotedSeeds: ContinuousOptimizerPromotedSeedSummary[];
    motifs: ContinuousOptimizerMotifSummary[];
  };
};

export function createDefaultContinuousOptimizerControls(): ContinuousOptimizerControls {
  return {
    sessionId: "hupper-continuous",
    scenarioId: "t3-full",
    workerCount: 6,
    chunkSize: 100_000,
    dbPath: ".optimizer/rust-wasm-search.sqlite",
  };
}

export function normalizeContinuousOptimizerControls(
  controls: Partial<ContinuousOptimizerControls>,
): ContinuousOptimizerControls {
  const defaults = createDefaultContinuousOptimizerControls();
  return {
    sessionId: normalizeSessionId(controls.sessionId ?? defaults.sessionId),
    scenarioId: controls.scenarioId ?? defaults.scenarioId,
    workerCount: clampInteger(controls.workerCount ?? defaults.workerCount, 1, 32),
    chunkSize: clampInteger(controls.chunkSize ?? defaults.chunkSize, 1_000, 10_000_000),
    dbPath: (controls.dbPath ?? defaults.dbPath).trim() || defaults.dbPath,
  };
}

export function createContinuousOptimizerPageViewModel(
  input: ContinuousOptimizerPageInput,
): ContinuousOptimizerPageViewModel {
  const controls = normalizeContinuousOptimizerControls(input.controls);
  const status = input.session?.status ?? "idle";
  return {
    controls,
    statusLabel: formatContinuousOptimizerStatus(status),
    operations: {
      canStart: status === "idle" || status === "stopped" || status === "error",
      canPause: status === "running",
      canResume: status === "paused" || status === "stopped",
    },
    bestCombos: {
      bestScore: input.session?.bestScore ?? null,
      totalAttempts: input.session?.totalAttempts ?? 0,
      validRate: input.session?.validRate ?? 0,
      checkpoints: input.checkpoints.slice().sort((left, right) => left.totalAttempts - right.totalAttempts),
    },
    learnedEvidence: {
      promotedSeeds: input.promotedSeeds.slice().sort((left, right) => right.confidence - left.confidence || right.score - left.score),
      motifs: input.motifs.slice().sort((left, right) => Number(right.promoted) - Number(left.promoted) || right.confidence - left.confidence),
    },
  };
}

function normalizeSessionId(value: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "hupper-continuous";
}

function formatContinuousOptimizerStatus(status: ContinuousOptimizerStatus): string {
  return status[0].toUpperCase() + status.slice(1);
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}
```

- [ ] **Step 4: Run UI domain tests**

Run:

```bash
rtk node --test --experimental-strip-types src/ui/continuousOptimizerWorkspace.test.ts
```

Expected: PASS.

## Task 5: Add Dedicated Continuous Route Shape

**Files:**
- Modify: `src/ui/researchNavigation.ts`
- Modify: `src/ui/researchWorkspace.test.ts`

- [ ] **Step 1: Add failing navigation test**

In `src/ui/researchWorkspace.test.ts` or the closest navigation test file, add:

```ts
import { openContinuousOptimizer } from "./researchNavigation.ts";

test("navigates to the dedicated continuous optimizer page", () => {
  const route = openContinuousOptimizer({ page: "workspace" });
  assert.equal(route.page, "continuous-optimizer");
});
```

- [ ] **Step 2: Run the targeted test**

Run:

```bash
rtk node --test --experimental-strip-types src/ui/researchWorkspace.test.ts
```

Expected: FAIL because `openContinuousOptimizer` and the route page are missing.

- [ ] **Step 3: Implement route type and helper**

Modify `src/ui/researchNavigation.ts` route union to include:

```ts
| { page: "continuous-optimizer"; returnTo?: ResearchRoute }
```

Add helper:

```ts
export function openContinuousOptimizer(route: ResearchRoute): ResearchRoute {
  return { page: "continuous-optimizer", returnTo: route };
}
```

- [ ] **Step 4: Run navigation/workspace tests**

Run:

```bash
rtk node --test --experimental-strip-types src/ui/researchWorkspace.test.ts
```

Expected: PASS.

## Task 6: Full Verification

**Files:**
- All touched files

- [ ] **Step 1: Run focused tests**

Run:

```bash
rtk node --test --experimental-strip-types scripts/continuous-search-store.test.ts src/ui/continuousOptimizerWorkspace.test.ts src/ui/researchWorkspace.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run project tests**

Run:

```bash
rtk pnpm test
```

Expected: PASS.

- [ ] **Step 3: Run continuous search smoke**

Run:

```bash
rtk pnpm search:rust-wasm -- --session continuous-smoke --scenario t2-a8-p2 --chunk-size 100 --max-rounds 1 --workers 1 --reset
```

Expected: exits `0` and writes continuous corpus rows.

- [ ] **Step 4: Run build**

Run:

```bash
rtk pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

Stage only files touched by this plan:

```bash
rtk git add scripts/continuous-search-store.ts scripts/continuous-search-store.test.ts scripts/search-rust-wasm-sqlite.ts src/ui/continuousOptimizerWorkspace.ts src/ui/continuousOptimizerWorkspace.test.ts src/ui/researchNavigation.ts src/ui/researchWorkspace.test.ts docs/superpowers/plans/2026-06-17-continuous-rust-wasm-learning.md
rtk git commit -m "feat: add continuous optimizer learning corpus"
```

Expected: commit succeeds. Do not stage unrelated dirty files unless they were intentionally modified by this plan.

## Coverage Review

- Persistent Rust/WASM corpus: Tasks 1-3.
- Candidate/checkpoint/motif/promoted-seed storage: Tasks 1-3.
- Evidence and combo separation for UI: Task 4.
- Dedicated `Continuous` route shape: Task 5.
- Long-running worker lifecycle management from browser: deferred; CLI remains the orchestrator in this slice.
- Neural guidance: explicitly deferred.
