import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { huppermageCatalog } from "../src/core/catalog/index.ts";
import { createOptimizerExperimentEvaluator } from "../src/core/optimizer/index.ts";
import type { RustWasmOptimizerCandidateInput } from "../src/core/optimizer/rustWasmBackendTypes.ts";
import { createResources } from "../src/core/simulation/index.ts";
import type { ComboSimulationOptions, SimulatedCharacter } from "../src/core/simulation/types.ts";
import { sublimationCatalog } from "../src/core/sublimations/index.ts";

type Scenario = {
  id: string;
  duration: number;
  maxActionsPerTurn: number;
  maxPassiveCount: number;
  maxSublimationCount: number;
};

type CandidateEvidence = {
  id: number;
  sessionId: string;
  candidate: RustWasmOptimizerCandidateInput;
  score: number;
  attempt: number;
};

type Variant = {
  strategy: string;
  candidate: RustWasmOptimizerCandidateInput;
  contextKeys?: string[];
};

type CandidateActionInput =
  RustWasmOptimizerCandidateInput["plan"]["turns"][number]["actions"][number];

type StrategyStats = {
  generated: number;
  valid: number;
  positive: number;
  globalBest: number;
  deltaTotal: number;
  bestDelta: number | null;
};

type ContextStats = StrategyStats & {
  key: string;
};

type SwapVariantEvaluation = {
  contextKeys: string[];
  valid: boolean;
  delta: number | null;
  positive: boolean;
  globalBest: boolean;
};

type ActionMacro = {
  key: string;
  actions: CandidateActionInput[];
  length: number;
  support: number;
  bestScore: number;
};

type MetricSummary = {
  generated: number;
  valid: number;
  positive: number;
  globalBest: number;
  positiveRate: number;
  globalBestRate: number;
  validRate: number;
  averageDelta: number;
  bestDelta: number;
};

type RuleSet = {
  id: string;
  description: string;
  contextKeys: string[];
};

type RuleSetStats = StrategyStats & {
  id: string;
  description: string;
  dbsWithValid: Set<string>;
};

type ContrastPairResult = {
  scenario: string;
  dbs: Array<ReturnType<typeof evaluateDatabase>>;
  aggregate: ReturnType<typeof aggregateSummaries>;
};

const adjacentSwapRuleSets: RuleSet[] = [
  {
    id: "current-online",
    description: "Current Rust/WASM ordered-pair selector",
    contextKeys: [
      "pair:debacle>orbes-luisants",
      "pair:orbes-luisants>halo-chatoyant",
    ],
  },
  {
    id: "turn3-debacle-orbes",
    description: "Narrow strongest turn-specific pair",
    contextKeys: ["turn-pair:3:debacle>orbes-luisants"],
  },
  {
    id: "debacle-orbes-only",
    description: "Strong ordered pair without turn specificity",
    contextKeys: ["pair:debacle>orbes-luisants"],
  },
  {
    id: "right-orbes",
    description: "Broader right-spell rule",
    contextKeys: ["right:orbes-luisants"],
  },
  {
    id: "current-plus-right-orbes",
    description: "Current ordered pairs plus broad right-spell rule",
    contextKeys: [
      "pair:debacle>orbes-luisants",
      "pair:orbes-luisants>halo-chatoyant",
      "right:orbes-luisants",
    ],
  },
];

const scenarios: Scenario[] = [
  { id: "t2-a8-p2", duration: 2, maxActionsPerTurn: 8, maxPassiveCount: 2, maxSublimationCount: 12 },
  { id: "t3-a12-p3", duration: 3, maxActionsPerTurn: 12, maxPassiveCount: 3, maxSublimationCount: 12 },
  { id: "t3-full", duration: 3, maxActionsPerTurn: 12, maxPassiveCount: 6, maxSublimationCount: 12 },
];

