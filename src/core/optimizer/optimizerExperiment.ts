import type { CatalogEntry, Resource, SpellCost } from "../catalog/types.ts";
import { simulateCombo } from "../simulation/comboSimulator.ts";
import type { Action, ComboPlan, ComboSimulationOptions, SimulatedCharacter } from "../simulation/types.ts";
import {
  evaluateSustainableCycle,
  scoreComboSimulation,
  scoreSustainableComboSimulation,
  type ComboOptimizationCriterion,
  type ComboScoreBreakdown,
  type ComboSustainability,
} from "./comboOptimizer.ts";

export type OptimizerExperimentEngineKind = "random" | "mcts" | "novelty" | "annealing" | "genetic" | "hybrid";

export type OptimizerExperimentBudget = {
  iterations: number;
};

export type OptimizerExperimentCandidateInput = {
  passiveIds?: string[];
  plan: ComboPlan;
};

export type OptimizerExperimentCandidate = {
  id: string;
  passiveIds: string[];
  plan: ComboPlan;
  score: ComboScoreBreakdown;
  simulation: ReturnType<typeof simulateCombo>;
  sustainability: ComboSustainability;
};

export type OptimizerExperimentProgress = {
  engine: OptimizerExperimentEngineKind;
  attempts: number;
  validCandidates: number;
  invalidCandidates: number;
  bestScore?: number;
  bestCandidate?: OptimizerExperimentCandidate;
  topCandidates: OptimizerExperimentCandidate[];
  metrics: Record<string, number>;
};

export type OptimizerExperimentEngineResult = {
  engine: OptimizerExperimentEngineKind;
  budget: OptimizerExperimentBudget;
  attempts: number;
  validCandidates: number;
  invalidCandidates: number;
  bestCandidate?: OptimizerExperimentCandidate;
  topCandidates: OptimizerExperimentCandidate[];
  progress: OptimizerExperimentProgress[];
  metrics: Record<string, number>;
};

export type OptimizerExperimentResult = {
  seed: string;
  duration: number;
  engineResults: OptimizerExperimentEngineResult[];
  bestCandidate?: OptimizerExperimentCandidate;
};

export type OptimizerExperimentOptions = {
  catalog: CatalogEntry[];
  character: SimulatedCharacter;
  duration: number;
  engines: OptimizerExperimentEngineKind[];
  budget: OptimizerExperimentBudget;
  seed?: string;
  availableSpellIds?: string[];
  availablePassiveIds?: string[];
  maxPassiveCount?: number;
  maxActionsPerTurn?: number;
  criterion?: ComboOptimizationCriterion;
  requireSustainableCycle?: boolean;
  defaultActionContext?: ComboSimulationOptions["defaultActionContext"];
  progressInterval?: number;
  maxCandidates?: number;
  onProgress?: (progress: OptimizerExperimentProgress) => void;
  yieldProgress?: () => Promise<void>;
  signal?: AbortSignal;
};

export type OptimizerExperimentEvaluatorOptions = {
  catalog: CatalogEntry[];
  character: SimulatedCharacter;
  duration: number;
  criterion?: ComboOptimizationCriterion;
  requireSustainableCycle?: boolean;
  defaultActionContext?: ComboSimulationOptions["defaultActionContext"];
};

export type OptimizerExperimentEvaluatorStats = {
  cacheHits: number;
  cacheMisses: number;
};

type OptimizerExperimentEvaluator = {
  evaluate(candidate: OptimizerExperimentCandidateInput): OptimizerExperimentCandidate | null;
  evaluateDetailed(candidate: OptimizerExperimentCandidateInput): OptimizerExperimentEvaluation;
  getStats(): OptimizerExperimentEvaluatorStats;
};

type OptimizerExperimentEvaluation = {
  result: OptimizerExperimentCandidate | null;
  normalizedCandidate: OptimizerExperimentCandidateInput;
  simulation: ReturnType<typeof simulateCombo>;
};

type EngineContext = {
  options: NormalizedExperimentOptions;
  evaluator: OptimizerExperimentEvaluator;
  rng: SeededRandom;
  sampler: CandidateSampler;
};

type NormalizedExperimentOptions = Required<Pick<
  OptimizerExperimentOptions,
  "duration" | "engines" | "budget" | "seed" | "maxPassiveCount" | "maxActionsPerTurn" | "progressInterval"
>> & Omit<OptimizerExperimentOptions, "duration" | "engines" | "budget" | "seed" | "maxPassiveCount" | "maxActionsPerTurn" | "progressInterval">;

type EngineAccumulator = {
  engine: OptimizerExperimentEngineKind;
  budget: OptimizerExperimentBudget;
  attempts: number;
  validCandidates: number;
  invalidCandidates: number;
  bestCandidate?: OptimizerExperimentCandidate;
  topCandidates: Map<string, OptimizerExperimentCandidate>;
  progress: OptimizerExperimentProgress[];
  metrics: Record<string, number>;
};

type CandidateSampler = {
  next(): OptimizerExperimentCandidateInput;
  random(): OptimizerExperimentCandidateInput;
  resourceAware(): OptimizerExperimentCandidateInput;
};

type SeededRandom = {
  next(): number;
  integer(min: number, max: number): number;
  pick<T>(values: T[]): T;
  chance(probability: number): boolean;
};

type ActionStat = {
  visits: number;
  totalReward: number;
};

type SoftResourcePool = Record<Resource, number>;

type NoveltyArchiveEntry = {
  input: OptimizerExperimentCandidateInput;
  result: OptimizerExperimentCandidate;
  descriptor: string[];
  novelty: number;
  localCompetition: number;
};

export function runOptimizerExperiment(options: OptimizerExperimentOptions): OptimizerExperimentResult {
  const normalized = normalizeExperimentOptions(options);
  const engineResults = normalized.engines.map((engine, engineIndex) => {
    const evaluator = createOptimizerExperimentEvaluator(normalized);
    const rng = createSeededRandom(`${normalized.seed}:${engine}:${engineIndex}`);
    const sampler = createCandidateSampler(normalized, rng);
    const context: EngineContext = { options: normalized, evaluator, rng, sampler };

    switch (engine) {
      case "random":
        return runRandomEngine(context);
      case "mcts":
        return runMctsEngine(context);
      case "novelty":
        return runNoveltyEngine(context);
      case "annealing":
        return runAnnealingEngine(context);
      case "genetic":
        return runGeneticEngine(context);
      case "hybrid":
        return runHybridEngine(context);
    }
  });

  return {
    seed: normalized.seed,
    duration: normalized.duration,
    engineResults,
    bestCandidate: pickBestCandidate(engineResults.flatMap((result) => result.bestCandidate ? [result.bestCandidate] : [])),
  };
}

export async function runOptimizerExperimentProgressive(options: OptimizerExperimentOptions): Promise<OptimizerExperimentResult> {
  const normalized = normalizeExperimentOptions(options);
  if (
    normalized.engines.length !== 1
    || (normalized.engines[0] !== "genetic" && normalized.engines[0] !== "hybrid")
  ) {
    return runOptimizerExperiment(options);
  }

  const evaluator = createOptimizerExperimentEvaluator(normalized);
  const engine = normalized.engines[0];
  const rng = createSeededRandom(`${normalized.seed}:${engine}:0`);
  const sampler = createCandidateSampler(normalized, rng);
  const context: EngineContext = { options: normalized, evaluator, rng, sampler };
  const engineResult = engine === "hybrid"
    ? await runHybridEngineProgressive(context)
    : await runGeneticEngineProgressive(context);

  return {
    seed: normalized.seed,
    duration: normalized.duration,
    engineResults: [engineResult],
    bestCandidate: engineResult.bestCandidate,
  };
}

export function createOptimizerExperimentEvaluator(
  options: OptimizerExperimentEvaluatorOptions,
): OptimizerExperimentEvaluator {
  const cache = new Map<string, OptimizerExperimentEvaluation>();
  const stats = {
    cacheHits: 0,
    cacheMisses: 0,
  };

  const evaluateDetailed = (candidate: OptimizerExperimentCandidateInput): OptimizerExperimentEvaluation => {
    const normalizedCandidate = normalizeCandidate(candidate);
    const key = createCandidateCacheKey(options, normalizedCandidate);
    if (cache.has(key)) {
      stats.cacheHits += 1;
      return cache.get(key)!;
    }

    stats.cacheMisses += 1;
    const character = createCandidateCharacter(options.character, normalizedCandidate.passiveIds);
    const simulation = simulateCombo({
      catalog: options.catalog,
      character,
      combo: normalizedCandidate.plan,
      defaultActionContext: options.defaultActionContext,
    });

    if (!simulation.valid) {
      const evaluation = { result: null, normalizedCandidate, simulation };
      cache.set(key, evaluation);
      return evaluation;
    }

    const sustainability = options.requireSustainableCycle
      ? evaluateSustainableCycle({
        catalog: options.catalog,
        character,
        plan: normalizedCandidate.plan,
        defaultActionContext: options.defaultActionContext,
      })
      : {
        required: false,
        sustainable: true,
      };

    if (!sustainability.sustainable) {
      const evaluation = { result: null, normalizedCandidate, simulation };
      cache.set(key, evaluation);
      return evaluation;
    }

    const result = {
      id: serializeExperimentCandidate(normalizedCandidate),
      passiveIds: normalizedCandidate.passiveIds,
      plan: normalizedCandidate.plan,
      simulation,
      score: options.requireSustainableCycle
        ? scoreSustainableComboSimulation(simulation, character, options.criterion)
        : scoreComboSimulation(simulation, options.criterion),
      sustainability,
    };

    const evaluation = { result, normalizedCandidate, simulation };
    cache.set(key, evaluation);
    return evaluation;
  };

  return {
    evaluate(candidate) {
      return evaluateDetailed(candidate).result;
    },
    evaluateDetailed,
    getStats() {
      return { ...stats };
    },
  };
}

function runRandomEngine(context: EngineContext): OptimizerExperimentEngineResult {
  const accumulator = createEngineAccumulator("random", context.options.budget);

  for (let iteration = 0; iteration < context.options.budget.iterations; iteration += 1) {
    evaluateAndRecord(context, accumulator, context.sampler.next());
  }

  return finalizeEngineResult(context, accumulator);
}

function runMctsEngine(context: EngineContext): OptimizerExperimentEngineResult {
  const accumulator = createEngineAccumulator("mcts", context.options.budget);
  const statsByPositionAction = new Map<string, ActionStat>();

  for (let iteration = 0; iteration < context.options.budget.iterations; iteration += 1) {
    const candidate = iteration < Math.min(10, context.options.budget.iterations)
      ? context.sampler.next()
      : createMctsCandidate(context, statsByPositionAction);
    const result = evaluateAndRecord(context, accumulator, candidate);
    if (result) {
      updateMctsStats(statsByPositionAction, candidate.plan, result.score.score);
    }
  }

  accumulator.metrics.mctsNodes = statsByPositionAction.size;
  return finalizeEngineResult(context, accumulator);
}

