import type { CatalogEntry } from "../catalog/types.ts";
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
  getStats(): OptimizerExperimentEvaluatorStats;
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
  const cache = new Map<string, OptimizerExperimentCandidate | null>();
  const stats = {
    cacheHits: 0,
    cacheMisses: 0,
  };

  return {
    evaluate(candidate) {
      const normalizedCandidate = normalizeCandidate(candidate);
      const key = createCandidateCacheKey(options, normalizedCandidate);
      if (cache.has(key)) {
        stats.cacheHits += 1;
        return cache.get(key) ?? null;
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
        cache.set(key, null);
        return null;
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
        cache.set(key, null);
        return null;
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

      cache.set(key, result);
      return result;
    },
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
  const accumulator = createEngineAccumulator("hybrid", context.options.budget);
  const populationSize = Math.max(8, Math.min(96, Math.floor(Math.sqrt(context.options.budget.iterations)) * 2));
  const eliteCount = Math.max(2, Math.ceil(populationSize * 0.15));
  const immigrantBatchSize = Math.max(2, Math.ceil(populationSize * 0.25));
  const stagnationLimit = Math.max(8, Math.min(80, Math.floor(populationSize * 0.75)));
  const localRefinementInterval = Math.max(3, Math.floor(populationSize / 4));
  let population: Array<{ input: OptimizerExperimentCandidateInput; result: OptimizerExperimentCandidate }> = [];
  let attemptsSinceImprovement = 0;

  while (accumulator.attempts < context.options.budget.iterations && population.length < populationSize) {
    if (context.options.signal?.aborted) {
      break;
    }
    const input = context.sampler.next();
    const { result, improved } = evaluateAndTrackImprovement(context, accumulator, input);
    attemptsSinceImprovement = improved ? 0 : attemptsSinceImprovement + 1;
    if (result) {
      population.push({ input, result });
    }
  }

  population = rankPopulation(population).slice(0, populationSize);

  while (accumulator.attempts < context.options.budget.iterations) {
    if (context.options.signal?.aborted) {
      break;
    }

    if (population.length < 2) {
      const input = context.sampler.random();
      const { result, improved } = evaluateAndTrackImprovement(context, accumulator, input);
      attemptsSinceImprovement = improved ? 0 : attemptsSinceImprovement + 1;
      if (result) {
        population.push({ input, result });
        population = rankPopulation(population).slice(0, populationSize);
      }
      continue;
    }

    if (attemptsSinceImprovement >= stagnationLimit) {
      const immigrants = injectHybridImmigrants(context, accumulator, population, eliteCount, immigrantBatchSize, populationSize);
      population = immigrants.population;
      attemptsSinceImprovement = immigrants.improved ? 0 : Math.floor(stagnationLimit / 2);
      accumulator.metrics.hybridRestarts = (accumulator.metrics.hybridRestarts ?? 0) + 1;
      accumulator.metrics.hybridImmigrants = (accumulator.metrics.hybridImmigrants ?? 0) + immigrants.count;
      continue;
    }

    const shouldRefineLocally = accumulator.attempts % localRefinementInterval === 0;
    const input = shouldRefineLocally
      ? createHybridLocalRefinement(population, context)
      : createHybridOffspring(population, context);
    if (shouldRefineLocally) {
      accumulator.metrics.hybridLocalRefinements = (accumulator.metrics.hybridLocalRefinements ?? 0) + 1;
    }

    const { result, improved } = evaluateAndTrackImprovement(context, accumulator, input);
    attemptsSinceImprovement = improved ? 0 : attemptsSinceImprovement + 1;
    if (result) {
      population.push({ input, result });
      population = rankPopulation(population).slice(0, populationSize);
    }
  }

  accumulator.metrics.populationSize = population.length;
  accumulator.metrics.hybridEliteCount = Math.min(eliteCount, population.length);
  accumulator.metrics.hybridStagnationLimit = stagnationLimit;
  return finalizeEngineResult(context, accumulator);
}

function evaluateAndTrackImprovement(
  context: EngineContext,
  accumulator: EngineAccumulator,
  input: OptimizerExperimentCandidateInput,
): { result: OptimizerExperimentCandidate | null; improved: boolean } {
  const previousBest = accumulator.bestCandidate;
  const result = evaluateAndRecord(context, accumulator, input);
  const improved = !previousBest
    ? Boolean(accumulator.bestCandidate)
    : Boolean(accumulator.bestCandidate && compareCandidates(accumulator.bestCandidate, previousBest) < 0);

  return { result, improved };
}

function injectHybridImmigrants(
  context: EngineContext,
  accumulator: EngineAccumulator,
  population: Array<{ input: OptimizerExperimentCandidateInput; result: OptimizerExperimentCandidate }>,
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
      : context.sampler.random();
    const tracked = evaluateAndTrackImprovement(context, accumulator, input);
    improved = improved || tracked.improved;
    immigrantCount += 1;
    if (tracked.result) {
      nextPopulation.push({ input, result: tracked.result });
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
): OptimizerExperimentCandidateInput {
  if (context.rng.chance(0.18)) {
    return context.sampler.random();
  }

  const parentA = tournamentSelect(population, context.rng);
  const parentB = tournamentSelect(population, context.rng);
  const child = crossoverCandidates(parentA.input, parentB.input, context.options, context.rng);
  return mutateCandidate(child, context);
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
  const accumulator = createEngineAccumulator("hybrid", context.options.budget);
  const populationSize = Math.max(8, Math.min(96, Math.floor(Math.sqrt(context.options.budget.iterations)) * 2));
  const eliteCount = Math.max(2, Math.ceil(populationSize * 0.15));
  const immigrantBatchSize = Math.max(2, Math.ceil(populationSize * 0.25));
  const stagnationLimit = Math.max(8, Math.min(80, Math.floor(populationSize * 0.75)));
  const localRefinementInterval = Math.max(3, Math.floor(populationSize / 4));
  let population: Array<{ input: OptimizerExperimentCandidateInput; result: OptimizerExperimentCandidate }> = [];
  let attemptsSinceImprovement = 0;

  while (accumulator.attempts < context.options.budget.iterations && population.length < populationSize) {
    if (context.options.signal?.aborted) {
      break;
    }
    const input = context.sampler.next();
    const { result, improved } = evaluateAndTrackImprovement(context, accumulator, input);
    attemptsSinceImprovement = improved ? 0 : attemptsSinceImprovement + 1;
    if (result) {
      population.push({ input, result });
    }
    await yieldHybridProgress(context, accumulator, population.length, populationSize);
  }

  population = rankPopulation(population).slice(0, populationSize);

  while (accumulator.attempts < context.options.budget.iterations) {
    if (context.options.signal?.aborted) {
      break;
    }

    if (population.length < 2) {
      const input = context.sampler.random();
      const { result, improved } = evaluateAndTrackImprovement(context, accumulator, input);
      attemptsSinceImprovement = improved ? 0 : attemptsSinceImprovement + 1;
      if (result) {
        population.push({ input, result });
        population = rankPopulation(population).slice(0, populationSize);
      }
      await yieldHybridProgress(context, accumulator, population.length, populationSize);
      continue;
    }

    if (attemptsSinceImprovement >= stagnationLimit) {
      const immigrants = injectHybridImmigrants(context, accumulator, population, eliteCount, immigrantBatchSize, populationSize);
      population = immigrants.population;
      attemptsSinceImprovement = immigrants.improved ? 0 : Math.floor(stagnationLimit / 2);
      accumulator.metrics.hybridRestarts = (accumulator.metrics.hybridRestarts ?? 0) + 1;
      accumulator.metrics.hybridImmigrants = (accumulator.metrics.hybridImmigrants ?? 0) + immigrants.count;
      await yieldHybridProgress(context, accumulator, population.length, populationSize);
      continue;
    }

    const shouldRefineLocally = accumulator.attempts % localRefinementInterval === 0;
    const input = shouldRefineLocally
      ? createHybridLocalRefinement(population, context)
      : createHybridOffspring(population, context);
    if (shouldRefineLocally) {
      accumulator.metrics.hybridLocalRefinements = (accumulator.metrics.hybridLocalRefinements ?? 0) + 1;
    }

    const { result, improved } = evaluateAndTrackImprovement(context, accumulator, input);
    attemptsSinceImprovement = improved ? 0 : attemptsSinceImprovement + 1;
    if (result) {
      population.push({ input, result });
      population = rankPopulation(population).slice(0, populationSize);
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
  accumulator.attempts += 1;
  const result = context.evaluator.evaluate(candidate);
  if (result) {
    accumulator.validCandidates += 1;
    addTopCandidate(context, accumulator, result);
    if (!accumulator.bestCandidate || compareCandidates(result, accumulator.bestCandidate) < 0) {
      accumulator.bestCandidate = result;
      recordProgress(context, accumulator);
    }
  } else {
    accumulator.invalidCandidates += 1;
  }

  if (accumulator.attempts % context.options.progressInterval === 0) {
    recordProgress(context, accumulator);
  }

  return result;
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
  const warmupCandidates = createWarmupCandidates(options, actions, 5_000);
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
  };
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

  if (context.rng.chance(0.25) && turn.actions.length < context.options.maxActionsPerTurn) {
    turn.actions.push(cloneAction(context.rng.pick(actions)));
    return next;
  }

  if (context.rng.chance(0.25) && turn.actions.length > 1) {
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
    if (entry?.constraints.some((constraint) => constraint.type === "maxCastsPerTarget")) {
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
    next.add(rng.pick(missing));
  } else if (canRemove && (!canAdd || rng.chance(0.35))) {
    next.delete(rng.pick([...next]));
  } else if (canAdd && canRemove) {
    next.delete(rng.pick([...next]));
    next.add(rng.pick(missing));
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

  return left.id.localeCompare(right.id);
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
