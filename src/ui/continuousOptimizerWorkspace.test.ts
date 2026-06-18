import assert from "node:assert/strict";
import test from "node:test";
import {
  createContinuousOptimizerLaunchArgs,
  createContinuousOptimizerPageViewModel,
  createDefaultContinuousOptimizerControls,
  normalizeContinuousOptimizerControls,
  streamContinuousOptimizerRun,
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
  assert.equal(controls.qualityPreset, "validated-contextual");
  assert.equal(controls.scoreCriterion, "total-damage");
  assert.equal(controls.targetElement, "fire");
  assert.equal(controls.requireSustainableCycle, false);
});

test("creates launch args for the validated Continuous quality preset", () => {
  const args = createContinuousOptimizerLaunchArgs(createDefaultContinuousOptimizerControls());

  assert.deepEqual(args, [
    "--session",
    "hupper-continuous",
    "--db",
    ".optimizer/rust-wasm-search.sqlite",
    "--scenario",
    "t3-full",
    "--workers",
    "10",
    "--chunk-size",
    "50000",
    "--score-criterion",
    "total-damage",
    "--resource-aware-fresh-chance",
    "1",
    "--learned-loadout-prior",
    "--learned-action-set-prior",
    "--contextual-adjacent-swaps",
  ]);
});

test("creates launch args for a custom sustainable air Continuous run", () => {
  const args = createContinuousOptimizerLaunchArgs({
    ...createDefaultContinuousOptimizerControls(),
    scenarioId: "t2-a8-p2",
    qualityPreset: "manual",
    scoreCriterion: "element-damage",
    targetElement: "air",
    requireSustainableCycle: true,
  });

  assert.deepEqual(args, [
    "--session",
    "hupper-continuous",
    "--db",
    ".optimizer/rust-wasm-search.sqlite",
    "--scenario",
    "t2-a8-p2",
    "--workers",
    "10",
    "--chunk-size",
    "50000",
    "--score-criterion",
    "element-damage",
    "--target-element",
    "air",
    "--sustainable-cycle",
  ]);
});

test("creates bounded launch args for an optimizer-owned Continuous run", () => {
  const args = createContinuousOptimizerLaunchArgs({
    ...createDefaultContinuousOptimizerControls(),
    maxRounds: 2,
  });

  const maxRoundsIndex = args.indexOf("--max-rounds");
  assert.ok(maxRoundsIndex > 0);
  assert.equal(args[maxRoundsIndex + 1], "2");
});

test("keeps manual Continuous launch args free of learned quality flags", () => {
  const args = createContinuousOptimizerLaunchArgs({
    ...createDefaultContinuousOptimizerControls(),
    qualityPreset: "manual",
  });

  assert.equal(args.includes("--learned-loadout-prior"), false);
  assert.equal(args.includes("--learned-action-set-prior"), false);
  assert.equal(args.includes("--contextual-adjacent-swaps"), false);
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
    reuseTrials: [
      { label: "rotate-turn-actions", sourceScore: 143_000, resultScore: 144_000, improvedGlobalBest: true },
    ],
    motifs: [
      { label: "cycle>light", supportCount: 12, confidence: 0.8, bestScore: 143_000 },
    ],
  });

  assert.equal(view.statusLabel, "Running");
  assert.equal(view.qualityPresetLabel, "Validated contextual");
  assert.equal(view.launchArgs.includes("--contextual-adjacent-swaps"), true);
  assert.equal(view.bestCombos.bestScore, 143_582.03);
  assert.equal(view.bestCombos.checkpoints.length, 2);
  assert.equal(view.learnedEvidence.reuseTrials[0].label, "rotate-turn-actions");
  assert.equal(view.learnedEvidence.motifs[0].label, "cycle>light");
});

test("streams startup and heartbeat events before checkpoint progress", async () => {
  const originalFetch = globalThis.fetch;
  const events: string[] = [];
  const body = [
    "event: started\ndata: {\"command\":\"node\"}",
    "event: heartbeat\ndata: {\"elapsedMs\":1200}",
    "event: progress\ndata: {\"totalAttempts\":500000,\"score\":42,\"validRate\":0.2}",
    "event: complete\ndata: {\"code\":0}",
  ].join("\n\n") + "\n\n";

  globalThis.fetch = async () => ({
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
  }) as Response;

  try {
    await streamContinuousOptimizerRun({
      args: ["--session", "test"],
      onComplete: () => events.push("complete"),
      onHeartbeat: (payload) => events.push(`heartbeat:${payload.elapsedMs}`),
      onProgress: (payload) => events.push(`progress:${payload.totalAttempts}`),
      onStarted: () => events.push("started"),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(events, [
    "started",
    "heartbeat:1200",
    "progress:500000",
    "complete",
  ]);
});

test("treats aborted Continuous stream reads as stopped runs", async () => {
  const originalFetch = globalThis.fetch;
  const abortController = new AbortController();
  const events: string[] = [];

  globalThis.fetch = async () => ({
    ok: true,
    body: {
      getReader() {
        return {
          read() {
            abortController.abort();
            return Promise.reject(new Error("BodyStreamBuffer was aborted"));
          },
        };
      },
    },
  }) as Response;

  try {
    await streamContinuousOptimizerRun({
      args: ["--session", "test"],
      onProgress: () => events.push("progress"),
      onStopped: () => events.push("stopped"),
      signal: abortController.signal,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(events, ["stopped"]);
});