function runNoveltyEngine(context: EngineContext): OptimizerExperimentEngineResult {
  const accumulator = createEngineAccumulator("novelty", context.options.budget);
  const archive: NoveltyArchiveEntry[] = [];
  const populationSize = Math.max(4, Math.min(24, Math.floor(Math.sqrt(context.options.budget.iterations)) + 4));
  const maxArchiveSize = Math.max(populationSize, Math.min(200, populationSize * 6));
  let maxNovelty = 0;
  let maxLocalCompetition = 0;
  let offspringCount = 0;
  let randomCount = 0;

  while (accumulator.attempts < context.options.budget.iterations) {
    if (context.options.signal?.aborted) {
      break;
    }

    const shouldExploreRandomly = archive.length < populationSize || context.rng.chance(0.15);
    const candidate = shouldExploreRandomly
      ? context.sampler.next()
      : createNoveltyOffspring(context, archive);
    if (shouldExploreRandomly) {
      randomCount += 1;
    } else {
      offspringCount += 1;
    }

    const result = evaluateAndRecord(context, accumulator, candidate);
    if (!result) {
      continue;
    }

    const descriptor = createNoveltyDescriptor(result);
    const novelty = computeNovelty(descriptor, archive);
    const localCompetition = computeLocalCompetition(result, descriptor, archive);
    maxNovelty = Math.max(maxNovelty, novelty);
    maxLocalCompetition = Math.max(maxLocalCompetition, localCompetition);
    addNoveltyArchiveEntry(
      archive,
      {
        input: cloneCandidateInput(candidate),
        result,
        descriptor,
        novelty,
        localCompetition,
      },
      accumulator.bestCandidate,
      maxArchiveSize,
    );
  }

  accumulator.metrics.archiveSize = archive.length;
  accumulator.metrics.populationSize = Math.min(archive.length, populationSize);
  accumulator.metrics.noveltyOffspring = offspringCount;
  accumulator.metrics.noveltyRandom = randomCount;
  accumulator.metrics.maxNovelty = roundMetric(maxNovelty);
  accumulator.metrics.localCompetitionMax = roundMetric(maxLocalCompetition);
  return finalizeEngineResult(context, accumulator);
}

function runAnnealingEngine(context: EngineContext): OptimizerExperimentEngineResult {
  const accumulator = createEngineAccumulator("annealing", context.options.budget);
  let current = context.sampler.next();
  let currentResult: OptimizerExperimentCandidate | null = null;

  for (let iteration = 0; iteration < context.options.budget.iterations; iteration += 1) {
    const candidate = iteration === 0 || !currentResult
      ? context.sampler.next()
      : mutateCandidate(current, context);
    const result = evaluateAndRecord(context, accumulator, candidate);
    const temperature = Math.max(0.01, 1 - iteration / Math.max(1, context.options.budget.iterations));

    if (!currentResult && result) {
      current = candidate;
      currentResult = result;
      continue;
    }

    if (result && shouldAcceptAnnealingCandidate(currentResult, result, temperature, context.rng)) {
      current = candidate;
      currentResult = result;
    }
  }

  accumulator.metrics.finalTemperature = 0.01;
  return finalizeEngineResult(context, accumulator);
}

function runGeneticEngine(context: EngineContext): OptimizerExperimentEngineResult {
  const accumulator = createEngineAccumulator("genetic", context.options.budget);
  const populationSize = Math.max(4, Math.min(24, Math.floor(Math.sqrt(context.options.budget.iterations)) + 4));
  let population: Array<{ input: OptimizerExperimentCandidateInput; result: OptimizerExperimentCandidate }> = [];

  while (accumulator.attempts < context.options.budget.iterations && population.length < populationSize) {
    if (context.options.signal?.aborted) {
      break;
    }
    const input = context.sampler.next();
    const result = evaluateAndRecord(context, accumulator, input);
    if (result) {
      population.push({ input, result });
    }
  }

  while (accumulator.attempts < context.options.budget.iterations) {
    if (context.options.signal?.aborted) {
      break;
    }
    if (population.length < 2) {
      const input = context.sampler.next();
      const result = evaluateAndRecord(context, accumulator, input);
      if (result) {
        population.push({ input, result });
      }
      continue;
    }

    const parentA = tournamentSelect(population, context.rng);
    const parentB = tournamentSelect(population, context.rng);
    const child = mutateCandidate(crossoverCandidates(parentA.input, parentB.input, context.options, context.rng), context);
    const result = evaluateAndRecord(context, accumulator, child);
    if (result) {
      population.push({ input: child, result });
      population = population
        .sort((left, right) => compareCandidates(left.result, right.result))
        .slice(0, populationSize);
    }
  }

  accumulator.metrics.populationSize = population.length;
  return finalizeEngineResult(context, accumulator);
}

function runHybridEngine(context: EngineContext): OptimizerExperimentEngineResult {
  const islandCount = getHybridIslandCount(context.options.budget.iterations);
  if (islandCount <= 1) {
    const result = runHybridSingleEngine(context);
    return {
      ...result,
      metrics: {
        ...result.metrics,
        hybridIslands: 1,
      },
    };
  }

  const baseIterations = Math.floor(context.options.budget.iterations / islandCount);
  const remainder = context.options.budget.iterations % islandCount;
  const islandResults: OptimizerExperimentEngineResult[] = [];

  for (let islandIndex = 0; islandIndex < islandCount; islandIndex += 1) {
    const iterations = baseIterations + (islandIndex < remainder ? 1 : 0);
    const islandOptions: NormalizedExperimentOptions = {
      ...context.options,
      budget: { iterations },
      progressInterval: Math.max(1, Math.floor(iterations / 10)),
    };
    const islandContext: EngineContext = {
      options: islandOptions,
      evaluator: createOptimizerExperimentEvaluator(islandOptions),
      rng: createSeededRandom(`${context.options.seed}:hybrid:island:${islandIndex}`),
      sampler: createCandidateSampler(islandOptions, createSeededRandom(`${context.options.seed}:hybrid:sampler:${islandIndex}`)),
    };
    islandResults.push(runHybridSingleEngine(islandContext));
  }

  return mergeHybridIslandResults(context, islandResults);
}

function runHybridSingleEngine(context: EngineContext): OptimizerExperimentEngineResult {
  const accumulator = createEngineAccumulator("hybrid", context.options.budget);
  const populationSize = Math.max(8, Math.min(96, Math.floor(Math.sqrt(context.options.budget.iterations)) * 2));
  const eliteCount = Math.max(2, Math.ceil(populationSize * 0.15));
  const immigrantBatchSize = Math.max(2, Math.ceil(populationSize * 0.25));
  const stagnationLimit = Math.max(8, Math.min(80, Math.ceil(populationSize * 2)));
  const localRefinementInterval = Math.max(3, Math.floor(populationSize / 4));
  // Per-island threshold: a global 1k run splits to roughly 166 attempts per island.
  const localRefinementPreemptionBudget = 160;
  // Keep repair cascades from starving elite-neighbor exploration on long searches.
  const repairBurstLimit = 2;
  let population: Array<{ input: OptimizerExperimentCandidateInput; result: OptimizerExperimentCandidate }> = [];
  const eliteNeighborQueue: OptimizerExperimentCandidateInput[] = [];
  const repairQueue: OptimizerExperimentCandidateInput[] = [];
  let attemptsSinceImprovement = 0;
  let consecutiveRepairAttempts = 0;

  while (accumulator.attempts < context.options.budget.iterations && population.length < populationSize) {
    if (context.options.signal?.aborted) {
      break;
    }
    const input = context.sampler.next();
    const { result, improved, repairCandidate } = evaluateAndTrackImprovement(context, accumulator, input);
    attemptsSinceImprovement = improved ? 0 : attemptsSinceImprovement + 1;
    if (result) {
      population.push({ input, result });
      if (improved) {
        enqueueHybridEliteNeighbors(eliteNeighborQueue, input, context, accumulator);
      }
    } else {
      enqueueHybridRepairCandidate(repairQueue, repairCandidate, context, accumulator);
    }
  }

  population = rankPopulation(population).slice(0, populationSize);

  while (accumulator.attempts < context.options.budget.iterations) {
    if (context.options.signal?.aborted) {
      break;
    }

    if (population.length < 2) {
      const input = createHybridFreshCandidate(context, accumulator);
      consecutiveRepairAttempts = 0;
      const { result, improved, repairCandidate } = evaluateAndTrackImprovement(context, accumulator, input);
      attemptsSinceImprovement = improved ? 0 : attemptsSinceImprovement + 1;
      if (result) {
        population.push({ input, result });
        if (improved) {
          enqueueHybridEliteNeighbors(eliteNeighborQueue, input, context, accumulator);
        }
        population = rankPopulation(population).slice(0, populationSize);
      } else {
        enqueueHybridRepairCandidate(repairQueue, repairCandidate, context, accumulator);
      }
      continue;
    }

    if (attemptsSinceImprovement >= stagnationLimit) {
      const immigrants = injectHybridImmigrants(context, accumulator, population, eliteNeighborQueue, eliteCount, immigrantBatchSize, populationSize);
      population = immigrants.population;
      attemptsSinceImprovement = immigrants.improved ? 0 : Math.floor(stagnationLimit / 2);
      consecutiveRepairAttempts = 0;
      accumulator.metrics.hybridRestarts = (accumulator.metrics.hybridRestarts ?? 0) + 1;
      accumulator.metrics.hybridImmigrants = (accumulator.metrics.hybridImmigrants ?? 0) + immigrants.count;
      continue;
    }

    const canProcessRepair = repairQueue.length > 0 && consecutiveRepairAttempts < repairBurstLimit;
    if (repairQueue.length > 0 && !canProcessRepair) {
      accumulator.metrics.hybridRepairDeferrals = (accumulator.metrics.hybridRepairDeferrals ?? 0) + 1;
    }

    const repairNeighbor = canProcessRepair ? repairQueue.shift() : undefined;
    const shouldRefineLocally = !repairNeighbor
      && context.options.budget.iterations >= localRefinementPreemptionBudget
      && accumulator.attempts % localRefinementInterval === 0;
    const eliteNeighbor = repairNeighbor || shouldRefineLocally ? undefined : eliteNeighborQueue.shift();
    const input = repairNeighbor
      ?? (shouldRefineLocally
        ? createHybridLocalRefinement(population, context)
        : eliteNeighbor
          ?? createHybridOffspring(population, context, accumulator));
    if (repairNeighbor) {
      accumulator.metrics.hybridRepairCandidates = (accumulator.metrics.hybridRepairCandidates ?? 0) + 1;
      consecutiveRepairAttempts += 1;
    } else {
      consecutiveRepairAttempts = 0;
    }
    if (eliteNeighbor) {
      accumulator.metrics.hybridEliteNeighborCandidates = (accumulator.metrics.hybridEliteNeighborCandidates ?? 0) + 1;
    }
    if (shouldRefineLocally) {
      accumulator.metrics.hybridLocalRefinements = (accumulator.metrics.hybridLocalRefinements ?? 0) + 1;
    }

    const { result, improved, repairCandidate } = evaluateAndTrackImprovement(context, accumulator, input);
    attemptsSinceImprovement = improved ? 0 : attemptsSinceImprovement + 1;
    if (result) {
      population.push({ input, result });
      if (improved) {
        enqueueHybridEliteNeighbors(eliteNeighborQueue, input, context, accumulator);
      }
      population = rankPopulation(population).slice(0, populationSize);
    } else {
      enqueueHybridRepairCandidate(repairQueue, repairCandidate, context, accumulator);
    }
  }

  accumulator.metrics.populationSize = population.length;
  accumulator.metrics.hybridEliteCount = Math.min(eliteCount, population.length);
  accumulator.metrics.hybridStagnationLimit = stagnationLimit;
  return finalizeEngineResult(context, accumulator);
}

function getHybridIslandCount(iterations: number): number {
  if (iterations < 80) {
    return 1;
  }

  return Math.min(6, Math.max(2, Math.floor(Math.sqrt(iterations) / 5)));
}

function mergeHybridIslandResults(
  context: EngineContext,
  islandResults: OptimizerExperimentEngineResult[],
): OptimizerExperimentEngineResult {
  const topCandidates = new Map<string, OptimizerExperimentCandidate>();
  for (const candidate of islandResults.flatMap((result) => result.topCandidates)) {
    topCandidates.set(candidate.id, candidate);
  }
  const rankedTopCandidates = [...topCandidates.values()].sort(compareCandidates);
  const maxCandidates = clampInteger(context.options.maxCandidates ?? 20, 1, 200);
  const metrics = mergeHybridIslandMetrics(islandResults);

  return {
    engine: "hybrid",
    budget: context.options.budget,
    attempts: islandResults.reduce((total, result) => total + result.attempts, 0),
    validCandidates: islandResults.reduce((total, result) => total + result.validCandidates, 0),
    invalidCandidates: islandResults.reduce((total, result) => total + result.invalidCandidates, 0),
    bestCandidate: pickBestCandidate(rankedTopCandidates),
    topCandidates: rankedTopCandidates.slice(0, maxCandidates),
    progress: islandResults.flatMap((result, islandIndex) => result.progress.map((progress) => ({
      ...progress,
      metrics: {
        ...progress.metrics,
        hybridIsland: islandIndex + 1,
        hybridIslands: islandResults.length,
      },
    }))),
    metrics,
  };
}

