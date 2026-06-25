export type ContinuousOptimizerStatus = "idle" | "running" | "paused" | "stopped" | "error";
export type ContinuousOptimizerQualityPreset = "validated-contextual" | "manual";
export type ContinuousOptimizerScoreCriterion = "total-damage" | "element-damage";
export type ContinuousOptimizerTargetElement = "fire" | "water" | "earth" | "air";

export type ContinuousOptimizerControls = {
  sessionId: string;
  scenarioId: "t1-full" | "t2-full" | "t3-full";
  workerCount: number;
  chunkSize: number;
  dbPath: string;
  qualityPreset: ContinuousOptimizerQualityPreset;
  scoreCriterion: ContinuousOptimizerScoreCriterion;
  targetElement: ContinuousOptimizerTargetElement;
  requireSustainableCycle: boolean;
  maxRounds?: number;
};

export type ContinuousOptimizerSessionSummary = {
  id: string;
  status: ContinuousOptimizerStatus;
  totalAttempts: number;
  admittedIndividuals: number;
  discardedProposals: number;
  fabricationAttempts: number;
  bestScore: number | null;
  workerCount: number;
  updatedAt: string | null;
};

export type ContinuousOptimizerCheckpointSummary = {
  totalAttempts: number;
  score: number;
  admittedIndividuals: number;
  discardedProposals: number;
  fabricationAttempts: number;
};

export type ContinuousOptimizerReuseTrialSummary = {
  label: string;
  sourceScore: number | null;
  resultScore: number | null;
  improvedGlobalBest: boolean;
};

export type ContinuousOptimizerMotifSummary = {
  label: string;
  supportCount: number;
  confidence: number;
  bestScore: number;
};

export type ContinuousOptimizerRunProgress = {
  totalAttempts: number;
  score: number;
  admittedIndividuals?: number;
  discardedProposals?: number;
  fabricationAttempts?: number;
  projectionRepairs?: number;
  factoryExhaustions?: number;
  validCandidates?: number;
  invalidCandidates?: number;
  validRate?: number;
  attemptsPerSecond?: number;
};

export type ContinuousOptimizerPageInput = {
  controls: ContinuousOptimizerControls;
  session: ContinuousOptimizerSessionSummary | null;
  checkpoints: ContinuousOptimizerCheckpointSummary[];
  reuseTrials: ContinuousOptimizerReuseTrialSummary[];
  motifs: ContinuousOptimizerMotifSummary[];
};

export type ContinuousOptimizerPageViewModel = {
  controls: ContinuousOptimizerControls;
  statusLabel: string;
  qualityPresetLabel: string;
  launchArgs: string[];
  operations: {
    canStart: boolean;
    canPause: boolean;
    canResume: boolean;
  };
  bestCombos: {
    bestScore: number | null;
    totalAttempts: number;
    admittedIndividuals: number;
    discardedProposals: number;
    fabricationAttempts: number;
    checkpoints: ContinuousOptimizerCheckpointSummary[];
  };
  learnedEvidence: {
    reuseTrials: ContinuousOptimizerReuseTrialSummary[];
    motifs: ContinuousOptimizerMotifSummary[];
  };
};

export function createDefaultContinuousOptimizerControls(): ContinuousOptimizerControls {
  return {
    sessionId: "hupper-continuous",
    scenarioId: "t3-full",
    workerCount: 10,
    chunkSize: 50_000,
    dbPath: ".optimizer/rust-wasm-search.sqlite",
    qualityPreset: "validated-contextual",
    scoreCriterion: "total-damage",
    targetElement: "fire",
    requireSustainableCycle: false,
  };
}

