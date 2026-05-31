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
import { syncHuppermageBqFromWp } from "./statControls.ts";

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
  passiveIds?: string[];
  totalDamage?: number;
  criteriaSummary?: string;
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

export type CreateBalancedElementSetInput = {
  buildId: string;
  sourceSetupSnapshotId: string;
  name?: string;
  now?: string;
};

export type SaveOptimizerCandidateComboInput = {
  buildId: string;
  setupSnapshotId: string;
  name?: string;
  plan: ComboPlan;
  passiveIds?: string[];
  totalDamage?: number;
  criteriaSummary?: string;
  now?: string;
};

export type RenameBuildInput = {
  buildId: string;
  name: string;
  now?: string;
};

export type RenameSetupSnapshotInput = {
  buildId: string;
  name: string;
  now?: string;
  setupSnapshotId: string;
};

export type DeleteSavedCombosInput = {
  comboIds: string[];
  now?: string;
};

export type DeleteSetupSnapshotInput = {
  buildId: string;
  now?: string;
  setupSnapshotId: string;
};

export type SaveSetupVersionInput = {
  buildId: string;
  character: SimulatedCharacter;
  now?: string;
  sourceSetupSnapshotId: string;
};

export type SaveSetupVersionResult = {
  created: boolean;
  setupSnapshotId: string;
  workspace: ResearchWorkspaceData;
};

export type WorkspaceStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export const researchWorkspaceStorageKey = "turnfu:research-workspace:v1";

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
    name: "Set 1200 maîtrise 4 éléments",
    classId: "huppermage",
    character,
    equipmentNotes: "Set de référence avec 1200 maîtrise générale et 1200 maîtrise sur Feu/Eau/Terre/Air; les items ne sont pas modelises.",
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
        name: "Huppermage 1200 maîtrise 4 éléments",
        classId: "huppermage",
        gameplayLabel: "Cycle lumière / BQ",
        notes: "Build de départ pour explorer les meilleurs combos T2 avec une base 1200 équilibrée.",
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
    name: "Set 1200 maîtrise 4 éléments",
    classId: input.classId,
    character,
    equipmentNotes: "Set de référence avec 1200 maîtrise générale et 1200 maîtrise sur Feu/Eau/Terre/Air; les items ne sont pas modelises.",
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

export function createBalancedElementSet(
  workspace: ResearchWorkspaceData,
  input: CreateBalancedElementSetInput,
): ResearchWorkspaceData {
  const sourceSetup = workspace.setupSnapshots.find((setup) => (
    setup.id === input.sourceSetupSnapshotId && setup.buildId === input.buildId
  ));
  if (!sourceSetup) {
    return workspace;
  }

  const now = input.now ?? new Date().toISOString();
  const name = input.name?.trim() || "Set éléments équilibrés";
  const mastery = sourceSetup.character.stats.elementalMastery;
  const balancedMastery = Math.round((mastery.fire + mastery.water + mastery.earth + mastery.air) / 4);
  const setupId = createUniqueStableId(
    "setup",
    `${name}-${sourceSetup.id}`,
    now,
    workspace.setupSnapshots.map((setup) => setup.id),
  );
  const setup: SetupSnapshot = {
    ...sourceSetup,
    id: setupId,
    version: sourceSetup.version + 1,
    name,
    character: {
      ...sourceSetup.character,
      stats: {
        ...sourceSetup.character.stats,
        elementalMastery: {
          ...sourceSetup.character.stats.elementalMastery,
          fire: balancedMastery,
          water: balancedMastery,
          earth: balancedMastery,
          air: balancedMastery,
        },
      },
    },
    equipmentNotes: `${sourceSetup.equipmentNotes} Set dérivé de ${sourceSetup.name}; maîtrises Feu/Eau/Terre/Air équilibrées à ${balancedMastery}.`,
    createdAt: now,
  };

  return {
    ...workspace,
    builds: appendBuildReference(workspace.builds, input.buildId, "setupSnapshotIds", setupId, now),
    setupSnapshots: [...workspace.setupSnapshots, setup],
  };
}