function mergeHybridIslandMetrics(islandResults: OptimizerExperimentEngineResult[]): Record<string, number> {
  const metrics: Record<string, number> = {
    hybridIslands: islandResults.length,
  };

  for (const result of islandResults) {
    for (const [key, value] of Object.entries(result.metrics)) {
      if (!Number.isFinite(value)) {
        continue;
      }
      metrics[key] = (metrics[key] ?? 0) + value;
    }
  }

  metrics.populationSize = islandResults.reduce((total, result) => total + (result.metrics.populationSize ?? 0), 0);
  return metrics;
}

function evaluateAndTrackImprovement(
  context: EngineContext,
  accumulator: EngineAccumulator,
  input: OptimizerExperimentCandidateInput,
): { result: OptimizerExperimentCandidate | null; improved: boolean; repairCandidate?: OptimizerExperimentCandidateInput } {
  const previousBest = accumulator.bestCandidate;
  const evaluation = evaluateAndRecordDetailed(context, accumulator, input);
  const result = evaluation.result;
  const improved = !previousBest
    ? Boolean(accumulator.bestCandidate)
    : Boolean(accumulator.bestCandidate && compareCandidates(accumulator.bestCandidate, previousBest) < 0);

  return {
    result,
    improved,
    repairCandidate: result ? undefined : createHybridRepairCandidate(evaluation.normalizedCandidate, evaluation.simulation),
  };
}

function createHybridRepairCandidate(
  input: OptimizerExperimentCandidateInput,
  simulation: ReturnType<typeof simulateCombo>,
): OptimizerExperimentCandidateInput | undefined {
  const violation = simulation.violations[0];
  if (!violation || violation.type === "unknownSpell") {
    return undefined;
  }

  const turn = input.plan.turns[violation.turnIndex];
  if (!turn || violation.actionIndex < 0 || violation.actionIndex >= turn.actions.length || turn.actions.length <= 1) {
    return undefined;
  }

  const candidate = cloneCandidateInput(input);
  const actions = candidate.plan.turns[violation.turnIndex]!.actions;
  // Long branches often fail because the suffix over-spends after a valid prefix.
  const deleteCount = input.plan.turns.length >= 2
    ? actions.length - violation.actionIndex
    : 1;
  actions.splice(violation.actionIndex, deleteCount);
  return candidate;
}

function enqueueHybridRepairCandidate(
  queue: OptimizerExperimentCandidateInput[],
  candidate: OptimizerExperimentCandidateInput | undefined,
  context: EngineContext,
  accumulator: EngineAccumulator,
) {
  if (!candidate || queue.length >= 512 || (context.options.duration < 3 && context.options.budget.iterations < 80)) {
    return;
  }

  const key = serializeExperimentCandidate(normalizeCandidate(candidate));
  if (queue.some((queued) => serializeExperimentCandidate(normalizeCandidate(queued)) === key)) {
    return;
  }

  queue.push(candidate);
  accumulator.metrics.hybridRepairQueueCandidates = (accumulator.metrics.hybridRepairQueueCandidates ?? 0) + 1;
}

function injectHybridImmigrants(
  context: EngineContext,
  accumulator: EngineAccumulator,
  population: Array<{ input: OptimizerExperimentCandidateInput; result: OptimizerExperimentCandidate }>,
  eliteNeighborQueue: OptimizerExperimentCandidateInput[],
  eliteCount: number,
  immigrantBatchSize: number,
  populationSize: number,
): {
  population: Array<{ input: OptimizerExperimentCandidateInput; result: OptimizerExperimentCandidate }>;
  count: number;
  improved: boolean;
} {
  const nextPopulation = rankPopulation(population).slice(0, eliteCount);
  let immigrantCount = 0;
  let improved = false;

  while (
    accumulator.attempts < context.options.budget.iterations
    && immigrantCount < immigrantBatchSize
    && nextPopulation.length < populationSize
  ) {
    if (context.options.signal?.aborted) {
      break;
    }
    const input = context.rng.chance(0.35) && nextPopulation.length > 0
      ? createHybridLocalRefinement(nextPopulation, context)
      : createHybridFreshCandidate(context, accumulator);
    const tracked = evaluateAndTrackImprovement(context, accumulator, input);
    improved = improved || tracked.improved;
    immigrantCount += 1;
    if (tracked.result) {
      nextPopulation.push({ input, result: tracked.result });
      if (tracked.improved) {
        enqueueHybridEliteNeighbors(eliteNeighborQueue, input, context, accumulator);
      }
    }
  }

  return {
    population: rankPopulation(nextPopulation).slice(0, populationSize),
    count: immigrantCount,
    improved,
  };
}

function createHybridOffspring(
  population: Array<{ input: OptimizerExperimentCandidateInput; result: OptimizerExperimentCandidate }>,
  context: EngineContext,
  accumulator: EngineAccumulator,
): OptimizerExperimentCandidateInput {
  if (context.rng.chance(0.18)) {
    return createHybridFreshCandidate(context, accumulator);
  }

  const parentA = tournamentSelect(population, context.rng);
  const parentB = tournamentSelect(population, context.rng);
  const child = crossoverCandidates(parentA.input, parentB.input, context.options, context.rng);
  return mutateCandidate(child, context);
}

function createHybridFreshCandidate(
  context: EngineContext,
  accumulator: EngineAccumulator,
): OptimizerExperimentCandidateInput {
  if (context.rng.chance(0.12)) {
    accumulator.metrics.hybridResourceAwareCandidates = (accumulator.metrics.hybridResourceAwareCandidates ?? 0) + 1;
    return context.sampler.resourceAware();
  }

  return context.sampler.random();
}

function enqueueHybridEliteNeighbors(
  queue: OptimizerExperimentCandidateInput[],
  input: OptimizerExperimentCandidateInput,
  context: EngineContext,
  accumulator: EngineAccumulator,
) {
  const maxQueueSize = 1_024;
  const maxGenerated = 640;
  const actions = getTopWeightedActions(context.options, Math.min(20, getSearchActions(context.options).length));
  const pairReplacementActions = getHybridPairReplacementActions(context.options);
  const seen = new Set(queue.map((candidate) => serializeExperimentCandidate(normalizeCandidate(candidate))));
  let generated = 0;
  let pairReplacementGenerated = 0;
  let relocateGenerated = 0;
  let targetFlipGenerated = 0;
  let pivotInsertionGenerated = 0;

  const addCandidate = (candidate: OptimizerExperimentCandidateInput, metric?: string): boolean => {
    if (queue.length >= maxQueueSize || generated >= maxGenerated) {
      return false;
    }

    const normalized = normalizeCandidate(candidate);
    const key = serializeExperimentCandidate(normalized);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    queue.push(normalized);
    generated += 1;
    if (metric) {
      accumulator.metrics[metric] = (accumulator.metrics[metric] ?? 0) + 1;
    }
    return true;
  };

  const availablePassiveIds = getAvailablePassiveIds(context.options)
    .sort((left, right) => getPassiveSearchWeight(right, context.options) - getPassiveSearchWeight(left, context.options));
  const activePassiveIds = [...new Set(input.passiveIds ?? [])]
    .filter((passiveId) => availablePassiveIds.includes(passiveId))
    .sort();
  const missingPassiveIds = availablePassiveIds.filter((passiveId) => !activePassiveIds.includes(passiveId));
  const passiveLimit = Math.min(context.options.maxPassiveCount, availablePassiveIds.length);

  for (const passiveId of activePassiveIds) {
    const candidate = cloneCandidateInput(input);
    candidate.passiveIds = activePassiveIds.filter((activePassiveId) => activePassiveId !== passiveId);
    addCandidate(candidate, "hybridPassiveNeighborCandidates");
  }

  if (activePassiveIds.length < passiveLimit) {
    for (const passiveId of missingPassiveIds.slice(0, 12)) {
      const candidate = cloneCandidateInput(input);
      candidate.passiveIds = [...activePassiveIds, passiveId].sort();
      addCandidate(candidate, "hybridPassiveNeighborCandidates");
    }
  }

  for (const passiveId of activePassiveIds) {
    for (const replacementPassiveId of missingPassiveIds.slice(0, 8)) {
      const candidate = cloneCandidateInput(input);
      candidate.passiveIds = activePassiveIds
        .filter((activePassiveId) => activePassiveId !== passiveId)
        .concat(replacementPassiveId)
        .sort();
      addCandidate(candidate, "hybridPassiveNeighborCandidates");
    }
  }

  for (let turnIndex = input.plan.turns.length - 1; turnIndex >= 0; turnIndex -= 1) {
    const turn = input.plan.turns[turnIndex];
    if (!turn) {
      continue;
    }

    for (let actionIndex = 0; actionIndex < turn.actions.length - 1; actionIndex += 1) {
      if (serializeAction(turn.actions[actionIndex]!) === serializeAction(turn.actions[actionIndex + 1]!)) {
        continue;
      }
      const candidate = cloneCandidateInput(input);
      const actionsToSwap = candidate.plan.turns[turnIndex]!.actions;
      const left = actionsToSwap[actionIndex]!;
      actionsToSwap[actionIndex] = actionsToSwap[actionIndex + 1]!;
      actionsToSwap[actionIndex + 1] = left;
      addCandidate(candidate, "hybridOrderNeighborCandidates");
    }

    if (context.options.duration <= 2) {
      for (let fromIndex = 0; fromIndex < turn.actions.length; fromIndex += 1) {
        for (let toIndex = 0; toIndex < turn.actions.length; toIndex += 1) {
          if (relocateGenerated >= 120) {
            break;
          }
          if (fromIndex === toIndex || fromIndex + 1 === toIndex) {
            continue;
          }
          const candidate = cloneCandidateInput(input);
          const actionsToRelocate = candidate.plan.turns[turnIndex]!.actions;
          const [action] = actionsToRelocate.splice(fromIndex, 1);
          actionsToRelocate.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, action!);
          if (addCandidate(candidate, "hybridRelocateNeighborCandidates")) {
            relocateGenerated += 1;
          }
        }
      }

      const targetFlipSpellIds = new Set(actions
        .filter((action) => action.target?.kind === "emptyCell")
        .map((action) => action.spellId));
      for (let actionIndex = 0; actionIndex < turn.actions.length; actionIndex += 1) {
        if (targetFlipGenerated >= 64) {
          break;
        }
        const action = turn.actions[actionIndex]!;
        if (!targetFlipSpellIds.has(action.spellId)) {
          continue;
        }
        const candidate = cloneCandidateInput(input);
        candidate.plan.turns[turnIndex]!.actions[actionIndex] = action.target?.kind === "emptyCell"
          ? { spellId: action.spellId }
          : { spellId: action.spellId, target: { kind: "emptyCell" } };
        if (addCandidate(candidate, "hybridTargetFlipNeighborCandidates")) {
          targetFlipGenerated += 1;
        }
      }
    } else if (context.options.duration === 3) {
      const useBroadT3Neighbors = context.options.maxPassiveCount > 3;
      const useMicroT3Neighbors = context.options.maxPassiveCount === 3 && context.options.budget.iterations >= 1_000;
      const pivotIndexes = turn.actions
        .map((action, index) => ({
          index,
          isPivot: action.spellId === "coeur-de-lumiere"
            || action.spellId === "runification"
            || action.spellId === "fleche-de-lumiere"
            || action.spellId === "epee-de-lumiere"
            || (useBroadT3Neighbors && (
              action.spellId === "halo-chatoyant"
              || action.spellId === "debacle"
              || action.spellId === "orbes-luisants"
            )),
        }))
        .filter((entry) => entry.isPivot)
        .slice(0, useBroadT3Neighbors ? 6 : 4);

      for (const { index: pivotIndex } of pivotIndexes) {
        for (const fromIndex of [pivotIndex - 2, pivotIndex - 1, pivotIndex + 1, pivotIndex + 2]) {
          if (relocateGenerated >= 32) {
            break;
          }
          if (fromIndex < 0 || fromIndex >= turn.actions.length) {
            continue;
          }
          for (const toIndex of [pivotIndex, pivotIndex + 1]) {
            if (relocateGenerated >= 32) {
              break;
            }
            if (toIndex < 0 || toIndex >= turn.actions.length || fromIndex === toIndex || fromIndex + 1 === toIndex) {
              continue;
            }
            const candidate = cloneCandidateInput(input);
            const actionsToRelocate = candidate.plan.turns[turnIndex]!.actions;
            const [action] = actionsToRelocate.splice(fromIndex, 1);
            actionsToRelocate.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, action!);
            if (addCandidate(candidate, "hybridRelocateNeighborCandidates")) {
              relocateGenerated += 1;
            }
          }
        }
      }

      if (useBroadT3Neighbors || useMicroT3Neighbors) {
        const targetFlipSpellIds = new Set(actions
          .filter((action) => action.target?.kind === "emptyCell")
          .map((action) => action.spellId));
        for (let actionIndex = 0; actionIndex < turn.actions.length; actionIndex += 1) {
          if (targetFlipGenerated >= 64) {
            break;
          }
          const action = turn.actions[actionIndex]!;
          if (!targetFlipSpellIds.has(action.spellId)) {
            continue;
          }
          const candidate = cloneCandidateInput(input);
          candidate.plan.turns[turnIndex]!.actions[actionIndex] = action.target?.kind === "emptyCell"
            ? { spellId: action.spellId }
            : { spellId: action.spellId, target: { kind: "emptyCell" } };
          if (addCandidate(candidate, "hybridTargetFlipNeighborCandidates")) {
            targetFlipGenerated += 1;
          }
        }
      }

      if (useBroadT3Neighbors && turn.actions.length < context.options.maxActionsPerTurn) {
        for (const { index: pivotIndex } of pivotIndexes) {
          for (const insertIndex of [pivotIndex, pivotIndex + 1]) {
            if (pivotInsertionGenerated >= 64) {
              break;
            }
            if (insertIndex < 0 || insertIndex > turn.actions.length) {
              continue;
            }
            for (const action of actions.slice(0, 4)) {
              if (pivotInsertionGenerated >= 64) {
                break;
              }
              const candidate = cloneCandidateInput(input);
              candidate.plan.turns[turnIndex]!.actions.splice(insertIndex, 0, cloneAction(action));
              if (addCandidate(candidate, "hybridPivotInsertionNeighborCandidates")) {
                pivotInsertionGenerated += 1;
              }
            }
          }
        }
      }
    }

    for (let firstIndex = 0; firstIndex < turn.actions.length - 1; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < turn.actions.length; secondIndex += 1) {
        for (const firstAction of pairReplacementActions) {
          if (pairReplacementGenerated >= 160) {
            break;
          }
          if (serializeAction(turn.actions[firstIndex]!) === serializeAction(firstAction)) {
            continue;
          }
          for (const secondAction of pairReplacementActions) {
            if (pairReplacementGenerated >= 160) {
              break;
            }
            if (serializeAction(turn.actions[secondIndex]!) === serializeAction(secondAction)) {
              continue;
            }
            const candidate = cloneCandidateInput(input);
            candidate.plan.turns[turnIndex]!.actions[firstIndex] = cloneAction(firstAction);
            candidate.plan.turns[turnIndex]!.actions[secondIndex] = cloneAction(secondAction);
            if (addCandidate(candidate)) {
              pairReplacementGenerated += 1;
            }
          }
        }
      }
    }
  }

  for (const [turnIndex, turn] of input.plan.turns.entries()) {
    if (turn.actions.length > 1) {
      for (let actionIndex = 0; actionIndex < turn.actions.length; actionIndex += 1) {
        const candidate = cloneCandidateInput(input);
        candidate.plan.turns[turnIndex]?.actions.splice(actionIndex, 1);
        addCandidate(candidate);
      }
    }

    if (turn.actions.length < context.options.maxActionsPerTurn) {
      for (const action of actions.slice(0, 4)) {
        const candidate = cloneCandidateInput(input);
        candidate.plan.turns[turnIndex]?.actions.push(cloneAction(action));
        addCandidate(candidate);
      }
    }

    for (let actionIndex = 0; actionIndex < turn.actions.length; actionIndex += 1) {
      for (const action of actions) {
        if (serializeAction(turn.actions[actionIndex]!) === serializeAction(action)) {
          continue;
        }
        const candidate = cloneCandidateInput(input);
        candidate.plan.turns[turnIndex]!.actions[actionIndex] = cloneAction(action);
        addCandidate(candidate);
      }
    }
  }
}

