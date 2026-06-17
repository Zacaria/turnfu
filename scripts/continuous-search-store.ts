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

export type PromoteContinuousSearchCandidateSeedsInput = {
  sessionId: string;
  minScore: number;
  maxSeeds: number;
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

    CREATE UNIQUE INDEX IF NOT EXISTS continuous_promoted_seeds_source_unique
    ON continuous_promoted_seeds (session_id, source_kind, source_ref);
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

export function resetContinuousSearchSession(database: DatabaseSync, id: string): void {
  database.prepare("DELETE FROM continuous_promoted_seeds WHERE session_id = ?").run(id);
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

export function promoteContinuousSearchCandidateSeeds(
  database: DatabaseSync,
  input: PromoteContinuousSearchCandidateSeedsInput,
): number {
  const candidates = database.prepare(`
    SELECT id, candidate_json, score
    FROM continuous_candidate_evaluations
    WHERE session_id = ? AND valid = 1 AND score >= ?
    ORDER BY score DESC, attempt DESC, id ASC
    LIMIT ?
  `).all(input.sessionId, input.minScore, input.maxSeeds) as Record<string, unknown>[];

  let promoted = 0;
  for (const candidate of candidates) {
    const result = database.prepare(`
      INSERT OR IGNORE INTO continuous_promoted_seeds (
        session_id, source_kind, source_ref, candidate_json, score, confidence
      ) VALUES (?, 'candidate', ?, ?, ?, ?)
    `).run(
      input.sessionId,
      String(candidate.id),
      String(candidate.candidate_json),
      Number(candidate.score),
      calculateCandidateSeedConfidence(Number(candidate.score)),
    );
    promoted += Number(result.changes ?? 0);
  }
  return promoted;
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

export function listContinuousSearchPromotedCandidateSeeds(
  database: DatabaseSync,
  sessionId: string,
  limit: number,
): ContinuousSearchPromotedSeed[] {
  const rows = database.prepare(`
    SELECT id, session_id, source_kind, source_ref, candidate_json, score, confidence, usage_count
    FROM continuous_promoted_seeds
    WHERE session_id = ? AND source_kind = 'candidate'
    ORDER BY usage_count ASC, confidence DESC, score DESC, id ASC
    LIMIT ?
  `).all(sessionId, limit) as Record<string, unknown>[];
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

export function markContinuousSearchPromotedSeedsUsed(
  database: DatabaseSync,
  ids: number[],
): void {
  const uniqueIds = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  if (uniqueIds.length === 0) {
    return;
  }
  const statement = database.prepare(`
    UPDATE continuous_promoted_seeds
    SET usage_count = usage_count + 1,
        last_used_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  for (const id of uniqueIds) {
    statement.run(id);
  }
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

function calculateCandidateSeedConfidence(score: number): number {
  return Math.round(Math.min(1, Math.max(0, score / 150_000)) * 1000) / 1000;
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
