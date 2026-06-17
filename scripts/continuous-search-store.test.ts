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
  listContinuousSearchPromotedSeeds,
  promoteContinuousSearchSeeds,
  recordContinuousSearchCandidate,
  recordContinuousSearchCheckpoint,
  recordContinuousSearchMotif,
  resetContinuousSearchSession,
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
      () =>
        ensureContinuousSearchSession(db, {
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

test("resets continuous session corpus rows", () => {
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
    recordContinuousSearchCheckpoint(db, {
      sessionId: "session-a",
      totalAttempts: 100,
      score: 42,
      validRate: 0.5,
      bestCandidateId: null,
      summary: { totalAttempts: 100, score: 42 },
    });

    resetContinuousSearchSession(db, "session-a");

    const rows = db.prepare("SELECT COUNT(*) AS count FROM continuous_sessions WHERE id = ?").get("session-a") as { count: number };
    assert.equal(rows.count, 0);
    assert.equal(listContinuousSearchCheckpoints(db, "session-a").length, 0);
  } finally {
    cleanup();
  }
});
