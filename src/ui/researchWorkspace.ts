import type { CatalogEntry, Element } from "../core/catalog/types.ts";
import { createResources } from "../core/simulation/index.ts";
import type {
  ActionContext,
  ActionTarget,
  ClassTurnState,
  ComboPlan,
  SimulatedCharacter,
} from "../core/simulation/types.ts";
import { createDefaultCharacter, defaultActionContext, defaultActionTarget } from "./defaults.ts";

export type WakfuClassId =
  | "huppermage"
  | "iop"
  | "cra"
  | "eniripsa"
  | "sacrieur"
  | "sram"
  | "xelor"
  | "ecaflip"
  | "enutrof"
  | "pandawa"
  | "sadida"
  | "osamodas"
  | "feca"
  | "roublard"
  | "zobal"
  | "steamer"
  | "eliotrope"
  | "ouginak";

export type WakfuClassOption = {
  id: WakfuClassId;
  label: string;
  selectable: boolean;
};

export type ResearchBuild = {
  id: string;
  name: string;
  classId: WakfuClassId;
  gameplayLabel: string;
  notes: string;
  setupSnapshotIds: string[];
  optimizerRunIds: string[];
  savedComboIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SetupSnapshot = {
  id: string;
  buildId: string;
  version: number;
  name: string;
  classId: WakfuClassId;
  character: SimulatedCharacter;
  equipmentNotes: string;
  deckSpellIds: string[];
  passiveIds: string[];
  target: ActionTarget;
  defaultActionContext: ActionContext;
  initialClassState: ClassTurnState;
  createdAt: string;
};

export type OptimizerRunReference = {
  id: string;
  buildId: string;
  setupSnapshotId: string;
  label: string;
  criteriaSummary: string;
  createdAt: string;
};

export type SavedComboReference = {
  id: string;
  buildId: string;
  setupSnapshotId: string;
  name: string;
  plan: ComboPlan;
  totalDamage?: number;
  createdAt: string;
};

export type ResearchWorkspaceData = {
  schemaVersion: 1;
  builds: ResearchBuild[];
  setupSnapshots: SetupSnapshot[];
  optimizerRuns: OptimizerRunReference[];
  savedCombos: SavedComboReference[];
};

export type CreateOptimizerRunReferenceInput = {
  buildId: string;
  setupSnapshotId: string;
  label?: string;
  criteriaSummary: string;
  now?: string;
};

export type SaveOptimizerCandidateComboInput = {
  buildId: string;
  setupSnapshotId: string;
  name?: string;
  plan: ComboPlan;
  totalDamage?: number;
  now?: string;
};

export type WorkspaceStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export const researchWorkspaceStorageKey = "wakfu-turn-optimizer:research-workspace:v1";

export const wakfuClassOptions: WakfuClassOption[] = [
  { id: "huppermage", label: "Huppermage", selectable: true },
  { id: "iop", label: "Iop", selectable: false },
  { id: "cra", label: "Crâ", selectable: false },
  { id: "eniripsa", label: "Eniripsa", selectable: false },
  { id: "sacrieur", label: "Sacrieur", selectable: false },
  { id: "sram", label: "Sram", selectable: false },
  { id: "xelor", label: "Xélor", selectable: false },
  { id: "ecaflip", label: "Ecaflip", selectable: false },
  { id: "enutrof", label: "Enutrof", selectable: false },
  { id: "pandawa", label: "Pandawa", selectable: false },
  { id: "sadida", label: "Sadida", selectable: false },
  { id: "osamodas", label: "Osamodas", selectable: false },
  { id: "feca", label: "Féca", selectable: false },
  { id: "roublard", label: "Roublard", selectable: false },
  { id: "zobal", label: "Zobal", selectable: false },
  { id: "steamer", label: "Steamer", selectable: false },
  { id: "eliotrope", label: "Eliotrope", selectable: false },
  { id: "ouginak", label: "Ouginak", selectable: false },
];

export function isWakfuClassSelectable(classId: WakfuClassId): boolean {
  return wakfuClassOptions.find((option) => option.id === classId)?.selectable ?? false;
}

export function createSeedResearchWorkspace({ now = new Date().toISOString() }: { now?: string } = {}): ResearchWorkspaceData {
  const buildId = "build-hupper-lumiere-distance";
  const setupId = "setup-hupper-lumiere-distance-v1";
  const character = createSeedHuppermageCharacter();
  const passiveIds = character.classState?.huppermage?.activePassives ?? [];
  const setup: SetupSnapshot = {
    id: setupId,
    buildId,
    version: 1,
    name: "Setup distance lumière v1",
    classId: "huppermage",
    character,
    equipmentNotes: "Stats finales saisies manuellement; les items ne sont pas modelises.",
    deckSpellIds: ["lueur-de-laube", "coeur-de-lumiere", "rayon-crepusculaire", "cycle-elementaire"],
    passiveIds,
    target: defaultActionTarget,
    defaultActionContext,
    initialClassState: character.classState ?? {},
    createdAt: now,
  };

  return {
    schemaVersion: 1,
    builds: [
      {
        id: buildId,
        name: "Huppermage lumière distance",
        classId: "huppermage",
        gameplayLabel: "Cycle lumière / BQ",
        notes: "Build de départ pour comparer les cycles lumière soutenables.",
        setupSnapshotIds: [setupId],
        optimizerRunIds: [],
        savedComboIds: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    setupSnapshots: [setup],
    optimizerRuns: [],
    savedCombos: [],
  };
}

export function createBuild(
  workspace: ResearchWorkspaceData,
  input: {
    classId: WakfuClassId;
    gameplayLabel?: string;
    name: string;
    now?: string;
  },
): ResearchWorkspaceData {
  if (!isWakfuClassSelectable(input.classId)) {
    return workspace;
  }

  const now = input.now ?? new Date().toISOString();
  const buildId = createStableId("build", input.name, now);
  const setupId = `${buildId}-setup-v1`;
  const character = createSeedHuppermageCharacter();
  const passiveIds = character.classState?.huppermage?.activePassives ?? [];
  const setup: SetupSnapshot = {
    id: setupId,
    buildId,
    version: 1,
    name: "Setup v1",
    classId: input.classId,
    character,
    equipmentNotes: "Stats finales saisies manuellement; les items ne sont pas modelises.",
    deckSpellIds: ["lueur-de-laube", "coeur-de-lumiere", "rayon-crepusculaire", "cycle-elementaire"],
    passiveIds,
    target: defaultActionTarget,
    defaultActionContext,
    initialClassState: character.classState ?? {},
    createdAt: now,
  };

  return {
    ...workspace,
    builds: [
      ...workspace.builds,
      {
        id: buildId,
        name: input.name.trim() || "Build sans nom",
        classId: input.classId,
        gameplayLabel: input.gameplayLabel?.trim() || "Gameplay à définir",
        notes: "",
        setupSnapshotIds: [setupId],
        optimizerRunIds: [],
        savedComboIds: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    setupSnapshots: [...workspace.setupSnapshots, setup],
  };
}

export function createOptimizerRunReference(
  workspace: ResearchWorkspaceData,
  input: CreateOptimizerRunReferenceInput,
): ResearchWorkspaceData {
  if (!hasBuildSetupPair(workspace, input.buildId, input.setupSnapshotId)) {
    return workspace;
  }

  const now = input.now ?? new Date().toISOString();
  const label = input.label?.trim() || `Run optimizer ${formatTimestampLabel(now)}`;
  const id = createUniqueStableId(
    "run",
    `${label}-${input.setupSnapshotId}`,
    now,
    workspace.optimizerRuns.map((run) => run.id),
  );
  const run: OptimizerRunReference = {
    id,
    buildId: input.buildId,
    setupSnapshotId: input.setupSnapshotId,
    label,
    criteriaSummary: input.criteriaSummary.trim() || "Critères optimizer",
    createdAt: now,
  };

  return {
    ...workspace,
    builds: appendBuildReference(workspace.builds, input.buildId, "optimizerRunIds", id, now),
    optimizerRuns: [...workspace.optimizerRuns, run],
  };
}

export function saveOptimizerCandidateCombo(
  workspace: ResearchWorkspaceData,
  input: SaveOptimizerCandidateComboInput,
): ResearchWorkspaceData {
  if (!hasBuildSetupPair(workspace, input.buildId, input.setupSnapshotId)) {
    return workspace;
  }

  const now = input.now ?? new Date().toISOString();
  const name = input.name?.trim() || `Combo ${formatTimestampLabel(now)}`;
  const id = createUniqueStableId(
    "combo",
    `${name}-${input.setupSnapshotId}`,
    now,
    workspace.savedCombos.map((combo) => combo.id),
  );
  const combo: SavedComboReference = {
    id,
    buildId: input.buildId,
    setupSnapshotId: input.setupSnapshotId,
    name,
    plan: input.plan,
    totalDamage: input.totalDamage,
    createdAt: now,
  };

  return {
    ...workspace,
    builds: appendBuildReference(workspace.builds, input.buildId, "savedComboIds", id, now),
    savedCombos: [...workspace.savedCombos, combo],
  };
}

export function filterBuildsByClass(builds: ResearchBuild[], classId: WakfuClassId | "all"): ResearchBuild[] {
  if (classId === "all") {
    return builds;
  }

  return builds.filter((build) => build.classId === classId);
}

export function getBuildSetups(workspace: ResearchWorkspaceData, buildId: string): SetupSnapshot[] {
  return workspace.setupSnapshots.filter((setup) => setup.buildId === buildId);
}

export function getBuildRuns(workspace: ResearchWorkspaceData, buildId: string): OptimizerRunReference[] {
  return workspace.optimizerRuns.filter((run) => run.buildId === buildId);
}

export function getBuildSavedCombos(workspace: ResearchWorkspaceData, buildId: string): SavedComboReference[] {
  return workspace.savedCombos.filter((combo) => combo.buildId === buildId);
}

export function getSetupSupportedSpellIds(setup: SetupSnapshot, catalog: CatalogEntry[]): string[] {
  const catalogIds = new Set(catalog.map((entry) => entry.id));
  return setup.deckSpellIds.filter((spellId) => catalogIds.has(spellId));
}

export function saveResearchWorkspace(storage: WorkspaceStorage, workspace: ResearchWorkspaceData): void {
  storage.setItem(researchWorkspaceStorageKey, JSON.stringify(workspace));
}

export function restoreResearchWorkspace(storage: WorkspaceStorage): ResearchWorkspaceData {
  const serialized = storage.getItem(researchWorkspaceStorageKey);
  if (!serialized) {
    return createSeedResearchWorkspace();
  }

  try {
    const parsed = JSON.parse(serialized) as ResearchWorkspaceData;
    if (parsed.schemaVersion === 1 && Array.isArray(parsed.builds) && Array.isArray(parsed.setupSnapshots)) {
      return parsed;
    }
  } catch {
    storage.removeItem(researchWorkspaceStorageKey);
  }

  return createSeedResearchWorkspace();
}

export function createMemoryWorkspaceStorage(): WorkspaceStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

export function formatWakfuClassLabel(classId: WakfuClassId): string {
  return wakfuClassOptions.find((option) => option.id === classId)?.label ?? classId;
}

export function formatElements(elements: Partial<Record<Element, number>>): string {
  return Object.entries(elements)
    .filter(([, value]) => value && value > 0)
    .map(([element, value]) => `${element}:${value}`)
    .join(", ");
}

function createSeedHuppermageCharacter(): SimulatedCharacter {
  const character = createDefaultCharacter();
  return {
    ...character,
    resources: createResources({ ap: 12, mp: 6, wp: 6, bq: 500 }),
    stats: {
      ...character.stats,
      generalMastery: 1200,
      elementalMastery: {
        fire: 400,
        water: 700,
        earth: 450,
        air: 300,
        light: 0,
        neutral: 0,
      },
      distanceMastery: 250,
      criticalMastery: 150,
      damageInflictedPercent: 20,
    },
  };
}

function createStableId(prefix: string, label: string, now: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "item";
  const suffix = now.replace(/[^0-9]/g, "").slice(0, 17);
  return `${prefix}-${slug}-${suffix}`;
}

function createUniqueStableId(prefix: string, label: string, now: string, existingIds: string[]): string {
  const existingIdSet = new Set(existingIds);
  const baseId = createStableId(prefix, label, now);
  if (!existingIdSet.has(baseId)) {
    return baseId;
  }

  let index = 2;
  while (existingIdSet.has(`${baseId}-${index}`)) {
    index += 1;
  }
  return `${baseId}-${index}`;
}

function hasBuildSetupPair(workspace: ResearchWorkspaceData, buildId: string, setupSnapshotId: string): boolean {
  return workspace.builds.some((build) => build.id === buildId)
    && workspace.setupSnapshots.some((setup) => setup.id === setupSnapshotId && setup.buildId === buildId);
}

function appendBuildReference(
  builds: ResearchBuild[],
  buildId: string,
  key: "optimizerRunIds" | "savedComboIds",
  id: string,
  now: string,
): ResearchBuild[] {
  return builds.map((build) => (
    build.id === buildId
      ? {
        ...build,
        [key]: [...build[key], id],
        updatedAt: now,
      }
      : build
  ));
}

function formatTimestampLabel(now: string): string {
  return now.slice(0, 16).replace("T", " ");
}
