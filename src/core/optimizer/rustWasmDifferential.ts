import {
  type GeneratedCandidate,
  type GeneratedSpellProjection,
  createRustWasmDifferentialFixtures,
  normalizeViolation,
  type RustWasmDifferentialFixture,
  type RustWasmDifferentialFixtureOptions,
} from "./rustWasmDifferentialFixtures.ts";
import { roundDamage, type ResourcePool } from "../simulation/index.ts";

export type RustWasmDifferentialWasmExports = {
  validate_resource_cost_json: (
    resourcesJson: string,
    costJson: string,
    spellId: string,
    actionIndex: number,
    contextJson?: string,
  ) => string;
  compute_raw_damage_json: (
    statsJson: string,
    effectJson: string,
    contextJson?: string,
  ) => string;
  apply_initial_passive_effects_json: (
    statsJson: string,
    resourcesJson: string,
    passivesJson: string,
  ) => string;
  create_unknown_spell_violation_json: (
    spellId: string,
    actionIndex: number,
  ) => string;
  validate_spell_rules_json: (
    spellJson: string,
    actionIndex: number,
    targetJson: string | undefined,
    castsBySpellIdJson: string,
    targetCastsBySpellIdJson: string,
    huppermageStateJson: string,
  ) => string;
  validate_huppermage_class_action_json: (
    spellId: string,
    actionIndex: number,
    targetJson: string | undefined,
    castsBySpellIdJson: string,
    huppermageStateJson: string,
  ) => string;
  create_next_turn_state_json: (
    baseResourcesJson: string,
    previousResourcesJson: string,
    previousHuppermageJson: string,
    castsBySpellIdJson: string,
  ) => string;
  apply_feu_follet_recover_json: (
    huppermageStateJson: string,
  ) => string;
  evaluate_sustainability_json: (
    required: boolean,
    firstSummaryJson: string,
    replaySummaryJson: string,
  ) => string;
  apply_turn_end_bq_json: (
    huppermageStateJson: string,
    resourcesJson: string,
  ) => string;
};

export type RustWasmDifferentialMismatch = {
  fixture: string;
  category: RustWasmDifferentialFixture["kind"];
  seed?: string;
  turnIndex?: number;
  actionIndex?: number;
  spellId?: string;
  fieldPath: string;
  typeScriptValue: unknown;
  rustWasmValue: unknown;
};

export type RustWasmDifferentialResult = {
  passed: boolean;
  fixtureCount: number;
  generatedCandidateCount: number;
  mismatchCount: number;
  firstMismatch?: RustWasmDifferentialMismatch;
  fixtureSetupMs: number;
  rustWasmElapsedMs: number;
  candidateEvaluationsPerSecond: number;
  elapsedMs: number;
};

const numericToleranceByFieldPath: Record<string, number> = {
  "$": 0,
};

const defaultNumericTolerance = 1e-9;

export type RustWasmDifferentialOptions = RustWasmDifferentialFixtureOptions;

export function runRustWasmDifferentialSuite(
  wasm: RustWasmDifferentialWasmExports,
  options: RustWasmDifferentialOptions = {},
): RustWasmDifferentialResult {
  const startedAt = performance.now();
  const fixtures = createRustWasmDifferentialFixtures(options);
  const fixtureSetupMs = Math.round((performance.now() - startedAt) * 100) / 100;
  const rustWasmStartedAt = performance.now();
  const generatedCandidateCount = countGeneratedCandidates(fixtures);
  let firstMismatch: RustWasmDifferentialMismatch | undefined;
  let mismatchCount = 0;

  for (const fixture of fixtures) {
    const rustValue = runRustFixture(wasm, fixture);
    const mismatch = findFirstMismatch(fixture.expected, rustValue, "$");

    if (mismatch) {
      mismatchCount += 1;
      firstMismatch ??= createMismatchReport(fixture, mismatch, rustValue);
    }
  }

  const rustWasmElapsedMs = Math.round((performance.now() - rustWasmStartedAt) * 100) / 100;
  return {
    passed: mismatchCount === 0,
    fixtureCount: fixtures.length,
    generatedCandidateCount,
    mismatchCount,
    firstMismatch,
    fixtureSetupMs,
    rustWasmElapsedMs,
    candidateEvaluationsPerSecond: calculateCandidateEvaluationsPerSecond(
      generatedCandidateCount,
      rustWasmElapsedMs,
    ),
    elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
  };
}

function countGeneratedCandidates(fixtures: RustWasmDifferentialFixture[]): number {
  return fixtures.reduce((total, fixture) =>
    total + (fixture.kind === "candidateBatch" ? fixture.candidates.length : 0), 0);
}

