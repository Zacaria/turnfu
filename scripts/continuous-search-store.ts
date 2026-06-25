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
  compatibleFingerprints?: string[];
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

export type UpdateContinuousSearchSessionProgressInput = {
  sessionId: string;
  totalAttempts: number;
  validCandidates: number;
  invalidCandidates: number;
  bestScore: number | null;
  bestCandidateId: number | null;
  summary: unknown;
};

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

export type ContinuousSearchMotifEvidence = {
  id: number;
  sessionId: string;
  motifKey: string;
  motif: unknown;
  supportCount: number;
  bestScore: number;
  averageScore: number;
  rediscoveryCount: number;
  confidence: number;
};

export type ContinuousSearchCandidateEvidence = {
  id: number;
  sessionId: string;
  candidate: unknown;
  score: number;
  attempt: number;
};

export type RecordContinuousSearchReuseTrialInput = {
  sessionId: string;
  sourceCandidateId: number | null;
  strategy: string;
  candidate: unknown;
  sourceScore: number | null;
  attempt: number;
  resultScore?: number | null;
  improvedGlobalBest?: boolean;
};

export type ContinuousSearchReuseTrial = {
  id: number;
  sessionId: string;
  sourceCandidateId: number | null;
  strategy: string;
  candidate: unknown;
  sourceScore: number | null;
  attempt: number;
  resultScore: number | null;
  improvedGlobalBest: boolean;
  createdAt: string;
};