export function saveSetupVersion(
  workspace: ResearchWorkspaceData,
  input: SaveSetupVersionInput,
): SaveSetupVersionResult {
  const sourceSetup = workspace.setupSnapshots.find((setup) => (
    setup.id === input.sourceSetupSnapshotId && setup.buildId === input.buildId
  ));
  if (!sourceSetup) {
    return { created: false, setupSnapshotId: input.sourceSetupSnapshotId, workspace };
  }

  const character = cloneCharacter(input.character);
  const passiveIds = character.classState?.huppermage?.activePassives ?? sourceSetup.passiveIds;
  const candidateSetup: SetupSnapshot = {
    ...sourceSetup,
    character,
    initialClassState: character.classState ?? {},
    passiveIds: [...passiveIds],
  };
  const candidateKey = createSetupAssumptionsKey(candidateSetup);
  const sourceKey = createSetupAssumptionsKey(sourceSetup);
  if (candidateKey === sourceKey) {
    return { created: false, setupSnapshotId: sourceSetup.id, workspace };
  }

  const equivalentSetup = workspace.setupSnapshots.find((setup) => (
    setup.buildId === input.buildId && createSetupAssumptionsKey(setup) === candidateKey
  ));
  if (equivalentSetup) {
    return { created: false, setupSnapshotId: equivalentSetup.id, workspace };
  }

  const now = input.now ?? new Date().toISOString();
  const nextVersion = Math.max(
    sourceSetup.version,
    ...workspace.setupSnapshots
      .filter((setup) => setup.buildId === sourceSetup.buildId && setup.name === sourceSetup.name)
      .map((setup) => setup.version),
  ) + 1;
  const setupId = createUniqueStableId(
    "setup",
    `${sourceSetup.name}-v${nextVersion}-${sourceSetup.id}`,
    now,
    workspace.setupSnapshots.map((setup) => setup.id),
  );
  const setup: SetupSnapshot = {
    ...candidateSetup,
    id: setupId,
    version: nextVersion,
    createdAt: now,
  };

  return {
    created: true,
    setupSnapshotId: setup.id,
    workspace: {
      ...workspace,
      builds: appendBuildReference(workspace.builds, input.buildId, "setupSnapshotIds", setup.id, now),
      setupSnapshots: [...workspace.setupSnapshots, setup],
    },
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
    passiveIds: input.passiveIds?.length ? [...input.passiveIds].sort() : undefined,
    totalDamage: input.totalDamage,
    criteriaSummary: input.criteriaSummary?.trim() || undefined,
    createdAt: now,
  };

  return {
    ...workspace,
    builds: appendBuildReference(workspace.builds, input.buildId, "savedComboIds", id, now),
    savedCombos: [...workspace.savedCombos, combo],
  };
}

export function renameBuild(workspace: ResearchWorkspaceData, input: RenameBuildInput): ResearchWorkspaceData {
  const nextName = input.name.trim();
  if (!nextName) {
    return workspace;
  }

  let changed = false;
  const now = input.now ?? new Date().toISOString();
  const builds = workspace.builds.map((build) => {
    if (build.id !== input.buildId || build.name === nextName) {
      return build;
    }

    changed = true;
    return {
      ...build,
      name: nextName,
      updatedAt: now,
    };
  });

  return changed ? { ...workspace, builds } : workspace;
}

export function renameSetupSnapshot(workspace: ResearchWorkspaceData, input: RenameSetupSnapshotInput): ResearchWorkspaceData {
  const nextName = input.name.trim();
  if (!nextName) {
    return workspace;
  }

  let changed = false;
  const now = input.now ?? new Date().toISOString();
  const setupSnapshots = workspace.setupSnapshots.map((setup) => {
    if (setup.id !== input.setupSnapshotId || setup.buildId !== input.buildId || setup.name === nextName) {
      return setup;
    }

    changed = true;
    return {
      ...setup,
      name: nextName,
    };
  });

  if (!changed) {
    return workspace;
  }

  return {
    ...workspace,
    builds: workspace.builds.map((build) => (
      build.id === input.buildId
        ? { ...build, updatedAt: now }
        : build
    )),
    setupSnapshots,
  };
}

export function deleteSavedCombo(
  workspace: ResearchWorkspaceData,
  comboId: string,
  now?: string,
): ResearchWorkspaceData {
  return deleteSavedCombos(workspace, { comboIds: [comboId], now });
}