export function normalizeContinuousOptimizerControls(
  controls: Partial<ContinuousOptimizerControls>,
): ContinuousOptimizerControls {
  const defaults = createDefaultContinuousOptimizerControls();
  return {
    sessionId: normalizeSessionId(controls.sessionId ?? defaults.sessionId),
    scenarioId: normalizeScenarioId(controls.scenarioId ?? defaults.scenarioId),
    workerCount: clampInteger(controls.workerCount ?? defaults.workerCount, 1, 32),
    chunkSize: clampInteger(controls.chunkSize ?? defaults.chunkSize, 1_000, 10_000_000),
    dbPath: (controls.dbPath ?? defaults.dbPath).trim() || defaults.dbPath,
    qualityPreset: normalizeQualityPreset(controls.qualityPreset ?? defaults.qualityPreset),
    scoreCriterion: normalizeScoreCriterion(controls.scoreCriterion ?? defaults.scoreCriterion),
    targetElement: normalizeTargetElement(controls.targetElement ?? defaults.targetElement),
    requireSustainableCycle: controls.requireSustainableCycle ?? defaults.requireSustainableCycle,
    maxRounds: controls.maxRounds === undefined
      ? undefined
      : clampInteger(controls.maxRounds, 1, 1_000_000),
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
    qualityPresetLabel: formatContinuousOptimizerQualityPreset(controls.qualityPreset),
    launchArgs: createContinuousOptimizerLaunchArgs(controls),
    operations: {
      canStart: status === "idle" || status === "stopped" || status === "error",
      canPause: status === "running",
      canResume: status === "paused" || status === "stopped",
    },
    bestCombos: {
      bestScore: input.session?.bestScore ?? null,
      totalAttempts: input.session?.totalAttempts ?? 0,
      admittedIndividuals: input.session?.admittedIndividuals ?? 0,
      discardedProposals: input.session?.discardedProposals ?? 0,
      fabricationAttempts: input.session?.fabricationAttempts ?? input.session?.totalAttempts ?? 0,
      checkpoints: input.checkpoints.slice().sort((left, right) => left.totalAttempts - right.totalAttempts),
    },
    learnedEvidence: {
      reuseTrials: input.reuseTrials.slice().sort((left, right) => {
        return Number(right.improvedGlobalBest) - Number(left.improvedGlobalBest)
          || (right.resultScore ?? 0) - (left.resultScore ?? 0)
          || (right.sourceScore ?? 0) - (left.sourceScore ?? 0);
      }),
      motifs: input.motifs.slice().sort((left, right) => {
        return right.confidence - left.confidence || right.bestScore - left.bestScore;
      }),
    },
  };
}

export function createContinuousOptimizerLaunchArgs(controls: ContinuousOptimizerControls): string[] {
  const normalized = normalizeContinuousOptimizerControls(controls);
  const args = [
    "--session",
    normalized.sessionId,
    "--db",
    normalized.dbPath,
    "--scenario",
    normalized.scenarioId,
    "--workers",
    String(normalized.workerCount),
    "--chunk-size",
    String(normalized.chunkSize),
    "--progress-interval-ms",
    "2000",
    "--score-criterion",
    normalized.scoreCriterion,
  ];
  if (normalized.scoreCriterion === "element-damage") {
    args.push("--target-element", normalized.targetElement);
  }
  if (normalized.requireSustainableCycle) {
    args.push("--sustainable-cycle");
  }
  if (normalized.maxRounds !== undefined) {
    args.push("--max-rounds", String(normalized.maxRounds));
  }

  if (normalized.qualityPreset === "validated-contextual") {
    args.push(
      "--resource-aware-fresh-chance",
      "1",
      "--contextual-adjacent-swaps",
      "--global-validity-guidance",
      "--min-round-valid-candidates",
      "50",
      "--max-round-attempt-multiplier",
      "5",
      "--validity-rescue",
      "--validity-rescue-seeds-per-worker",
      "6",
      "--reuse-trials",
      "--reuse-trials-per-worker",
      "2",
      "--motif-seeds",
      "--motif-seeds-per-worker",
      "1",
      "--plateau-order-chain-neighbors",
      "--plateau-trigger-rounds",
      "1",
    );
  }

  return args;
}