function getHybridPairReplacementActions(options: NormalizedExperimentOptions): Action[] {
  const entriesBySpellId = new Map(options.catalog.map((entry) => [entry.id, entry]));
  return getSearchActions(options).filter((action) => {
    const spell = entriesBySpellId.get(action.spellId);
    if (!spell || spell.element === "light" || spell.element === "neutral") {
      return false;
    }

    return getSoftCostAmount(spell.cost, "ap") <= 2
      && getSoftCostAmount(spell.cost, "mp") === 0
      && getSoftCostAmount(spell.cost, "wp") === 0
      && getSoftCostAmount(spell.cost, "bq") === 0;
  });
}

function getTopWeightedActions(options: NormalizedExperimentOptions, limit: number): Action[] {
  const entriesBySpellId = new Map(options.catalog.map((entry) => [entry.id, entry]));
  return getSearchActions(options)
    .map((action) => ({
      action,
      weight: getActionSearchWeight(entriesBySpellId.get(action.spellId) ?? {
        kind: "spell",
        id: action.spellId,
        name: action.spellId,
        className: "huppermage",
        level: 0,
        effects: [],
        constraints: [],
        tags: [],
        metadata: {
          status: "unverified",
          normalizedLevel: 0,
          sources: [],
        },
      }),
    }))
    .sort((left, right) => right.weight - left.weight)
    .slice(0, Math.max(1, limit))
    .map((entry) => entry.action);
}

function createHybridLocalRefinement(
  population: Array<{ input: OptimizerExperimentCandidateInput; result: OptimizerExperimentCandidate }>,
  context: EngineContext,
): OptimizerExperimentCandidateInput {
  const ranked = rankPopulation(population);
  const parent = ranked[context.rng.integer(0, Math.min(4, ranked.length - 1))] ?? tournamentSelect(population, context.rng);
  let candidate = cloneCandidateInput(parent.input);
  const mutationCount = context.rng.integer(1, 3);

  for (let index = 0; index < mutationCount; index += 1) {
    candidate = mutateCandidate(candidate, context);
  }

  return candidate;
}

function rankPopulation(
  population: Array<{ input: OptimizerExperimentCandidateInput; result: OptimizerExperimentCandidate }>,
): Array<{ input: OptimizerExperimentCandidateInput; result: OptimizerExperimentCandidate }> {
  return population.sort((left, right) => compareCandidates(left.result, right.result));
}

async function runHybridEngineProgressive(context: EngineContext): Promise<OptimizerExperimentEngineResult> {
  const islandCount = getHybridIslandCount(context.options.budget.iterations);
  if (islandCount <= 1) {
    const result = await runHybridSingleEngineProgressive(context);
    return {
      ...result,
      metrics: {
        ...result.metrics,
        hybridIslands: 1,
      },
    };
  }

  const baseIterations = Math.floor(context.options.budget.iterations / islandCount);
  const remainder = context.options.budget.iterations % islandCount;
  const islandResults: OptimizerExperimentEngineResult[] = [];
  let attemptOffset = 0;

  for (let islandIndex = 0; islandIndex < islandCount; islandIndex += 1) {
    const iterations = baseIterations + (islandIndex < remainder ? 1 : 0);
    const islandOptions: NormalizedExperimentOptions = {
      ...context.options,
      budget: { iterations },
      progressInterval: Math.max(1, Math.floor(iterations / 10)),
      onProgress: (progress) => {
        context.options.onProgress?.({
          ...progress,
          attempts: attemptOffset + progress.attempts,
          metrics: {
            ...progress.metrics,
            hybridIsland: islandIndex + 1,
            hybridIslands: islandCount,
          },
        });
      },
    };
    const islandContext: EngineContext = {
      options: islandOptions,
      evaluator: createOptimizerExperimentEvaluator(islandOptions),
      rng: createSeededRandom(`${context.options.seed}:hybrid:progressive-island:${islandIndex}`),
      sampler: createCandidateSampler(islandOptions, createSeededRandom(`${context.options.seed}:hybrid:progressive-sampler:${islandIndex}`)),
    };
    const islandResult = await runHybridSingleEngineProgressive(islandContext);
    islandResults.push(islandResult);
    attemptOffset += islandResult.attempts;
  }

  return mergeHybridIslandResults(context, islandResults);
}