export type ContinuousSearchReuseStrategyEvidence = {
  strategy: string;
  trials: number;
  evaluatedTrials: number;
  unscoredTrials: number;
  positiveScoreDeltaTrials: number;
  negativeScoreDeltaTrials: number;
  globalBestTrials: number;
  averageScoreDelta: number | null;
  bestScoreDelta: number | null;
  latestAttempt: number;
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

    CREATE TABLE IF NOT EXISTS continuous_reuse_trials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      source_candidate_id INTEGER,
      strategy TEXT NOT NULL,
      candidate_hash TEXT NOT NULL,
      candidate_json TEXT NOT NULL,
      source_score REAL,
      attempt INTEGER NOT NULL,
      result_score REAL,
      improved_global_best INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, strategy, candidate_hash)
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
    const compatibleFingerprints = new Set([input.fingerprint, ...(input.compatibleFingerprints ?? [])]);
    if (!compatibleFingerprints.has(String(row.fingerprint))) {
      throw new Error(`Session '${input.id}' fingerprint mismatch. Use --reset to discard persisted search state.`);
    }
    if (row.fingerprint !== input.fingerprint) {
      database.prepare(`
        UPDATE continuous_sessions
        SET fingerprint = ?, setup_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(input.fingerprint, input.setupHash, input.id);
    }
    return mapSessionRow(row);
  }

  database.prepare(`
    INSERT INTO continuous_sessions (id, fingerprint, scenario_id, setup_hash, seed, worker_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(input.id, input.fingerprint, input.scenarioId, input.setupHash, input.seed, input.workerCount);

  return ensureContinuousSearchSession(database, input);
}

export function resetContinuousSearchSession(database: DatabaseSync, id: string): void {
  database.prepare("DELETE FROM continuous_reuse_trials WHERE session_id = ?").run(id);
  database.prepare("DELETE FROM continuous_boundary_samples WHERE session_id = ?").run(id);
  database.prepare("DELETE FROM continuous_motifs WHERE session_id = ?").run(id);
  database.prepare("DELETE FROM continuous_checkpoints WHERE session_id = ?").run(id);
  database.prepare("DELETE FROM continuous_candidate_evaluations WHERE session_id = ?").run(id);
  database.prepare("DELETE FROM continuous_worker_states WHERE session_id = ?").run(id);
  database.prepare("DELETE FROM continuous_sessions WHERE id = ?").run(id);
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

export function updateContinuousSearchSessionProgress(
  database: DatabaseSync,
  input: UpdateContinuousSearchSessionProgressInput,
): void {
  database.prepare(`
    UPDATE continuous_sessions
    SET total_attempts = ?,
        valid_candidates = ?,
        invalid_candidates = ?,
        best_score = ?,
        best_candidate_id = ?,
        last_summary_json = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    input.totalAttempts,
    input.validCandidates,
    input.invalidCandidates,
    input.bestScore,
    input.bestCandidateId,
    JSON.stringify(input.summary),
    input.sessionId,
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
      average_score, rediscovery_count, confidence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id, motif_key) DO UPDATE SET
      motif_json = excluded.motif_json,
      support_count = excluded.support_count,
      best_score = MAX(continuous_motifs.best_score, excluded.best_score),
      average_score = excluded.average_score,
      rediscovery_count = excluded.rediscovery_count,
      confidence = excluded.confidence,
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
  );
}

export function listContinuousSearchCandidateEvidence(
  database: DatabaseSync,
  sessionId: string,
  limit: number,
): ContinuousSearchCandidateEvidence[] {
  const rows = database.prepare(`
    SELECT id, session_id, candidate_json, score, attempt
    FROM continuous_candidate_evaluations
    WHERE session_id = ? AND valid = 1
    ORDER BY score DESC, attempt DESC, id ASC
    LIMIT ?
  `).all(sessionId, limit) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    sessionId: String(row.session_id),
    candidate: JSON.parse(String(row.candidate_json)),
    score: Number(row.score),
    attempt: Number(row.attempt),
  }));
}

export function listContinuousSearchMotifEvidence(
  database: DatabaseSync,
  sessionId: string,
  limit: number,
): ContinuousSearchMotifEvidence[] {
  const rows = database.prepare(`
    SELECT id, session_id, motif_key, motif_json, support_count, best_score,
           average_score, rediscovery_count, confidence
    FROM continuous_motifs
    WHERE session_id = ?
    ORDER BY best_score DESC, confidence DESC, support_count DESC, id ASC
    LIMIT ?
  `).all(sessionId, limit) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    sessionId: String(row.session_id),
    motifKey: String(row.motif_key),
    motif: JSON.parse(String(row.motif_json)),
    supportCount: Number(row.support_count),
    bestScore: Number(row.best_score),
    averageScore: Number(row.average_score),
    rediscoveryCount: Number(row.rediscovery_count),
    confidence: Number(row.confidence),
  }));
}

export function recordContinuousSearchReuseTrial(
  database: DatabaseSync,
  input: RecordContinuousSearchReuseTrialInput,
): number {
  const hash = hashContinuousCandidate(input.candidate);
  database.prepare(`
    INSERT INTO continuous_reuse_trials (
      session_id, source_candidate_id, strategy, candidate_hash, candidate_json,
      source_score, attempt, result_score, improved_global_best
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id, strategy, candidate_hash) DO UPDATE SET
      source_candidate_id = excluded.source_candidate_id,
      source_score = excluded.source_score,
      attempt = excluded.attempt,
      result_score = CASE
        WHEN excluded.result_score IS NULL THEN continuous_reuse_trials.result_score
        WHEN continuous_reuse_trials.result_score IS NULL THEN excluded.result_score
        ELSE MAX(continuous_reuse_trials.result_score, excluded.result_score)
      END,
      improved_global_best = CASE
        WHEN excluded.improved_global_best = 1 THEN 1
        ELSE continuous_reuse_trials.improved_global_best
      END
  `).run(
    input.sessionId,
    input.sourceCandidateId,
    input.strategy,
    hash,
    JSON.stringify(input.candidate),
    input.sourceScore,
    input.attempt,
    input.resultScore ?? null,
    input.improvedGlobalBest ? 1 : 0,
  );
  const row = database.prepare(`
    SELECT id FROM continuous_reuse_trials
    WHERE session_id = ? AND strategy = ? AND candidate_hash = ?
  `).get(input.sessionId, input.strategy, hash) as { id: number };
  return row.id;
}

export function listContinuousSearchReuseTrials(
  database: DatabaseSync,
  sessionId: string,
  limit: number,
): ContinuousSearchReuseTrial[] {
  const rows = database.prepare(`
    SELECT id, session_id, source_candidate_id, strategy, candidate_json, source_score,
           attempt, result_score, improved_global_best, created_at
    FROM continuous_reuse_trials
    WHERE session_id = ?
    ORDER BY improved_global_best DESC, result_score DESC, attempt DESC, id ASC
    LIMIT ?
  `).all(sessionId, limit) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    sessionId: String(row.session_id),
    sourceCandidateId: row.source_candidate_id === null ? null : Number(row.source_candidate_id),
    strategy: String(row.strategy),
    candidate: JSON.parse(String(row.candidate_json)),
    sourceScore: row.source_score === null ? null : Number(row.source_score),
    attempt: Number(row.attempt),
    resultScore: row.result_score === null ? null : Number(row.result_score),
    improvedGlobalBest: Number(row.improved_global_best) === 1,
    createdAt: String(row.created_at),
  }));
}

export function listContinuousSearchReuseStrategyEvidence(
  database: DatabaseSync,
  sessionId: string,
): ContinuousSearchReuseStrategyEvidence[] {
  const rows = database.prepare(`
    SELECT
      strategy,
      COUNT(*) AS trials,
      SUM(CASE WHEN result_score IS NOT NULL THEN 1 ELSE 0 END) AS evaluated_trials,
      SUM(CASE WHEN result_score IS NULL THEN 1 ELSE 0 END) AS unscored_trials,
      SUM(CASE
        WHEN result_score IS NOT NULL
         AND source_score IS NOT NULL
         AND result_score > source_score THEN 1
        ELSE 0
      END) AS positive_score_delta_trials,
      SUM(CASE
        WHEN result_score IS NOT NULL
         AND source_score IS NOT NULL
         AND result_score < source_score THEN 1
        ELSE 0
      END) AS negative_score_delta_trials,
      SUM(CASE WHEN improved_global_best = 1 THEN 1 ELSE 0 END) AS global_best_trials,
      AVG(CASE
        WHEN result_score IS NOT NULL AND source_score IS NOT NULL
        THEN result_score - source_score
        ELSE NULL
      END) AS average_score_delta,
      MAX(CASE
        WHEN result_score IS NOT NULL AND source_score IS NOT NULL
        THEN result_score - source_score
        ELSE NULL
      END) AS best_score_delta,
      MAX(attempt) AS latest_attempt
    FROM continuous_reuse_trials
    WHERE session_id = ?
    GROUP BY strategy
    ORDER BY global_best_trials DESC, average_score_delta DESC, latest_attempt DESC, strategy ASC
  `).all(sessionId) as Record<string, unknown>[];
  return rows.map((row) => ({
    strategy: String(row.strategy),
    trials: Number(row.trials),
    evaluatedTrials: Number(row.evaluated_trials),
    unscoredTrials: Number(row.unscored_trials),
    positiveScoreDeltaTrials: Number(row.positive_score_delta_trials),
    negativeScoreDeltaTrials: Number(row.negative_score_delta_trials),
    globalBestTrials: Number(row.global_best_trials),
    averageScoreDelta: row.average_score_delta === null ? null : Number(row.average_score_delta),
    bestScoreDelta: row.best_score_delta === null ? null : Number(row.best_score_delta),
    latestAttempt: Number(row.latest_attempt),
  }));
}

export function hashContinuousCandidate(candidate: unknown): string {
  return createHash("sha256").update(JSON.stringify(candidate)).digest("hex");
}

function calculateMotifConfidence(input: RecordContinuousSearchMotifInput): number {
  const support = Math.min(1, input.supportCount / 10);
  const rediscovery = Math.min(1, input.rediscoveryCount / 4);
  const score = Math.min(1, input.bestScore / 150_000);
  return Math.round(((support * 0.4) + (rediscovery * 0.3) + (score * 0.3)) * 1000) / 1000;
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
