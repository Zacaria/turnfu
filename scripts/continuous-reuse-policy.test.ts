import assert from "node:assert/strict";
import test from "node:test";
import {
  createContinuousReuseStrategyPolicy,
  filterAndRankContinuousReuseTrialOptions,
} from "./continuous-reuse-policy.ts";
import type { ContinuousSearchReuseStrategyEvidence } from "./continuous-search-store.ts";

test("suppresses strategies with enough negative source-relative evidence", () => {
  const policy = createContinuousReuseStrategyPolicy([
    createEvidence({
      strategy: "bad-move",
      evaluatedTrials: 3,
      negativeScoreDeltaTrials: 3,
      averageScoreDelta: -4_000,
    }),
    createEvidence({
      strategy: "unseen-enough",
      trials: 1,
      evaluatedTrials: 0,
      unscoredTrials: 1,
      averageScoreDelta: null,
    }),
  ]);

  assert.deepEqual(policy.suppressedStrategies, ["bad-move"]);
  assert.deepEqual(
    filterAndRankContinuousReuseTrialOptions([
      { strategy: "bad-move", sourceScore: 200 },
      { strategy: "unseen-enough", sourceScore: 100 },
      { strategy: "new-strategy", sourceScore: 150 },
    ], policy),
    [
      { strategy: "new-strategy", sourceScore: 150 },
      { strategy: "unseen-enough", sourceScore: 100 },
    ],
  );
});

test("prioritizes global-best and positive-delta strategies", () => {
  const policy = createContinuousReuseStrategyPolicy([
    createEvidence({
      strategy: "small-positive",
      evaluatedTrials: 4,
      positiveScoreDeltaTrials: 4,
      averageScoreDelta: 500,
    }),
    createEvidence({
      strategy: "global-winner",
      evaluatedTrials: 4,
      positiveScoreDeltaTrials: 1,
      globalBestTrials: 1,
      averageScoreDelta: -250,
    }),
  ]);

  assert.deepEqual(
    filterAndRankContinuousReuseTrialOptions([
      { strategy: "small-positive", sourceScore: 300 },
      { strategy: "global-winner", sourceScore: 100 },
      { strategy: "neutral", sourceScore: 500 },
    ], policy),
    [
      { strategy: "global-winner", sourceScore: 100 },
      { strategy: "small-positive", sourceScore: 300 },
      { strategy: "neutral", sourceScore: 500 },
    ],
  );
});

function createEvidence(
  overrides: Partial<ContinuousSearchReuseStrategyEvidence> & { strategy: string },
): ContinuousSearchReuseStrategyEvidence {
  const averageScoreDelta = "averageScoreDelta" in overrides
    ? overrides.averageScoreDelta!
    : 0;
  return {
    strategy: overrides.strategy,
    trials: overrides.trials ?? overrides.evaluatedTrials ?? 0,
    evaluatedTrials: overrides.evaluatedTrials ?? 0,
    unscoredTrials: overrides.unscoredTrials ?? 0,
    positiveScoreDeltaTrials: overrides.positiveScoreDeltaTrials ?? 0,
    negativeScoreDeltaTrials: overrides.negativeScoreDeltaTrials ?? 0,
    globalBestTrials: overrides.globalBestTrials ?? 0,
    averageScoreDelta,
    bestScoreDelta: overrides.bestScoreDelta ?? averageScoreDelta,
    latestAttempt: overrides.latestAttempt ?? 100,
  };
}
