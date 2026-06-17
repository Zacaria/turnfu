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
