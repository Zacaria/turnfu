import assert from "node:assert/strict";
import test from "node:test";

import { cost, damage, huppermageCatalog, normalizeCatalog, normalizeEntry, passive, resourceDelta, screenshot, spell, statModifier } from "../catalog/index.ts";
import { createResources } from "../simulation/index.ts";
import {
  createOptimizerExperimentEvaluator,
  runOptimizerExperiment,
  runOptimizerExperimentProgressive,
  type OptimizerExperimentEngineKind,
} from "./optimizerExperiment.ts";
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
  assert.ok((hybrid.metrics.hybridLocalRefinements ?? 0) > 0);
  assert.ok((hybrid.metrics.hybridEliteNeighborCandidates ?? 0) > 0);
  assert.ok((hybrid.metrics.hybridResourceAwareCandidates ?? 0) > 0);
  assert.ok(hybrid.topCandidates.some((candidate) => candidate.score.score === 144));
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
    budget: { iterations: 80 },
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

  assert.ok((result.bestCandidate?.score.score ?? 0) >= 80_000);
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
    availablePassiveIds: huppermageCatalog.filter((entry) => entry.kind === "passive").map((entry) => entry.id),
    defaultActionContext: {
      position: "face",
      rangeMode: "distance",
      isCritical: false,
      isBerserk: false,
      isBlocked: false,
    },
  });

  assert.ok((result.bestCandidate?.score.score ?? 0) >= 92_000);
  assert.ok((result.engineResults[0]?.metrics.hybridRepairCandidates ?? 0) > 0);
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