const character: SimulatedCharacter = {
  id: "contrast-pair-huppermage",
  className: "huppermage",
  resources: createResources({ ap: 12, mp: 6, wp: 6, bq: 500 }),
  stats: {
    level: 200,
    hitPoints: 2050,
    hitPointsPercent: 0,
    generalMastery: 1200,
    elementalMastery: { fire: 1200, water: 1200, earth: 1200, air: 1200, light: 0, neutral: 0 },
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

const availablePassiveIds = huppermageCatalog
  .filter((entry) => entry.kind === "passive")
  .map((entry) => entry.id);
const availableSublimationIds = sublimationCatalog
  .filter((entry) => entry.supportStatus === "supported")
  .map((entry) => entry.id);
const weightedActionCandidates = createWeightedActionCandidates();
const actionVariantsBySpellId = createActionVariantsBySpellId();

function runCli(): void {
  const dbPaths = readOptions("--db").flatMap((value) => value.split(",")).filter(Boolean);
  if (dbPaths.length === 0) {
    throw new Error("Usage: contrast-pair-search.ts --db <path>[,--db <path>] [--scenario t3-full] [--limit 20] [--variants-per-source 256]");
  }
  const scenario = scenarios.find((entry) => entry.id === (readOption("--scenario") ?? "t3-full"));
  if (!scenario) {
    throw new Error(`Unknown --scenario. Expected one of: ${scenarios.map((entry) => entry.id).join(", ")}.`);
  }
  const limit = readIntegerOption("--limit", 20);
  const variantsPerSource = readIntegerOption("--variants-per-source", 256);
  const topExamples = readIntegerOption("--top-examples", 10);
  const minContextValid = readIntegerOption("--min-context-valid", 10);
  const includePlanGrafts = process.argv.includes("--plan-grafts");
  const includeActionEdits = process.argv.includes("--action-edits");
  const includeMacroSplices = process.argv.includes("--macro-splices");
  const includeTargetEdits = process.argv.includes("--target-edits");
  const summary = {
    scenario: scenario.id,
    dbs: dbPaths.map((dbPath) =>
      evaluateDatabase(
        resolve(dbPath),
        scenario,
        limit,
        variantsPerSource,
        topExamples,
        minContextValid,
        includePlanGrafts,
        includeActionEdits,
        includeMacroSplices,
        includeTargetEdits,
      )
    ),
  };
  const aggregate = aggregateSummaries(summary.dbs, minContextValid);
  const result: ContrastPairResult = { ...summary, aggregate };
  const outPath = readOption("--out");
  if (outPath) {
    const resolvedOut = resolve(outPath);
    mkdirSync(dirname(resolvedOut), { recursive: true });
    writeFileSync(resolvedOut, `${JSON.stringify(result, null, 2)}\n`);
  }
  if (process.argv.includes("--quiet")) {
    console.log(JSON.stringify(createConsoleSummary(result), null, 2));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

function evaluateDatabase(
  dbPath: string,
  scenario: Scenario,
  limit: number,
  variantsPerSource: number,
  topExamples: number,
  minContextValid: number,
  includePlanGrafts: boolean,
  includeActionEdits: boolean,
  includeMacroSplices: boolean,
  includeTargetEdits: boolean,
) {
  const database = new DatabaseSync(dbPath);
  try {
    const allEvidenceRows = listCandidateEvidence(database, 1_000);
    const evidenceRows = allEvidenceRows.slice(0, limit);
    const evaluator = createOptimizerExperimentEvaluator({
      catalog: huppermageCatalog,
      character,
      duration: scenario.duration,
      defaultActionContext,
    });
    const sourceScores = new Map<number, number>();
    let skippedInvalidSources = 0;
    for (const evidence of allEvidenceRows) {
      const score = evaluateScore(evaluator, evidence.candidate);
      if (score === null) {
        continue;
      }
      sourceScores.set(evidence.id, score);
    }
    for (const evidence of evidenceRows) {
      if (!sourceScores.has(evidence.id)) {
        skippedInvalidSources += 1;
      }
    }
    const sessionBest = Math.max(...sourceScores.values(), Number.NEGATIVE_INFINITY);
    const strategies = new Map<string, StrategyStats>();
    const swapContexts = new Map<string, ContextStats>();
    const actionEditContexts = new Map<string, ContextStats>();
    const targetEditContexts = new Map<string, ContextStats>();
    const planGraftContexts = new Map<string, ContextStats>();
    const macroSpliceContexts = new Map<string, ContextStats>();
    const ruleSets = createRuleSetStatsMap();
    const swapVariantEvaluations: SwapVariantEvaluation[] = [];
    const positives: Array<Record<string, unknown>> = [];
    let generatedVariants = 0;
    let validVariants = 0;
    let positiveVariants = 0;
    let globalBestVariants = 0;
    for (const evidence of evidenceRows) {
      const sourceScore = sourceScores.get(evidence.id);
      if (sourceScore === undefined) {
        continue;
      }
      const graftSources = allEvidenceRows
        .filter((row) => row.id !== evidence.id && sourceScores.has(row.id))
        .slice(0, Math.min(40, Math.max(limit, 12)));
      const variants = createContrastVariants(
        evidence.candidate,
        scenario,
        variantsPerSource,
        graftSources,
        includePlanGrafts,
        includeActionEdits,
        includeMacroSplices,
        includeTargetEdits,
      );
      const seen = new Set<string>();
      for (const variant of variants) {
        const key = stableStringify(variant.candidate);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        generatedVariants += 1;
        const stats = getStrategyStats(strategies, variant.strategy);
        stats.generated += 1;
        for (const contextKey of variant.contextKeys ?? []) {
          getVariantContextStats(
            variant,
            swapContexts,
            actionEditContexts,
            targetEditContexts,
            planGraftContexts,
            macroSpliceContexts,
            contextKey,
          ).generated += 1;
        }
        for (const stats of matchingRuleSetStats(ruleSets, variant.contextKeys ?? [])) {
          stats.generated += 1;
        }
        const score = evaluateScore(evaluator, variant.candidate);
        if (score === null) {
          if (variant.strategy === "swap-adjacent-actions") {
            swapVariantEvaluations.push({
              contextKeys: variant.contextKeys ?? [],
              valid: false,
              delta: null,
              positive: false,
              globalBest: false,
            });
          }
          continue;
        }
        validVariants += 1;
        stats.valid += 1;
        const delta = score - sourceScore;
        const improvedGlobalBest = score > sessionBest;
        if (variant.strategy === "swap-adjacent-actions") {
          swapVariantEvaluations.push({
            contextKeys: variant.contextKeys ?? [],
            valid: true,
            delta,
            positive: delta > 0,
            globalBest: improvedGlobalBest,
          });
        }
        stats.deltaTotal += delta;
        stats.bestDelta = stats.bestDelta === null ? delta : Math.max(stats.bestDelta, delta);
        for (const contextKey of variant.contextKeys ?? []) {
          const contextStats = getVariantContextStats(
            variant,
            swapContexts,
            actionEditContexts,
            targetEditContexts,
            planGraftContexts,
            macroSpliceContexts,
            contextKey,
          );
          contextStats.valid += 1;
          contextStats.deltaTotal += delta;
          contextStats.bestDelta = contextStats.bestDelta === null ? delta : Math.max(contextStats.bestDelta, delta);
        }
        for (const stats of matchingRuleSetStats(ruleSets, variant.contextKeys ?? [])) {
          stats.valid += 1;
          stats.deltaTotal += delta;
          stats.bestDelta = stats.bestDelta === null ? delta : Math.max(stats.bestDelta, delta);
          stats.dbsWithValid.add(dbPath);
        }
        if (delta > 0) {
          positiveVariants += 1;
          stats.positive += 1;
          if (improvedGlobalBest) {
            globalBestVariants += 1;
            stats.globalBest += 1;
          }
          for (const contextKey of variant.contextKeys ?? []) {
            const contextStats = getVariantContextStats(
              variant,
              swapContexts,
              actionEditContexts,
              targetEditContexts,
              planGraftContexts,
              macroSpliceContexts,
              contextKey,
            );
            contextStats.positive += 1;
            if (improvedGlobalBest) {
              contextStats.globalBest += 1;
            }
          }
          for (const stats of matchingRuleSetStats(ruleSets, variant.contextKeys ?? [])) {
            stats.positive += 1;
            if (improvedGlobalBest) {
              stats.globalBest += 1;
            }
          }
          positives.push({
            dbPath,
            sessionId: evidence.sessionId,
            sourceCandidateId: evidence.id,
            strategy: variant.strategy,
            sourceScore: round(sourceScore),
            score: round(score),
            delta: round(delta),
            improvedGlobalBest,
          });
        }
      }
    }
    positives.sort((left, right) => Number(right.delta) - Number(left.delta));
    const result = {
      dbPath,
      sourceCandidates: evidenceRows.length,
      scoredSources: sourceScores.size,
      skippedInvalidSources,
      generatedVariants,
      validVariants,
      positiveVariants,
      globalBestVariants,
      strategies: summarizeStrategies(strategies),
      swapContexts: summarizeContexts(swapContexts, minContextValid, 20),
      actionEditContexts: summarizeContexts(actionEditContexts, minContextValid, 20),
      targetEditContexts: summarizeContexts(targetEditContexts, minContextValid, 20),
      planGraftContexts: summarizeContexts(planGraftContexts, minContextValid, 20),
      macroSpliceContexts: summarizeContexts(macroSpliceContexts, minContextValid, 20),
      ruleSets: summarizeRuleSets(ruleSets),
      topPositiveExamples: positives.slice(0, topExamples),
    };
    Object.defineProperty(result, "swapVariantEvaluations", {
      value: swapVariantEvaluations,
      enumerable: false,
    });
    return result;
  } finally {
    database.close();
  }
}

function listCandidateEvidence(database: DatabaseSync, limit: number): CandidateEvidence[] {
  const rows = database.prepare(`
    SELECT id, session_id, candidate_json, score, attempt
    FROM continuous_candidate_evaluations
    WHERE valid = 1
    ORDER BY score DESC, attempt DESC, id ASC
    LIMIT ?
  `).all(limit) as Record<string, unknown>[];
  return rows.flatMap((row) => {
    const candidate = toCandidateInput(parseJson(String(row.candidate_json)));
    if (!candidate) {
      return [];
    }
    return [{
      id: Number(row.id),
      sessionId: String(row.session_id),
      candidate,
      score: Number(row.score),
      attempt: Number(row.attempt),
    }];
  });
}

function createContrastVariants(
  candidate: RustWasmOptimizerCandidateInput,
  scenario: Scenario,
  variantsPerSource: number,
  graftSources: CandidateEvidence[],
  includePlanGrafts: boolean,
  includeActionEdits: boolean,
  includeMacroSplices: boolean,
  includeTargetEdits: boolean,
): Variant[] {
  const variants: Variant[] = [];
  if (includePlanGrafts) {
    addPlanGraftVariants(variants, candidate, graftSources);
  }
  if (includeMacroSplices) {
    addMacroSpliceVariants(variants, candidate, graftSources);
  }
  addActionOrderVariants(variants, candidate, scenario);
  if (includeTargetEdits) {
    addActionTargetVariants(variants, candidate);
  }
  if (includeActionEdits) {
    addActionCompletionVariants(variants, candidate, scenario);
    addActionReplacementVariants(variants, candidate);
  }
  addActionDropVariants(variants, candidate);
  addLoadoutReplacementVariants(variants, candidate, "replace-passive", "passiveIds", availablePassiveIds, scenario.maxPassiveCount);
  addLoadoutReplacementVariants(
    variants,
    candidate,
    "replace-sublimation",
    "sublimationIds",
    availableSublimationIds,
    scenario.maxSublimationCount,
  );
  return variants.slice(0, variantsPerSource);
}

function addPlanGraftVariants(
  variants: Variant[],
  candidate: RustWasmOptimizerCandidateInput,
  graftSources: CandidateEvidence[],
): void {
  for (let turnIndex = 0; turnIndex < candidate.plan.turns.length; turnIndex += 1) {
    for (const source of graftSources) {
      const donorTurn = source.candidate.plan.turns[turnIndex];
      if (!donorTurn) {
        continue;
      }
      if (stableStringify(candidate.plan.turns[turnIndex]) !== stableStringify(donorTurn)) {
        const singleTurn = cloneCandidate(candidate);
        singleTurn.plan.turns[turnIndex] = JSON.parse(JSON.stringify(donorTurn));
        variants.push({
          strategy: "graft-single-turn",
          candidate: singleTurn,
          contextKeys: createPlanGraftContextKeys(candidate, source.candidate, turnIndex, false),
        });
      }

      const sourceSuffix = candidate.plan.turns.slice(turnIndex);
      const donorSuffix = source.candidate.plan.turns.slice(turnIndex);
      if (donorSuffix.length > 0 && stableStringify(sourceSuffix) !== stableStringify(donorSuffix)) {
        const suffix = cloneCandidate(candidate);
        suffix.plan.turns.splice(turnIndex, donorSuffix.length, ...JSON.parse(JSON.stringify(donorSuffix)));
        variants.push({
          strategy: "graft-turn-suffix",
          candidate: suffix,
          contextKeys: createPlanGraftContextKeys(candidate, source.candidate, turnIndex, true),
        });
      }
    }
  }
}

function addMacroSpliceVariants(
  variants: Variant[],
  candidate: RustWasmOptimizerCandidateInput,
  graftSources: CandidateEvidence[],
): void {
  const macros = createActionMacroLibrary(graftSources, candidate, 24);
  if (macros.length === 0) {
    return;
  }

  for (const macro of macros) {
    for (let turnIndex = 0; turnIndex < candidate.plan.turns.length; turnIndex += 1) {
      const turn = candidate.plan.turns[turnIndex];
      if (turn.actions.length < macro.length) {
        continue;
      }
      for (let actionIndex = 0; actionIndex <= turn.actions.length - macro.length; actionIndex += 1) {
        const existingKey = encodeActionMacro(turn.actions.slice(actionIndex, actionIndex + macro.length));
        if (existingKey === macro.key) {
          continue;
        }
        const next = cloneCandidate(candidate);
        next.plan.turns[turnIndex].actions.splice(actionIndex, macro.length, ...macro.actions.map(cloneAction));
        variants.push({
          strategy: "splice-action-macro",
          candidate: next,
          contextKeys: createMacroSpliceContextKeys(candidate, macro, turnIndex, actionIndex),
        });
      }
    }
  }
}

function addActionCompletionVariants(variants: Variant[], candidate: RustWasmOptimizerCandidateInput, scenario: Scenario): void {
  for (let turnIndex = 0; turnIndex < candidate.plan.turns.length; turnIndex += 1) {
    const turn = candidate.plan.turns[turnIndex];
    if (turn.actions.length >= scenario.maxActionsPerTurn) {
      continue;
    }

    for (const action of weightedActionCandidates.slice(0, 8)) {
      const next = cloneCandidate(candidate);
      next.plan.turns[turnIndex].actions.push(cloneAction(action));
      variants.push({
        strategy: "append-weighted-action",
        candidate: next,
        contextKeys: createActionAppendContextKeys(candidate, turnIndex, action),
      });
    }
  }
}

function createActionMacroLibrary(
  sources: CandidateEvidence[],
  excludedCandidate: RustWasmOptimizerCandidateInput,
  limit: number,
): ActionMacro[] {
  const excludedFingerprint = stableStringify(excludedCandidate);
  const macros = new Map<string, ActionMacro>();
  for (const source of sources) {
    if (stableStringify(source.candidate) === excludedFingerprint) {
      continue;
    }
    for (const turn of source.candidate.plan.turns) {
      for (const length of [2, 3]) {
        if (turn.actions.length < length) {
          continue;
        }
        for (let start = 0; start <= turn.actions.length - length; start += 1) {
          const actions = turn.actions.slice(start, start + length);
          const key = encodeActionMacro(actions);
          const existing = macros.get(key);
          if (existing) {
            existing.support += 1;
            existing.bestScore = Math.max(existing.bestScore, source.score);
            continue;
          }
          macros.set(key, {
            key,
            actions: actions.map(cloneAction),
            length,
            support: 1,
            bestScore: source.score,
          });
        }
      }
    }
  }

  return [...macros.values()]
    .sort((left, right) =>
      right.support - left.support
      || right.bestScore - left.bestScore
      || right.length - left.length
      || left.key.localeCompare(right.key)
    )
    .slice(0, limit);
}

function addActionReplacementVariants(variants: Variant[], candidate: RustWasmOptimizerCandidateInput): void {
  for (let turnIndex = 0; turnIndex < candidate.plan.turns.length; turnIndex += 1) {
    const turn = candidate.plan.turns[turnIndex];
    for (let actionIndex = 0; actionIndex < turn.actions.length; actionIndex += 1) {
      for (const action of weightedActionCandidates.slice(0, 8)) {
        if (encodeActionForContext(turn.actions[actionIndex]) === encodeActionForContext(action)) {
          continue;
        }
        const next = cloneCandidate(candidate);
        next.plan.turns[turnIndex].actions[actionIndex] = cloneAction(action);
        variants.push({
          strategy: "replace-with-weighted-action",
          candidate: next,
          contextKeys: createActionReplacementContextKeys(candidate, turnIndex, actionIndex, action),
        });
      }
    }
  }
}

function addActionTargetVariants(variants: Variant[], candidate: RustWasmOptimizerCandidateInput): void {
  for (let turnIndex = 0; turnIndex < candidate.plan.turns.length; turnIndex += 1) {
    const turn = candidate.plan.turns[turnIndex];
    for (let actionIndex = 0; actionIndex < turn.actions.length; actionIndex += 1) {
      const current = turn.actions[actionIndex];
      const currentKey = encodeActionForContext(current);
      const actionVariants = actionVariantsBySpellId.get(readSpellId(current)) ?? [];
      for (const replacement of actionVariants) {
        if (encodeActionForContext(replacement) === currentKey) {
          continue;
        }
        const next = cloneCandidate(candidate);
        next.plan.turns[turnIndex].actions[actionIndex] = cloneAction(replacement);
        variants.push({
          strategy: "retarget-action",
          candidate: next,
          contextKeys: createActionTargetContextKeys(candidate, turnIndex, actionIndex, replacement),
        });
      }
    }
  }
}

function addActionOrderVariants(variants: Variant[], candidate: RustWasmOptimizerCandidateInput, scenario: Scenario): void {
  for (let turnIndex = 0; turnIndex < candidate.plan.turns.length; turnIndex += 1) {
    const turn = candidate.plan.turns[turnIndex];
    if (turn.actions.length > 1) {
      const rotated = cloneCandidate(candidate);
      const [firstAction] = rotated.plan.turns[turnIndex].actions.splice(0, 1);
      rotated.plan.turns[turnIndex].actions.push(firstAction);
        variants.push({ strategy: "rotate-turn-actions", candidate: rotated });
      for (let actionIndex = 1; actionIndex < turn.actions.length; actionIndex += 1) {
        const swapped = cloneCandidate(candidate);
        [swapped.plan.turns[turnIndex].actions[actionIndex - 1], swapped.plan.turns[turnIndex].actions[actionIndex]] = [
          swapped.plan.turns[turnIndex].actions[actionIndex],
          swapped.plan.turns[turnIndex].actions[actionIndex - 1],
        ];
        variants.push({
          strategy: "swap-adjacent-actions",
          candidate: swapped,
          contextKeys: createAdjacentSwapContextKeys(candidate, turnIndex, actionIndex),
        });
      }
    }
    if (turnIndex > 0 && turn.actions.length > 0 && candidate.plan.turns[turnIndex - 1].actions.length < scenario.maxActionsPerTurn) {
      const moved = cloneCandidate(candidate);
      const action = moved.plan.turns[turnIndex].actions.pop();
      if (action) {
        moved.plan.turns[turnIndex - 1].actions.push(action);
        variants.push({ strategy: "move-last-action-earlier", candidate: moved });
      }
    }
    if (turnIndex < candidate.plan.turns.length - 1 && turn.actions.length > 0 && candidate.plan.turns[turnIndex + 1].actions.length < scenario.maxActionsPerTurn) {
      const moved = cloneCandidate(candidate);
      const [action] = moved.plan.turns[turnIndex].actions.splice(0, 1);
      moved.plan.turns[turnIndex + 1].actions.unshift(action);
      variants.push({ strategy: "move-first-action-later", candidate: moved });
    }
  }
}

function addActionDropVariants(variants: Variant[], candidate: RustWasmOptimizerCandidateInput): void {
  for (let turnIndex = 0; turnIndex < candidate.plan.turns.length; turnIndex += 1) {
    const turn = candidate.plan.turns[turnIndex];
    for (let actionIndex = 0; actionIndex < turn.actions.length; actionIndex += 1) {
      const next = cloneCandidate(candidate);
      next.plan.turns[turnIndex].actions.splice(actionIndex, 1);
      variants.push({ strategy: "drop-action", candidate: next });
    }
  }
}

function addLoadoutReplacementVariants(
  variants: Variant[],
  candidate: RustWasmOptimizerCandidateInput,
  strategy: string,
  field: "passiveIds" | "sublimationIds",
  availableIds: string[],
  maxCount: number,
): void {
  const currentIds = (candidate[field] ?? []).slice(0, maxCount);
  if (currentIds.length === 0) {
    return;
  }
  const current = new Set(currentIds);
  const replacements = availableIds.filter((id) => !current.has(id));
  for (const slotIndex of deterministicIndexOrder(currentIds.length, `${strategy}:slot`, candidate)) {
    for (const replacement of deterministicIdOrder(replacements, `${strategy}:${slotIndex}`, candidate)) {
      const next = cloneCandidate(candidate);
      next[field] = [...currentIds];
      next[field]![slotIndex] = replacement;
      variants.push({ strategy, candidate: next });
    }
  }
}

function evaluateScore(
  evaluator: ReturnType<typeof createOptimizerExperimentEvaluator>,
  candidate: RustWasmOptimizerCandidateInput,
): number | null {
  return evaluator.evaluateDetailed({
    passiveIds: candidate.passiveIds ?? [],
    sublimationIds: candidate.sublimationIds ?? [],
    plan: candidate.plan,
  }).result?.score.score ?? null;
}

function toCandidateInput(candidate: unknown): RustWasmOptimizerCandidateInput | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const record = candidate as Record<string, unknown>;
  if (!record.plan || typeof record.plan !== "object") {
    return null;
  }
  return {
    passiveIds: Array.isArray(record.passiveIds) ? record.passiveIds.filter(isString) : [],
    sublimationIds: Array.isArray(record.sublimationIds) ? record.sublimationIds.filter(isString) : [],
    plan: record.plan as RustWasmOptimizerCandidateInput["plan"],
  };
}

function aggregateSummaries(dbs: Array<ReturnType<typeof evaluateDatabase>>, minContextValid: number) {
  const strategies = new Map<string, StrategyStats>();
  const swapContexts = new Map<string, ContextStats>();
  const actionEditContexts = new Map<string, ContextStats>();
  const targetEditContexts = new Map<string, ContextStats>();
  const planGraftContexts = new Map<string, ContextStats>();
  const macroSpliceContexts = new Map<string, ContextStats>();
  const ruleSets = createRuleSetStatsMap();
  const aggregate = {
    sourceCandidates: 0,
    scoredSources: 0,
    skippedInvalidSources: 0,
    generatedVariants: 0,
    validVariants: 0,
    positiveVariants: 0,
    globalBestVariants: 0,
  };
  for (const db of dbs) {
    aggregate.sourceCandidates += db.sourceCandidates;
    aggregate.scoredSources += db.scoredSources;
    aggregate.skippedInvalidSources += db.skippedInvalidSources;
    aggregate.generatedVariants += db.generatedVariants;
    aggregate.validVariants += db.validVariants;
    aggregate.positiveVariants += db.positiveVariants;
    aggregate.globalBestVariants += db.globalBestVariants;
    for (const [strategy, stats] of Object.entries(db.strategies)) {
      const entry = getStrategyStats(strategies, strategy);
      entry.generated += stats.generated;
      entry.valid += stats.valid;
      entry.positive += stats.positive;
      entry.globalBest += stats.globalBest;
      entry.deltaTotal += stats.averageDelta * stats.valid;
      entry.bestDelta = entry.bestDelta === null ? stats.bestDelta : Math.max(entry.bestDelta, stats.bestDelta);
    }
    for (const context of db.swapContexts.all) {
      const entry = getContextStats(swapContexts, context.key);
      entry.generated += context.generated;
      entry.valid += context.valid;
      entry.positive += context.positive;
      entry.globalBest += context.globalBest;
      entry.deltaTotal += context.averageDelta * context.valid;
      entry.bestDelta = entry.bestDelta === null ? context.bestDelta : Math.max(entry.bestDelta, context.bestDelta);
    }
    for (const context of db.actionEditContexts.all) {
      const entry = getContextStats(actionEditContexts, context.key);
      entry.generated += context.generated;
      entry.valid += context.valid;
      entry.positive += context.positive;
      entry.globalBest += context.globalBest;
      entry.deltaTotal += context.averageDelta * context.valid;
      entry.bestDelta = entry.bestDelta === null ? context.bestDelta : Math.max(entry.bestDelta, context.bestDelta);
    }
    for (const context of db.targetEditContexts.all) {
      const entry = getContextStats(targetEditContexts, context.key);
      entry.generated += context.generated;
      entry.valid += context.valid;
      entry.positive += context.positive;
      entry.globalBest += context.globalBest;
      entry.deltaTotal += context.averageDelta * context.valid;
      entry.bestDelta = entry.bestDelta === null ? context.bestDelta : Math.max(entry.bestDelta, context.bestDelta);
    }
    for (const context of db.planGraftContexts.all) {
      const entry = getContextStats(planGraftContexts, context.key);
      entry.generated += context.generated;
      entry.valid += context.valid;
      entry.positive += context.positive;
      entry.globalBest += context.globalBest;
      entry.deltaTotal += context.averageDelta * context.valid;
      entry.bestDelta = entry.bestDelta === null ? context.bestDelta : Math.max(entry.bestDelta, context.bestDelta);
    }
    for (const context of db.macroSpliceContexts.all) {
      const entry = getContextStats(macroSpliceContexts, context.key);
      entry.generated += context.generated;
      entry.valid += context.valid;
      entry.positive += context.positive;
      entry.globalBest += context.globalBest;
      entry.deltaTotal += context.averageDelta * context.valid;
      entry.bestDelta = entry.bestDelta === null ? context.bestDelta : Math.max(entry.bestDelta, context.bestDelta);
    }
    for (const stats of Object.values(db.ruleSets)) {
      const entry = ruleSets.get(stats.id);
      if (!entry) {
        continue;
      }
      entry.generated += stats.generated;
      entry.valid += stats.valid;
      entry.positive += stats.positive;
      entry.globalBest += stats.globalBest;
      entry.deltaTotal += stats.averageDelta * stats.valid;
      entry.bestDelta = entry.bestDelta === null ? stats.bestDelta : Math.max(entry.bestDelta, stats.bestDelta);
      if (stats.valid > 0) {
        entry.dbsWithValid.add(db.dbPath);
      }
    }
  }
  return {
    ...aggregate,
    strategies: summarizeStrategies(strategies),
    swapContexts: summarizeContexts(swapContexts, minContextValid, 30),
    actionEditContexts: summarizeContexts(actionEditContexts, minContextValid, 30),
    targetEditContexts: summarizeContexts(targetEditContexts, minContextValid, 30),
    planGraftContexts: summarizeContexts(planGraftContexts, minContextValid, 30),
    macroSpliceContexts: summarizeContexts(macroSpliceContexts, minContextValid, 30),
    ruleSets: summarizeRuleSets(ruleSets),
    heldOutContextPolicy: evaluateHeldOutContextPolicy(dbs, minContextValid),
    heldOutIdentityContextPolicy: evaluateHeldOutContextPolicy(
      dbs,
      minContextValid,
      isActionIdentityContextKey,
    ),
  };
}

function summarizeStrategies(strategies: Map<string, StrategyStats>): Record<string, {
  generated: number;
  valid: number;
  positive: number;
  globalBest: number;
  positiveRate: number;
  validRate: number;
  averageDelta: number;
  bestDelta: number;
}> {
  const summary: Record<string, {
    generated: number;
    valid: number;
    positive: number;
    globalBest: number;
    positiveRate: number;
    validRate: number;
    averageDelta: number;
    bestDelta: number;
  }> = {};
  for (const [strategy, stats] of [...strategies.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    summary[strategy] = {
      generated: stats.generated,
      valid: stats.valid,
      positive: stats.positive,
      globalBest: stats.globalBest,
      positiveRate: round(stats.positive / Math.max(1, stats.valid), 4),
      validRate: round(stats.valid / Math.max(1, stats.generated), 4),
      averageDelta: round(stats.deltaTotal / Math.max(1, stats.valid)),
      bestDelta: round(stats.bestDelta ?? 0),
    };
  }
  return summary;
}

function evaluateHeldOutContextPolicy(
  dbs: Array<ReturnType<typeof evaluateDatabase>>,
  minContextValid: number,
  allowContext: (contextKey: string) => boolean = () => true,
) {
  if (dbs.length < 3) {
    return {
      eligible: false,
      reason: "Need at least 3 databases for leave-one-database-out context selection.",
      folds: [],
      selectedAggregate: summarizeMetricStats(createEmptyStats()),
      currentOnlineAggregate: summarizeMetricStats(createEmptyStats()),
      lift: createMetricLift(summarizeMetricStats(createEmptyStats()), summarizeMetricStats(createEmptyStats())),
    };
  }

  const selectedAggregate = createEmptyStats();
  const currentOnlineAggregate = createEmptyStats();
  const folds = dbs.map((holdout) => {
    const trainingDbs = dbs.filter((db) => db.dbPath !== holdout.dbPath);
    const selectedContexts = selectHeldOutContextPolicy(trainingDbs, minContextValid, allowContext);
    const holdoutEvaluations = getSwapVariantEvaluations(holdout);
    const selected = summarizeSwapVariantPolicy(holdoutEvaluations, selectedContexts);
    const currentOnline = summarizeSwapVariantPolicy(holdoutEvaluations, getRuleSetContextKeys("current-online"));
    addStats(selectedAggregate, selected.raw);
    addStats(currentOnlineAggregate, currentOnline.raw);
    return {
      holdoutDbPath: holdout.dbPath,
      selectedContexts,
      selected: selected.summary,
      currentOnline: currentOnline.summary,
      lift: createMetricLift(selected.summary, currentOnline.summary),
    };
  });

  const selectedSummary = summarizeMetricStats(selectedAggregate);
  const currentOnlineSummary = summarizeMetricStats(currentOnlineAggregate);
  return {
    eligible: true,
    minContextValid,
    folds,
    selectedAggregate: selectedSummary,
    currentOnlineAggregate: currentOnlineSummary,
    lift: createMetricLift(selectedSummary, currentOnlineSummary),
  };
}

function selectHeldOutContextPolicy(
  trainingDbs: Array<ReturnType<typeof evaluateDatabase>>,
  minContextValid: number,
  allowContext: (contextKey: string) => boolean,
): string[] {
  const contexts = new Map<string, ContextStats & { dbsWithValid: Set<string> }>();
  for (const db of trainingDbs) {
    for (const context of db.swapContexts.all) {
      if (!allowContext(context.key)) {
        continue;
      }
      const current = contexts.get(context.key) ?? {
        key: context.key,
        generated: 0,
        valid: 0,
        positive: 0,
        globalBest: 0,
        deltaTotal: 0,
        bestDelta: null,
        dbsWithValid: new Set<string>(),
      };
      current.generated += context.generated;
      current.valid += context.valid;
      current.positive += context.positive;
      current.globalBest += context.globalBest;
      current.deltaTotal += context.averageDelta * context.valid;
      current.bestDelta = current.bestDelta === null ? context.bestDelta : Math.max(current.bestDelta, context.bestDelta);
      if (context.valid > 0) {
        current.dbsWithValid.add(db.dbPath);
      }
      contexts.set(context.key, current);
    }
  }

  const minDbsWithValid = Math.min(
    trainingDbs.length,
    Math.max(2, Math.ceil(trainingDbs.length * 0.35)),
  );
  const minValid = Math.max(minContextValid, 20);
  return [...contexts.values()]
    .map((context) => ({
      key: context.key,
      valid: context.valid,
      dbsWithValid: context.dbsWithValid.size,
      positiveRate: context.positive / Math.max(1, context.valid),
      globalBestRate: context.globalBest / Math.max(1, context.valid),
      averageDelta: context.deltaTotal / Math.max(1, context.valid),
      bestDelta: context.bestDelta ?? 0,
    }))
    .filter((context) =>
      context.valid >= minValid
      && context.dbsWithValid >= minDbsWithValid
      && context.positiveRate >= 0.75
      && context.globalBestRate > 0
      && context.averageDelta > 0
    )
    .sort((left, right) =>
      right.globalBestRate - left.globalBestRate
      || right.positiveRate - left.positiveRate
      || right.averageDelta - left.averageDelta
      || right.dbsWithValid - left.dbsWithValid
      || right.valid - left.valid
      || left.key.localeCompare(right.key)
    )
    .slice(0, 4)
    .map((context) => context.key);
}

function isActionIdentityContextKey(contextKey: string): boolean {
  return contextKey.startsWith("pair:") || contextKey.startsWith("turn-pair:");
}

function summarizeSwapVariantPolicy(
  evaluations: SwapVariantEvaluation[],
  contextKeys: string[],
): { raw: StrategyStats; summary: MetricSummary } {
  const contextKeySet = new Set(contextKeys);
  const stats = createEmptyStats();
  for (const evaluation of evaluations) {
    if (!evaluation.contextKeys.some((contextKey) => contextKeySet.has(contextKey))) {
      continue;
    }
    stats.generated += 1;
    if (!evaluation.valid || evaluation.delta === null) {
      continue;
    }
    stats.valid += 1;
    stats.deltaTotal += evaluation.delta;
    stats.bestDelta = stats.bestDelta === null ? evaluation.delta : Math.max(stats.bestDelta, evaluation.delta);
    if (evaluation.positive) {
      stats.positive += 1;
    }
    if (evaluation.globalBest) {
      stats.globalBest += 1;
    }
  }
  return { raw: stats, summary: summarizeMetricStats(stats) };
}

function getSwapVariantEvaluations(db: ReturnType<typeof evaluateDatabase>): SwapVariantEvaluation[] {
  return (db as ReturnType<typeof evaluateDatabase> & { swapVariantEvaluations?: SwapVariantEvaluation[] })
    .swapVariantEvaluations ?? [];
}

function getRuleSetContextKeys(id: string): string[] {
  return adjacentSwapRuleSets.find((ruleSet) => ruleSet.id === id)?.contextKeys ?? [];
}

function createEmptyStats(): StrategyStats {
  return { generated: 0, valid: 0, positive: 0, globalBest: 0, deltaTotal: 0, bestDelta: null };
}

function addStats(target: StrategyStats, source: StrategyStats): void {
  target.generated += source.generated;
  target.valid += source.valid;
  target.positive += source.positive;
  target.globalBest += source.globalBest;
  target.deltaTotal += source.deltaTotal;
  target.bestDelta = target.bestDelta === null ? source.bestDelta : Math.max(target.bestDelta, source.bestDelta ?? target.bestDelta);
}

function summarizeMetricStats(stats: StrategyStats): MetricSummary {
  return {
    generated: stats.generated,
    valid: stats.valid,
    positive: stats.positive,
    globalBest: stats.globalBest,
    positiveRate: round(stats.positive / Math.max(1, stats.valid), 4),
    globalBestRate: round(stats.globalBest / Math.max(1, stats.valid), 4),
    validRate: round(stats.valid / Math.max(1, stats.generated), 4),
    averageDelta: round(stats.deltaTotal / Math.max(1, stats.valid)),
    bestDelta: round(stats.bestDelta ?? 0),
  };
}

function createMetricLift(left: MetricSummary, right: MetricSummary) {
  return {
    positiveRate: round(left.positiveRate - right.positiveRate, 4),
    globalBestRate: round(left.globalBestRate - right.globalBestRate, 4),
    validRate: round(left.validRate - right.validRate, 4),
    averageDelta: round(left.averageDelta - right.averageDelta),
    globalBest: left.globalBest - right.globalBest,
  };
}

function getStrategyStats(strategies: Map<string, StrategyStats>, strategy: string): StrategyStats {
  const current = strategies.get(strategy);
  if (current) {
    return current;
  }
  const next = { generated: 0, valid: 0, positive: 0, globalBest: 0, deltaTotal: 0, bestDelta: null };
  strategies.set(strategy, next);
  return next;
}

function getContextStats(contexts: Map<string, ContextStats>, key: string): ContextStats {
  const current = contexts.get(key);
  if (current) {
    return current;
  }
  const next = { key, generated: 0, valid: 0, positive: 0, globalBest: 0, deltaTotal: 0, bestDelta: null };
  contexts.set(key, next);
  return next;
}

function getVariantContextStats(
  variant: Variant,
  swapContexts: Map<string, ContextStats>,
  actionEditContexts: Map<string, ContextStats>,
  targetEditContexts: Map<string, ContextStats>,
  planGraftContexts: Map<string, ContextStats>,
  macroSpliceContexts: Map<string, ContextStats>,
  key: string,
): ContextStats {
  if (variant.strategy === "swap-adjacent-actions") {
    return getContextStats(swapContexts, key);
  }
  if (variant.strategy === "append-weighted-action" || variant.strategy === "replace-with-weighted-action") {
    return getContextStats(actionEditContexts, key);
  }
  if (variant.strategy === "retarget-action") {
    return getContextStats(targetEditContexts, key);
  }
  if (variant.strategy === "graft-single-turn" || variant.strategy === "graft-turn-suffix") {
    return getContextStats(planGraftContexts, key);
  }
  if (variant.strategy === "splice-action-macro") {
    return getContextStats(macroSpliceContexts, key);
  }
  return getContextStats(swapContexts, key);
}

function createRuleSetStatsMap(): Map<string, RuleSetStats> {
  return new Map(adjacentSwapRuleSets.map((ruleSet) => [ruleSet.id, {
    id: ruleSet.id,
    description: ruleSet.description,
    generated: 0,
    valid: 0,
    positive: 0,
    globalBest: 0,
    deltaTotal: 0,
    bestDelta: null,
    dbsWithValid: new Set<string>(),
  }]));
}

function matchingRuleSetStats(
  ruleSets: Map<string, RuleSetStats>,
  contextKeys: string[],
): RuleSetStats[] {
  if (contextKeys.length === 0) {
    return [];
  }
  const contextKeySet = new Set(contextKeys);
  return adjacentSwapRuleSets.flatMap((ruleSet) => {
    if (!ruleSet.contextKeys.some((contextKey) => contextKeySet.has(contextKey))) {
      return [];
    }
    const stats = ruleSets.get(ruleSet.id);
    return stats ? [stats] : [];
  });
}

function summarizeRuleSets(ruleSets: Map<string, RuleSetStats>): Record<string, {
  id: string;
  description: string;
  generated: number;
  valid: number;
  positive: number;
  globalBest: number;
  dbsWithValid: number;
  positiveRate: number;
  globalBestRate: number;
  validRate: number;
  averageDelta: number;
  bestDelta: number;
}> {
  const summary: Record<string, {
    id: string;
    description: string;
    generated: number;
    valid: number;
    positive: number;
    globalBest: number;
    dbsWithValid: number;
    positiveRate: number;
    globalBestRate: number;
    validRate: number;
    averageDelta: number;
    bestDelta: number;
  }> = {};
  for (const stats of [...ruleSets.values()].sort((left, right) => left.id.localeCompare(right.id))) {
    summary[stats.id] = {
      id: stats.id,
      description: stats.description,
      generated: stats.generated,
      valid: stats.valid,
      positive: stats.positive,
      globalBest: stats.globalBest,
      dbsWithValid: stats.dbsWithValid.size,
      positiveRate: round(stats.positive / Math.max(1, stats.valid), 4),
      globalBestRate: round(stats.globalBest / Math.max(1, stats.valid), 4),
      validRate: round(stats.valid / Math.max(1, stats.generated), 4),
      averageDelta: round(stats.deltaTotal / Math.max(1, stats.valid)),
      bestDelta: round(stats.bestDelta ?? 0),
    };
  }
  return summary;
}

function summarizeContexts(contexts: Map<string, ContextStats>, minValid: number, limit: number) {
  const all = [...contexts.values()]
    .map((stats) => ({
      key: stats.key,
      generated: stats.generated,
      valid: stats.valid,
      positive: stats.positive,
      globalBest: stats.globalBest,
      positiveRate: round(stats.positive / Math.max(1, stats.valid), 4),
      globalBestRate: round(stats.globalBest / Math.max(1, stats.valid), 4),
      validRate: round(stats.valid / Math.max(1, stats.generated), 4),
      averageDelta: round(stats.deltaTotal / Math.max(1, stats.valid)),
      bestDelta: round(stats.bestDelta ?? 0),
    }))
    .sort((left, right) =>
      right.valid - left.valid
      || right.positive - left.positive
      || left.key.localeCompare(right.key)
    );
  const eligible = all.filter((stats) => stats.valid >= minValid);
  const topPositiveRate = [...eligible]
    .sort((left, right) =>
      right.positiveRate - left.positiveRate
      || right.globalBestRate - left.globalBestRate
      || right.averageDelta - left.averageDelta
      || right.valid - left.valid
      || left.key.localeCompare(right.key)
    )
    .slice(0, limit);
  const topGlobalBestRate = [...eligible]
    .sort((left, right) =>
      right.globalBestRate - left.globalBestRate
      || right.positiveRate - left.positiveRate
      || right.averageDelta - left.averageDelta
      || right.valid - left.valid
      || left.key.localeCompare(right.key)
    )
    .slice(0, limit);
  return {
    minValid,
    all,
    eligibleContexts: eligible.length,
    topPositiveRate,
    topGlobalBestRate,
  };
}

function createConsoleSummary(result: ContrastPairResult) {
  const swapStats = result.aggregate.strategies["swap-adjacent-actions"];
  const appendStats = result.aggregate.strategies["append-weighted-action"];
  const replaceStats = result.aggregate.strategies["replace-with-weighted-action"];
  const retargetStats = result.aggregate.strategies["retarget-action"];
  const graftSingleTurnStats = result.aggregate.strategies["graft-single-turn"];
  const graftTurnSuffixStats = result.aggregate.strategies["graft-turn-suffix"];
  const spliceActionMacroStats = result.aggregate.strategies["splice-action-macro"];
  return {
    scenario: result.scenario,
    dbCount: result.dbs.length,
    aggregate: {
      sourceCandidates: result.aggregate.sourceCandidates,
      validVariants: result.aggregate.validVariants,
      positiveVariants: result.aggregate.positiveVariants,
      globalBestVariants: result.aggregate.globalBestVariants,
      swapAdjacentActions: swapStats,
      appendWeightedActions: appendStats,
      replaceWithWeightedAction: replaceStats,
      retargetAction: retargetStats,
      graftSingleTurn: graftSingleTurnStats,
      graftTurnSuffix: graftTurnSuffixStats,
      spliceActionMacro: spliceActionMacroStats,
      adjacentSwapRuleSets: result.aggregate.ruleSets,
      swapContextEligibleContexts: result.aggregate.swapContexts.eligibleContexts,
      swapContextTopPositiveRate: result.aggregate.swapContexts.topPositiveRate.slice(0, 10),
      swapContextTopGlobalBestRate: result.aggregate.swapContexts.topGlobalBestRate.slice(0, 10),
      heldOutContextPolicy: {
        eligible: result.aggregate.heldOutContextPolicy.eligible,
        selectedAggregate: result.aggregate.heldOutContextPolicy.selectedAggregate,
        currentOnlineAggregate: result.aggregate.heldOutContextPolicy.currentOnlineAggregate,
        lift: result.aggregate.heldOutContextPolicy.lift,
        folds: result.aggregate.heldOutContextPolicy.folds.map((fold) => ({
          holdoutDbPath: fold.holdoutDbPath,
          selectedContexts: fold.selectedContexts,
          selected: fold.selected,
          currentOnline: fold.currentOnline,
          lift: fold.lift,
        })),
      },
      heldOutIdentityContextPolicy: {
        eligible: result.aggregate.heldOutIdentityContextPolicy.eligible,
        selectedAggregate: result.aggregate.heldOutIdentityContextPolicy.selectedAggregate,
        currentOnlineAggregate: result.aggregate.heldOutIdentityContextPolicy.currentOnlineAggregate,
        lift: result.aggregate.heldOutIdentityContextPolicy.lift,
        folds: result.aggregate.heldOutIdentityContextPolicy.folds.map((fold) => ({
          holdoutDbPath: fold.holdoutDbPath,
          selectedContexts: fold.selectedContexts,
          selected: fold.selected,
          currentOnline: fold.currentOnline,
          lift: fold.lift,
        })),
      },
      actionEditEligibleContexts: result.aggregate.actionEditContexts.eligibleContexts,
      actionEditTopPositiveRate: result.aggregate.actionEditContexts.topPositiveRate.slice(0, 10),
      actionEditTopGlobalBestRate: result.aggregate.actionEditContexts.topGlobalBestRate.slice(0, 10),
      targetEditEligibleContexts: result.aggregate.targetEditContexts.eligibleContexts,
      targetEditTopPositiveRate: result.aggregate.targetEditContexts.topPositiveRate.slice(0, 10),
      targetEditTopGlobalBestRate: result.aggregate.targetEditContexts.topGlobalBestRate.slice(0, 10),
      planGraftEligibleContexts: result.aggregate.planGraftContexts.eligibleContexts,
      planGraftTopPositiveRate: result.aggregate.planGraftContexts.topPositiveRate.slice(0, 10),
      planGraftTopGlobalBestRate: result.aggregate.planGraftContexts.topGlobalBestRate.slice(0, 10),
      macroSpliceEligibleContexts: result.aggregate.macroSpliceContexts.eligibleContexts,
      macroSpliceTopPositiveRate: result.aggregate.macroSpliceContexts.topPositiveRate.slice(0, 10),
      macroSpliceTopGlobalBestRate: result.aggregate.macroSpliceContexts.topGlobalBestRate.slice(0, 10),
    },
  };
}

function createAdjacentSwapContextKeys(
  candidate: RustWasmOptimizerCandidateInput,
  turnIndex: number,
  actionIndex: number,
): string[] {
  const turn = candidate.plan.turns[turnIndex];
  const leftSpell = readSpellId(turn.actions[actionIndex - 1]);
  const rightSpell = readSpellId(turn.actions[actionIndex]);
  const orderedPair = `${leftSpell}>${rightSpell}`;
  const unorderedPair = [leftSpell, rightSpell].sort().join("|");
  const turnNumber = turnIndex + 1;
  const leftSlot = actionIndex;
  return [
    `turn:${turnNumber}`,
    `slot:${leftSlot}`,
    `turn-slot:${turnNumber}:${leftSlot}`,
    `left:${leftSpell}`,
    `right:${rightSpell}`,
    `pair:${orderedPair}`,
    `unordered-pair:${unorderedPair}`,
    `turn-pair:${turnNumber}:${orderedPair}`,
  ];
}

function readSpellId(action: unknown): string {
  if (!action || typeof action !== "object") {
    return "unknown";
  }
  const record = action as Record<string, unknown>;
  return typeof record.spellId === "string" ? record.spellId : "unknown";
}

function createPlanGraftContextKeys(
  candidate: RustWasmOptimizerCandidateInput,
  donor: RustWasmOptimizerCandidateInput,
  turnIndex: number,
  suffix: boolean,
): string[] {
  const sourceTurn = candidate.plan.turns[turnIndex];
  const donorTurn = donor.plan.turns[turnIndex];
  const turnNumber = turnIndex + 1;
  const sourceFirst = sourceTurn?.actions[0] ? readSpellId(sourceTurn.actions[0]) : "empty";
  const donorFirst = donorTurn?.actions[0] ? readSpellId(donorTurn.actions[0]) : "empty";
  const sourceLast = sourceTurn?.actions.at(-1) ? readSpellId(sourceTurn.actions.at(-1)) : "empty";
  const donorLast = donorTurn?.actions.at(-1) ? readSpellId(donorTurn.actions.at(-1)) : "empty";
  const sourceCount = sourceTurn?.actions.length ?? 0;
  const donorCount = donorTurn?.actions.length ?? 0;
  const kind = suffix ? "suffix" : "turn";

  return [
    `graft:${kind}`,
    `graft:${kind}:turn:${turnNumber}`,
    `graft:${kind}:count:${sourceCount}>${donorCount}`,
    `graft:${kind}:first:${sourceFirst}>${donorFirst}`,
    `graft:${kind}:last:${sourceLast}>${donorLast}`,
    `graft:${kind}:turn-first:${turnNumber}:${sourceFirst}>${donorFirst}`,
    `graft:${kind}:turn-last:${turnNumber}:${sourceLast}>${donorLast}`,
  ];
}

function createActionAppendContextKeys(
  candidate: RustWasmOptimizerCandidateInput,
  turnIndex: number,
  action: CandidateActionInput,
): string[] {
  const turn = candidate.plan.turns[turnIndex];
  const previousSpell = turn.actions.length > 0 ? readSpellId(turn.actions[turn.actions.length - 1]) : "start";
  const spell = readSpellId(action);
  const turnNumber = turnIndex + 1;
  const slot = turn.actions.length + 1;
  return [
    `append:turn:${turnNumber}`,
    `append:slot:${slot}`,
    `append:spell:${spell}`,
    `append:after:${previousSpell}`,
    `append:after-pair:${previousSpell}>${spell}`,
    `append:turn-after-pair:${turnNumber}:${previousSpell}>${spell}`,
  ];
}

function createActionReplacementContextKeys(
  candidate: RustWasmOptimizerCandidateInput,
  turnIndex: number,
  actionIndex: number,
  replacement: CandidateActionInput,
): string[] {
  const turn = candidate.plan.turns[turnIndex];
  const oldSpell = readSpellId(turn.actions[actionIndex]);
  const newSpell = readSpellId(replacement);
  const leftSpell = actionIndex > 0 ? readSpellId(turn.actions[actionIndex - 1]) : "start";
  const rightSpell = actionIndex < turn.actions.length - 1 ? readSpellId(turn.actions[actionIndex + 1]) : "end";
  const turnNumber = turnIndex + 1;
  const slot = actionIndex + 1;
  return [
    `replace:turn:${turnNumber}`,
    `replace:slot:${slot}`,
    `replace:spell:${oldSpell}>${newSpell}`,
    `replace:new:${newSpell}`,
    `replace:left-pair:${leftSpell}>${newSpell}`,
    `replace:right-pair:${newSpell}>${rightSpell}`,
    `replace:turn-spell:${turnNumber}:${oldSpell}>${newSpell}`,
    `replace:turn-new:${turnNumber}:${newSpell}`,
  ];
}

function createActionTargetContextKeys(
  candidate: RustWasmOptimizerCandidateInput,
  turnIndex: number,
  actionIndex: number,
  replacement: CandidateActionInput,
): string[] {
  const turn = candidate.plan.turns[turnIndex];
  const current = turn.actions[actionIndex];
  const spell = readSpellId(current);
  const oldTarget = readTargetKind(current);
  const newTarget = readTargetKind(replacement);
  const leftSpell = actionIndex > 0 ? readSpellId(turn.actions[actionIndex - 1]) : "start";
  const rightSpell = actionIndex < turn.actions.length - 1 ? readSpellId(turn.actions[actionIndex + 1]) : "end";
  const turnNumber = turnIndex + 1;
  const slot = actionIndex + 1;
  const change = `${oldTarget}>${newTarget}`;
  return [
    `target:turn:${turnNumber}`,
    `target:slot:${slot}`,
    `target:spell:${spell}`,
    `target:change:${change}`,
    `target:spell-change:${spell}:${change}`,
    `target:turn-spell-change:${turnNumber}:${spell}:${change}`,
    `target:left:${leftSpell}>${spell}:${newTarget}`,
    `target:right:${spell}:${newTarget}>${rightSpell}`,
  ];
}

function createMacroSpliceContextKeys(
  candidate: RustWasmOptimizerCandidateInput,
  macro: ActionMacro,
  turnIndex: number,
  actionIndex: number,
): string[] {
  const turn = candidate.plan.turns[turnIndex];
  const turnNumber = turnIndex + 1;
  const slot = actionIndex + 1;
  const leftSpell = actionIndex > 0 ? readSpellId(turn.actions[actionIndex - 1]) : "start";
  const rightIndex = actionIndex + macro.length;
  const rightSpell = rightIndex < turn.actions.length ? readSpellId(turn.actions[rightIndex]) : "end";
  const mode = "replace";
  const macroFirst = readSpellId(macro.actions[0]);
  const macroLast = readSpellId(macro.actions[macro.actions.length - 1]);

  return [
    `macro:${mode}`,
    `macro:${mode}:length:${macro.length}`,
    `macro:${mode}:turn:${turnNumber}`,
    `macro:${mode}:slot:${slot}`,
    `macro:${mode}:key:${macro.key}`,
    `macro:${mode}:support:${Math.min(macro.support, 10)}`,
    `macro:${mode}:first:${macroFirst}`,
    `macro:${mode}:last:${macroLast}`,
    `macro:${mode}:boundary:${leftSpell}>${macroFirst}`,
    `macro:${mode}:boundary:${macroLast}>${rightSpell}`,
    `macro:${mode}:turn-key:${turnNumber}:${macro.key}`,
    `macro:${mode}:turn-boundary:${turnNumber}:${leftSpell}>${macroFirst}`,
    `macro:${mode}:turn-boundary:${turnNumber}:${macroLast}>${rightSpell}`,
  ];
}

function createWeightedActionCandidates(): CandidateActionInput[] {
  const actions = huppermageCatalog
    .filter((entry) => entry.kind === "spell")
    .flatMap((entry) => createSearchActionVariants(entry as Record<string, unknown>).map((action) => ({
      action,
      weight: computeActionSearchWeight(entry as Record<string, unknown>),
    })));

  return actions
    .sort((left, right) =>
      right.weight - left.weight
      || encodeActionForContext(left.action).localeCompare(encodeActionForContext(right.action))
    )
    .map((entry) => entry.action);
}

function createActionVariantsBySpellId(): Map<string, CandidateActionInput[]> {
  const variantsBySpellId = new Map<string, CandidateActionInput[]>();
  for (const entry of huppermageCatalog) {
    if (entry.kind !== "spell") {
      continue;
    }
    const variants = createSearchActionVariants(entry as Record<string, unknown>)
      .sort((left, right) => encodeActionForContext(left).localeCompare(encodeActionForContext(right)));
    variantsBySpellId.set(String(entry.id), variants);
  }
  return variantsBySpellId;
}

function createSearchActionVariants(entry: Record<string, unknown>): CandidateActionInput[] {
  const spellId = String(entry.id);
  const variants: CandidateActionInput[] = [{ spellId } as CandidateActionInput];
  const targetKinds = new Set<string>();
  for (const constraint of asRecordArray(entry.constraints)) {
    if (constraint.type === "requiresTarget" && typeof constraint.target === "string") {
      targetKinds.add(constraint.target);
    }
    if (constraint.type === "maxCastsPerTarget") {
      targetKinds.add("emptyCell");
    }
  }
  for (const targetKind of [...targetKinds].sort()) {
    variants.push({ spellId, target: { kind: targetKind } } as CandidateActionInput);
  }
  return variants;
}

function computeActionSearchWeight(entry: Record<string, unknown>): number {
  let weight = 1;
  for (const effect of asRecordArray(entry.effects)) {
    if (effect.type === "damage") {
      weight += (readNumber(effect.base, 0) * Math.max(1, readNumber(effect.times, 1))) / 25;
    }
    if (
      effect.type === "resourceDelta"
      && (effect.target === undefined || effect.target === "caster")
      && readNumber(effect.amount, 0) > 0
    ) {
      weight += 1;
    }
  }
  for (const tag of Array.isArray(entry.tags) ? entry.tags : []) {
    if (typeof tag === "string" && ["light", "burst", "rune-consumer", "mark", "scales-with-bq"].includes(tag)) {
      weight += 2;
    }
  }
  return Math.max(1, weight);
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function cloneAction(action: CandidateActionInput): CandidateActionInput {
  return JSON.parse(JSON.stringify(action)) as CandidateActionInput;
}

function encodeActionForContext(action: CandidateActionInput): string {
  return `${readSpellId(action)}:${readTargetKind(action)}`;
}

function readTargetKind(action: CandidateActionInput): string {
  const target = "target" in action && action.target && typeof action.target === "object"
    ? (action.target as Record<string, unknown>).kind
    : undefined;
  return typeof target === "string" ? target : "default";
}

function encodeActionMacro(actions: CandidateActionInput[]): string {
  return actions.map(encodeActionForContext).join(">");
}

function deterministicIndexOrder(length: number, salt: string, candidate: RustWasmOptimizerCandidateInput): number[] {
  return Array.from({ length }, (_, index) => index).sort((left, right) =>
    createFingerprint({ salt, index: left, candidate }).localeCompare(createFingerprint({ salt, index: right, candidate }))
  );
}

function deterministicIdOrder(ids: string[], salt: string, candidate: RustWasmOptimizerCandidateInput): string[] {
  return [...ids].sort((left, right) =>
    createFingerprint({ salt, id: left, candidate }).localeCompare(createFingerprint({ salt, id: right, candidate }))
  );
}

function cloneCandidate(candidate: RustWasmOptimizerCandidateInput): RustWasmOptimizerCandidateInput {
  return JSON.parse(JSON.stringify(candidate)) as RustWasmOptimizerCandidateInput;
}

function createFingerprint(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function parseJson(value: string): unknown {
  return JSON.parse(value);
}

function readOptions(name: string): string[] {
  return process.argv.flatMap((value, index) => value === name ? [process.argv[index + 1]] : []).filter(Boolean);
}

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readIntegerOption(name: string, fallback: number): number {
  const value = readOption(name);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runCli();
}