async function runHybridSingleEngineProgressive(context: EngineContext): Promise<OptimizerExperimentEngineResult> {
  const accumulator = createEngineAccumulator("hybrid", context.options.budget);
  const populationSize = Math.max(8, Math.min(96, Math.floor(Math.sqrt(context.options.budget.iterations)) * 2));
  const eliteCount = Math.max(2, Math.ceil(populationSize * 0.15));
  const immigrantBatchSize = Math.max(2, Math.ceil(populationSize * 0.25));
  const stagnationLimit = Math.max(8, Math.min(80, Math.ceil(populationSize * 2)));
  const localRefinementInterval = Math.max(3, Math.floor(populationSize / 4));
  // Per-island threshold: a global 1k run splits to roughly 166 attempts per island.
  const localRefinementPreemptionBudget = 160;
  // Keep repair cascades from starving elite-neighbor exploration on long searches.
  const repairBurstLimit = 2;
  let population: Array<{ input: OptimizerExperimentCandidateInput; result: OptimizerExperimentCandidate }> = [];
  const eliteNeighborQueue: OptimizerExperimentCandidateInput[] = [];
  const repairQueue: OptimizerExperimentCandidateInput[] = [];
  let attemptsSinceImprovement = 0;
  let consecutiveRepairAttempts = 0;

  while (accumulator.attempts < context.options.budget.iterations && population.length < populationSize) {
    if (context.options.signal?.aborted) {
      break;
    }
    const input = context.sampler.next();
    const { result, improved, repairCandidate } = evaluateAndTrackImprovement(context, accumulator, input);
    attemptsSinceImprovement = improved ? 0 : attemptsSinceImprovement + 1;
    if (result) {
      population.push({ input, result });
      if (improved) {
        enqueueHybridEliteNeighbors(eliteNeighborQueue, input, context, accumulator);
      }
    } else {
      enqueueHybridRepairCandidate(repairQueue, repairCandidate, context, accumulator);
    }
    await yieldHybridProgress(context, accumulator, population.length, populationSize);
  }

  population = rankPopulation(population).slice(0, populationSize);

  while (accumulator.attempts < context.options.budget.iterations) {
    if (context.options.signal?.aborted) {
      break;
    }

    if (population.length < 2) {
      const input = createHybridFreshCandidate(context, accumulator);
      consecutiveRepairAttempts = 0;
      const { result, improved, repairCandidate } = evaluateAndTrackImprovement(context, accumulator, input);
      attemptsSinceImprovement = improved ? 0 : attemptsSinceImprovement + 1;
      if (result) {
        population.push({ input, result });
        if (improved) {
          enqueueHybridEliteNeighbors(eliteNeighborQueue, input, context, accumulator);
        }
        population = rankPopulation(population).slice(0, populationSize);
      } else {
        enqueueHybridRepairCandidate(repairQueue, repairCandidate, context, accumulator);
      }
      await yieldHybridProgress(context, accumulator, population.length, populationSize);
      continue;
    }

    if (attemptsSinceImprovement >= stagnationLimit) {
      const immigrants = injectHybridImmigrants(context, accumulator, population, eliteNeighborQueue, eliteCount, immigrantBatchSize, populationSize);
      population = immigrants.population;
      attemptsSinceImprovement = immigrants.improved ? 0 : Math.floor(stagnationLimit / 2);
      consecutiveRepairAttempts = 0;
      accumulator.metrics.hybridRestarts = (accumulator.metrics.hybridRestarts ?? 0) + 1;
      accumulator.metrics.hybridImmigrants = (accumulator.metrics.hybridImmigrants ?? 0) + immigrants.count;
      await yieldHybridProgress(context, accumulator, population.length, populationSize);
      continue;
    }

    const canProcessRepair = repairQueue.length > 0 && consecutiveRepairAttempts < repairBurstLimit;
    if (repairQueue.length > 0 && !canProcessRepair) {
      accumulator.metrics.hybridRepairDeferrals = (accumulator.metrics.hybridRepairDeferrals ?? 0) + 1;
    }

    const repairNeighbor = canProcessRepair ? repairQueue.shift() : undefined;
    const shouldRefineLocally = !repairNeighbor
      && context.options.budget.iterations >= localRefinementPreemptionBudget
      && accumulator.attempts % localRefinementInterval === 0;
    const eliteNeighbor = repairNeighbor || shouldRefineLocally ? undefined : eliteNeighborQueue.shift();
    const input = repairNeighbor
      ?? (shouldRefineLocally
        ? createHybridLocalRefinement(population, context)
        : eliteNeighbor
          ?? createHybridOffspring(population, context, accumulator));
    if (repairNeighbor) {
      accumulator.metrics.hybridRepairCandidates = (accumulator.metrics.hybridRepairCandidates ?? 0) + 1;
      consecutiveRepairAttempts += 1;
    } else {
      consecutiveRepairAttempts = 0;
    }
    if (eliteNeighbor) {
      accumulator.metrics.hybridEliteNeighborCandidates = (accumulator.metrics.hybridEliteNeighborCandidates ?? 0) + 1;
    }
    if (shouldRefineLocally) {
      accumulator.metrics.hybridLocalRefinements = (accumulator.metrics.hybridLocalRefinements ?? 0) + 1;
    }

    const { result, improved, repairCandidate } = evaluateAndTrackImprovement(context, accumulator, input);
    attemptsSinceImprovement = improved ? 0 : attemptsSinceImprovement + 1;
    if (result) {
      population.push({ input, result });
      if (improved) {
        enqueueHybridEliteNeighbors(eliteNeighborQueue, input, context, accumulator);
      }
      population = rankPopulation(population).slice(0, populationSize);
    } else {
      enqueueHybridRepairCandidate(repairQueue, repairCandidate, context, accumulator);
    }
    await yieldHybridProgress(context, accumulator, population.length, populationSize);
  }

  accumulator.metrics.populationSize = population.length;
  accumulator.metrics.hybridEliteCount = Math.min(eliteCount, population.length);
  accumulator.metrics.hybridStagnationLimit = stagnationLimit;
  return finalizeEngineResult(context, accumulator);
}

async function yieldHybridProgress(
  context: EngineContext,
  accumulator: EngineAccumulator,
  populationSize: number,
  targetPopulationSize: number,
) {
  if (!context.options.yieldProgress || accumulator.attempts % context.options.progressInterval !== 0) {
    return;
  }

  accumulator.metrics.populationSize = populationSize;
  accumulator.metrics.targetPopulationSize = targetPopulationSize;
  await context.options.yieldProgress();
}

async function runGeneticEngineProgressive(context: EngineContext): Promise<OptimizerExperimentEngineResult> {
  const accumulator = createEngineAccumulator("genetic", context.options.budget);
  const populationSize = Math.max(4, Math.min(24, Math.floor(Math.sqrt(context.options.budget.iterations)) + 4));
  let population: Array<{ input: OptimizerExperimentCandidateInput; result: OptimizerExperimentCandidate }> = [];

  while (accumulator.attempts < context.options.budget.iterations && population.length < populationSize) {
    if (context.options.signal?.aborted) {
      break;
    }
    const input = context.sampler.next();
    const result = evaluateAndRecord(context, accumulator, input);
    if (result) {
      population.push({ input, result });
    }
    await yieldGeneticProgress(context, accumulator, population.length, populationSize);
  }

  while (accumulator.attempts < context.options.budget.iterations) {
    if (context.options.signal?.aborted) {
      break;
    }
    if (population.length < 2) {
      const input = context.sampler.next();
      const result = evaluateAndRecord(context, accumulator, input);
      if (result) {
        population.push({ input, result });
      }
      await yieldGeneticProgress(context, accumulator, population.length, populationSize);
      continue;
    }

    const parentA = tournamentSelect(population, context.rng);
    const parentB = tournamentSelect(population, context.rng);
    const child = mutateCandidate(crossoverCandidates(parentA.input, parentB.input, context.options, context.rng), context);
    const result = evaluateAndRecord(context, accumulator, child);
    if (result) {
      population.push({ input: child, result });
      population = population
        .sort((left, right) => compareCandidates(left.result, right.result))
        .slice(0, populationSize);
    }
    await yieldGeneticProgress(context, accumulator, population.length, populationSize);
  }

  accumulator.metrics.populationSize = population.length;
  return finalizeEngineResult(context, accumulator);
}

function evaluateAndRecord(
  context: EngineContext,
  accumulator: EngineAccumulator,
  candidate: OptimizerExperimentCandidateInput,
): OptimizerExperimentCandidate | null {
  return evaluateAndRecordDetailed(context, accumulator, candidate).result;
}

function evaluateAndRecordDetailed(
  context: EngineContext,
  accumulator: EngineAccumulator,
  candidate: OptimizerExperimentCandidateInput,
): OptimizerExperimentEvaluation {
  accumulator.attempts += 1;
  const evaluation = context.evaluator.evaluateDetailed(candidate);
  if (evaluation.result) {
    accumulator.validCandidates += 1;
    addTopCandidate(context, accumulator, evaluation.result);
    if (!accumulator.bestCandidate || compareCandidates(evaluation.result, accumulator.bestCandidate) < 0) {
      accumulator.bestCandidate = evaluation.result;
      recordProgress(context, accumulator);
    }
  } else {
    accumulator.invalidCandidates += 1;
  }

  if (accumulator.attempts % context.options.progressInterval === 0) {
    recordProgress(context, accumulator);
  }

  return evaluation;
}

function recordProgress(context: EngineContext, accumulator: EngineAccumulator) {
  const evaluatorStats = context.evaluator.getStats();
  const snapshot = {
    engine: accumulator.engine,
    attempts: accumulator.attempts,
    validCandidates: accumulator.validCandidates,
    invalidCandidates: accumulator.invalidCandidates,
    bestScore: accumulator.bestCandidate?.score.score,
    bestCandidate: accumulator.bestCandidate,
    topCandidates: [...accumulator.topCandidates.values()].sort(compareCandidates),
    metrics: {
      ...accumulator.metrics,
      ...evaluatorStats,
    },
  };
  accumulator.progress.push(snapshot);
  context.options.onProgress?.(snapshot);
}

async function yieldGeneticProgress(
  context: EngineContext,
  accumulator: EngineAccumulator,
  populationSize: number,
  targetPopulationSize: number,
) {
  if (!context.options.yieldProgress || accumulator.attempts % context.options.progressInterval !== 0) {
    return;
  }

  accumulator.metrics.populationSize = populationSize;
  accumulator.metrics.targetPopulationSize = targetPopulationSize;
  await context.options.yieldProgress();
}

function finalizeEngineResult(context: EngineContext, accumulator: EngineAccumulator): OptimizerExperimentEngineResult {
  if (accumulator.progress.length === 0 || accumulator.progress.at(-1)?.attempts !== accumulator.attempts) {
    recordProgress(context, accumulator);
  }

  return {
    engine: accumulator.engine,
    budget: accumulator.budget,
    attempts: accumulator.attempts,
    validCandidates: accumulator.validCandidates,
    invalidCandidates: accumulator.invalidCandidates,
    bestCandidate: accumulator.bestCandidate,
    topCandidates: [...accumulator.topCandidates.values()].sort(compareCandidates),
    progress: accumulator.progress,
    metrics: {
      ...accumulator.metrics,
      ...context.evaluator.getStats(),
    },
  };
}

function createCandidateSampler(options: NormalizedExperimentOptions, rng: SeededRandom): CandidateSampler {
  const actions = getSearchActions(options);
  const domainWarmupCandidates = createDomainWarmupCandidates(options, actions);
  const warmupCandidates = [
    ...domainWarmupCandidates,
    ...createWarmupCandidates(options, actions, Math.max(0, 5_000 - domainWarmupCandidates.length)),
  ];
  let warmupIndex = 0;

  return {
    next() {
      if (warmupIndex < warmupCandidates.length) {
        const candidate = warmupCandidates[warmupIndex];
        warmupIndex += 1;
        return cloneCandidateInput(candidate);
      }
      return createRandomCandidate(options, actions, rng);
    },
    random() {
      return createRandomCandidate(options, actions, rng);
    },
    resourceAware() {
      return createResourceAwareCandidate(options, actions, rng);
    },
  };
}

function createDomainWarmupCandidates(
  options: NormalizedExperimentOptions,
  actions: Action[],
): OptimizerExperimentCandidateInput[] {
  const seeds = getHuppermageDomainSeedCandidates();
  const actionByKey = new Map(actions.map((action) => [serializeAction(action), action]));
  const availablePassiveIds = new Set(getAvailablePassiveIds(options));
  const extensionActions = getTopWeightedActions(options, Math.min(16, actions.length));
  const candidates: OptimizerExperimentCandidateInput[] = [];

  for (const seed of seeds) {
    if (
      seed.turns.length > options.duration
      || (seed.maxDuration && options.duration > seed.maxDuration)
      || (seed.minPassiveCount && options.maxPassiveCount < seed.minPassiveCount)
    ) {
      continue;
    }

    const passiveVariants = createDomainSeedPassiveVariants(seed.passiveIds, options, availablePassiveIds);
    if (passiveVariants.length === 0) {
      continue;
    }

    const turns = seed.turns.map((turn) => (
      turn.slice(0, options.maxActionsPerTurn).map((actionKey) => actionByKey.get(actionKey))
    ));
    if (turns.some((turn) => turn.some((action) => !action))) {
      continue;
    }

    const baseTurns = [
      ...turns.map((turn) => ({
        actions: turn.map((action) => cloneAction(action!)),
      })),
      ...Array.from({ length: options.duration - seed.turns.length }, () => ({ actions: [] })),
    ];

    for (const passiveIds of passiveVariants) {
      candidates.push({
        passiveIds,
        plan: {
          turns: baseTurns.map(cloneTurn),
        },
      });
    }

    if (seed.turns.length < options.duration) {
      for (const turn of baseTurns.slice(0, seed.turns.length)) {
        if (turn.actions.length === 0) {
          continue;
        }
        const extendedTurns = baseTurns.map(cloneTurn);
        extendedTurns[seed.turns.length] = cloneTurn(turn);
        for (const passiveIds of passiveVariants) {
          candidates.push({
            passiveIds,
            plan: {
              turns: extendedTurns,
            },
          });
        }
      }

      for (const action of extensionActions) {
        const extendedTurns = baseTurns.map(cloneTurn);
        extendedTurns[seed.turns.length]!.actions.push(cloneAction(action));
        for (const passiveIds of passiveVariants) {
          candidates.push({
            passiveIds,
            plan: {
              turns: extendedTurns,
            },
          });
        }
      }
    }
  }

  return candidates;
}

