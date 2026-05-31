import {
  createRustWasmDifferentialFixtures,
  normalizeViolation,
  type RustWasmDifferentialFixture,
} from "./rustWasmDifferentialFixtures.ts";

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
  mismatchCount: number;
  firstMismatch?: RustWasmDifferentialMismatch;
  elapsedMs: number;
};

const numericToleranceByFieldPath: Record<string, number> = {
  "$": 0,
};

const defaultNumericTolerance = 1e-9;

export function runRustWasmDifferentialSuite(wasm: RustWasmDifferentialWasmExports): RustWasmDifferentialResult {
  const startedAt = performance.now();
  const fixtures = createRustWasmDifferentialFixtures();
  let firstMismatch: RustWasmDifferentialMismatch | undefined;
  let mismatchCount = 0;

  for (const fixture of fixtures) {
    const rustValue = runRustFixture(wasm, fixture);
    const mismatch = findFirstMismatch(fixture.expected, rustValue, "$");

    if (mismatch) {
      mismatchCount += 1;
      firstMismatch ??= {
        fixture: fixture.name,
        category: fixture.kind,
        actionIndex: "actionIndex" in fixture ? fixture.actionIndex : undefined,
        spellId: "spellId" in fixture ? fixture.spellId : undefined,
        fieldPath: mismatch.fieldPath,
        typeScriptValue: mismatch.typeScriptValue,
        rustWasmValue: mismatch.rustWasmValue,
      };
    }
  }

  return {
    passed: mismatchCount === 0,
    fixtureCount: fixtures.length,
    mismatchCount,
    firstMismatch,
    elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
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

  return JSON.parse(wasm.apply_initial_passive_effects_json(
    JSON.stringify(fixture.stats),
    JSON.stringify(fixture.resources),
    JSON.stringify(fixture.passives),
  ));
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
