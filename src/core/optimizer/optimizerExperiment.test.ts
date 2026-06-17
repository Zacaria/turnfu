import assert from "node:assert/strict";
import test from "node:test";

import { cost, damage, huppermageCatalog, normalizeCatalog, normalizeEntry, passive, resourceDelta, screenshot, spell, statModifier } from "../catalog/index.ts";
import { createResources } from "../simulation/index.ts";
import {
  configureRustWasmOptimizerBackend,
  createOptimizerExperimentEvaluator,
  runOptimizerExperiment,
  runOptimizerExperimentProgressive,
  type OptimizerExperimentEngineKind,
} from "./optimizerExperiment.ts";
import { mergeDiscoveryMotif, mineDiscoveryMotif, rankDiscoveryMotifs } from "./discovery.ts";
import type { CatalogEntry } from "../catalog/types.ts";
import type { SimulatedCharacter } from "../simulation/types.ts";

const source = screenshot("/tmp/optimizer-experiment-test.png", "optimizer-experiment-test");

const catalog = normalizeCatalog([
  spell("setup", {
    name: "Setup",
    level: 200,
    element: "fire",
    cost: cost({ ap: 1 }),
    effects: [resourceDelta({ resource: "bq", amount: 500 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("hit", {
    name: "Hit",
    level: 200,
    cost: cost({ ap: 1 }),
    effects: [damage({ element: "fire", base: 20 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
  spell("burst", {
    name: "Burst",
    level: 200,
    element: "fire",
    cost: cost({ bq: 500 }),
    effects: [damage({ element: "fire", base: 120 })],
    constraints: [],
    metadata: { status: "extracted", sources: [source] },
  }),
]) as CatalogEntry[];

const character: SimulatedCharacter = {
  id: "optimizer-experiment-test",
  className: "huppermage",
  resources: createResources({ ap: 1, mp: 0, wp: 0, bq: 0 }),
  stats: {
    generalMastery: 0,
    elementalMastery: { fire: 0 },
    damageInflictedPercent: 0,
  },
};

const allEngines: OptimizerExperimentEngineKind[] = ["random", "mcts", "novelty", "annealing", "genetic", "hybrid"];

test("runs requested engines with common progress and deterministic seeded results", () => {
  const progress: string[] = [];
  const first = runOptimizerExperiment({
    catalog,
    character,
    duration: 2,
    availableSpellIds: ["setup", "hit", "burst"],
    engines: allEngines,
    seed: "same-seed",
    budget: { iterations: 40 },
    maxActionsPerTurn: 1,
    progressInterval: 10,
    onProgress: (snapshot) => {
      progress.push(`${snapshot.engine}:${snapshot.attempts}:${snapshot.bestScore ?? "none"}`);
    },
  });
  const second = runOptimizerExperiment({
    catalog,
    character,
    duration: 2,
    availableSpellIds: ["setup", "hit", "burst"],
    engines: allEngines,
    seed: "same-seed",
    budget: { iterations: 40 },
    maxActionsPerTurn: 1,
  });

  assert.deepEqual(first.engineResults.map((result) => result.engine), allEngines);
  assert.deepEqual(first.engineResults.map((result) => result.backend), allEngines.map(() => "typescript"));
  assert.ok(first.engineResults.every((result) => result.budget.iterations === 40));
  assert.ok(first.engineResults.every((result) => result.attempts > 0));
  assert.ok(first.engineResults.every((result) => result.validCandidates > 0));
  assert.ok(first.engineResults.every((result) => result.progress.length > 0));
  assert.ok(progress.length > 0);
  assert.deepEqual(
    first.engineResults.map((result) => result.bestCandidate?.id),
    second.engineResults.map((result) => result.bestCandidate?.id),
  );
});

test("keeps TypeScript backend as default and requires configured Rust backend", () => {
  const defaultResult = runOptimizerExperiment({
    catalog,
    character,
    duration: 2,
    availableSpellIds: ["setup", "hit", "burst"],
    engines: ["hybrid"],
    seed: "default-backend",
    budget: { iterations: 40 },
    maxActionsPerTurn: 1,
  });

  assert.equal(defaultResult.engineResults[0]?.backend, "typescript");
  assert.throws(
    () => runOptimizerExperiment({
      catalog,
      character,
      duration: 2,
      availableSpellIds: ["setup", "hit", "burst"],
      engines: ["hybrid"],
      backend: "rustWasm",
      seed: "rust-backend",
      budget: { iterations: 40 },
      maxActionsPerTurn: 1,
    }),
    /Rust\/WASM optimizer backend is not configured/,
  );
});

test("runs configured Rust/WASM hybrid backend through the Rust batch evaluator guarded by the TypeScript oracle", () => {
  configureRustWasmOptimizerBackend({
    generate_hybrid_candidates_json(requestJson) {
      const request = JSON.parse(requestJson);
      return JSON.stringify({
        schemaVersion: 1,
        backend: "rustWasm",
        supported: request.engine === "hybrid",
        engine: request.engine,
        seed: request.seed,
        attempts: 2,
        candidates: [
          {
            passiveIds: [],
            plan: {
              turns: [
                { actions: [{ spellId: "hit" }] },
                { actions: [{ spellId: "hit" }] },
              ],
            },
          },
          {
            passiveIds: [],
            plan: {
              turns: [
                { actions: [{ spellId: "setup" }] },
                { actions: [{ spellId: "burst" }] },
              ],
            },
          },
        ],
        metrics: {
          rustWasmGeneratedCandidates: 2,
        },
      });
    },
    evaluate_candidate_batch_json(_requestJson, candidatesJson) {
      const candidates = JSON.parse(candidatesJson);
      return JSON.stringify(candidates.map((candidate: { id: string; plan: { turns: Array<{ actions: Array<{ spellId: string }> }> } }) => {
        const firstSpell = candidate.plan.turns[0]?.actions[0]?.spellId;
        const score = firstSpell === "setup" ? 144 : 40;
        return {
          candidateId: candidate.id,
          valid: true,
          totalDamage: score,
          score: {
            score,
            totalDamage: score,
            damageByResolvedElement: {
              fire: score,
              water: 0,
              earth: 0,
              air: 0,
              light: 0,
              neutral: 0,
            },
          },
        };
      }));
    },
  });

  try {
    const result = runOptimizerExperiment({
      catalog,
      character,
      duration: 2,
      availableSpellIds: ["setup", "hit", "burst"],
      engines: ["hybrid"],
      backend: "rustWasm",
      seed: "rust-backend",
      budget: { iterations: 2 },
      maxActionsPerTurn: 1,
    });

    const engine = result.engineResults[0];
    assert.equal(engine?.backend, "rustWasm");
    assert.equal(engine?.attempts, 2);
    assert.equal(engine?.metrics.rustWasmBatchCalls, 1);
    assert.equal(engine?.metrics.rustWasmGeneratedCandidates, 2);
    assert.equal(engine?.metrics.rustWasmCandidateEvaluations, 2);
    assert.equal(result.bestCandidate?.score.score, 144);
    assert.equal(result.bestCandidate?.plan.turns[0]?.actions[0]?.spellId, "setup");
  } finally {
    configureRustWasmOptimizerBackend(undefined);
  }
});

test("can skip per-candidate Rust/WASM oracle checks and verify final top candidates through TypeScript", () => {
  configureRustWasmOptimizerBackend({
    generate_hybrid_candidates_json() {
      throw new Error("direct Rust/WASM search should not request candidate batches");
    },
    run_hybrid_search_json(requestJson) {
      const request = JSON.parse(requestJson);
      return JSON.stringify({
        schemaVersion: 1,
        backend: "rustWasm",
        supported: request.engine === "hybrid",
        engine: request.engine,
        seed: request.seed,
        attempts: 2,
        validCandidates: 2,
        invalidCandidates: 0,
        topCandidates: [
          {
            id: "::burst|",
            passiveIds: [],
            plan: {
              turns: [
                { actions: [{ spellId: "burst" }] },
                { actions: [] },
              ],
            },
            score: {
              score: 999,
              totalDamage: 999,
              damageByResolvedElement: {
                fire: 999,
                water: 0,
                earth: 0,
                air: 0,
                light: 0,
                neutral: 0,
              },
            },
          },
          {
            id: "::hit|hit",
            passiveIds: [],
            plan: {
              turns: [
                { actions: [{ spellId: "hit" }] },
                { actions: [{ spellId: "hit" }] },
              ],
            },
            score: {
              score: 40,
              totalDamage: 40,
              damageByResolvedElement: {
                fire: 40,
                water: 0,
                earth: 0,
                air: 0,
                light: 0,
                neutral: 0,
              },
            },
          },
        ],
        metrics: {
          rustWasmGeneratedCandidates: 2,
          rustWasmCandidateEvaluations: 2,
        },
      });
    },
    evaluate_candidate_batch_json() {
      throw new Error("direct Rust/WASM search should not request candidate evaluations");
    },
  });

  try {
    const result = runOptimizerExperiment({
      catalog,
      character,
      duration: 2,
      availableSpellIds: ["setup", "hit", "burst"],
      engines: ["hybrid"],
      backend: "rustWasm",
      rustWasmOracle: "finalTopCandidates",
      seed: "rust-backend-no-candidate-oracle",
      budget: { iterations: 2 },
      maxActionsPerTurn: 1,
    });

    const engine = result.engineResults[0];
    assert.equal(engine?.backend, "rustWasm");
    assert.equal(engine?.attempts, 2);
    assert.equal(engine?.validCandidates, 2);
    assert.equal(engine?.metrics.rustWasmOracleCandidateChecks ?? 0, 0);
    assert.equal(engine?.metrics.rustWasmBackendSearchCalls, 1);
    assert.equal(engine?.metrics.rustWasmFinalOracleCandidates, 2);
    assert.equal(engine?.metrics.rustWasmFinalOracleValid, 1);
    assert.equal(engine?.metrics.rustWasmFinalOracleInvalid, 1);
    assert.equal(engine?.metrics.rustWasmUnverifiedBestScore, 999);
    assert.equal(result.bestCandidate?.score.score, 40);
    assert.equal(result.bestCandidate?.plan.turns[0]?.actions[0]?.spellId, "hit");
  } finally {
    configureRustWasmOptimizerBackend(undefined);
  }
});

test("evaluates complete plans so a weak setup turn can produce the best final score", () => {
  const result = runOptimizerExperiment({
    catalog,
    character,
    duration: 2,
    availableSpellIds: ["setup", "hit", "burst"],
    engines: ["random"],
    seed: "setup-finder",
    budget: { iterations: 40 },
    maxActionsPerTurn: 1,
  });

  const best = result.bestCandidate;

  assert.ok(best);
  assert.equal(best.plan.turns[0]?.actions[0]?.spellId, "setup");
  assert.equal(best.plan.turns[1]?.actions[0]?.spellId, "burst");
  assert.equal(best.score.score, 144);
});

test("memoizes duplicate complete plan evaluations", () => {
  const evaluator = createOptimizerExperimentEvaluator({
    catalog,
    character,
    duration: 2,
    criterion: { type: "totalDamage" },
  });
  const candidate = {
    passiveIds: [],
    plan: {
      turns: [
        { actions: [{ spellId: "setup" }] },
        { actions: [{ spellId: "burst" }] },
      ],
    },
  };

  const first = evaluator.evaluate(candidate);
  const second = evaluator.evaluate(candidate);
  const stats = evaluator.getStats();

  assert.equal(first?.score.score, 144);
  assert.equal(second?.score.score, 144);
  assert.equal(stats.cacheMisses, 1);
  assert.equal(stats.cacheHits, 1);
});

test("extracts discovery descriptors for valid and invalid candidate evaluations", () => {
  const evaluator = createOptimizerExperimentEvaluator({
    catalog,
    character,
    duration: 2,
    criterion: { type: "totalDamage" },
    discovery: { enabled: true },
  });

  const valid = evaluator.evaluateDetailed({
    passiveIds: [],
    plan: {
      turns: [
        { actions: [{ spellId: "setup" }] },
      ],
    },
  });
  const invalid = evaluator.evaluateDetailed({
    passiveIds: [],
    plan: {
      turns: [
        { actions: [{ spellId: "burst" }] },
      ],
    },
  });

  assert.equal(valid.result?.score.score, 0);
  assert.equal(valid.discovery.descriptor.valid, true);
  assert.ok(valid.discovery.descriptor.affordances.includes("bq-ready"));
  assert.ok(valid.discovery.discoveryScore.reasons.includes("bqRecovery"));
  assert.equal(invalid.result, null);
  assert.equal(invalid.discovery.descriptor.valid, false);
  assert.equal(invalid.discovery.descriptor.violation?.category, "resourceDebt");
  assert.ok(invalid.discovery.discoveryScore.reasons.includes("boundary:resourceDebt"));
});

test("reports discovery metrics without changing final ranking", () => {
  const result = runOptimizerExperiment({
    catalog,
    character,
    duration: 2,
    availableSpellIds: ["setup", "hit", "burst"],
    engines: ["hybrid"],
    seed: "discovery-metrics-ranking",
    budget: { iterations: 80 },
    maxActionsPerTurn: 1,
    discovery: {
      enabled: true,
      curriculumObjectives: ["bqGeneration", "validLongPlans"],
      motifSeedBudget: 4,
    },
  });

  const engine = result.engineResults[0];
  assert.equal(result.bestCandidate?.score.score, 144);
  assert.equal(result.bestCandidate?.plan.turns[0]?.actions[0]?.spellId, "setup");
  assert.equal(result.bestCandidate?.plan.turns[1]?.actions[0]?.spellId, "burst");
  assert.ok((engine?.metrics.discoveryDescriptors ?? 0) > 0);
  assert.ok((engine?.metrics.discoveryScoreLeader ?? 0) > 0);
  assert.ok((engine?.metrics.discoveryMotifs ?? 0) > 0);
  assert.ok((engine?.metrics.discoveryMotifSeedCandidates ?? 0) > 0);
  assert.ok((engine?.metrics.discoveryCurriculumCandidates ?? 0) > 0);
  assert.equal(engine?.bestCandidate?.score.score, result.bestCandidate?.score.score);
});

test("mines and ranks discovery motifs from reusable evaluated patterns", () => {
  const evaluator = createOptimizerExperimentEvaluator({
    catalog,
    character,
    duration: 2,
    criterion: { type: "totalDamage" },
    discovery: { enabled: true },
  });
  const input = {
    passiveIds: [],
    plan: {
      turns: [
        { actions: [{ spellId: "setup" }] },
        { actions: [{ spellId: "burst" }] },
      ],
    },
  };
  const evaluation = evaluator.evaluateDetailed(input);
  const first = mineDiscoveryMotif({ input: evaluation.normalizedCandidate, payload: evaluation.discovery, attempt: 1 });
  const second = mineDiscoveryMotif({ input: evaluation.normalizedCandidate, payload: evaluation.discovery, attempt: 2 });

  assert.ok(first);
  assert.ok(second);
  const merged = mergeDiscoveryMotif(first, second);
  const ranked = rankDiscoveryMotifs([
    {
      ...merged,
      key: "lower-support",
      supportCount: 1,
      validationRate: 1,
      discoveryScoreContribution: 1,
      finalScoreContribution: 1,
    },
    merged,
  ]);

  assert.equal(merged.supportCount, 2);
  assert.equal(merged.validationRate, 1);
  assert.equal(ranked[0]?.key, merged.key);
});

test("novelty search evolves offspring from its archive", () => {
  const result = runOptimizerExperiment({
    catalog,
    character,
    duration: 2,
    availableSpellIds: ["setup", "hit", "burst"],
    engines: ["novelty"],
    seed: "novelty-archive-offspring",
    budget: { iterations: 60 },
    maxActionsPerTurn: 2,
  });

  const novelty = result.engineResults[0];

  assert.ok(novelty);
  assert.ok((novelty.metrics.populationSize ?? 0) > 1);
  assert.ok((novelty.metrics.noveltyOffspring ?? 0) > 0);
  assert.ok((novelty.metrics.localCompetitionMax ?? 0) > 0);
});

test("hybrid search restarts from fresh branches after stagnation while preserving elites", () => {
  const result = runOptimizerExperiment({
    catalog,
    character,
    duration: 2,
    availableSpellIds: ["setup", "hit", "burst"],
    engines: ["hybrid"],
    seed: "hybrid-stagnation-restarts",
    budget: { iterations: 120 },
    maxActionsPerTurn: 1,
    maxCandidates: 4,
  });

  const hybrid = result.engineResults[0];

  assert.ok(hybrid);
  assert.equal(hybrid.engine, "hybrid");
  assert.ok((hybrid.metrics.hybridIslands ?? 0) > 1);
  assert.equal(hybrid.bestCandidate?.score.score, 144);
  assert.ok((hybrid.metrics.hybridRestarts ?? 0) > 0);
  assert.ok((hybrid.metrics.hybridImmigrants ?? 0) > 0);
  assert.ok((hybrid.metrics.hybridEliteNeighborCandidates ?? 0) > 0);
  assert.ok((hybrid.metrics.hybridResourceAwareCandidates ?? 0) > 0);
  assert.ok(hybrid.topCandidates.some((candidate) => candidate.score.score === 144));
});

test("hybrid search lets long per-island runs refine locally before queued elites", () => {
  const result = runOptimizerExperiment({
    catalog,
    character,
    duration: 2,
    availableSpellIds: ["setup", "hit", "burst"],
    engines: ["hybrid"],
    seed: "hybrid-long-local-refinement",
    budget: { iterations: 1_000 },
    maxActionsPerTurn: 1,
    maxCandidates: 4,
  });

  const hybrid = result.engineResults[0];

  assert.ok(hybrid);
  assert.equal(hybrid.engine, "hybrid");
  assert.ok((hybrid.metrics.hybridLocalRefinements ?? 0) > 0);
  assert.ok((hybrid.metrics.hybridEliteNeighborCandidates ?? 0) > 0);
  assert.ok((hybrid.metrics.cacheHits ?? 0) > 0);
  assert.equal(hybrid.bestCandidate?.score.score, 144);
});

test("hybrid progressive search yields during long live runs", async () => {
  let yields = 0;
  const result = await runOptimizerExperimentProgressive({
    catalog,
    character,
    duration: 2,
    availableSpellIds: ["setup", "hit", "burst"],
    engines: ["hybrid"],
    seed: "hybrid-progressive-yields",
    budget: { iterations: 120 },
    maxActionsPerTurn: 1,
    progressInterval: 10,
    yieldProgress: async () => {
      yields += 1;
    },
  });

  assert.equal(result.engineResults[0]?.engine, "hybrid");
  assert.ok((result.engineResults[0]?.metrics.hybridIslands ?? 0) > 1);
  assert.ok(yields > 1);
});

test("hybrid search starts from a known high-value Huppermage branch", () => {
  const result = runOptimizerExperiment({
    catalog: huppermageCatalog,
    character: {
      id: "optimizer-experiment-huppermage-seed",
      className: "huppermage",
      resources: createResources({ ap: 12, mp: 6, wp: 6, bq: 500 }),
      stats: {
        level: 200,
        hitPoints: 2050,
        hitPointsPercent: 0,
        generalMastery: 1200,
        elementalMastery: {
          fire: 1200,
          water: 1200,
          earth: 1200,
          air: 1200,
          light: 0,
          neutral: 0,
        },
        meleeMastery: 0,
        distanceMastery: 250,
        berserkMastery: 0,
        rearMastery: 0,
        criticalMastery: 150,
        healingMastery: 0,
        damageInflictedPercent: 20,
        healsPerformedPercent: 0,
        healsReceivedPercent: 0,
        armorReceivedPercent: 0,
        armorGivenPercent: 0,
        elementalResistance: 0,
        rearResistance: 0,
        criticalResistance: 0,
        range: 0,
        willpower: 0,
        criticalHitPercent: 3,
        parry: 0,
        lock: 0,
        dodge: 0,
        initiative: 0,
        indirectDamagePercent: 0,
      },
    },
    duration: 2,
    engines: ["hybrid"],
    seed: "hybrid-huppermage-domain-seed",
    budget: { iterations: 1 },
    maxActionsPerTurn: 12,
    maxPassiveCount: 6,
    availablePassiveIds: huppermageCatalog.filter((entry) => entry.kind === "passive").map((entry) => entry.id),
    defaultActionContext: {
      position: "face",
      rangeMode: "distance",
      isCritical: false,
      isBerserk: false,
      isBlocked: false,
    },
  });

  assert.ok((result.bestCandidate?.score.score ?? 0) >= 77_000);
  assert.ok((result.engineResults[0]?.metrics.hybridOrderNeighborCandidates ?? 0) > 0);
  assert.ok((result.engineResults[0]?.metrics.hybridPassiveNeighborCandidates ?? 0) > 0);
});

test("hybrid search can reuse and extend known Huppermage branches as longer-duration prefixes", () => {
  const result = runOptimizerExperiment({
    catalog: huppermageCatalog,
    character: {
      id: "optimizer-experiment-huppermage-prefix-seed",
      className: "huppermage",
      resources: createResources({ ap: 12, mp: 6, wp: 6, bq: 500 }),
      stats: {
        level: 200,
        hitPoints: 2050,
        hitPointsPercent: 0,
        generalMastery: 1200,
        elementalMastery: {
          fire: 1200,
          water: 1200,
          earth: 1200,
          air: 1200,
          light: 0,
          neutral: 0,
        },
        meleeMastery: 0,
        distanceMastery: 250,
        berserkMastery: 0,
        rearMastery: 0,
        criticalMastery: 150,
        healingMastery: 0,
        damageInflictedPercent: 20,
        healsPerformedPercent: 0,
        healsReceivedPercent: 0,
        armorReceivedPercent: 0,
        armorGivenPercent: 0,
        elementalResistance: 0,
        rearResistance: 0,
        criticalResistance: 0,
        range: 0,
        willpower: 0,
        criticalHitPercent: 3,
        parry: 0,
        lock: 0,
        dodge: 0,
        initiative: 0,
        indirectDamagePercent: 0,
      },
    },
    duration: 3,
    engines: ["hybrid"],
    seed: "hybrid-huppermage-domain-prefix-seed",
    budget: { iterations: 16 },
    maxActionsPerTurn: 12,
    maxPassiveCount: 6,
    availablePassiveIds: huppermageCatalog.filter((entry) => entry.kind === "passive").map((entry) => entry.id),
    defaultActionContext: {
      position: "face",
      rangeMode: "distance",
      isCritical: false,
      isBerserk: false,
      isBlocked: false,
    },
  });

  assert.ok((result.bestCandidate?.score.score ?? 0) >= 102_000);
  assert.equal(result.bestCandidate?.plan.turns.length, 3);
});

test("hybrid search adapts known Huppermage branches to capped action counts", () => {
  const result = runOptimizerExperiment({
    catalog: huppermageCatalog,
    character: {
      id: "optimizer-experiment-huppermage-capped-seed",
      className: "huppermage",
      resources: createResources({ ap: 12, mp: 6, wp: 6, bq: 500 }),
      stats: {
        level: 200,
        hitPoints: 2050,
        hitPointsPercent: 0,
        generalMastery: 1200,
        elementalMastery: {
          fire: 1200,
          water: 1200,
          earth: 1200,
          air: 1200,
          light: 0,
          neutral: 0,
        },
        meleeMastery: 0,
        distanceMastery: 250,
        berserkMastery: 0,
        rearMastery: 0,
        criticalMastery: 150,
        healingMastery: 0,
        damageInflictedPercent: 20,
        healsPerformedPercent: 0,
        healsReceivedPercent: 0,
        armorReceivedPercent: 0,
        armorGivenPercent: 0,
        elementalResistance: 0,
        rearResistance: 0,
        criticalResistance: 0,
        range: 0,
        willpower: 0,
        criticalHitPercent: 3,
        parry: 0,
        lock: 0,
        dodge: 0,
        initiative: 0,
        indirectDamagePercent: 0,
      },
    },
    duration: 3,
    engines: ["hybrid"],
    seed: "hybrid-huppermage-capped-domain-seed",
    budget: { iterations: 16 },
    maxActionsPerTurn: 7,
    maxPassiveCount: 6,
    availablePassiveIds: huppermageCatalog.filter((entry) => entry.kind === "passive").map((entry) => entry.id),
    defaultActionContext: {
      position: "face",
      rangeMode: "distance",
      isCritical: false,
      isBerserk: false,
      isBlocked: false,
    },
  });

  assert.ok((result.bestCandidate?.score.score ?? 0) >= 80_000);
  assert.ok(result.bestCandidate?.plan.turns.every((turn) => turn.actions.length <= 7));
});

test("hybrid search adapts known Huppermage branches to capped passive counts", () => {
  const result = runOptimizerExperiment({
    catalog: huppermageCatalog,
    character: {
      id: "optimizer-experiment-huppermage-passive-capped-seed",
      className: "huppermage",
      resources: createResources({ ap: 12, mp: 6, wp: 6, bq: 500 }),
      stats: {
        level: 200,
        hitPoints: 2050,
        hitPointsPercent: 0,
        generalMastery: 1200,
        elementalMastery: {
          fire: 1200,
          water: 1200,
          earth: 1200,
          air: 1200,
          light: 0,
          neutral: 0,
        },
        meleeMastery: 0,
        distanceMastery: 250,
        berserkMastery: 0,
        rearMastery: 0,
        criticalMastery: 150,
        healingMastery: 0,
        damageInflictedPercent: 20,
        healsPerformedPercent: 0,
        healsReceivedPercent: 0,
        armorReceivedPercent: 0,
        armorGivenPercent: 0,
        elementalResistance: 0,
        rearResistance: 0,
        criticalResistance: 0,
        range: 0,
        willpower: 0,
        criticalHitPercent: 3,
        parry: 0,
        lock: 0,
        dodge: 0,
        initiative: 0,
        indirectDamagePercent: 0,
      },
    },
    duration: 2,
    engines: ["hybrid"],
    seed: "bench-t2-a8-p2-a",
    budget: { iterations: 16 },
    maxActionsPerTurn: 8,
    maxPassiveCount: 2,
    availablePassiveIds: huppermageCatalog.filter((entry) => entry.kind === "passive").map((entry) => entry.id),
    defaultActionContext: {
      position: "face",
      rangeMode: "distance",
      isCritical: false,
      isBerserk: false,
      isBlocked: false,
    },
  });

  assert.ok((result.bestCandidate?.score.score ?? 0) >= 73_000);
  assert.ok((result.bestCandidate?.passiveIds.length ?? 0) <= 2);
  assert.ok((result.engineResults[0]?.metrics.hybridRelocateNeighborCandidates ?? 0) > 0);
});

test("hybrid search repairs invalid three-turn Huppermage branches", () => {
  const result = runOptimizerExperiment({
    catalog: huppermageCatalog,
    character: {
      id: "optimizer-experiment-huppermage-repair-seed",
      className: "huppermage",
      resources: createResources({ ap: 12, mp: 6, wp: 6, bq: 500 }),
      stats: {
        level: 200,
        hitPoints: 2050,
        hitPointsPercent: 0,
        generalMastery: 1200,
        elementalMastery: {
          fire: 1200,
          water: 1200,
          earth: 1200,
          air: 1200,
          light: 0,
          neutral: 0,
        },
        meleeMastery: 0,
        distanceMastery: 250,
        berserkMastery: 0,
        rearMastery: 0,
        criticalMastery: 150,
        healingMastery: 0,
        damageInflictedPercent: 20,
        healsPerformedPercent: 0,
        healsReceivedPercent: 0,
        armorReceivedPercent: 0,
        armorGivenPercent: 0,
        elementalResistance: 0,
        rearResistance: 0,
        criticalResistance: 0,
        range: 0,
        willpower: 0,
        criticalHitPercent: 3,
        parry: 0,
        lock: 0,
        dodge: 0,
        initiative: 0,
        indirectDamagePercent: 0,
      },
    },
    duration: 3,
    engines: ["hybrid"],
    seed: "bench-t3-a12-p3-a",
    budget: { iterations: 100 },
    maxActionsPerTurn: 12,
    maxPassiveCount: 3,
    discovery: { enabled: true },
    availablePassiveIds: huppermageCatalog.filter((entry) => entry.kind === "passive").map((entry) => entry.id),
    defaultActionContext: {
      position: "face",
      rangeMode: "distance",
      isCritical: false,
      isBerserk: false,
      isBlocked: false,
    },
  });

  const engineResult = result.engineResults[0];
  assert.ok((result.bestCandidate?.score.score ?? 0) >= 92_000);
  assert.ok((engineResult?.metrics.hybridRepairQueueCandidates ?? 0) > 0);
  assert.ok((engineResult?.metrics.hybridRepairCandidates ?? 0) > 0);
  assert.ok((engineResult?.metrics.discoveryRepairSignals ?? 0) > 0);
  assert.ok((engineResult?.metrics.discoveryBoundarySamples ?? 0) > 0);
  assert.ok((engineResult?.validCandidates ?? 0) > (engineResult?.invalidCandidates ?? 0));
  assert.ok((engineResult?.metrics.hybridRelocateNeighborCandidates ?? 0) > 0);
});

test("ranks passive chromosomes by simulated score without passive-specific overrides", () => {
  const passiveCatalog = [
    ...catalog,
    normalizeEntry(passive("neutral-passive", {
      name: "Neutral Passive",
      level: 200,
      effects: [],
      constraints: [],
      tags: [],
      metadata: { status: "extracted", sources: [source] },
    })),
    normalizeEntry(passive("damage-passive", {
      name: "Damage Passive",
      level: 200,
      effects: [statModifier({ stat: "damageInflictedPercent", amount: 15, target: "caster" })],
      constraints: [],
      tags: [],
      metadata: { status: "extracted", sources: [source] },
    })),
  ];

  const result = runOptimizerExperiment({
    catalog: passiveCatalog,
    character,
    duration: 1,
    availableSpellIds: ["hit"],
    availablePassiveIds: ["neutral-passive", "damage-passive"],
    engines: ["genetic"],
    seed: "passive-chromosome-ranking",
    budget: { iterations: 40 },
    maxActionsPerTurn: 1,
    maxPassiveCount: 1,
    maxCandidates: 4,
  });

  const best = result.bestCandidate;

  assert.ok(best);
  assert.deepEqual(best.passiveIds, ["damage-passive"]);
  assert.equal(best.plan.turns[0]?.actions[0]?.spellId, "hit");
  assert.ok(best.score.score > 20);
});

test("prefers fewer passive chromosomes when simulated scores tie", () => {
  const passiveCatalog = [
    ...catalog,
    normalizeEntry(passive("neutral-passive", {
      name: "Neutral Passive",
      level: 200,
      effects: [],
      constraints: [],
      tags: [],
      metadata: { status: "extracted", sources: [source] },
    })),
  ];

  const result = runOptimizerExperiment({
    catalog: passiveCatalog,
    character,
    duration: 1,
    availableSpellIds: ["hit"],
    availablePassiveIds: ["neutral-passive"],
    engines: ["genetic"],
    seed: "passive-tie-break",
    budget: { iterations: 20 },
    maxActionsPerTurn: 1,
    maxPassiveCount: 1,
    maxCandidates: 2,
  });

  assert.deepEqual(result.bestCandidate?.passiveIds, []);
  assert.deepEqual(result.engineResults[0]?.topCandidates.map((candidate) => candidate.passiveIds), [[], ["neutral-passive"]]);
});

test("ranks sublimation chromosomes by simulated score", () => {
  const result = runOptimizerExperiment({
    catalog,
    character: {
      ...character,
      stats: {
        ...character.stats,
        criticalHitPercent: 0,
        criticalMastery: 100,
      },
    },
    duration: 1,
    availableSpellIds: ["hit"],
    availableSublimationIds: ["influence-6"],
    engines: ["genetic"],
    seed: "sublimation-chromosome-ranking",
    budget: { iterations: 20 },
    maxActionsPerTurn: 1,
    maxSublimationCount: 1,
    maxCandidates: 2,
    defaultActionContext: { criticalMode: "expected" },
  });

  assert.deepEqual(result.bestCandidate?.sublimationIds, ["influence-6"]);
  assert.ok((result.bestCandidate?.score.score ?? 0) > 20);
});

test("evaluates sustainable cycles with candidate sublimations", () => {
  const sustainableCatalog = [
    ...catalog,
    normalizeEntry(spell("two-ap-hit", {
      name: "Two AP Hit",
      level: 200,
      cost: cost({ ap: 2 }),
      effects: [damage({ element: "fire", base: 20 })],
      constraints: [],
      metadata: { status: "extracted", sources: [source] },
    })),
  ] as CatalogEntry[];
  const evaluator = createOptimizerExperimentEvaluator({
    catalog: sustainableCatalog,
    character,
    duration: 1,
    requireSustainableCycle: true,
  });

  const result = evaluator.evaluate({
    sublimationIds: ["vivacite-2"],
    plan: {
      turns: [{ actions: [{ spellId: "two-ap-hit" }] }],
    },
  });

  assert.ok(result);
  assert.deepEqual(result.sublimationIds, ["vivacite-2"]);
  assert.equal(result.sustainability.sustainable, true);
  assert.equal(result.sustainability.replay?.turns[0]?.result.breakdown[0]?.resourceBefore.ap, 2);
});

test("hybrid search explores sublimation neighbors before spending the short-run budget", () => {
  const result = runOptimizerExperiment({
    catalog,
    character: {
      ...character,
      stats: {
        ...character.stats,
        criticalHitPercent: 0,
        criticalMastery: 100,
      },
    },
    duration: 1,
    availableSpellIds: ["hit"],
    availableSublimationIds: ["influence-6"],
    engines: ["hybrid"],
    seed: "hybrid-sublimation-neighbor-ranking",
    budget: { iterations: 20 },
    maxActionsPerTurn: 1,
    maxSublimationCount: 1,
    maxCandidates: 2,
    defaultActionContext: { criticalMode: "expected" },
  });

  assert.deepEqual(result.bestCandidate?.sublimationIds, ["influence-6"]);
  assert.ok((result.engineResults[0]?.metrics.hybridSublimationNeighborCandidates ?? 0) > 0);
});