function createDomainSeedPassiveVariants(
  passiveIds: string[],
  options: NormalizedExperimentOptions,
  availablePassiveIds: Set<string>,
): string[][] {
  const availableSeedPassives = passiveIds.filter((passiveId) => availablePassiveIds.has(passiveId));
  const passiveLimit = Math.min(options.maxPassiveCount, availableSeedPassives.length);
  if (passiveLimit === 0) {
    return [[]];
  }
  if (availableSeedPassives.length <= options.maxPassiveCount) {
    return [availableSeedPassives];
  }

  return combinePassiveVariants(availableSeedPassives, passiveLimit)
    .sort((left, right) => scorePassiveVariant(right, options) - scorePassiveVariant(left, options))
    .slice(0, 24);
}

function combinePassiveVariants(passiveIds: string[], size: number): string[][] {
  if (size === 0) {
    return [[]];
  }
  if (passiveIds.length < size) {
    return [];
  }

  const [firstPassiveId, ...remainingPassiveIds] = passiveIds;
  const withFirst = combinePassiveVariants(remainingPassiveIds, size - 1)
    .map((variant) => [firstPassiveId!, ...variant].sort());
  const withoutFirst = combinePassiveVariants(remainingPassiveIds, size);
  return [...withFirst, ...withoutFirst];
}

function scorePassiveVariant(passiveIds: string[], options: NormalizedExperimentOptions): number {
  return passiveIds.reduce((total, passiveId) => total + getPassiveSearchWeight(passiveId, options), 0);
}

function getHuppermageDomainSeedCandidates(): Array<{
  passiveIds: string[];
  turns: string[][];
  maxDuration?: number;
  minPassiveCount?: number;
}> {
  return [
    {
      passiveIds: [
        "carnage",
        "extension-des-sens",
        "profusion-runique",
      ],
      turns: [
        [
          "halo-chatoyant",
          "eboulement",
          "coeur-de-lumiere",
          "papillons-diurnes",
          "flux-denergie",
          "debacle",
          "orbes-luisants",
          "orbes-luisants",
        ],
        [
          "coeur-de-lumiere",
          "runification",
          "debacle",
          "fleche-de-lumiere",
          "epee-de-lumiere",
          "eboulement",
          "ombres-dansantes",
          "halo-chatoyant",
        ],
        [
          "halo-chatoyant",
          "eboulement",
          "coeur-de-lumiere",
          "eboulement",
          "papillons-diurnes",
          "debacle",
          "orbes-luisants",
          "halo-chatoyant@emptyCell",
        ],
      ],
    },
    {
      passiveIds: [
        "carnage",
        "extension-des-sens",
        "profusion-runique",
      ],
      turns: [
        [
          "eboulement",
          "coeur-de-lumiere",
          "halo-chatoyant",
          "papillons-diurnes",
          "flux-denergie",
          "debacle",
          "orbes-luisants",
          "orbes-luisants",
        ],
        [
          "coeur-de-lumiere",
          "runification",
          "debacle",
          "fleche-de-lumiere",
          "epee-de-lumiere",
          "eboulement",
          "ombres-dansantes",
          "halo-chatoyant",
        ],
        [
          "halo-chatoyant",
          "eboulement",
          "coeur-de-lumiere",
          "halo-chatoyant@emptyCell",
          "papillons-diurnes",
          "debacle",
          "orbes-luisants",
          "halo-chatoyant@emptyCell",
        ],
      ],
    },
    {
      passiveIds: [
        "carnage",
        "extension-des-sens",
        "profusion-runique",
      ],
      turns: [
        [
          "halo-chatoyant",
          "eboulement",
          "coeur-de-lumiere",
          "papillons-diurnes",
          "flux-denergie",
          "debacle",
          "orbes-luisants",
          "orbes-luisants",
        ],
        [
          "coeur-de-lumiere",
          "runification",
          "eboulement",
          "debacle",
          "fleche-de-lumiere",
          "ombres-dansantes",
          "halo-chatoyant",
          "epee-de-lumiere",
        ],
        [
          "halo-chatoyant",
          "eboulement",
          "coeur-de-lumiere",
          "papillons-diurnes",
          "flux-denergie",
          "debacle",
          "orbes-luisants",
          "halo-chatoyant@emptyCell",
        ],
      ],
    },
    {
      passiveIds: [
        "carnage",
        "extension-des-sens",
        "profusion-runique",
      ],
      turns: [
        [
          "halo-chatoyant",
          "eboulement",
          "coeur-de-lumiere",
          "papillons-diurnes",
          "flux-denergie",
          "debacle",
          "orbes-luisants",
          "orbes-luisants",
        ],
        [
          "coeur-de-lumiere",
          "runification",
          "eboulement",
          "debacle",
          "fleche-de-lumiere",
          "ombres-dansantes",
          "halo-chatoyant",
          "epee-de-lumiere",
        ],
      ],
    },
    {
      passiveIds: [
        "carnage",
        "extension-des-sens",
        "profusion-runique",
      ],
      turns: [
        [
          "eboulement",
          "coeur-de-lumiere",
          "flux-denergie",
          "papillons-diurnes",
          "debacle",
          "orbes-luisants",
          "orbes-luisants",
        ],
        [
          "coeur-de-lumiere",
          "runification",
          "debacle",
          "debacle",
          "fleche-de-lumiere",
          "epee-de-lumiere",
          "epee-de-lumiere",
        ],
      ],
      maxDuration: 2,
      minPassiveCount: 3,
    },
    {
      passiveIds: [
        "carnage",
        "extension-des-sens",
        "profusion-runique",
      ],
      turns: [
        [
          "eboulement",
          "coeur-de-lumiere",
          "flux-denergie",
          "papillons-diurnes",
          "debacle",
          "orbes-luisants",
          "orbes-luisants",
        ],
        [
          "coeur-de-lumiere",
          "runification",
          "eboulement",
          "debacle",
          "fleche-de-lumiere",
          "orbes-luisants",
          "epee-de-lumiere",
        ],
      ],
      maxDuration: 2,
    },
    {
      passiveIds: [
        "carnage",
        "extension-des-sens",
        "profusion-runique",
      ],
      turns: [
        [
          "eboulement",
          "coeur-de-lumiere",
          "rayon-crepusculaire",
          "flux-denergie",
          "papillons-diurnes",
          "debacle",
          "orbes-luisants",
        ],
        [
          "coeur-de-lumiere",
          "runification",
          "debacle",
          "fleche-de-lumiere",
          "orbes-luisants",
          "papillons-diurnes",
          "epee-de-lumiere",
        ],
      ],
    },
    {
      passiveIds: [
        "carnage",
        "extension-des-sens",
      ],
      turns: [
        [
          "eboulement",
          "coeur-de-lumiere",
          "halo-chatoyant",
          "papillons-diurnes",
          "flux-denergie",
          "debacle",
          "orbes-luisants",
          "orbes-luisants",
        ],
        [
          "coeur-de-lumiere",
          "runification",
          "debacle",
          "fleche-de-lumiere",
          "epee-de-lumiere",
          "eboulement",
          "ombres-dansantes",
          "halo-chatoyant",
        ],
      ],
    },
    {
      passiveIds: [
        "carnage",
        "extension-des-sens",
        "profusion-runique",
      ],
      turns: [
        [
          "halo-chatoyant",
          "eboulement",
          "coeur-de-lumiere",
          "papillons-diurnes",
          "flux-denergie",
          "debacle",
          "orbes-luisants",
          "orbes-luisants",
        ],
        [
          "coeur-de-lumiere",
          "runification",
          "papillons-diurnes",
          "debacle",
          "fleche-de-lumiere",
          "eboulement",
          "halo-chatoyant",
          "epee-de-lumiere",
        ],
      ],
    },
    {
      passiveIds: [
        "carnage",
        "extension-des-sens",
        "fluctuation",
        "liaison-lumineuse",
        "profusion-runique",
        "sauvegarde-runique",
      ],
      turns: [
        [
          "flux-denergie",
          "eboulement",
          "coeur-de-lumiere",
          "papillons-diurnes",
          "epee-de-lumiere",
          "orbes-luisants",
          "debacle",
          "debacle",
          "cycle-elementaire",
        ],
        [
          "coeur-de-lumiere",
          "runification",
          "ombres-dansantes",
          "debacle",
          "fleche-de-lumiere",
          "flux-denergie",
          "halo-chatoyant@emptyCell",
          "epee-de-lumiere",
        ],
      ],
    },
  ];
}

function createWarmupCandidates(
  options: NormalizedExperimentOptions,
  actions: Action[],
  limit: number,
): OptimizerExperimentCandidateInput[] {
  if (options.maxActionsPerTurn !== 1) {
    return [];
  }

  const passiveSelections = createPassiveSelections(options);
  const plans = combineSingleActionTurns(actions, options.duration, limit);
  const candidates: OptimizerExperimentCandidateInput[] = [];

  for (const passiveIds of passiveSelections) {
    for (const plan of plans) {
      candidates.push({ passiveIds, plan });
      if (candidates.length >= limit) {
        return candidates;
      }
    }
  }

  return candidates;
}

function combineSingleActionTurns(actions: Action[], duration: number, limit: number): ComboPlan[] {
  if (duration === 0) {
    return [{ turns: [] }];
  }

  const shorterPlans = combineSingleActionTurns(actions, duration - 1, limit);
  const plans: ComboPlan[] = [];
  for (const action of actions) {
    for (const plan of shorterPlans) {
      plans.push({
        turns: [{ actions: [cloneAction(action)] }, ...plan.turns.map(cloneTurn)],
      });
      if (plans.length >= limit) {
        return plans;
      }
    }
  }
  return plans;
}

function createRandomCandidate(
  options: NormalizedExperimentOptions,
  actions: Action[],
  rng: SeededRandom,
): OptimizerExperimentCandidateInput {
  return {
    passiveIds: pickRandomPassives(options, rng),
    plan: {
      turns: Array.from({ length: options.duration }, () => ({
        actions: Array.from({ length: rng.integer(1, options.maxActionsPerTurn) }, () => cloneAction(rng.pick(actions))),
      })),
    },
  };
}

function createResourceAwareCandidate(
  options: NormalizedExperimentOptions,
  actions: Action[],
  rng: SeededRandom,
): OptimizerExperimentCandidateInput {
  const entriesBySpellId = new Map(options.catalog.map((entry) => [entry.id, entry]));
  const baseResources = { ...options.character.resources };
  const resources: SoftResourcePool = { ...baseResources };
  const turns = [];

  for (let turnIndex = 0; turnIndex < options.duration; turnIndex += 1) {
    resources.ap = baseResources.ap;
    resources.mp = baseResources.mp;

    const turnActions: Action[] = [];
    const castsBySpellId = new Map<string, number>();
    const targetCastsBySpellId = new Map<string, number>();
    const targetActionCount = rng.integer(
      Math.max(1, Math.floor(options.maxActionsPerTurn * 0.55)),
      options.maxActionsPerTurn,
    );

    for (let actionIndex = 0; actionIndex < targetActionCount; actionIndex += 1) {
      const affordableActions = actions.filter((action) => {
        const spell = entriesBySpellId.get(action.spellId);
        return spell
          && canUseActionSoftly(action, spell, resources, castsBySpellId, targetCastsBySpellId);
      });

      if (affordableActions.length === 0) {
        break;
      }

      const action = cloneAction(pickWeightedAction(affordableActions, entriesBySpellId, rng));
      turnActions.push(action);
      const spell = entriesBySpellId.get(action.spellId);
      if (spell) {
        applySoftActionResources(resources, spell.cost, spell);
        castsBySpellId.set(spell.id, (castsBySpellId.get(spell.id) ?? 0) + 1);
        if (countsAsSoftTargetCast(action)) {
          targetCastsBySpellId.set(spell.id, (targetCastsBySpellId.get(spell.id) ?? 0) + 1);
        }
      }
    }

    if (turnActions.length === 0) {
      turnActions.push(cloneAction(rng.pick(actions)));
    }

    turns.push({ actions: turnActions });
  }

  return {
    passiveIds: pickRandomPassives(options, rng),
    plan: { turns },
  };
}

