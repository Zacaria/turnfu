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
      promotedSeeds: input.promotedSeeds.slice().sort((left, right) => {
        return right.confidence - left.confidence || right.score - left.score;
      }),
      motifs: input.motifs.slice().sort((left, right) => {
        return Number(right.promoted) - Number(left.promoted) || right.confidence - left.confidence;
      }),
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