function calculateCandidateEvaluationsPerSecond(candidateCount: number, elapsedMs: number): number {
  if (candidateCount === 0 || elapsedMs <= 0) {
    return 0;
  }

  return Math.round((candidateCount / elapsedMs) * 100_000) / 100;
}

function createMismatchReport(
  fixture: RustWasmDifferentialFixture,
  mismatch: { fieldPath: string; typeScriptValue: unknown; rustWasmValue: unknown },
  rustValue: unknown,
): RustWasmDifferentialMismatch {
  const candidateContext = fixture.kind === "candidateBatch"
    ? getCandidateBatchMismatchContext(fixture, mismatch.fieldPath, rustValue)
    : {};

  return {
    fixture: fixture.name,
    category: fixture.kind,
    seed: "seed" in fixture ? fixture.seed : undefined,
    turnIndex: "turnIndex" in fixture ? fixture.turnIndex : candidateContext.turnIndex,
    actionIndex: "actionIndex" in fixture ? fixture.actionIndex : candidateContext.actionIndex,
    spellId: "spellId" in fixture ? fixture.spellId : candidateContext.spellId,
    fieldPath: mismatch.fieldPath,
    typeScriptValue: mismatch.typeScriptValue,
    rustWasmValue: mismatch.rustWasmValue,
  };
}

function getCandidateBatchMismatchContext(
  fixture: Extract<RustWasmDifferentialFixture, { kind: "candidateBatch" }>,
  fieldPath: string,
  rustValue: unknown,
): Pick<RustWasmDifferentialMismatch, "turnIndex" | "actionIndex" | "spellId"> {
  const candidateIndex = getCandidateIndexFromFieldPath(fieldPath);
  if (candidateIndex === undefined) {
    return {};
  }

  const typeScriptResult = Array.isArray(fixture.expected)
    ? fixture.expected[candidateIndex]
    : undefined;
  const rustResult = Array.isArray(rustValue)
    ? rustValue[candidateIndex]
    : undefined;
  const violation = getFirstViolationContext(typeScriptResult) ?? getFirstViolationContext(rustResult);
  if (violation) {
    return violation;
  }

  const candidate = fixture.candidates[candidateIndex];
  const firstAction = candidate?.plan.turns[0]?.actions[0];
  return {
    turnIndex: firstAction ? 0 : undefined,
    actionIndex: firstAction ? 0 : undefined,
    spellId: firstAction?.spellId,
  };
}

function getCandidateIndexFromFieldPath(fieldPath: string): number | undefined {
  const match = /^\$\[(\d+)\]/.exec(fieldPath);
  return match ? Number(match[1]) : undefined;
}

function getFirstViolationContext(
  result: unknown,
): Pick<RustWasmDifferentialMismatch, "turnIndex" | "actionIndex" | "spellId"> | undefined {
  if (!isRecord(result) || !isRecord(result.firstViolation)) {
    return undefined;
  }

  return {
    turnIndex: typeof result.firstViolation.turnIndex === "number" ? result.firstViolation.turnIndex : undefined,
    actionIndex: typeof result.firstViolation.actionIndex === "number" ? result.firstViolation.actionIndex : undefined,
    spellId: typeof result.firstViolation.spellId === "string" ? result.firstViolation.spellId : undefined,
  };
}

