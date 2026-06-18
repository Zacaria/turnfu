import type { ContinuousSearchReuseStrategyEvidence } from "./continuous-search-store.ts";

export type ContinuousReusePolicyMode = "off" | "adaptive";

export type ContinuousReuseStrategyPolicy = {
  mode: ContinuousReusePolicyMode;
  minEvaluatedTrials: number;
  evidence: ContinuousSearchReuseStrategyEvidence[];
  suppressedStrategies: string[];
  strategyRanks: Record<string, number>;
};

export type ContinuousReuseTrialOption = {
  strategy: string;
  sourceScore: number;
};

export function createContinuousReuseStrategyPolicy(
  evidence: ContinuousSearchReuseStrategyEvidence[],
  options?: {
    mode?: ContinuousReusePolicyMode;
    minEvaluatedTrials?: number;
  },
): ContinuousReuseStrategyPolicy {
  const mode = options?.mode ?? "adaptive";
  const minEvaluatedTrials = Math.max(1, options?.minEvaluatedTrials ?? 3);
  if (mode === "off") {
    return {
      mode,
      minEvaluatedTrials,
      evidence,
      suppressedStrategies: [],
      strategyRanks: {},
    };
  }

  const suppressedStrategies: string[] = [];
  const strategyRanks: Record<string, number> = {};
  for (const row of evidence) {
    if (shouldSuppressStrategy(row, minEvaluatedTrials)) {
      suppressedStrategies.push(row.strategy);
      strategyRanks[row.strategy] = Number.NEGATIVE_INFINITY;
      continue;
    }
    strategyRanks[row.strategy] = rankStrategy(row);
  }

  return {
    mode,
    minEvaluatedTrials,
    evidence,
    suppressedStrategies,
    strategyRanks,
  };
}

export function filterAndRankContinuousReuseTrialOptions<T extends ContinuousReuseTrialOption>(
  options: T[],
  policy: ContinuousReuseStrategyPolicy,
): T[] {
  if (policy.mode === "off") {
    return options;
  }
  const suppressed = new Set(policy.suppressedStrategies);
  return options
    .filter((option) => !suppressed.has(option.strategy))
    .sort((left, right) =>
      getStrategyRank(policy, right.strategy) - getStrategyRank(policy, left.strategy)
      || right.sourceScore - left.sourceScore
      || left.strategy.localeCompare(right.strategy)
    );
}

function shouldSuppressStrategy(
  evidence: ContinuousSearchReuseStrategyEvidence,
  minEvaluatedTrials: number,
): boolean {
  return evidence.evaluatedTrials >= minEvaluatedTrials
    && evidence.globalBestTrials === 0
    && evidence.averageScoreDelta !== null
    && evidence.averageScoreDelta < 0;
}

function rankStrategy(evidence: ContinuousSearchReuseStrategyEvidence): number {
  if (evidence.evaluatedTrials === 0) {
    return 0;
  }
  const globalBestRate = evidence.globalBestTrials / evidence.evaluatedTrials;
  const positiveDeltaRate = evidence.positiveScoreDeltaTrials / evidence.evaluatedTrials;
  const averageDelta = clamp((evidence.averageScoreDelta ?? 0) / 1_000, -10, 10);
  return round((globalBestRate * 100) + (positiveDeltaRate * 10) + averageDelta, 4);
}

function getStrategyRank(policy: ContinuousReuseStrategyPolicy, strategy: string): number {
  return policy.strategyRanks[strategy] ?? 0.5;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}
