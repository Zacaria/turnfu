import {
  createRustWasmDifferentialFixtures,
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

  return JSON.parse(wasm.apply_initial_passive_effects_json(
    JSON.stringify(fixture.stats),
    JSON.stringify(fixture.resources),
    JSON.stringify(fixture.passives),
  ));
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