function canUseActionSoftly(
  action: Action,
  spell: CatalogEntry,
  resources: SoftResourcePool,
  castsBySpellId: Map<string, number>,
  targetCastsBySpellId: Map<string, number>,
): boolean {
  if (!canAffordCost(resources, spell.cost)) {
    return false;
  }

  for (const constraint of spell.constraints) {
    if (constraint.type === "requiresTarget" && action.target?.kind !== constraint.target) {
      return false;
    }

    if (constraint.type === "maxCastsPerTurn" && (castsBySpellId.get(spell.id) ?? 0) >= constraint.value) {
      return false;
    }

    if (
      constraint.type === "maxCastsPerTarget"
      && countsAsSoftTargetCast(action)
      && (targetCastsBySpellId.get(spell.id) ?? 0) >= constraint.value
    ) {
      return false;
    }
  }

  return true;
}

function canAffordCost(resources: SoftResourcePool, cost: SpellCost | undefined): boolean {
  return getSoftCostAmount(cost, "ap") <= resources.ap
    && getSoftCostAmount(cost, "mp") <= resources.mp
    && getSoftCostAmount(cost, "wp") <= resources.wp
    && getSoftCostAmount(cost, "bq") <= resources.bq;
}

function applySoftActionResources(
  resources: SoftResourcePool,
  cost: SpellCost | undefined,
  spell: CatalogEntry,
) {
  resources.ap -= getSoftCostAmount(cost, "ap");
  resources.mp -= getSoftCostAmount(cost, "mp");
  resources.wp -= getSoftCostAmount(cost, "wp");
  resources.bq -= getSoftCostAmount(cost, "bq");

  for (const effect of spell.effects) {
    if (effect.type === "resourceDelta" && (!effect.target || effect.target === "caster")) {
      resources[effect.resource] = Math.max(0, resources[effect.resource] + effect.amount);
    }
  }
}

function pickWeightedAction(
  actions: Action[],
  entriesBySpellId: Map<string, CatalogEntry>,
  rng: SeededRandom,
): Action {
  const weightedActions = actions.map((action) => {
    const spell = entriesBySpellId.get(action.spellId);
    return {
      action,
      weight: spell ? getActionSearchWeight(spell) : 1,
    };
  });
  const totalWeight = weightedActions.reduce((total, entry) => total + entry.weight, 0);
  let cursor = rng.next() * totalWeight;

  for (const entry of weightedActions) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.action;
    }
  }

  return weightedActions.at(-1)?.action ?? actions[0]!;
}

function getActionSearchWeight(spell: CatalogEntry): number {
  let weight = 1;
  for (const effect of spell.effects) {
    if (effect.type === "damage") {
      weight += (effect.base * (effect.times ?? 1)) / 25;
    }
    if (effect.type === "resourceDelta" && (!effect.target || effect.target === "caster") && effect.amount > 0) {
      weight += 1;
    }
  }

  for (const tag of spell.tags) {
    if (tag === "light" || tag === "burst" || tag === "rune-consumer" || tag === "mark" || tag === "scales-with-bq") {
      weight += 2;
    }
  }

  return Math.max(1, weight);
}

function getSoftCostAmount(cost: SpellCost | undefined, resource: Resource): number {
  return Math.max(0, cost?.[resource] ?? 0);
}

function countsAsSoftTargetCast(action: Action): boolean {
  return action.target?.kind !== "emptyCell";
}

function createMctsCandidate(context: EngineContext, statsByPositionAction: Map<string, ActionStat>): OptimizerExperimentCandidateInput {
  const actions = getSearchActions(context.options);
  const passiveIds = pickRandomPassives(context.options, context.rng);
  const turns = [];

  for (let turnIndex = 0; turnIndex < context.options.duration; turnIndex += 1) {
    const actionCount = context.rng.integer(1, context.options.maxActionsPerTurn);
    const turnActions = [];
    for (let actionIndex = 0; actionIndex < actionCount; actionIndex += 1) {
      turnActions.push(cloneAction(selectMctsAction(actions, turnIndex, actionIndex, statsByPositionAction, context.rng)));
    }
    turns.push({ actions: turnActions });
  }

  return { passiveIds, plan: { turns } };
}

function selectMctsAction(
  actions: Action[],
  turnIndex: number,
  actionIndex: number,
  statsByPositionAction: Map<string, ActionStat>,
  rng: SeededRandom,
): Action {
  const totalVisits = actions.reduce((total, action) => (
    total + (statsByPositionAction.get(createMctsStatKey(turnIndex, actionIndex, action))?.visits ?? 0)
  ), 0);
  const unvisited = actions.filter((action) => !statsByPositionAction.has(createMctsStatKey(turnIndex, actionIndex, action)));
  if (unvisited.length > 0) {
    return rng.pick(unvisited);
  }

  return actions
    .map((action) => {
      const stats = statsByPositionAction.get(createMctsStatKey(turnIndex, actionIndex, action))!;
      return {
        action,
        value: stats.totalReward / stats.visits + Math.sqrt(2 * Math.log(Math.max(1, totalVisits)) / stats.visits),
      };
    })
    .sort((left, right) => right.value - left.value)[0]!.action;
}

function updateMctsStats(statsByPositionAction: Map<string, ActionStat>, plan: ComboPlan, reward: number) {
  for (const [turnIndex, turn] of plan.turns.entries()) {
    for (const [actionIndex, action] of turn.actions.entries()) {
      const key = createMctsStatKey(turnIndex, actionIndex, action);
      const stats = statsByPositionAction.get(key) ?? { visits: 0, totalReward: 0 };
      stats.visits += 1;
      stats.totalReward += reward;
      statsByPositionAction.set(key, stats);
    }
  }
}

function mutateCandidate(candidate: OptimizerExperimentCandidateInput, context: EngineContext): OptimizerExperimentCandidateInput {
  const actions = getSearchActions(context.options);
  const next = cloneCandidateInput(candidate);
  if (context.rng.chance(0.35)) {
    next.passiveIds = mutatePassiveIds(next.passiveIds ?? [], context.options, context.rng);
  }

  const turnIndex = context.rng.integer(0, next.plan.turns.length - 1);
  const turn = next.plan.turns[turnIndex];
  if (!turn) {
    return createRandomCandidate(context.options, actions, context.rng);
  }

  if (context.options.duration >= 2 && context.options.budget.iterations >= 80) {
    const targetFlipSpellIds = new Set(actions
      .filter((action) => action.target?.kind === "emptyCell")
      .map((action) => action.spellId));
    const flippableIndexes = turn.actions
      .map((action, index) => ({ action, index }))
      .filter(({ action }) => targetFlipSpellIds.has(action.spellId));
    if (flippableIndexes.length > 0) {
      const { action, index } = context.rng.pick(flippableIndexes);
      turn.actions[index] = action.target?.kind === "emptyCell"
        ? { spellId: action.spellId }
        : { spellId: action.spellId, target: { kind: "emptyCell" } };
      return next;
    }
  }

  if (context.rng.chance(0.25) && turn.actions.length < context.options.maxActionsPerTurn) {
    turn.actions.push(cloneAction(context.rng.pick(actions)));
    return next;
  }

  const deleteChance = context.options.duration >= 3 && turn.actions.length >= Math.ceil(context.options.maxActionsPerTurn * 0.75)
    ? 0.45
    : 0.25;
  if (context.rng.chance(deleteChance) && turn.actions.length > 1) {
    turn.actions.splice(context.rng.integer(0, turn.actions.length - 1), 1);
    return next;
  }

  turn.actions[context.rng.integer(0, turn.actions.length - 1)] = cloneAction(context.rng.pick(actions));
  return next;
}

function crossoverCandidates(
  parentA: OptimizerExperimentCandidateInput,
  parentB: OptimizerExperimentCandidateInput,
  options: NormalizedExperimentOptions,
  rng: SeededRandom,
): OptimizerExperimentCandidateInput {
  const turns = parentA.plan.turns.map((turn, index) => rng.chance(0.5)
    ? cloneTurn(turn)
    : cloneTurn(parentB.plan.turns[index] ?? turn));
  const passiveIds = crossoverPassiveIds(parentA.passiveIds ?? [], parentB.passiveIds ?? [], options, rng);
  return { passiveIds, plan: { turns } };
}

function tournamentSelect(
  population: Array<{ input: OptimizerExperimentCandidateInput; result: OptimizerExperimentCandidate }>,
  rng: SeededRandom,
): { input: OptimizerExperimentCandidateInput; result: OptimizerExperimentCandidate } {
  const left = rng.pick(population);
  const right = rng.pick(population);
  return compareCandidates(left.result, right.result) <= 0 ? left : right;
}

function createNoveltyOffspring(
  context: EngineContext,
  archive: NoveltyArchiveEntry[],
): OptimizerExperimentCandidateInput {
  const parentA = selectNoveltyParent(archive, context.rng);
  if (archive.length > 1 && context.rng.chance(0.5)) {
    const parentB = selectNoveltyParent(archive, context.rng);
    return mutateCandidate(crossoverCandidates(parentA.input, parentB.input, context.options, context.rng), context);
  }

  return mutateCandidate(parentA.input, context);
}

function selectNoveltyParent(archive: NoveltyArchiveEntry[], rng: SeededRandom): NoveltyArchiveEntry {
  const tournamentSize = Math.min(3, archive.length);
  let selected = rng.pick(archive);
  for (let index = 1; index < tournamentSize; index += 1) {
    const challenger = rng.pick(archive);
    if (compareNoveltyArchiveEntries(challenger, selected) < 0) {
      selected = challenger;
    }
  }
  return selected;
}

function compareNoveltyArchiveEntries(left: NoveltyArchiveEntry, right: NoveltyArchiveEntry): number {
  const localCompetitionDifference = right.localCompetition - left.localCompetition;
  if (localCompetitionDifference !== 0) {
    return localCompetitionDifference;
  }

  const noveltyDifference = right.novelty - left.novelty;
  if (noveltyDifference !== 0) {
    return noveltyDifference;
  }

  return compareCandidates(left.result, right.result);
}

function addNoveltyArchiveEntry(
  archive: NoveltyArchiveEntry[],
  entry: NoveltyArchiveEntry,
  bestCandidate: OptimizerExperimentCandidate | undefined,
  maxArchiveSize: number,
) {
  const shouldAdd = archive.length === 0
    || entry.novelty > 0.25
    || entry.localCompetition > 0
    || entry.result.id === bestCandidate?.id;
  if (!shouldAdd) {
    return;
  }

  archive.push(entry);
  archive.sort(compareNoveltyArchiveEntries);
  archive.splice(maxArchiveSize);
}

function shouldAcceptAnnealingCandidate(
  current: OptimizerExperimentCandidate | null,
  candidate: OptimizerExperimentCandidate,
  temperature: number,
  rng: SeededRandom,
): boolean {
  if (!current) {
    return true;
  }

  const delta = candidate.score.score - current.score.score;
  return delta >= 0 || rng.next() < Math.exp(delta / Math.max(1, Math.abs(current.score.score)) / temperature);
}

function createNoveltyDescriptor(candidate: OptimizerExperimentCandidate): string[] {
  return [
    `score:${Math.floor(candidate.score.score / 25)}`,
    `total:${Math.floor(candidate.score.totalDamage / 25)}`,
    `bq:${Math.floor(candidate.simulation.finalState.remainingResources.bq / 50)}`,
    `wp:${candidate.simulation.finalState.remainingResources.wp}`,
    `actions:${candidate.plan.turns.reduce((total, turn) => total + turn.actions.length, 0)}`,
    `passives:${candidate.passiveIds.join(",")}`,
    ...candidate.plan.turns.flatMap((turn, turnIndex) => turn.actions.map((action) => `t${turnIndex}:${serializeAction(action)}`)),
  ];
}