export async function streamContinuousOptimizerRun({
  args,
  onCandidate,
  onComplete,
  onHeartbeat,
  onLog,
  onProgress,
  onStarted,
  onStopped,
  signal,
}: {
  args: string[];
  onCandidate?: (payload: unknown) => void;
  onComplete?: () => void;
  onHeartbeat?: (payload: { elapsedMs?: number }) => void;
  onLog?: (line: string) => void;
  onProgress: (payload: ContinuousOptimizerRunProgress) => void;
  onStarted?: () => void;
  onStopped?: () => void;
  signal?: AbortSignal;
}): Promise<void> {
  const response = await fetch("/api/continuous-optimizer/stream", {
    body: JSON.stringify({ args }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal,
  });
  if (!response.ok) {
    throw new Error(await readContinuousOptimizerStreamError(response));
  }
  if (!response.body) {
    throw new Error("Continuous optimizer stream response is missing a readable body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const recentLogs: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const eventChunk of events) {
        const event = parseServerSentEvent(eventChunk);
        if (!event) {
          continue;
        }
        if (event.event === "progress") {
          onProgress(JSON.parse(event.data) as ContinuousOptimizerRunProgress);
        } else if (event.event === "candidate") {
          onCandidate?.(JSON.parse(event.data));
        } else if (event.event === "started") {
          onStarted?.();
        } else if (event.event === "heartbeat") {
          onHeartbeat?.(JSON.parse(event.data) as { elapsedMs?: number });
        } else if (event.event === "complete") {
          onComplete?.();
        } else if (event.event === "stopped") {
          onStopped?.();
        } else if (event.event === "log") {
          const parsed = JSON.parse(event.data) as { line?: string; stream?: string };
          if (parsed.line) {
            const line = parsed.stream ? `${parsed.stream}: ${parsed.line}` : parsed.line;
            recentLogs.push(line);
            recentLogs.splice(0, Math.max(0, recentLogs.length - 8));
            onLog?.(line);
          }
        } else if (event.event === "error") {
          const parsed = JSON.parse(event.data) as { error?: string };
          throw new Error(formatContinuousOptimizerError(
            parsed.error ?? "Continuous optimizer stream failed.",
            recentLogs,
          ));
        }
      }
    }
  } catch (error) {
    if (signal?.aborted || isContinuousOptimizerAbortError(error)) {
      onStopped?.();
      return;
    }
    throw error;
  }
}

function formatContinuousOptimizerError(error: string, recentLogs: string[]): string {
  const meaningfulLog = recentLogs.find((line) => line.includes("fingerprint mismatch"))
    ?? recentLogs.find((line) => line.startsWith("stderr: Error:"))
    ?? recentLogs.find((line) => line.includes("Error:"));
  const primary = meaningfulLog
    ? meaningfulLog.replace(/^stderr:\s*/, "").replace(/^Error:\s*/, "")
    : error;
  const details = [error, ...recentLogs]
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== primary && line !== `Error: ${primary}`)
    .slice(0, 8);

  return [primary, ...details].join("\n");
}

function normalizeScenarioId(scenarioId: ContinuousOptimizerControls["scenarioId"]): ContinuousOptimizerControls["scenarioId"] {
  return scenarioId === "t1-full"
    || scenarioId === "t2-full"
    || scenarioId === "t3-full"
    ? scenarioId
    : "t3-full";
}

function normalizeSessionId(value: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "hupper-continuous";
}

function isContinuousOptimizerAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === "AbortError" || error.message.includes("BodyStreamBuffer was aborted");
}

function formatContinuousOptimizerStatus(status: ContinuousOptimizerStatus): string {
  return status[0].toUpperCase() + status.slice(1);
}

function normalizeQualityPreset(value: ContinuousOptimizerQualityPreset): ContinuousOptimizerQualityPreset {
  return value === "manual" ? "manual" : "validated-contextual";
}

function formatContinuousOptimizerQualityPreset(value: ContinuousOptimizerQualityPreset): string {
  return value === "manual" ? "Manual" : "Validated contextual";
}

function normalizeScoreCriterion(value: ContinuousOptimizerScoreCriterion): ContinuousOptimizerScoreCriterion {
  return value === "element-damage" ? "element-damage" : "total-damage";
}

function normalizeTargetElement(value: ContinuousOptimizerTargetElement): ContinuousOptimizerTargetElement {
  return value === "water" || value === "earth" || value === "air" ? value : "fire";
}

function parseServerSentEvent(chunk: string): { event: string; data: string } | null {
  let event = "message";
  const data: string[] = [];

  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      data.push(line.slice("data:".length).trimStart());
    }
  }

  return data.length > 0 ? { event, data: data.join("\n") } : null;
}

async function readContinuousOptimizerStreamError(response: Response): Promise<string> {
  try {
    const parsed = await response.json() as { error?: string };
    return parsed.error ?? `Continuous optimizer stream failed with status ${response.status}.`;
  } catch {
    return `Continuous optimizer stream failed with status ${response.status}.`;
  }
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}
