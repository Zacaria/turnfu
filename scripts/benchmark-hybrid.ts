import { huppermageCatalog } from "../src/core/catalog/index.ts";
import { runOptimizerExperiment } from "../src/core/optimizer/index.ts";
import { createResources } from "../src/core/simulation/index.ts";
import type { ComboSimulationOptions, SimulatedCharacter } from "../src/core/simulation/types.ts";

type HybridBenchmarkScenario = {
  id: string;
  duration: number;
  maxActionsPerTurn: number;
  maxPassiveCount: number;
};

const character: SimulatedCharacter = {
  id: "hybrid-benchmark-huppermage",
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
};

const defaultActionContext: ComboSimulationOptions["defaultActionContext"] = {
  position: "face",
  rangeMode: "distance",
  isCritical: false,
  isBerserk: false,
  isBlocked: false,
};

const scenarios: HybridBenchmarkScenario[] = [
  { id: "t2-a7-p3", duration: 2, maxActionsPerTurn: 7, maxPassiveCount: 3 },
  { id: "t2-a8-p2", duration: 2, maxActionsPerTurn: 8, maxPassiveCount: 2 },
  { id: "t3-a12-p3", duration: 3, maxActionsPerTurn: 12, maxPassiveCount: 3 },
  { id: "t3-a10-p6", duration: 3, maxActionsPerTurn: 10, maxPassiveCount: 6 },
  { id: "t3-full", duration: 3, maxActionsPerTurn: 12, maxPassiveCount: 6 },
];

const requestedScenarioIds = new Set(readOptionValues("--scenario"));
const requestedBudgets = readOptionValues("--budget").map((value) => Number.parseInt(value, 10));
const requestedSeeds = readOptionValues("--seed");
const budgets = requestedBudgets.length > 0 ? requestedBudgets : [16, 100, 1_000];
const seeds = requestedSeeds.length > 0 ? requestedSeeds : ["a", "b", "c"];
const selectedScenarios = requestedScenarioIds.size > 0
  ? scenarios.filter((scenario) => requestedScenarioIds.has(scenario.id))
  : scenarios;
const availablePassiveIds = huppermageCatalog.filter((entry) => entry.kind === "passive").map((entry) => entry.id);

for (const scenario of selectedScenarios) {
  for (const budget of budgets) {
    const rows = seeds.map((seed) => {
      const result = runOptimizerExperiment({
        catalog: huppermageCatalog,
        character,
        duration: scenario.duration,
        engines: ["hybrid"],
        seed: `bench-${scenario.id}-${seed}`,
        budget: { iterations: budget },
        maxActionsPerTurn: scenario.maxActionsPerTurn,
        maxPassiveCount: scenario.maxPassiveCount,
        availablePassiveIds,
        defaultActionContext,
        maxCandidates: 5,
        progressInterval: 1_000_000,
      });
      const engine = result.engineResults[0]!;
      return {
        seed,
        score: round(result.bestCandidate?.score.score ?? 0),
        validRate: round(engine.validCandidates / Math.max(1, engine.attempts), 4),
        attempts: engine.attempts,
        valid: engine.validCandidates,
        invalid: engine.invalidCandidates,
        metrics: engine.metrics,
      };
    });
    const scores = rows.map((row) => row.score).sort((left, right) => left - right);
    const validRates = rows.map((row) => row.validRate).sort((left, right) => left - right);
    console.log(JSON.stringify({
      scenario: scenario.id,
      budget,
      scores,
      medianScore: scores[Math.floor(scores.length / 2)] ?? 0,
      validRates,
      medianValidRate: validRates[Math.floor(validRates.length / 2)] ?? 0,
      rows,
    }));
  }
}

function readOptionValues(name: string): string[] {
  const values: string[] = [];
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1]!);
      index += 1;
    }
  }
  return values;
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}