function runRustFixture(wasm: RustWasmDifferentialWasmExports, fixture: RustWasmDifferentialFixture): unknown {
  if (fixture.kind === "resourceCost") {
    return JSON.parse(wasm.validate_resource_cost_json(
      JSON.stringify(fixture.resources),
      JSON.stringify(fixture.cost),
      fixture.spellId,
      fixture.actionIndex,
      JSON.stringify(fixture.context),
    ));
  }

  if (fixture.kind === "damage") {
    return JSON.parse(wasm.compute_raw_damage_json(
      JSON.stringify(fixture.stats),
      JSON.stringify(fixture.effect),
      JSON.stringify(fixture.context),
    ));
  }

  if (fixture.kind === "invalidPlan") {
    if (fixture.operation === "unknownSpell") {
      return normalizeRustViolation(JSON.parse(wasm.create_unknown_spell_violation_json(
        fixture.spellId,
        fixture.actionIndex,
      )));
    }

    if (fixture.operation === "resourceCost") {
      const result = JSON.parse(wasm.validate_resource_cost_json(
        JSON.stringify(fixture.resources),
        JSON.stringify(fixture.cost),
        fixture.spellId,
        fixture.actionIndex,
      ));
      return normalizeRustViolation(result.violation);
    }

    if (fixture.operation === "spellRules") {
      return normalizeRustViolation(JSON.parse(wasm.validate_spell_rules_json(
        JSON.stringify(fixture.spellRules),
        fixture.actionIndex,
        fixture.target ? JSON.stringify(fixture.target) : undefined,
        JSON.stringify(fixture.castsBySpellId ?? {}),
        JSON.stringify(fixture.targetCastsBySpellId ?? {}),
        JSON.stringify(fixture.huppermageState),
      )));
    }

    return normalizeRustViolation(JSON.parse(wasm.validate_huppermage_class_action_json(
      fixture.spellId,
      fixture.actionIndex,
      fixture.target ? JSON.stringify(fixture.target) : undefined,
      JSON.stringify(fixture.castsBySpellId ?? {}),
      JSON.stringify(fixture.huppermageState),
    )));
  }

  if (fixture.kind === "multiTurn") {
    if (fixture.operation === "nextTurnState") {
      return JSON.parse(wasm.create_next_turn_state_json(
        JSON.stringify(fixture.baseResources),
        JSON.stringify(fixture.previousResources),
        JSON.stringify(fixture.previousHuppermage),
        JSON.stringify(fixture.castsBySpellId),
      ));
    }

    if (fixture.operation === "feuFolletRecover") {
      const result = JSON.parse(wasm.apply_feu_follet_recover_json(
        JSON.stringify(fixture.huppermageState),
      ));
      return {
        ...result,
        state: result.state,
      };
    }

    return JSON.parse(wasm.evaluate_sustainability_json(
      fixture.required,
      JSON.stringify(fixture.firstSummary),
      JSON.stringify(fixture.replaySummary),
    ));
  }

  if (fixture.kind === "candidateBatch") {
    return fixture.candidates.map((candidate) => evaluateGeneratedCandidateWithRustPrimitives(
      wasm,
      candidate,
      fixture.resources,
      fixture.stats,
      fixture.initialHuppermage,
      fixture.spellBook,
    ));
  }

  return JSON.parse(wasm.apply_initial_passive_effects_json(
    JSON.stringify(fixture.stats),
    JSON.stringify(fixture.resources),
    JSON.stringify(fixture.passives),
  ));
}

function evaluateGeneratedCandidateWithRustPrimitives(
  wasm: RustWasmDifferentialWasmExports,
  candidate: GeneratedCandidate,
  baseResources: ResourcePool,
  stats: Record<string, unknown>,
  initialHuppermage: RustHuppermageStateForBatch,
  spellBook: Record<string, GeneratedSpellProjection>,
): Record<string, unknown> {
  let resources = cloneJson(baseResources);
  let huppermage: RustHuppermageStateForBatch = cloneJson(initialHuppermage);
  let totalDamage = 0;

  for (const [turnIndex, turn] of candidate.plan.turns.entries()) {
    const castsBySpellId: Record<string, number> = {};
    const targetCastsBySpellId: Record<string, number> = {};

    for (const [actionIndex, action] of turn.actions.entries()) {
      const spell = spellBook[action.spellId];
      if (!spell) {
        return createGeneratedRustResult(candidate.id, false, totalDamage, resources, huppermage, {
          turnIndex,
          violationType: "unknownSpell",
          actionIndex,
          spellId: action.spellId,
        });
      }

      const spellViolation = normalizeRustViolation(JSON.parse(wasm.validate_spell_rules_json(
        JSON.stringify(spell.rules),
        actionIndex,
        action.target ? JSON.stringify(action.target.kind) : undefined,
        JSON.stringify(castsBySpellId),
        JSON.stringify(targetCastsBySpellId),
        JSON.stringify(huppermage),
      )));
      if (spellViolation) {
        return createGeneratedRustResult(candidate.id, false, totalDamage, resources, huppermage, {
          turnIndex,
          ...spellViolation,
        });
      }

      const resourceValidation = JSON.parse(wasm.validate_resource_cost_json(
        JSON.stringify(resources),
        JSON.stringify(spell.cost),
        action.spellId,
        actionIndex,
      ));
      const resourceViolation = normalizeRustViolation(resourceValidation.violation);
      if (resourceViolation) {
        return createGeneratedRustResult(candidate.id, false, totalDamage, resources, huppermage, {
          turnIndex,
          ...resourceViolation,
        });
      }
      resources = resourceValidation.resourcesAfterCost;

      for (const effect of spell.damageEffects) {
        const formula = JSON.parse(wasm.compute_raw_damage_json(
          JSON.stringify(stats),
          JSON.stringify(effect),
        ));
        totalDamage = roundDamage(totalDamage + formula.result);
      }

      castsBySpellId[action.spellId] = (castsBySpellId[action.spellId] ?? 0) + 1;
      if (action.target?.kind !== "emptyCell") {
        targetCastsBySpellId[action.spellId] = (targetCastsBySpellId[action.spellId] ?? 0) + 1;
      }
      if (spell.rules.cooldownTurns !== undefined) {
        huppermage.cooldownsBySpellId[action.spellId] = spell.rules.cooldownTurns;
      }
      if (spell.rules.isDeckTracked && !huppermage.usedSpellIds.includes(action.spellId)) {
        huppermage.usedSpellIds.push(action.spellId);
      }
    }

    const turnEnd = JSON.parse(wasm.apply_turn_end_bq_json(
      JSON.stringify(huppermage),
      JSON.stringify(resources),
    ));
      huppermage = turnEnd.state;
    resources = turnEnd.resources;

    if (turnIndex < candidate.plan.turns.length - 1) {
      const carried = JSON.parse(wasm.create_next_turn_state_json(
        JSON.stringify(baseResources),
        JSON.stringify(resources),
        JSON.stringify(huppermage),
        JSON.stringify(castsBySpellId),
      ));
      huppermage = carried.huppermage;
      resources = carried.resources;
    }
  }

  return createGeneratedRustResult(candidate.id, true, totalDamage, resources, huppermage);
}

