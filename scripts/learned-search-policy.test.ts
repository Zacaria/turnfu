import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  createContinuousSearchSchema,
  ensureContinuousSearchSession,
  recordContinuousSearchCandidate,
  recordContinuousSearchCheckpoint,
  recordContinuousSearchMotif,
  recordContinuousSearchReuseTrial,
} from "./continuous-search-store.ts";
import {
  evaluateLearnedPolicyDataset,
  exportLearnedPolicyDataset,
  parseLearnedPolicyDataset,
  serializeLearnedPolicyDataset,
} from "./learned-search-policy.ts";

function createTempDatabase(): { db: DatabaseSync; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "learned-search-policy-"));
  const db = new DatabaseSync(join(dir, "search.sqlite"));
  return {
    db,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("exports continuous evidence rows with labels and deterministic splits", () => {
  const { db, cleanup } = createTempDatabase();
  try {
    seedPolicyCorpus(db);

    const rows = exportLearnedPolicyDataset(db, { splitKey: "seed", testModulo: 2, testRemainder: 0 });
    const reparsed = parseLearnedPolicyDataset(serializeLearnedPolicyDataset(rows));

    assert.deepEqual(reparsed, rows);
    assert.deepEqual(
      [...new Set(rows.map((row) => row.kind))].sort(),
      ["boundary", "candidate", "checkpoint", "motif", "reuseTrial"],
    );
    assert.equal(new Set(rows.map((row) => `${row.groupKey}:${row.split}`)).size, 1);

    const positiveTrial = rows.find((row) => row.kind === "reuseTrial" && row.strategy === "good-edit");
    assert.ok(positiveTrial);
    assert.equal(positiveTrial.labels.valid, true);
    assert.equal(positiveTrial.labels.scoreDelta, 5_000);
    assert.equal(positiveTrial.labels.useful, true);

    const invalidCandidate = rows.find((row) => row.kind === "candidate" && row.labels.valid === false);
    assert.ok(invalidCandidate);
    assert.equal(invalidCandidate.labels.violationCategory, "resourceDebt");
  } finally {
    cleanup();
  }
});

test("evaluates strategy ranking lift over handcrafted ordering", () => {
  const rows = [
    createReuseTrialRow("train-good", "good-edit", "train", 2, 100_000, 110_000),
    createReuseTrialRow("train-bad", "bad-edit", "train", 1, 100_000, 80_000),
    createReuseTrialRow("test-good", "good-edit", "test", 2, 100_000, 106_000),
    createReuseTrialRow("test-bad", "bad-edit", "test", 1, 100_000, 75_000),
  ];

  const summary = evaluateLearnedPolicyDataset(rows, { topK: 1 });

  assert.equal(summary.proposalRows, 4);
  assert.equal(summary.handcrafted.topKAverageScoreDelta, -25_000);
  assert.equal(summary.strategyBaseline.topKAverageScoreDelta, 6_000);
  assert.equal(summary.lift.topKAverageScoreDelta, 31_000);
  assert.equal(summary.strategyBaseline.usefulRate, 1);
});

function seedPolicyCorpus(db: DatabaseSync): void {
  createContinuousSearchSchema(db);
  ensureContinuousSearchSession(db, {
    id: "session-a",
    fingerprint: "fingerprint-a",
    scenarioId: "t3-full",
    setupHash: "setup-a",
    seed: "policy-seed",
    workerCount: 2,
  });
  const sourceCandidateId = recordContinuousSearchCandidate(db, {
    sessionId: "session-a",
    candidate: createCandidate(["hit-a", "hit-b"]),
    score: 100_000,
    valid: true,
    violationCategory: null,
    finalState: null,
    descriptor: { affordances: ["bq-ready"] },
    sourceKind: "checkpoint-top",
    sourceRef: "100",
    attempt: 100,
  });
  recordContinuousSearchCandidate(db, {
    sessionId: "session-a",
    candidate: createCandidate(["too-expensive"]),
    score: 0,
    valid: false,
    violationCategory: "resourceDebt",
    finalState: null,
    descriptor: { violation: { category: "resourceDebt" } },
    sourceKind: "boundary",
    sourceRef: "100",
    attempt: 101,
  });
  recordContinuousSearchReuseTrial(db, {
    sessionId: "session-a",
    sourceCandidateId,
    strategy: "good-edit",
    candidate: createCandidate(["hit-b", "hit-a"]),
    sourceScore: 100_000,
    attempt: 200,
    resultScore: 105_000,
    improvedGlobalBest: true,
  });
  recordContinuousSearchCheckpoint(db, {
    sessionId: "session-a",
    totalAttempts: 200,
    score: 105_000,
    validRate: 0.5,
    bestCandidateId: sourceCandidateId,
    summary: { totalAttempts: 200, score: 105_000 },
  });
  recordContinuousSearchMotif(db, {
    sessionId: "session-a",
    motifKey: "hit-a>hit-b",
    motif: { spellPrefix: ["hit-a", "hit-b"], passiveIds: ["passive-a"], sublimationIds: [] },
    supportCount: 8,
    bestScore: 105_000,
    averageScore: 100_000,
    rediscoveryCount: 3,
  });
  db.prepare(`
    INSERT INTO continuous_boundary_samples (
      session_id, candidate_id, violation_category, repair_attempted,
      repair_succeeded, repaired_candidate_id
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run("session-a", sourceCandidateId, "resourceDebt", 1, 1, sourceCandidateId);
}

function createCandidate(spellIds: string[]): unknown {
  return {
    passiveIds: ["passive-a"],
    sublimationIds: [],
    plan: {
      turns: [{ actions: spellIds.map((spellId) => ({ spellId })) }],
    },
  };
}

function createReuseTrialRow(
  id: string,
  strategy: string,
  split: "train" | "test",
  handcraftedOrder: number,
  sourceScore: number,
  resultScore: number,
) {
  return {
    id,
    kind: "reuseTrial" as const,
    split,
    groupKey: split,
    sessionId: `${split}-session`,
    scenarioId: "t3-full",
    setupHash: "setup",
    seed: split,
    attempt: 1,
    sourceKind: "reuse-trial",
    sourceRef: strategy,
    sourceCandidateId: 1,
    strategy,
    handcraftedOrder,
    features: null,
    labels: {
      valid: true,
      resultScore,
      sourceScore,
      scoreDelta: resultScore - sourceScore,
      improvedGlobalBest: false,
      useful: resultScore > sourceScore,
      violationCategory: null,
    },
  };
}