export function deleteSavedCombos(
  workspace: ResearchWorkspaceData,
  input: DeleteSavedCombosInput,
): ResearchWorkspaceData {
  const comboIds = new Set(input.comboIds);
  if (comboIds.size === 0) {
    return workspace;
  }

  const now = input.now ?? new Date().toISOString();
  const affectedBuildIds = new Set(
    workspace.savedCombos
      .filter((combo) => comboIds.has(combo.id))
      .map((combo) => combo.buildId),
  );
  for (const build of workspace.builds) {
    if (build.savedComboIds.some((comboId) => comboIds.has(comboId))) {
      affectedBuildIds.add(build.id);
    }
  }

  if (affectedBuildIds.size === 0) {
    return workspace;
  }

  return {
    ...workspace,
    builds: workspace.builds.map((build) => (
      affectedBuildIds.has(build.id)
        ? {
          ...build,
          savedComboIds: build.savedComboIds.filter((comboId) => !comboIds.has(comboId)),
          updatedAt: now,
        }
        : build
    )),
    savedCombos: workspace.savedCombos.filter((combo) => !comboIds.has(combo.id)),
  };
}

export function deleteSetupSnapshot(
  workspace: ResearchWorkspaceData,
  input: DeleteSetupSnapshotInput,
): ResearchWorkspaceData {
  const build = workspace.builds.find((candidate) => candidate.id === input.buildId);
  if (!build || !build.setupSnapshotIds.includes(input.setupSnapshotId) || build.setupSnapshotIds.length <= 1) {
    return workspace;
  }

  const setup = workspace.setupSnapshots.find((candidate) => (
    candidate.id === input.setupSnapshotId && candidate.buildId === input.buildId
  ));
  if (!setup) {
    return workspace;
  }

  const now = input.now ?? new Date().toISOString();
  const deletedRunIds = new Set(
    workspace.optimizerRuns
      .filter((run) => run.setupSnapshotId === input.setupSnapshotId)
      .map((run) => run.id),
  );
  const deletedComboIds = new Set(
    workspace.savedCombos
      .filter((combo) => combo.setupSnapshotId === input.setupSnapshotId)
      .map((combo) => combo.id),
  );

  return {
    ...workspace,
    builds: workspace.builds.map((candidate) => (
      candidate.id === input.buildId
        ? {
          ...candidate,
          setupSnapshotIds: candidate.setupSnapshotIds.filter((setupId) => setupId !== input.setupSnapshotId),
          optimizerRunIds: candidate.optimizerRunIds.filter((runId) => !deletedRunIds.has(runId)),
          savedComboIds: candidate.savedComboIds.filter((comboId) => !deletedComboIds.has(comboId)),
          updatedAt: now,
        }
        : candidate
    )),
    optimizerRuns: workspace.optimizerRuns.filter((run) => run.setupSnapshotId !== input.setupSnapshotId),
    savedCombos: workspace.savedCombos.filter((combo) => combo.setupSnapshotId !== input.setupSnapshotId),
    setupSnapshots: workspace.setupSnapshots.filter((candidate) => candidate.id !== input.setupSnapshotId),
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

export function createSetupAssumptionsKey(setup: SetupSnapshot): string {
  return JSON.stringify({
    character: setup.character,
    defaultActionContext: setup.defaultActionContext,
    equipmentNotes: setup.equipmentNotes,
    initialClassState: setup.initialClassState,
    passiveIds: setup.character.classState?.huppermage?.activePassives ?? setup.passiveIds,
    target: setup.target,
  });
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
  return syncHuppermageBqFromWp({
    ...character,
    resources: createResources({ ap: 12, mp: 6, wp: 6, bq: 0 }),
    stats: {
      ...character.stats,
      generalMastery: 1200,
      elementalMastery: {
        fire: 1200,
        water: 1200,
        earth: 1200,
        air: 1200,
        light: 0,
        neutral: 0,
      },
      distanceMastery: 250,
      criticalMastery: 150,
      damageInflictedPercent: 20,
    },
  });
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

function cloneCharacter(character: SimulatedCharacter): SimulatedCharacter {
  return {
    ...character,
    classState: character.classState ? JSON.parse(JSON.stringify(character.classState)) as SimulatedCharacter["classState"] : undefined,
    resources: createResources({ ...character.resources }),
    stats: {
      ...character.stats,
      elementalMastery: { ...character.stats.elementalMastery },
    },
  };
}

function hasBuildSetupPair(workspace: ResearchWorkspaceData, buildId: string, setupSnapshotId: string): boolean {
  return workspace.builds.some((build) => build.id === buildId)
    && workspace.setupSnapshots.some((setup) => setup.id === setupSnapshotId && setup.buildId === buildId);
}

function appendBuildReference(
  builds: ResearchBuild[],
  buildId: string,
  key: "setupSnapshotIds" | "optimizerRunIds" | "savedComboIds",
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