function createGeneratedRustResult(
  candidateId: string,
  valid: boolean,
  totalDamage: number,
  finalResources: ResourcePool,
  finalHuppermage: RustHuppermageStateForBatch,
  firstViolation?: Record<string, unknown>,
): Record<string, unknown> {
  return pruneUndefinedRecord({
    candidateId,
    valid,
    totalDamage,
    finalResources,
    finalHuppermage,
    firstViolation: firstViolation
      ? normalizeGeneratedRustViolation(firstViolation)
      : undefined,
  });
}

function normalizeGeneratedRustViolation(violation: Record<string, unknown>): Record<string, unknown> | null {
  const normalized = normalizeRustViolation({
    violationType: violation.violationType,
    actionIndex: violation.actionIndex,
    spellId: violation.spellId,
    resource: violation.resource,
    required: violation.required,
    available: violation.available,
    scope: violation.scope,
  });
  return normalized ? { turnIndex: violation.turnIndex, ...normalized } : null;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type RustHuppermageStateForBatch = Record<string, unknown> & {
  cooldownsBySpellId: Record<string, number>;
  usedSpellIds: string[];
};

function pruneUndefinedRecord<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)) as T;
}

function normalizeRustViolation(violation: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!violation) {
    return null;
  }

  return normalizeViolation({
    type: violation.violationType as never,
    actionIndex: violation.actionIndex as number,
    spellId: nullToUndefined(violation.spellId) as string | undefined,
    resource: nullToUndefined(violation.resource) as never,
    required: nullToUndefined(violation.required) as number | undefined,
    available: nullToUndefined(violation.available) as number | undefined,
    scope: nullToUndefined(violation.scope) as never,
    message: "",
  });
}

function nullToUndefined(value: unknown): unknown {
  return value === null ? undefined : value;
}

function findFirstMismatch(
  typeScriptValue: unknown,
  rustWasmValue: unknown,
  fieldPath: string,
): { fieldPath: string; typeScriptValue: unknown; rustWasmValue: unknown } | undefined {
  if (typeof typeScriptValue === "number" && typeof rustWasmValue === "number") {
    const tolerance = numericToleranceByFieldPath[fieldPath] ?? defaultNumericTolerance;
    return Math.abs(typeScriptValue - rustWasmValue) <= tolerance
      ? undefined
      : { fieldPath, typeScriptValue, rustWasmValue };
  }

  if (Object.is(typeScriptValue, rustWasmValue)) {
    return undefined;
  }

  if (Array.isArray(typeScriptValue) || Array.isArray(rustWasmValue)) {
    if (!Array.isArray(typeScriptValue) || !Array.isArray(rustWasmValue)) {
      return { fieldPath, typeScriptValue, rustWasmValue };
    }

    if (typeScriptValue.length !== rustWasmValue.length) {
      return { fieldPath: `${fieldPath}.length`, typeScriptValue: typeScriptValue.length, rustWasmValue: rustWasmValue.length };
    }

    for (let index = 0; index < typeScriptValue.length; index += 1) {
      const mismatch = findFirstMismatch(typeScriptValue[index], rustWasmValue[index], `${fieldPath}[${index}]`);
      if (mismatch) {
        return mismatch;
      }
    }

    return undefined;
  }

  if (isRecord(typeScriptValue) || isRecord(rustWasmValue)) {
    if (!isRecord(typeScriptValue) || !isRecord(rustWasmValue)) {
      return { fieldPath, typeScriptValue, rustWasmValue };
    }

    const keys = [...new Set([...Object.keys(typeScriptValue), ...Object.keys(rustWasmValue)])].sort();
    for (const key of keys) {
      const mismatch = findFirstMismatch(typeScriptValue[key], rustWasmValue[key], `${fieldPath}.${key}`);
      if (mismatch) {
        return mismatch;
      }
    }

    return undefined;
  }

  return { fieldPath, typeScriptValue, rustWasmValue };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