function computeNovelty(descriptor: string[], archive: NoveltyArchiveEntry[]): number {
  if (archive.length === 0) {
    return 1;
  }

  const nearest = getNearestNoveltyEntries(descriptor, archive, 10);
  return nearest.reduce((total, archived) => total + archived.distance, 0) / nearest.length;
}

function computeLocalCompetition(
  candidate: OptimizerExperimentCandidate,
  descriptor: string[],
  archive: NoveltyArchiveEntry[],
): number {
  if (archive.length === 0) {
    return 1;
  }

  const nearest = getNearestNoveltyEntries(descriptor, archive, 10);
  const defeatedNeighbors = nearest.filter((neighbor) => compareCandidates(candidate, neighbor.entry.result) < 0).length;
  return defeatedNeighbors / nearest.length;
}

function getNearestNoveltyEntries(
  descriptor: string[],
  archive: NoveltyArchiveEntry[],
  limit: number,
): Array<{ entry: NoveltyArchiveEntry; distance: number }> {
  return archive
    .map((entry) => ({ entry, distance: descriptorDistance(descriptor, entry.descriptor) }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, Math.min(limit, archive.length));
}

function descriptorDistance(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);
  let intersectionCount = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) {
      intersectionCount += 1;
    }
  }
  return union.size === 0 ? 0 : 1 - intersectionCount / union.size;
}

function createEngineAccumulator(
  engine: OptimizerExperimentEngineKind,
  budget: OptimizerExperimentBudget,
): EngineAccumulator {
  return {
    engine,
    budget,
    attempts: 0,
    validCandidates: 0,
    invalidCandidates: 0,
    topCandidates: new Map(),
    progress: [],
    metrics: {},
  };
}

function addTopCandidate(
  context: EngineContext,
  accumulator: EngineAccumulator,
  candidate: OptimizerExperimentCandidate,
) {
  accumulator.topCandidates.set(candidate.id, candidate);
  const maxCandidates = clampInteger(context.options.maxCandidates ?? 20, 1, 200);
  const ranked = [...accumulator.topCandidates.values()].sort(compareCandidates);
  accumulator.topCandidates = new Map(ranked.slice(0, maxCandidates).map((entry) => [entry.id, entry]));
}

function normalizeExperimentOptions(options: OptimizerExperimentOptions): NormalizedExperimentOptions {
  return {
    ...options,
    duration: clampInteger(options.duration, 1, 3),
    engines: options.engines.length > 0 ? options.engines : ["random"],
    budget: { iterations: clampInteger(options.budget.iterations, 1, 1_000_000) },
    seed: options.seed ?? "optimizer-experiment",
    maxPassiveCount: clampInteger(options.maxPassiveCount ?? 0, 0, 6),
    maxActionsPerTurn: clampInteger(options.maxActionsPerTurn ?? 3, 1, 12),
    progressInterval: clampInteger(options.progressInterval ?? Math.max(1, Math.floor(options.budget.iterations / 10)), 1, 1_000_000),
  };
}

function getSearchActions(options: NormalizedExperimentOptions): Action[] {
  const entriesById = new Map(options.catalog.map((entry) => [entry.id, entry]));
  const spellIds = [...new Set(
    (options.availableSpellIds ?? options.catalog.filter((entry) => entry.kind === "spell").map((entry) => entry.id))
      .filter((spellId) => entriesById.get(spellId)?.kind === "spell"),
  )].sort();

  return spellIds.flatMap((spellId) => {
    const actions: Action[] = [{ spellId }];
    const entry = entriesById.get(spellId);
    if (entry?.constraints.some((constraint) => (
      constraint.type === "maxCastsPerTarget"
      || (constraint.type === "requiresTarget" && constraint.target === "emptyCell")
    ))) {
      actions.push({ spellId, target: { kind: "emptyCell" } });
    }
    return actions;
  });
}

function createPassiveSelections(options: NormalizedExperimentOptions): string[][] {
  const passiveIds = getAvailablePassiveIds(options);
  if (passiveIds.length === 0 || options.maxPassiveCount === 0) {
    return [[]];
  }

  const selections: string[][] = [[]];
  for (const passiveId of passiveIds) {
    for (const selection of [...selections]) {
      if (selection.length < options.maxPassiveCount) {
        selections.push([...selection, passiveId].sort());
      }
    }
  }
  return selections;
}

function pickRandomPassives(options: NormalizedExperimentOptions, rng: SeededRandom): string[] {
  const passiveIds = getAvailablePassiveIds(options);
  if (passiveIds.length === 0 || options.maxPassiveCount === 0) {
    return [];
  }

  const passiveLimit = Math.min(options.maxPassiveCount, passiveIds.length);
  const targetCount = rng.chance(0.8)
    ? rng.integer(Math.min(1, passiveLimit), passiveLimit)
    : rng.integer(0, passiveLimit);
  const selected: string[] = [];
  const remaining = [...passiveIds];

  while (selected.length < targetCount && remaining.length > 0) {
    const passiveId = pickWeightedPassiveId(remaining, options, rng);
    selected.push(passiveId);
    remaining.splice(remaining.indexOf(passiveId), 1);
  }

  return selected.sort();
}

function pickWeightedPassiveId(passiveIds: string[], options: NormalizedExperimentOptions, rng: SeededRandom): string {
  const weighted = passiveIds.map((passiveId) => ({
    passiveId,
    weight: getPassiveSearchWeight(passiveId, options),
  }));
  const totalWeight = weighted.reduce((total, entry) => total + entry.weight, 0);
  let cursor = rng.next() * totalWeight;

  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.passiveId;
    }
  }

  return weighted.at(-1)!.passiveId;
}

function getPassiveSearchWeight(passiveId: string, options: NormalizedExperimentOptions): number {
  const passive = options.catalog.find((entry) => entry.id === passiveId && entry.kind === "passive");
  if (!passive) {
    return 1;
  }

  let weight = 1;
  for (const effect of passive.effects) {
    if (effect.type === "statModifier" && effect.stat === "damageInflictedPercent" && effect.amount > 0) {
      weight += effect.amount / 5;
    }
  }

  for (const tag of passive.tags) {
    if (["damage", "abondance", "bq", "heart"].includes(tag)) {
      weight += 2;
    }
  }

  return weight;
}

function mutatePassiveIds(
  currentPassiveIds: string[],
  options: NormalizedExperimentOptions,
  rng: SeededRandom,
): string[] {
  const availablePassiveIds = getAvailablePassiveIds(options);
  if (availablePassiveIds.length === 0 || options.maxPassiveCount === 0) {
    return [];
  }

  const available = new Set(availablePassiveIds);
  const next = new Set(currentPassiveIds.filter((passiveId) => available.has(passiveId)));
  const missing = availablePassiveIds.filter((passiveId) => !next.has(passiveId));
  const canAdd = next.size < Math.min(options.maxPassiveCount, availablePassiveIds.length) && missing.length > 0;
  const canRemove = next.size > 0;

  if (canAdd && (!canRemove || rng.chance(0.45))) {
    next.add(pickWeightedPassiveId(missing, options, rng));
  } else if (canRemove && (!canAdd || rng.chance(0.35))) {
    next.delete(rng.pick([...next]));
  } else if (canAdd && canRemove) {
    next.delete(rng.pick([...next]));
    next.add(pickWeightedPassiveId(missing, options, rng));
  }

  return [...next].sort();
}

function crossoverPassiveIds(
  parentAPassiveIds: string[],
  parentBPassiveIds: string[],
  options: NormalizedExperimentOptions,
  rng: SeededRandom,
): string[] {
  const available = new Set(getAvailablePassiveIds(options));
  const inherited = [...new Set([...parentAPassiveIds, ...parentBPassiveIds])]
    .filter((passiveId) => available.has(passiveId))
    .sort();
  const selected: string[] = [];

  for (const passiveId of inherited) {
    if (selected.length >= options.maxPassiveCount) {
      break;
    }
    const inParentA = parentAPassiveIds.includes(passiveId);
    const inParentB = parentBPassiveIds.includes(passiveId);
    if ((inParentA && inParentB) || rng.chance(0.5)) {
      selected.push(passiveId);
    }
  }

  return selected.sort();
}

function getAvailablePassiveIds(options: NormalizedExperimentOptions): string[] {
  const currentPassives = options.character.classState?.huppermage?.activePassives ?? [];
  const passiveIds = options.availablePassiveIds ?? currentPassives;
  const catalogPassiveIds = new Set(options.catalog.filter((entry) => entry.kind === "passive").map((entry) => entry.id));
  return [...new Set(passiveIds)].filter((passiveId) => catalogPassiveIds.has(passiveId)).sort();
}

function createCandidateCharacter(character: SimulatedCharacter, passiveIds: string[]): SimulatedCharacter {
  const huppermage = character.classState?.huppermage;
  return {
    ...character,
    resources: { ...character.resources },
    stats: {
      ...character.stats,
      elementalMastery: { ...character.stats.elementalMastery },
    },
    classState: {
      ...character.classState,
      huppermage: {
        ...huppermage,
        activePassives: [...passiveIds],
      },
    },
  };
}

function normalizeCandidate(candidate: OptimizerExperimentCandidateInput): Required<OptimizerExperimentCandidateInput> {
  return {
    passiveIds: [...(candidate.passiveIds ?? [])].sort(),
    plan: {
      turns: candidate.plan.turns.map(cloneTurn),
    },
  };
}

function createCandidateCacheKey(
  options: OptimizerExperimentEvaluatorOptions,
  candidate: Required<OptimizerExperimentCandidateInput>,
): string {
  return JSON.stringify({
    characterId: options.character.id,
    duration: options.duration,
    criterion: options.criterion ?? { type: "totalDamage" },
    requireSustainableCycle: options.requireSustainableCycle ?? false,
    candidate: serializeExperimentCandidate(candidate),
  });
}

function serializeExperimentCandidate(candidate: Required<OptimizerExperimentCandidateInput>): string {
  return `${candidate.passiveIds.join("+")}::${candidate.plan.turns.map((turn) => turn.actions.map(serializeAction).join(",")).join("|")}`;
}

function serializeAction(action: Action): string {
  return action.target ? `${action.spellId}@${action.target.kind}` : action.spellId;
}

function cloneCandidateInput(candidate: OptimizerExperimentCandidateInput): OptimizerExperimentCandidateInput {
  return {
    passiveIds: [...(candidate.passiveIds ?? [])],
    plan: {
      turns: candidate.plan.turns.map(cloneTurn),
    },
  };
}

function cloneTurn(turn: { actions: Action[] }): { actions: Action[] } {
  return {
    actions: turn.actions.map(cloneAction),
  };
}

function cloneAction(action: Action): Action {
  return {
    ...action,
    target: action.target ? { ...action.target } : undefined,
    context: action.context ? { ...action.context } : undefined,
  };
}

function createMctsStatKey(turnIndex: number, actionIndex: number, action: Action): string {
  return `${turnIndex}:${actionIndex}:${serializeAction(action)}`;
}

function pickBestCandidate(candidates: OptimizerExperimentCandidate[]): OptimizerExperimentCandidate | undefined {
  return [...candidates].sort(compareCandidates)[0];
}

function compareCandidates(left: OptimizerExperimentCandidate, right: OptimizerExperimentCandidate): number {
  const scoreDifference = right.score.score - left.score.score;
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const passiveCountDifference = left.passiveIds.length - right.passiveIds.length;
  if (passiveCountDifference !== 0) {
    return passiveCountDifference;
  }

  const actionCountDifference = countCandidateActions(left) - countCandidateActions(right);
  if (actionCountDifference !== 0) {
    return actionCountDifference;
  }

  return left.id.localeCompare(right.id);
}

function countCandidateActions(candidate: OptimizerExperimentCandidate): number {
  return candidate.plan.turns.reduce((total, turn) => total + turn.actions.length, 0);
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function createSeededRandom(seed: string): SeededRandom {
  let state = hashSeed(seed);

  return {
    next() {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    },
    integer(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick(values) {
      return values[this.integer(0, values.length - 1)]!;
    },
    chance(probability) {
      return this.next() < probability;
    },
  };
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
