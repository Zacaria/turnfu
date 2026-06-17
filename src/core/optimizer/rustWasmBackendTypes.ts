import type { CatalogEntry } from "../catalog/types.ts";
import type { ComboPlan, ComboSimulationOptions, SimulatedCharacter } from "../simulation/types.ts";
import type { ComboOptimizationCriterion, ComboScoreBreakdown, ComboSustainability } from "./comboOptimizer.ts";
import type { OptimizerExperimentBackendKind, OptimizerExperimentEngineKind, OptimizerExperimentOptions } from "./optimizerExperiment.ts";

export const RUST_WASM_OPTIMIZER_SCHEMA_VERSION = 1;

export type RustWasmOptimizerRequest = {
  schemaVersion: typeof RUST_WASM_OPTIMIZER_SCHEMA_VERSION;
  engine: OptimizerExperimentEngineKind;
  seed: string;
  duration: number;
  iterations: number;
  maxActionsPerTurn: number;
  maxPassiveCount: number;
  maxSublimationCount: number;
  availableSpellIds: string[];
  availablePassiveIds: string[];
  availableSublimationIds: string[];
  catalog: CatalogEntry[];
  character: SimulatedCharacter;
  criterion?: ComboOptimizationCriterion;
  requireSustainableCycle: boolean;
  defaultActionContext?: ComboSimulationOptions["defaultActionContext"];
  maxCandidates?: number;
  seedCandidates?: RustWasmOptimizerCandidateInput[];
  resumeState?: RustWasmHybridSearchResumeState;
};

export type RustWasmOptimizerCandidateInput = {
  passiveIds?: string[];
  sublimationIds?: string[];
  plan: ComboPlan;
};

export type RustWasmOptimizerResponse = {
  schemaVersion: typeof RUST_WASM_OPTIMIZER_SCHEMA_VERSION;
  backend: OptimizerExperimentBackendKind;
  supported: boolean;
  engine: OptimizerExperimentEngineKind;
  seed: string;
  attempts: number;
  validCandidates: number;
  invalidCandidates: number;
  metrics: Record<string, number>;
};

export type RustWasmOptimizerCandidateBatchResponse = {
  schemaVersion: typeof RUST_WASM_OPTIMIZER_SCHEMA_VERSION;
  backend: OptimizerExperimentBackendKind;
  supported: boolean;
  engine: OptimizerExperimentEngineKind;
  seed: string;
  attempts: number;
  candidates: Array<{
    passiveIds?: string[];
    sublimationIds?: string[];
    plan: ComboPlan;
  }>;
  metrics: Record<string, number>;
};

export type RustWasmOptimizerScoredCandidate = {
  id: string;
  passiveIds: string[];
  sublimationIds: string[];
  plan: ComboPlan;
  score: ComboScoreBreakdown;
};

export type RustWasmOptimizerSearchResponse = {
  schemaVersion: typeof RUST_WASM_OPTIMIZER_SCHEMA_VERSION;
  backend: OptimizerExperimentBackendKind;
  supported: boolean;
  engine: OptimizerExperimentEngineKind;
  seed: string;
  attempts: number;
  validCandidates: number;
  invalidCandidates: number;
  topCandidates: RustWasmOptimizerScoredCandidate[];
  metrics: Record<string, number>;
  resumeState?: RustWasmHybridSearchResumeState;
};

export type RustWasmHybridSearchResumeState = {
  schemaVersion: typeof RUST_WASM_OPTIMIZER_SCHEMA_VERSION;
  totalAttempts: number;
  islands: RustWasmHybridIslandResumeState[];
};

export type RustWasmHybridIslandResumeState = {
  islandIndex: number;
  seed: string;
  rngState: number;
  warmupIndex: number;
  restartIndex: number;
  attemptsSinceImprovement: number;
  consecutiveRepairAttempts: number;
  consecutiveEliteNeighborAttempts: number;
  population: Array<{
    id: string;
    candidate: RustWasmOptimizerCandidateInput;
    score: number;
    valid?: boolean;
  }>;
  repairQueue: RustWasmOptimizerCandidateInput[];
  eliteNeighborQueue: RustWasmOptimizerCandidateInput[];
};

export type RustWasmCandidateEvaluationInput = {
  id: string;
  passiveIds?: string[];
  sublimationIds?: string[];
  plan: ComboPlan;
};

export type RustWasmCandidateEvaluationResult = {
  candidateId: string;
  valid: boolean;
  totalDamage: number;
  score?: ComboScoreBreakdown;
};

export type RustWasmOptimizerWasmExports = {
  generate_hybrid_candidates_json: (requestJson: string) => string;
  run_hybrid_search_json?: (requestJson: string) => string;
  evaluate_candidate_batch_json: (requestJson: string, candidatesJson: string) => string;
};

export function createRustWasmOptimizerRequest(options: OptimizerExperimentOptions): RustWasmOptimizerRequest {
  const engine = options.engines.length === 1 ? options.engines[0] : undefined;
  if (!engine) {
    throw new Error("Rust/WASM optimizer requests require exactly one engine.");
  }

  return {
    schemaVersion: RUST_WASM_OPTIMIZER_SCHEMA_VERSION,
    engine,
    seed: options.seed ?? "optimizer-experiment",
    duration: clampInteger(options.duration, 1, 3),
    iterations: clampInteger(options.budget.iterations, 1, 1_000_000_000),
    maxActionsPerTurn: clampInteger(options.maxActionsPerTurn ?? 3, 1, 12),
    maxPassiveCount: clampInteger(options.maxPassiveCount ?? 0, 0, 6),
    maxSublimationCount: clampInteger(options.maxSublimationCount ?? 0, 0, 12),
    availableSpellIds: [...(options.availableSpellIds ?? getDefaultAvailableSpellIds(options.catalog))].sort(),
    availablePassiveIds: [...(options.availablePassiveIds ?? [])].sort(),
    availableSublimationIds: [...(options.availableSublimationIds ?? getDefaultAvailableSublimationIds(options.character))].sort(),
    catalog: normalizeCatalogForRustWasm(options.catalog),
    character: cloneJson(options.character),
    criterion: options.criterion ? cloneJson(options.criterion) : undefined,
    requireSustainableCycle: options.requireSustainableCycle ?? false,
    defaultActionContext: options.defaultActionContext ? cloneJson(options.defaultActionContext) : undefined,
    maxCandidates: options.maxCandidates,
  };
}

export function serializeRustWasmOptimizerRequest(options: OptimizerExperimentOptions): string {
  return JSON.stringify(createRustWasmOptimizerRequest(options));
}

function normalizeCatalogForRustWasm(catalog: CatalogEntry[]): CatalogEntry[] {
  return [...catalog]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((entry) => cloneJson(entry));
}

function getDefaultAvailableSpellIds(catalog: CatalogEntry[]): string[] {
  return catalog.filter((entry) => entry.kind === "spell").map((entry) => entry.id);
}

function getDefaultAvailableSublimationIds(character: SimulatedCharacter): string[] {
  return character.sublimations?.selections.map((selection) => selection.sublimationId) ?? [];
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.floor(value)));
}
