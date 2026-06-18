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
  listContinuousSearchCandidateEvidence,
  listContinuousSearchMotifEvidence,
  listContinuousSearchReuseStrategyEvidence,
  listContinuousSearchReuseTrials,
  recordContinuousSearchCandidate,
  recordContinuousSearchCheckpoint,
  recordContinuousSearchMotif,
  recordContinuousSearchReuseTrial,
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

test("records high-confidence motifs without materialized promoted seeds", () => {
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

    const promotedTable = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = 'continuous_promoted_seeds'
    `).get();
    assert.equal(promotedTable, undefined);
  } finally {
    cleanup();
  }
});

test("lists motif evidence by best score then confidence", () => {
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
      motifKey: "low",
      motif: { spellPrefix: ["low"] },
      supportCount: 10,
      bestScore: 100_000,
      averageScore: 99_000,
      rediscoveryCount: 4,
    });
    recordContinuousSearchMotif(db, {
      sessionId: "session-a",
      motifKey: "high",
      motif: { spellPrefix: ["high"], passiveIds: ["passive-a"], sublimationIds: ["sublimation-a"] },
      supportCount: 2,
      bestScore: 150_000,
      averageScore: 125_000,
      rediscoveryCount: 1,
    });

    const motifs = listContinuousSearchMotifEvidence(db, "session-a", 8);

    assert.deepEqual(motifs.map((motif) => motif.motifKey), ["high", "low"]);
    assert.deepEqual(motifs[0].motif, {
      spellPrefix: ["high"],
      passiveIds: ["passive-a"],
      sublimationIds: ["sublimation-a"],
    });
    assert.equal(motifs[0].bestScore, 150_000);
    assert.equal(motifs[0].confidence > 0, true);
  } finally {
    cleanup();
  }
});

test("lists candidate evidence and records reuse trials without exact seed promotion", () => {
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

    const candidate = {
      id: "candidate:one",
      passiveIds: ["passive-a"],
      sublimationIds: [],
      plan: { turns: [{ actions: [{ spellId: "hit" }] }] },
      score: { score: 120_000 },
    };
    recordContinuousSearchCandidate(db, {
      sessionId: "session-a",
      candidate,
      score: 120_000,
      valid: true,
      violationCategory: null,
      finalState: null,
      descriptor: { checkpointRank: 1 },
      sourceKind: "checkpoint-top",
      sourceRef: "100",
      attempt: 100,
    });

    const evidence = listContinuousSearchCandidateEvidence(db, "session-a", 4);
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].score, 120_000);
    assert.deepEqual(evidence[0].candidate, candidate);

    const trialCandidate = {
      passiveIds: candidate.passiveIds,
      sublimationIds: candidate.sublimationIds,
      plan: { turns: [{ actions: [{ spellId: "hit" }] }] },
    };
    const trialId = recordContinuousSearchReuseTrial(db, {
      sessionId: "session-a",
      sourceCandidateId: evidence[0].id,
      strategy: "rotate-turn-actions",
      candidate: trialCandidate,
      sourceScore: evidence[0].score,
      attempt: 200,
      resultScore: 121_000,
      improvedGlobalBest: true,
    });
    const duplicateTrialId = recordContinuousSearchReuseTrial(db, {
      sessionId: "session-a",
      sourceCandidateId: evidence[0].id,
      strategy: "rotate-turn-actions",
      candidate: trialCandidate,
      sourceScore: evidence[0].score,
      attempt: 300,
      resultScore: 122_000,
      improvedGlobalBest: true,
    });

    assert.equal(duplicateTrialId, trialId);
    const trials = listContinuousSearchReuseTrials(db, "session-a", 4);
    assert.equal(trials.length, 1);
    assert.equal(trials[0].strategy, "rotate-turn-actions");
    assert.equal(trials[0].sourceCandidateId, evidence[0].id);
    assert.equal(trials[0].sourceScore, 120_000);
    assert.equal(trials[0].resultScore, 122_000);
    assert.equal(trials[0].improvedGlobalBest, true);
  } finally {
    cleanup();
  }
});

test("aggregates reuse trial strategy evidence", () => {
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

    recordContinuousSearchReuseTrial(db, {
      sessionId: "session-a",
      sourceCandidateId: null,
      strategy: "move-last-action-earlier",
      candidate: { passiveIds: [], sublimationIds: [], plan: { turns: [{ actions: [{ spellId: "a" }] }] } },
      sourceScore: 100_000,
      attempt: 100,
      resultScore: 90_000,
      improvedGlobalBest: false,
    });
    recordContinuousSearchReuseTrial(db, {
      sessionId: "session-a",
      sourceCandidateId: null,
      strategy: "move-last-action-earlier",
      candidate: { passiveIds: [], sublimationIds: [], plan: { turns: [{ actions: [{ spellId: "b" }] }] } },
      sourceScore: 100_000,
      attempt: 200,
      resultScore: 110_000,
      improvedGlobalBest: true,
    });
    recordContinuousSearchReuseTrial(db, {
      sessionId: "session-a",
      sourceCandidateId: null,
      strategy: "rotate-turn-actions",
      candidate: { passiveIds: [], sublimationIds: [], plan: { turns: [{ actions: [{ spellId: "c" }] }] } },
      sourceScore: 100_000,
      attempt: 300,
      resultScore: null,
      improvedGlobalBest: false,
    });

    const evidence = listContinuousSearchReuseStrategyEvidence(db, "session-a");

    assert.deepEqual(evidence.map((row) => row.strategy), ["move-last-action-earlier", "rotate-turn-actions"]);
    assert.equal(evidence[0].trials, 2);
    assert.equal(evidence[0].evaluatedTrials, 2);
    assert.equal(evidence[0].positiveScoreDeltaTrials, 1);
    assert.equal(evidence[0].negativeScoreDeltaTrials, 1);
    assert.equal(evidence[0].globalBestTrials, 1);
    assert.equal(evidence[0].averageScoreDelta, 0);
    assert.equal(evidence[0].bestScoreDelta, 10_000);
    assert.equal(evidence[1].unscoredTrials, 1);
    assert.equal(evidence[1].averageScoreDelta, null);
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
