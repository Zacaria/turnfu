import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ClipboardPaste,
  Copy,
  Eye,
  EyeOff,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  getHuppermagePassives,
  getHuppermageSpells,
} from "../core/catalog/index.ts";
import { findSublimation, sublimationCatalog, validateSublimationBuild } from "../core/sublimations/index.ts";
import type { CatalogEntry, Effect, Element, Resource, Rune } from "../core/catalog/types.ts";
import {
  createResources,
  simulateCombo,
} from "../core/simulation/index.ts";
import {
  countHiddenCatalogEntries,
  createHiddenCatalogEntryState,
  getVisibleCatalogEntries,
  isCatalogEntryHidden,
  toggleHiddenCatalogEntry,
  type HiddenCatalogEntryState,
} from "./catalogVisibility.ts";
import {
  type CatalogInfoIcon,
  describeCatalogConstraint,
  describeCatalogEffectLine,
  getCatalogCostTokens,
  getCatalogRangeTokens,
} from "./catalogEntryInfo.ts";
import type {
  Action,
  ActionContext,
  ActionResult,
  ActionTarget,
  AttackPosition,
  BaseStats,
  ComboPlan,
  RangeMode,
  SimulatedCharacter,
} from "../core/simulation/types.ts";
import {
  aptitudeDefinitions,
  aptitudeFamilies,
  aptitudeFamilyOrder,
  computeAptitudeStats,
  createDefaultAptitudeDistribution,
  getAvailableAptitudePoints,
  getSpentAptitudePoints,
  parseAptitudeDistributionCode,
  serializeAptitudeDistribution,
  setAptitudeLevel,
  setAptitudeRank,
  type AppliedAptitudeStats,
  type AptitudeDistribution,
  type AptitudeFamilyId,
} from "./aptitudes.ts";
import { createDefaultCharacter, defaultActionContext, defaultActionTarget } from "./defaults.ts";
import { resolveDetailTarget } from "./detailSelection.ts";
import { describeEffect, describeViolation, formatHeart, formatNumber, summarizeStats } from "./format.ts";
import { HuppermageRuneAura } from "./HuppermageRuneAura.tsx";
import { getHuppermageIconSrc } from "./icons.ts";
import {
  createOptimizerCandidateId,
  createSavedComboName,
  openCandidateInBuilder,
  summarizeOptimizerControls,
  type OptimizerCandidateViewModel,
  type OptimizerWorkspaceControls,
} from "./optimizerWorkspace.ts";
import {
  BuildPage,
  OptimizerWorkspacePage,
  OptimizerRunDetailPage,
  ResearchLibraryPage,
  SavedComboComparisonPage,
  SetupPage,
  type OptimizerWorkspaceSession,
} from "./ResearchWorkspacePages.tsx?v=sublimations-rebase-v1";
import {
  createBalancedElementSet,
  createBuild,
  createOptimizerRunReference,
  createSetupAssumptionsKey,
  deleteSavedCombo,
  deleteSavedCombos,
  deleteSetupSnapshot,
  getBuildRuns,
  getBuildSavedCombos,
  getBuildSetups,
  restoreResearchWorkspace,
  saveResearchWorkspace,
  renameBuild,
  renameSetupSnapshot,
  saveOptimizerCandidateCombo,
  saveSetupVersion,
  type ResearchWorkspaceData,
  type SavedComboReference,
  type SetupSnapshot,
  type WakfuClassId,
} from "./researchWorkspace.ts";
import type { SublimationBuild, SublimationCatalogEntry, SublimationCategory } from "../core/sublimations/types.ts";
import {
  createResearchRoute,
  openBuilderFromSetup,
  openBuild,
  openOptimizerFromSetup,
  openOptimizerRun,
  openSavedComboComparison,
  openSetup,
  retargetSetupRoute,
  returnToBuild,
  returnToPrevious,
  type ResearchRoute,
} from "./researchNavigation.ts";
import {
  getAptitudeIconSrc,
  getElementMasteryIconSrc,
  getResourceIconSrc,
  getStatIconSrc,
  type StatIconKey,
} from "./statIcons.ts";
import {
  formatElementLabel,
  formatAptitudeFamilyLabel,
  formatAptitudeLabel,
  formatPositionLabel,
  formatRangeModeLabel,
  formatResourceLabel,
  formatRuneLabel,
  formatTargetLabel,
  formatUiMessage,
  setUiLocale,
  supportedLocales,
  t,
  type UiLocale,
} from "./i18n.ts";
import { getRuneIconSrc } from "./spellAttributeIcons.ts";
import {
  createHuppermageBuildResources,
  getBuildResourceOptions,
  getCombatResourceOptions,
  getStatStep,
  syncHuppermageBqFromWp,
} from "./statControls.ts";
import {
  createTimelineDropIntent,
  shouldRemoveTimelineActionOnDragEnd,
  type TimelineDropIntent,
} from "./timelineDnd.ts";
import { createTimelineCursorMarks } from "./timelineCursor.ts";
import { createComboTimelineSnapshots } from "./timelineSnapshots.ts";
import { createTurnRows } from "./turnRows.ts";
import { getWakfuliSublimationIconSrc } from "./sublimationIcons.ts";
import {
  createSublimationPreviewItems,
  createSublimationStateItems,
  getSublimationPreviewTone,
  type SublimationPreviewItem,
} from "./sublimationPreview.ts";

type TimelineAction = Action & {
  uid: string;
};

type TimelineSnapshot = ReturnType<typeof createComboTimelineSnapshots>[number];

type CenterTabId = "combos" | "aptitudes" | "equipment";

type EquipmentExtraStatKey =
  | "barrier"
  | "equipmentKnowledge"
  | "leadership"
  | "lockDodge"
  | "prospection"
  | "wisdom";

type EquipmentExtraStats = Record<EquipmentExtraStatKey, number>;

type DragPayload =
  | { type: "spell"; spellId: string }
  | { type: "timelineAction"; uid: string };

const dragPayloadType = "application/x-wakfu-turn-action";
const runeOptions: Rune[] = ["incandescent", "aquatic", "telluric", "aerial"];
const elementOptions: Element[] = ["fire", "water", "earth", "air", "light", "neutral"];
const targetOptions: ActionTarget["kind"][] = ["enemy", "ally", "fighter", "emptyCell", "feuFollet"];
const positionOptions: AttackPosition[] = ["face", "side", "rear"];
const rangeModeOptions: Array<RangeMode | "none"> = ["none", "melee", "distance"];
const runeToElement: Record<Rune, Element> = {
  incandescent: "fire",
  aquatic: "water",
  telluric: "earth",
  aerial: "air",
};
const nonDeckSpellIds = new Set(["coeur-de-lumiere", "cycle-elementaire", "feu-follet"]);

export function App() {
  const spells = useMemo(() => getHuppermageSpells(), []);
  const passives = useMemo(() => getHuppermagePassives(), []);
  const catalog = useMemo(() => [...spells, ...passives], [passives, spells]);
  const [researchWorkspace, setResearchWorkspace] = useState<ResearchWorkspaceData>(() => (
    typeof window === "undefined"
      ? restoreResearchWorkspace(createMemoryStorageFallback())
      : restoreResearchWorkspace(window.localStorage)
  ));
  const [researchRoute, setResearchRoute] = useState<ResearchRoute>(() => createResearchRoute());
  const optimizerSessionsRef = useRef<Record<string, OptimizerWorkspaceSession>>({});
  const builderBaselineRef = useRef<{ assumptionKey: string; setupSnapshotId: string } | null>(null);
  const optimizerSessionFlushRef = useRef<number | null>(null);
  const [optimizerSessions, setOptimizerSessions] = useState<Record<string, OptimizerWorkspaceSession>>({});
  const [buildClassFilter, setBuildClassFilter] = useState<WakfuClassId | "all">("all");
  const [characterConfig, setCharacterConfig] = useState<SimulatedCharacter>(() => createDefaultCharacter());
  const [equipmentCharacter, setEquipmentCharacter] = useState<SimulatedCharacter>(() => createDefaultEquipmentCharacter());
  const [equipmentExtras, setEquipmentExtras] = useState<EquipmentExtraStats>(() => createDefaultEquipmentExtraStats());
  const [locale, setLocale] = useState<UiLocale>("fr");
  const [centerTab, setCenterTab] = useState<CenterTabId>("combos");
  const [aptitudeDistribution, setAptitudeDistribution] = useState<AptitudeDistribution>(() => createDefaultAptitudeDistribution());
  const [turns, setTurns] = useState<TimelineAction[][]>(() => [createDefaultTimeline()]);
  const [selectedTurnIndex, setSelectedTurnIndex] = useState(0);
  const [selectedStep, setSelectedStep] = useState(0);
  const [selectedTimelineUid, setSelectedTimelineUid] = useState<string | null>(() => turns[0]?.[0]?.uid ?? null);
  const [selectedCatalogEntryId, setSelectedCatalogEntryId] = useState<string | null>(null);
  const [hoveredCatalogEntryId, setHoveredCatalogEntryId] = useState<string | null>(null);
  const [hiddenCatalogEntries, setHiddenCatalogEntries] = useState<HiddenCatalogEntryState>(() => createHiddenCatalogEntryState());
  const [showHiddenCatalogEntries, setShowHiddenCatalogEntries] = useState(false);
  const [timelineDropIntent, setTimelineDropIntent] = useState<TimelineDropIntent | null>(null);
  const [timelineDropTurnIndex, setTimelineDropTurnIndex] = useState<number | null>(null);
  const activeDragPayloadRef = useRef<DragPayload | null>(null);
  const completedTimelineDropRef = useRef(false);
  const turnStackRef = useRef<HTMLDivElement | null>(null);
  const character = useMemo(
    () => createCharacterFromBuild(characterConfig, aptitudeDistribution, equipmentCharacter),
    [aptitudeDistribution, characterConfig, equipmentCharacter],
  );
  const activeBuild = researchRoute.buildId
    ? researchWorkspace.builds.find((build) => build.id === researchRoute.buildId)
    : undefined;
  const activeOptimizerRun = researchRoute.page === "optimizerRun"
    ? researchWorkspace.optimizerRuns.find((run) => run.id === researchRoute.optimizerRunId)
    : undefined;
  const activeSetup = researchRoute.setupSnapshotId
    ? researchWorkspace.setupSnapshots.find((setup) => setup.id === researchRoute.setupSnapshotId)
    : activeBuild
      ? getBuildSetups(researchWorkspace, activeBuild.id)[0]
      : undefined;

  const timeline = turns[selectedTurnIndex] ?? [];
  const combo = useMemo(
    () => ({
      turns: turns.map((turn) => ({
        actions: turn.map(({ uid: _uid, ...action }) => action),
      })),
    }),
    [turns],
  );
  const simulation = useMemo(
    () => simulateCombo({ catalog, character, combo }),
    [catalog, character, combo],
  );
  const turnRows = useMemo(() => createTurnRows({ turns, turnResults: simulation.turns }), [simulation.turns, turns]);
  const cursorMarks = useMemo(() => createTimelineCursorMarks(turns.map((turn) => turn.length)), [turns]);
  const snapshots = useMemo(() => createComboTimelineSnapshots(simulation, character), [character, simulation]);
  const currentSnapshot = snapshots[Math.min(selectedStep, snapshots.length - 1)] ?? snapshots[0];
  const selectedTurnResult = simulation.turns[selectedTurnIndex]?.result;
  const currentHuppermageState = currentSnapshot?.classState.huppermage;
  const deckSpellLimit = currentHuppermageState?.deckSpellLimit ?? character.classState?.huppermage?.deckSpellLimit ?? 12;
  const usedSpellIds = currentHuppermageState?.usedSpellIds ?? [];
  const temporaryUnlockedSpellElement = currentHuppermageState?.temporaryUnlockedSpellElement ?? null;
  const passiveLimit = character.classState?.huppermage?.passiveLimit ?? 6;
  const selectedTimelineIndex = selectedTimelineUid
    ? timeline.findIndex((action) => action.uid === selectedTimelineUid)
    : -1;
  const detailTarget = resolveDetailTarget({
    hoveredCatalogEntryId,
    selectedCatalogEntryId,
    selectedTimelineUid,
    selectedActionIndex: selectedTimelineIndex >= 0 ? selectedTimelineIndex : null,
  });
  const selectedActionIndex = detailTarget.kind === "timeline" ? detailTarget.actionIndex : null;
  const selectedAction = selectedActionIndex !== null ? timeline[selectedActionIndex] : undefined;
  const selectedActionResult = selectedActionIndex !== null
    ? selectedTurnResult?.breakdown.find((entry) => entry.actionIndex === selectedActionIndex)
    : undefined;
  const selectedCatalogEntry = detailTarget.kind === "catalog"
    ? [...spells, ...passives].find((entry) => entry.id === detailTarget.entryId)
    : selectedAction
      ? spells.find((entry) => entry.id === selectedAction.spellId)
      : undefined;
  const timelineDropPreviewSpellId = getTimelineDropPreviewSpellId(timelineDropIntent, turns);
  const timelineDropPreviewEntry = timelineDropPreviewSpellId
    ? spells.find((entry) => entry.id === timelineDropPreviewSpellId)
    : undefined;

  useEffect(() => {
    setSelectedStep((step) => Math.min(step, Math.max(0, snapshots.length - 1)));
  }, [snapshots.length]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      saveResearchWorkspace(window.localStorage, researchWorkspace);
    }
  }, [researchWorkspace]);

  useEffect(() => () => {
    if (optimizerSessionFlushRef.current !== null) {
      window.cancelAnimationFrame(optimizerSessionFlushRef.current);
    }
  }, []);

  useEffect(() => {
    setUiLocale(locale);
    document.documentElement.lang = locale;
    document.documentElement.classList.add("notranslate");
    document.documentElement.setAttribute("translate", "no");
    document.title = t("app.title");
  }, [locale]);

  function changeLocale(nextLocale: UiLocale) {
    setUiLocale(nextLocale);
    setLocale(nextLocale);
  }

  function createResearchBuild(input: { classId: WakfuClassId; gameplayLabel: string; name: string }) {
    setResearchWorkspace((workspace) => {
      const nextWorkspace = createBuild(workspace, { ...input, now: new Date().toISOString() });
      const createdBuild = nextWorkspace.builds.at(-1);
      if (createdBuild && createdBuild.id !== workspace.builds.at(-1)?.id) {
        setResearchRoute(openBuild(researchRoute, createdBuild.id));
      }
      return nextWorkspace;
    });
  }

  function createBalancedSetFromSetup(setup: SetupSnapshot) {
    const now = new Date().toISOString();
    setResearchWorkspace((workspace) => createBalancedElementSet(workspace, {
      buildId: setup.buildId,
      sourceSetupSnapshotId: setup.id,
      name: `Set éléments équilibrés ${now.slice(0, 16).replace("T", " ")}`,
      now,
    }));
  }

  function removeSetupSnapshot(setup: SetupSnapshot) {
    setResearchWorkspace((workspace) => deleteSetupSnapshot(workspace, {
      buildId: setup.buildId,
      setupSnapshotId: setup.id,
      now: new Date().toISOString(),
    }));
  }

  function renameResearchBuild(buildId: string, name: string) {
    setResearchWorkspace((workspace) => renameBuild(workspace, {
      buildId,
      name,
      now: new Date().toISOString(),
    }));
  }

  function renameResearchSetup(setup: SetupSnapshot, name: string) {
    setResearchWorkspace((workspace) => renameSetupSnapshot(workspace, {
      buildId: setup.buildId,
      setupSnapshotId: setup.id,
      name,
      now: new Date().toISOString(),
    }));
  }

  function updateSetupSublimations(setup: SetupSnapshot, sublimations: SublimationBuild) {
    const now = new Date().toISOString();
    const nextSublimations = {
      ...sublimations,
      selections: [...sublimations.selections],
      hpAssumption: sublimations.hpAssumption ?? setup.hpAssumption,
    };
    const result = saveSetupVersion(researchWorkspace, {
      buildId: setup.buildId,
      character: {
        ...setup.character,
        sublimations: nextSublimations,
      },
      sourceSetupSnapshotId: setup.id,
      now,
    });
    setResearchWorkspace(result.workspace);
    setResearchRoute((route) => openSetup(route, setup.buildId, result.setupSnapshotId));
  }

  function openSetupInBuilder(setup: SetupSnapshot, candidate?: OptimizerCandidateViewModel) {
    if (!candidate) {
      openSetupPlanInBuilder(setup);
      return;
    }

    const handoff = openCandidateInBuilder(setup, candidate);
    applySetupToBuilder({ ...setup, character: handoff.character }, handoff.plan);
    setResearchRoute((route) => openBuilderFromSetup(route, setup.buildId, setup.id));
  }

  function openSetupPlanInBuilder(setup: SetupSnapshot, plan?: ComboPlan) {
    applySetupToBuilder(setup, plan);
    setResearchRoute((route) => openBuilderFromSetup(route, setup.buildId, setup.id));
  }

  function openSavedComboInBuilder(combo: SavedComboReference) {
    const setup = researchWorkspace.setupSnapshots.find((candidate) => candidate.id === combo.setupSnapshotId);
    if (setup) {
      const character = combo.passiveIds?.length || combo.sublimations
        ? {
          ...setup.character,
          sublimations: combo.sublimations ?? setup.character.sublimations,
          classState: {
            ...setup.character.classState,
            huppermage: {
              ...setup.character.classState?.huppermage,
              activePassives: [...(combo.passiveIds ?? setup.character.classState?.huppermage?.activePassives ?? [])],
            },
          },
        }
        : setup.character;
      applySetupToBuilder({ ...setup, character }, combo.plan);
      setResearchRoute((route) => openBuilderFromSetup(route, setup.buildId, setup.id));
    }
  }

  function saveOptimizerRun(setup: SetupSnapshot, controls: OptimizerWorkspaceControls) {
    const now = new Date().toISOString();
    setResearchWorkspace((workspace) => createOptimizerRunReference(workspace, {
      buildId: setup.buildId,
      setupSnapshotId: setup.id,
      label: `Run optimizer ${now.slice(0, 16).replace("T", " ")}`,
      criteriaSummary: summarizeOptimizerControls(controls),
      now,
    }));
  }

  function saveOptimizerCombo(
    setup: SetupSnapshot,
    candidate: OptimizerCandidateViewModel,
    controls: OptimizerWorkspaceControls,
  ) {
    setResearchWorkspace((workspace) => saveOptimizerCandidateCombo(workspace, {
      buildId: setup.buildId,
      setupSnapshotId: setup.id,
      name: createSavedComboName(candidate),
      plan: candidate.plan,
      passiveIds: candidate.passiveIds,
      sublimations: candidate.sublimations,
      totalDamage: candidate.totalDamage,
      criteriaSummary: summarizeOptimizerControls(controls),
      now: new Date().toISOString(),
    }));
  }

  function removeSavedCombo(comboId: string) {
    setResearchWorkspace((workspace) => deleteSavedCombo(workspace, comboId));
  }

  function removeSavedCombos(comboIds: string[]) {
    setResearchWorkspace((workspace) => deleteSavedCombos(workspace, { comboIds }));
  }

  function storeOptimizerSession(setupId: string, session: OptimizerWorkspaceSession) {
    const nextSessions = {
      ...optimizerSessionsRef.current,
      [setupId]: session,
    };
    optimizerSessionsRef.current = nextSessions;
    if (typeof window === "undefined") {
      setOptimizerSessions(nextSessions);
      return;
    }

    if (optimizerSessionFlushRef.current !== null) {
      return;
    }

    optimizerSessionFlushRef.current = window.requestAnimationFrame(() => {
      optimizerSessionFlushRef.current = null;
      setOptimizerSessions(optimizerSessionsRef.current);
    });
  }

  function applySetupToBuilder(setup: SetupSnapshot, plan?: ComboPlan) {
    const distribution = createDefaultAptitudeDistribution(setup.character.stats.level ?? 200);
    const builderSetup: SetupSnapshot = {
      ...setup,
      initialClassState: setup.character.classState ?? {},
      passiveIds: setup.character.classState?.huppermage?.activePassives ?? setup.passiveIds,
    };
    builderBaselineRef.current = {
      assumptionKey: createSetupAssumptionsKey(builderSetup),
      setupSnapshotId: setup.id,
    };
    setAptitudeDistribution(distribution);
    setCharacterConfig(setup.character);
    setEquipmentCharacter(createEquipmentCharacterFromFinalCharacter(setup.character, distribution));
    setCenterTab("combos");
    const nextTurns = plan
      ? plan.turns.map((turn) => turn.actions.map(createTimelineActionFromAction))
      : [[]];
    setTurns(nextTurns.length > 0 ? nextTurns : [[]]);
    setSelectedTurnIndex(0);
    setSelectedTimelineUid(nextTurns[0]?.[0]?.uid ?? null);
    setSelectedCatalogEntryId(null);
    setSelectedStep(0);
  }

  function returnFromBuilder() {
    if (researchRoute.page !== "builder" || !researchRoute.buildId || !researchRoute.setupSnapshotId || !activeSetup) {
      setResearchRoute(returnToPrevious(researchRoute));
      return;
    }

    const builderSetup: SetupSnapshot = {
      ...activeSetup,
      character,
      initialClassState: character.classState ?? {},
      passiveIds: character.classState?.huppermage?.activePassives ?? activeSetup.passiveIds,
    };
    const currentAssumptionKey = createSetupAssumptionsKey(builderSetup);
    const baseline = builderBaselineRef.current;
    if (baseline?.setupSnapshotId === researchRoute.setupSnapshotId && baseline.assumptionKey === currentAssumptionKey) {
      setResearchRoute(returnToPrevious(researchRoute));
      return;
    }

    const result = saveSetupVersion(researchWorkspace, {
      buildId: researchRoute.buildId,
      sourceSetupSnapshotId: researchRoute.setupSnapshotId,
      character,
      now: new Date().toISOString(),
    });
    builderBaselineRef.current = {
      assumptionKey: currentAssumptionKey,
      setupSnapshotId: result.setupSnapshotId,
    };
    setResearchWorkspace(result.workspace);
    setResearchRoute(retargetSetupRoute(returnToPrevious(researchRoute), result.setupSnapshotId));
  }

  function insertAction(spellId: string, index = timeline.length) {
    insertActionInTurn(selectedTurnIndex, spellId, index);
  }

  function insertActionInTurn(turnIndex: number, spellId: string, index = turns[turnIndex]?.length ?? 0) {
    const turn = turns[turnIndex] ?? [];
    const targetIndex = clamp(index, 0, turn.length);
    const nextAction = createTimelineAction(spellId);
    updateTurn(turnIndex, (actions) => {
      return [
        ...actions.slice(0, targetIndex),
        nextAction,
        ...actions.slice(targetIndex),
      ];
    });
    setSelectedTurnIndex(turnIndex);
    setSelectedTimelineUid(nextAction.uid);
    setSelectedCatalogEntryId(null);
    setSelectedStep(getPlannedSnapshotIndexForAction(turns, turnIndex, targetIndex));
  }

  function updateAction(index: number, patch: Partial<Action>) {
    updateSelectedTurn((actions) => actions.map((action, actionIndex) => actionIndex === index ? { ...action, ...patch } : action));
  }

  function moveAction(index: number, direction: -1 | 1) {
    updateSelectedTurn((actions) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= actions.length) {
        return actions;
      }

      const nextActions = [...actions];
      const [movedAction] = nextActions.splice(index, 1);
      nextActions.splice(targetIndex, 0, movedAction);
      return nextActions;
    });
    setSelectedStep(Math.max(1, selectedStep + direction));
  }

  function moveActionToIndex(uid: string, targetIndex: number) {
    moveActionToTurnIndex(uid, selectedTurnIndex, targetIndex);
  }

  function moveActionToTurnIndex(uid: string, turnIndex: number, targetIndex: number) {
    const sourceLocation = findTimelineActionLocation(turns, uid);
    const targetTurn = turns[turnIndex] ?? [];
    if (!sourceLocation || !targetTurn) {
      return;
    }

    const isSameTurn = sourceLocation.turnIndex === turnIndex;
    const adjustedIndex = isSameTurn && sourceLocation.actionIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const boundedIndex = clamp(adjustedIndex, 0, isSameTurn ? targetTurn.length - 1 : targetTurn.length);

    setTurns((currentTurns) => {
      const movedAction = currentTurns[sourceLocation.turnIndex]?.[sourceLocation.actionIndex];
      if (!movedAction) {
        return currentTurns;
      }

      return currentTurns.map((turn, currentTurnIndex) => {
        if (currentTurnIndex === sourceLocation.turnIndex && currentTurnIndex === turnIndex) {
          const nextActions = [...turn];
          const [action] = nextActions.splice(sourceLocation.actionIndex, 1);
          nextActions.splice(boundedIndex, 0, action);
          return nextActions;
        }

        if (currentTurnIndex === sourceLocation.turnIndex) {
          return turn.filter((action) => action.uid !== uid);
        }

        if (currentTurnIndex === turnIndex) {
          const nextActions = [...turn];
          nextActions.splice(boundedIndex, 0, movedAction);
          return nextActions;
        }

        return turn;
      });
    });
    setSelectedTurnIndex(turnIndex);
    setSelectedTimelineUid(uid);
    setSelectedStep(getSnapshotIndexForAction(turnIndex, boundedIndex, snapshots));
  }

  function duplicateAction(index: number) {
    updateSelectedTurn((actions) => {
      const action = actions[index];
      if (!action) {
        return actions;
      }

      const copyAction = { ...action, uid: crypto.randomUUID() };
      return [...actions.slice(0, index + 1), copyAction, ...actions.slice(index + 1)];
    });
  }

  function removeAction(index: number) {
    const removedUid = timeline[index]?.uid;
    updateSelectedTurn((actions) => actions.filter((_action, actionIndex) => actionIndex !== index));
    if (removedUid && removedUid === selectedTimelineUid) {
      setSelectedTimelineUid(timeline[index + 1]?.uid ?? timeline[index - 1]?.uid ?? null);
    }
    setSelectedStep((step) => Math.max(0, Math.min(step, timeline.length - 1)));
  }

  function removeActionByUid(uid: string) {
    const sourceLocation = findTimelineActionLocation(turns, uid);
    if (!sourceLocation) {
      return;
    }

    setTurns((currentTurns) => currentTurns.map((turn, turnIndex) => (
      turnIndex === sourceLocation.turnIndex ? turn.filter((action) => action.uid !== uid) : turn
    )));
    if (selectedTimelineUid === uid) {
      const sourceTurn = turns[sourceLocation.turnIndex] ?? [];
      setSelectedTurnIndex(sourceLocation.turnIndex);
      setSelectedTimelineUid(sourceTurn[sourceLocation.actionIndex + 1]?.uid ?? sourceTurn[sourceLocation.actionIndex - 1]?.uid ?? null);
      setSelectedCatalogEntryId(null);
      setSelectedStep(getFirstSnapshotIndexForTurn(sourceLocation.turnIndex, snapshots));
    }
  }

  function selectTimelineAction(uid: string, index: number) {
    selectTurnTimelineAction(selectedTurnIndex, uid, index);
  }

  function selectTurnTimelineAction(turnIndex: number, uid: string, index: number) {
    setSelectedTurnIndex(turnIndex);
    setSelectedTimelineUid(uid);
    setSelectedCatalogEntryId(null);
    setSelectedStep(getSnapshotIndexForAction(turnIndex, index, snapshots));
  }

  function updateSelectedTurn(updater: (actions: TimelineAction[]) => TimelineAction[]) {
    updateTurn(selectedTurnIndex, updater);
  }

  function updateTurn(turnIndex: number, updater: (actions: TimelineAction[]) => TimelineAction[]) {
    setTurns((currentTurns) => currentTurns.map((turn, currentTurnIndex) => (
      currentTurnIndex === turnIndex ? updater(turn) : turn
    )));
  }

  function addTurn() {
    setTurns((currentTurns) => [...currentTurns, []]);
    setSelectedTurnIndex(turns.length);
    setSelectedTimelineUid(null);
    setSelectedCatalogEntryId(null);
  }

  function removeTurn(index: number) {
    if (turns.length <= 1) {
      return;
    }

    const nextTurns = turns.filter((_turn, turnIndex) => turnIndex !== index);
    setTurns(nextTurns);
    const nextSelectedTurnIndex = clamp(index >= selectedTurnIndex ? selectedTurnIndex - 1 : selectedTurnIndex, 0, nextTurns.length - 1);
    setSelectedTurnIndex(nextSelectedTurnIndex);
    setSelectedTimelineUid(nextTurns[nextSelectedTurnIndex]?.[0]?.uid ?? null);
    setSelectedCatalogEntryId(null);
    setSelectedStep(0);
  }

  function selectTurn(index: number) {
    const nextIndex = clamp(index, 0, turns.length - 1);
    setSelectedTurnIndex(nextIndex);
    setSelectedTimelineUid(turns[nextIndex]?.[0]?.uid ?? null);
    setSelectedCatalogEntryId(null);
    setSelectedStep(getFirstSnapshotIndexForTurn(nextIndex, snapshots));
  }

  function selectCursorStep(step: number) {
    const nextStep = clamp(step, 0, Math.max(0, snapshots.length - 1));
    const snapshot = snapshots[nextStep];
    setSelectedStep(nextStep);

    if (!snapshot) {
      return;
    }

    const nextTurnIndex = clamp(snapshot.turnIndex, 0, turns.length - 1);
    setSelectedTurnIndex(nextTurnIndex);
    setSelectedCatalogEntryId(null);
    setSelectedTimelineUid(
      typeof snapshot.actionIndex === "number"
        ? turns[nextTurnIndex]?.[snapshot.actionIndex]?.uid ?? null
        : null,
    );
  }

  function selectCatalogEntry(entryId: string) {
    setSelectedCatalogEntryId(entryId);
    setSelectedTimelineUid(null);
  }

  function toggleCatalogEntryHidden(entry: CatalogEntry) {
    setHiddenCatalogEntries((state) => toggleHiddenCatalogEntry(state, entry));
    setHoveredCatalogEntryId(null);
  }

  function togglePassive(passiveId: string, active: boolean) {
    const huppermage = characterConfig.classState?.huppermage;
    const activePassives = new Set(huppermage?.activePassives ?? []);
    if (active) {
      const limit = huppermage?.passiveLimit ?? 6;
      if (!activePassives.has(passiveId) && activePassives.size >= limit) {
        return;
      }
      activePassives.add(passiveId);
    } else {
      activePassives.delete(passiveId);
    }

    setCharacterConfig({
      ...characterConfig,
      classState: {
        ...characterConfig.classState,
        huppermage: {
          ...huppermage,
          activePassives: [...activePassives],
        },
      },
    });
  }

  function changeBuilderSublimations(sublimations: SublimationBuild) {
    const nextSublimations = {
      ...sublimations,
      selections: sublimations.selections.map((selection) => ({ ...selection })),
    };

    setCharacterConfig((current) => ({
      ...current,
      sublimations: nextSublimations,
    }));
    persistBuilderSetupSublimations(nextSublimations);
  }

  function returnFromBuilder() {
    if (
      researchRoute.page === "builder"
      && researchRoute.returnTo?.page === "setup"
      && activeSetup
      && character.sublimations
      && !areSublimationBuildsEqual(character.sublimations, activeSetup.sublimations)
    ) {
      updateSetupSublimations(activeSetup, character.sublimations);
      return;
    }

    setResearchRoute(returnToPrevious(researchRoute));
  }

  function persistBuilderSetupSublimations(sublimations: SublimationBuild) {
    if (
      researchRoute.page !== "builder"
      || researchRoute.returnTo?.page !== "setup"
      || !activeSetup
      || areSublimationBuildsEqual(sublimations, activeSetup.sublimations)
    ) {
      return;
    }

    const now = new Date().toISOString();
    const nextWorkspace = createSetupSnapshotWithSublimations(researchWorkspace, {
      buildId: activeSetup.buildId,
      sourceSetupSnapshotId: activeSetup.id,
      sublimations,
      now,
    });
    const createdSetupId = nextWorkspace.setupSnapshots.at(-1)?.id ?? activeSetup.id;
    setResearchWorkspace(nextWorkspace);
    setResearchRoute({
      page: "builder",
      buildId: activeSetup.buildId,
      setupSnapshotId: createdSetupId,
      returnTo: {
        page: "setup",
        buildId: activeSetup.buildId,
        setupSnapshotId: createdSetupId,
        returnTo: {
          page: "build",
          buildId: activeSetup.buildId,
        },
      },
    });
  }

  function startSpellDrag(event: React.DragEvent, spellId: string) {
    const payload: DragPayload = { type: "spell", spellId };
    activeDragPayloadRef.current = payload;
    writeDragPayload(event, payload);
    event.dataTransfer.effectAllowed = "copy";
    setTimelineDropIntent(null);
  }

  function startTimelineDrag(event: React.DragEvent, uid: string) {
    const payload: DragPayload = { type: "timelineAction", uid };
    activeDragPayloadRef.current = payload;
    completedTimelineDropRef.current = false;
    writeDragPayload(event, payload);
    event.dataTransfer.effectAllowed = "move";
    setTimelineDropIntent(null);
  }

  function finishTimelineDrag(event: React.DragEvent, uid: string) {
    const timelineLaneBounds = getTimelineLaneBounds(turnStackRef.current);
    const didDropOnTimeline = completedTimelineDropRef.current;
    completedTimelineDropRef.current = false;
    activeDragPayloadRef.current = null;

    if (!didDropOnTimeline && timelineLaneBounds.length > 0 && shouldRemoveTimelineActionOnDragEnd(
      event.dataTransfer.dropEffect,
      { x: event.clientX, y: event.clientY },
      timelineLaneBounds,
    )) {
      removeActionByUid(uid);
    }
    clearTimelineDrop();
  }

  function finishCatalogDrag() {
    activeDragPayloadRef.current = null;
    clearTimelineDrop();
  }

  function allowTimelineDrop(event: React.DragEvent, index: number) {
    allowTurnTimelineDrop(event, selectedTurnIndex, index);
  }

  function allowTurnTimelineDrop(event: React.DragEvent, turnIndex: number, index: number) {
    const payload = readDragPayload(event) ?? activeDragPayloadRef.current;
    if (!payload) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = payload?.type === "timelineAction" ? "move" : "copy";
    const turnUids = getTurnUids(turns, turnIndex);
    const sourceLocation = payload?.type === "timelineAction" ? findTimelineActionLocation(turns, payload.uid) : null;
    const sourceTimelineUids = sourceLocation && sourceLocation.turnIndex !== turnIndex
      ? getTurnUids(turns, sourceLocation.turnIndex)
      : undefined;
    const intent = payload ? createTimelineDropIntent(payload, turnUids, index, { sourceTimelineUids }) : null;
    setTimelineDropIntent(intent);
    setTimelineDropTurnIndex(intent ? turnIndex : null);
  }

  function clearTimelineDrop() {
    setTimelineDropIntent(null);
    setTimelineDropTurnIndex(null);
  }

  function leaveTimelineDrop(event: React.DragEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (!nextTarget || !(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      clearTimelineDrop();
    }
  }

  function dropOnTimeline(event: React.DragEvent, index = timeline.length) {
    dropOnTurnTimeline(event, selectedTurnIndex, index);
  }

  function dropOnTurnTimeline(event: React.DragEvent, turnIndex: number, index = turns[turnIndex]?.length ?? 0) {
    event.preventDefault();
    event.stopPropagation();

    const payload = readDragPayload(event) ?? activeDragPayloadRef.current;
    const turnUids = getTurnUids(turns, turnIndex);
    const sourceLocation = payload?.type === "timelineAction" ? findTimelineActionLocation(turns, payload.uid) : null;
    const sourceTimelineUids = sourceLocation && sourceLocation.turnIndex !== turnIndex
      ? getTurnUids(turns, sourceLocation.turnIndex)
      : undefined;
    const intent = payload ? createTimelineDropIntent(payload, turnUids, index, { sourceTimelineUids }) : null;
    clearTimelineDrop();
    if (!payload) {
      return;
    }

    if (payload.type === "timelineAction" && intent?.kind === "moveAction") {
      completedTimelineDropRef.current = true;
    }
    activeDragPayloadRef.current = null;

    if (intent?.kind === "insertSpell") {
      insertActionInTurn(turnIndex, intent.spellId, intent.insertIndex);
      return;
    }

    if (intent?.kind === "moveAction" && !intent.isNoop) {
      moveActionToTurnIndex(intent.uid, turnIndex, intent.insertIndex);
    }
  }

  if (researchRoute.page === "library") {
    return (
      <>
        <AppHeader locale={locale} onChangeLocale={changeLocale} />
        <ResearchLibraryPage
          classFilter={buildClassFilter}
          workspace={researchWorkspace}
          onClassFilterChange={setBuildClassFilter}
          onCreateBuild={createResearchBuild}
          onOpenBuild={(buildId) => setResearchRoute(openBuild(researchRoute, buildId))}
          onOpenQuickBuilder={() => setResearchRoute({ page: "builder" })}
        />
      </>
    );
  }

  if (researchRoute.page === "build" && activeBuild) {
    const setups = getBuildSetups(researchWorkspace, activeBuild.id);
    return (
      <>
        <AppHeader locale={locale} onChangeLocale={changeLocale} />
        <BuildPage
          build={activeBuild}
          runs={getBuildRuns(researchWorkspace, activeBuild.id)}
          savedCombos={getBuildSavedCombos(researchWorkspace, activeBuild.id)}
          setups={setups}
          onBack={() => setResearchRoute({ page: "library" })}
          onCreateBalancedSet={createBalancedSetFromSetup}
          onDeleteSetup={removeSetupSnapshot}
          onOpenBuilder={(setup) => openSetupInBuilder(setup)}
          onOpenOptimizer={(setup) => setResearchRoute(openOptimizerFromSetup(researchRoute, activeBuild.id, setup.id))}
          onOpenRun={(run) => setResearchRoute(openOptimizerRun(researchRoute, activeBuild.id, run.id))}
          onOpenSavedCombos={() => setResearchRoute(openSavedComboComparison(researchRoute, activeBuild.id))}
          onOpenSetup={(setup) => setResearchRoute(openSetup(researchRoute, activeBuild.id, setup.id))}
          onRenameBuild={(name) => renameResearchBuild(activeBuild.id, name)}
          onRenameSetup={renameResearchSetup}
        />
      </>
    );
  }

  if (researchRoute.page === "optimizerRun" && activeBuild && activeOptimizerRun) {
    return (
      <>
        <AppHeader locale={locale} onChangeLocale={changeLocale} />
        <OptimizerRunDetailPage
          build={activeBuild}
          run={activeOptimizerRun}
          setup={researchWorkspace.setupSnapshots.find((setup) => setup.id === activeOptimizerRun.setupSnapshotId)}
          setups={getBuildSetups(researchWorkspace, activeBuild.id)}
          savedCombos={getBuildSavedCombos(researchWorkspace, activeBuild.id)}
          onBack={() => setResearchRoute(returnToPrevious(researchRoute))}
          onOpenCombo={openSavedComboInBuilder}
        />
      </>
    );
  }

  if (researchRoute.page === "savedCombos" && activeBuild) {
    return (
      <>
        <AppHeader locale={locale} onChangeLocale={changeLocale} />
        <SavedComboComparisonPage
          build={activeBuild}
          setups={getBuildSetups(researchWorkspace, activeBuild.id)}
          savedCombos={getBuildSavedCombos(researchWorkspace, activeBuild.id)}
          onBack={() => setResearchRoute(returnToPrevious(researchRoute))}
          onDeleteCombo={removeSavedCombo}
          onDeleteVisibleCombos={removeSavedCombos}
          onOpenCombo={openSavedComboInBuilder}
        />
      </>
    );
  }

  if (researchRoute.page === "setup" && activeBuild && activeSetup) {
    return (
      <>
        <AppHeader locale={locale} onChangeLocale={changeLocale} />
        <SetupPage
          build={activeBuild}
          catalog={catalog}
          setup={activeSetup}
          onBack={() => setResearchRoute(returnToPrevious(researchRoute))}
          onChangeSublimations={(sublimations) => updateSetupSublimations(activeSetup, sublimations)}
          onOpenBuilder={() => openSetupInBuilder(activeSetup)}
          onOpenOptimizer={() => setResearchRoute(openOptimizerFromSetup(researchRoute, activeBuild.id, activeSetup.id))}
          onRenameSetup={(name) => renameResearchSetup(activeSetup, name)}
        />
      </>
    );
  }

  if (researchRoute.page === "optimizer" && activeBuild && activeSetup) {
    const savedCandidateIds = getBuildSavedCombos(researchWorkspace, activeBuild.id)
      .filter((comboReference) => comboReference.setupSnapshotId === activeSetup.id)
      .map((comboReference) => createOptimizerCandidateId(comboReference.plan));
    const savedRunKeys = getBuildRuns(researchWorkspace, activeBuild.id)
      .filter((run) => run.setupSnapshotId === activeSetup.id)
      .map((run) => `${run.setupSnapshotId}:${run.criteriaSummary}`);

    return (
      <>
        <AppHeader locale={locale} onChangeLocale={changeLocale} />
        <OptimizerWorkspacePage
          build={activeBuild}
          catalog={catalog}
          initialSession={optimizerSessionsRef.current[activeSetup.id] ?? optimizerSessions[activeSetup.id]}
          key={activeSetup.id}
          setup={activeSetup}
          savedCandidateIds={savedCandidateIds}
          savedRunKeys={savedRunKeys}
          onBack={() => setResearchRoute(returnToPrevious(researchRoute))}
          onOpenCandidate={(candidate) => {
            openSetupInBuilder(activeSetup, candidate);
          }}
          onSaveCandidate={(candidate, controls) => saveOptimizerCombo(activeSetup, candidate, controls)}
          onSaveRun={(controls) => saveOptimizerRun(activeSetup, controls)}
          onSessionChange={(session) => storeOptimizerSession(activeSetup.id, session)}
        />
      </>
    );
  }

  return (
    <>
      <AppHeader locale={locale} onChangeLocale={changeLocale} onOpenLibrary={() => setResearchRoute(returnToBuild(researchRoute))} />

      <main className="app-shell">
        {researchRoute.page === "builder" && researchRoute.returnTo ? (
          <button className="back-button builder-back-button" type="button" onClick={returnFromBuilder}>
            <ArrowLeft size={16} />
            {getBuilderBackLabel(researchRoute)}
          </button>
        ) : null}

        <section className={`workspace ${centerTab !== "combos" ? "workspace-center-only" : ""}`}>
          <aside className="panel setup-panel" aria-label={t("panel.stateTracker")}>
            <PanelHeader title={t("panel.stateTracker")} />
            <HuppermageStateTracker
              activeSublimations={character.sublimations}
              initialConditionResources={character.resources}
              initialConditionStats={character.stats}
              resources={currentSnapshot?.resources ?? character.resources}
              snapshot={currentSnapshot}
            />
          </aside>

          <section className="panel center-panel" aria-label={t("panel.sequenceDetails")}>
            <PanelHeader
              title={t(centerTab === "combos" ? "panel.sequence" : centerTab === "aptitudes" ? "panel.aptitudes" : "panel.equipment")}
              subtitle={t(centerTab === "combos" ? "panel.actionOrder" : centerTab === "aptitudes" ? "panel.importFormat" : "panel.equipmentSubtitle")}
              actions={
                <div className="sequence-summary" aria-label={t("app.liveResults")}>
                  <div className="sequence-summary-score" title={t("metric.comboDamage")}>
                    <span>{t("metric.comboDamage")}</span>
                    <b>{simulation.totalDamage}</b>
                  </div>
                  <div className={simulation.valid ? "status-pill status-ok" : "status-pill status-error"}>
                    {simulation.valid ? t("status.valid") : t("status.invalid")}
                  </div>
                </div>
              }
            />
            <CenterTabs value={centerTab} onChange={setCenterTab} />
            {centerTab === "combos" ? (
              <>
                <div ref={turnStackRef} className={`turn-stack ${timelineDropIntent ? "dragging" : ""}`} aria-label={t("combo.turns")}>
                  {turnRows.map((turnRow) => {
                    const turnActions = turns[turnRow.turnIndex] ?? [];
                    const turnResult = simulation.turns.find((turnResult) => turnResult.turnIndex === turnRow.turnIndex)?.result;
                    const isActiveTurn = selectedTurnIndex === turnRow.turnIndex;

                    return (
                      <section
                        key={turnRow.turnIndex}
                        className={`turn-row ${isActiveTurn ? "active" : ""} ${turnRow.valid ? "" : "invalid"}`}
                        aria-label={turnRow.label}
                      >
                        <div className="turn-row-summary">
                          <button
                            className="turn-row-select"
                            type="button"
                            onClick={() => selectTurn(turnRow.turnIndex)}
                          >
                            <span className="turn-row-label">{turnRow.label}</span>
                            <span className="turn-row-metric" title={formatResourceLabel("ap")}>
                              <StatIcon src={getResourceIconSrc("ap")} label={formatResourceLabel("ap")} />
                              <b>{turnRow.remainingAp}</b>
                            </span>
                            <span className="turn-row-metric" title={t("metric.turnDamage")}>
                              <StatIcon src={getStatIconSrc("damageInflictedPercent")} label={t("metric.turnDamage")} />
                              <b>{turnRow.totalDamage}</b>
                            </span>
                          </button>
                        </div>

                        <div
                          className={`sequence-rack ${turnActions.length === 0 ? "empty" : ""}`}
                          onDragLeave={leaveTimelineDrop}
                          onDragOver={(event) => allowTurnTimelineDrop(event, turnRow.turnIndex, turnActions.length)}
                          onDrop={(event) => dropOnTurnTimeline(event, turnRow.turnIndex, turnActions.length)}
                        >
                          {turnActions.map((action, index) => {
                            const spell = spells.find((entry) => entry.id === action.spellId);
                            const isFailed = turnResult?.violations.some((violation) => violation.actionIndex === index) ?? false;
                            const isSelected = selectedTimelineUid === action.uid;
                            const isCursorStep = currentSnapshot?.turnIndex === turnRow.turnIndex && currentSnapshot?.actionIndex === index;
                            const isDropTurn = timelineDropTurnIndex === turnRow.turnIndex;
                            const isDragSource = isDropTurn && timelineDropIntent?.kind === "moveAction" && timelineDropIntent.sourceIndex === index;

                            return (
                              <Fragment key={action.uid}>
                                <TimelineDropMarker
                                  active={isDropTurn && isTimelineDropMarkerActive(timelineDropIntent, index)}
                                  entry={timelineDropPreviewEntry}
                                />
                                <button
                                  aria-label={`${turnRow.label}.${index + 1}. ${spell?.name ?? t("action.unknownSpell")}`}
                                  className={`sequence-tile ${isSelected ? "selected" : ""} ${isCursorStep ? "cursor-step" : ""} ${isFailed ? "failed" : ""} ${isDragSource ? "drag-source" : ""}`}
                                  draggable
                                  type="button"
                                  onClick={() => selectTurnTimelineAction(turnRow.turnIndex, action.uid, index)}
                                  onDragEnd={(event) => finishTimelineDrag(event, action.uid)}
                                  onDragStart={(event) => startTimelineDrag(event, action.uid)}
                                  onDragOver={(event) => allowTurnTimelineDrop(event, turnRow.turnIndex, index)}
                                  onDrop={(event) => dropOnTurnTimeline(event, turnRow.turnIndex, index)}
                                >
                                  <span className="tile-index">{index + 1}</span>
                                  <EntryIcon entryId={action.spellId} label={spell?.name ?? t("action.unknownSpell")} />
                                  {isFailed ? <span className="tile-warning" title={t("action.invalid")}>!</span> : null}
                                </button>
                              </Fragment>
                            );
                          })}
                          <TimelineDropMarker
                            active={timelineDropTurnIndex === turnRow.turnIndex && isTimelineDropMarkerActive(timelineDropIntent, turnActions.length)}
                            entry={timelineDropPreviewEntry}
                          />
                          <button
                            aria-label={t("action.addToEnd")}
                            aria-disabled={!selectedCatalogEntry || selectedCatalogEntry.kind === "passive"}
                            className="sequence-add"
                            title={t("action.addToEnd")}
                            type="button"
                            onDragOver={(event) => allowTurnTimelineDrop(event, turnRow.turnIndex, turnActions.length)}
                            onDrop={(event) => dropOnTurnTimeline(event, turnRow.turnIndex, turnActions.length)}
                            onClick={() => selectedCatalogEntry?.kind !== "passive" && selectedCatalogEntry ? insertActionInTurn(turnRow.turnIndex, selectedCatalogEntry.id) : undefined}
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                        {turns.length > 1 ? (
                          <button
                            aria-label={t("combo.removeTurn")}
                            className="turn-row-remove"
                            title={t("combo.removeTurn")}
                            type="button"
                            onClick={() => removeTurn(turnRow.turnIndex)}
                          >
                            ×
                          </button>
                        ) : null}
                      </section>
                    );
                  })}
                  <CursorControl
                    marks={cursorMarks}
                    value={selectedStep}
                    max={Math.max(0, snapshots.length - 1)}
                    onChange={selectCursorStep}
                  />
                  <button className="turn-add-row" type="button" onClick={addTurn}>
                    <Plus size={15} />
                    {t("combo.addTurn")}
                  </button>
                </div>

                <section className="detail-panel" aria-label={t("panel.detailSheet")}>
                  <SelectionDetail
                    action={selectedAction}
                    actionIndex={selectedActionIndex}
                    actionResult={selectedActionResult}
                    entry={selectedCatalogEntry}
                    snapshot={currentSnapshot}
                    onAddSpell={(spellId) => insertAction(spellId, selectedTimelineIndex >= 0 ? selectedTimelineIndex + 1 : timeline.length)}
                    onDuplicateAction={selectedActionIndex !== null ? () => duplicateAction(selectedActionIndex) : undefined}
                    onRemoveAction={selectedActionIndex !== null ? () => removeAction(selectedActionIndex) : undefined}
                  />
                  {selectedAction && selectedActionIndex !== null ? (
                    <ActionEditor action={selectedAction} onChange={(patch) => updateAction(selectedActionIndex, patch)} />
                  ) : null}
                </section>
              </>
            ) : null}
            {centerTab === "aptitudes" ? (
              <AptitudeDistributionEditor
                distribution={aptitudeDistribution}
                onChange={setAptitudeDistribution}
              />
            ) : null}
            {centerTab === "equipment" ? (
              <div className="equipment-tab-content">
                <ResourceEditor character={equipmentCharacter} onChange={setEquipmentCharacter} />
                <EquipmentExtraStatsEditor stats={equipmentExtras} onChange={setEquipmentExtras} />
                <StatsEditor character={equipmentCharacter} onChange={setEquipmentCharacter} />
              </div>
            ) : null}
          </section>

          {centerTab === "combos" ? (
            <aside className="panel library-panel" aria-label={t("panel.library")}>
              <PanelHeader title={t("panel.library")} />
              <CatalogLibrary
                activePassives={character.classState?.huppermage?.activePassives ?? []}
                activeSublimations={character.sublimations}
                deckSpellLimit={deckSpellLimit}
                hiddenEntries={hiddenCatalogEntries}
                passives={passives}
                passiveLimit={passiveLimit}
                showHiddenEntries={showHiddenCatalogEntries}
                spells={spells}
                temporaryUnlockedSpellElement={temporaryUnlockedSpellElement}
                usedSpellIds={usedSpellIds}
                onDragSpell={startSpellDrag}
                onDragEnd={finishCatalogDrag}
                onHoverEntry={setHoveredCatalogEntryId}
                onSelectEntry={selectCatalogEntry}
                onShowHiddenEntriesChange={setShowHiddenCatalogEntries}
                onToggleEntryHidden={toggleCatalogEntryHidden}
                onTogglePassive={togglePassive}
                onChangeSublimations={changeBuilderSublimations}
              />
            </aside>
          ) : null}
      </section>
      </main>
    </>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

type AdditiveStatKey = Exclude<keyof BaseStats, "elementalMastery" | "level">;

const additiveStatKeys: AdditiveStatKey[] = [
  "hitPoints",
  "hitPointsPercent",
  "generalMastery",
  "meleeMastery",
  "distanceMastery",
  "berserkMastery",
  "rearMastery",
  "criticalMastery",
  "healingMastery",
  "damageInflictedPercent",
  "healsPerformedPercent",
  "healsReceivedPercent",
  "armorReceivedPercent",
  "armorGivenPercent",
  "elementalResistance",
  "rearResistance",
  "criticalResistance",
  "range",
  "willpower",
  "criticalHitPercent",
  "parry",
  "lock",
  "dodge",
  "initiative",
  "indirectDamagePercent",
];

function createEmptyEquipmentStats(): BaseStats {
  return {
    level: 0,
    hitPoints: 0,
    hitPointsPercent: 0,
    generalMastery: 0,
    elementalMastery: {
      fire: 0,
      water: 0,
      earth: 0,
      air: 0,
      light: 0,
      neutral: 0,
    },
    meleeMastery: 0,
    distanceMastery: 0,
    berserkMastery: 0,
    rearMastery: 0,
    criticalMastery: 0,
    healingMastery: 0,
    damageInflictedPercent: 0,
    healsPerformedPercent: 0,
    healsReceivedPercent: 0,
    armorReceivedPercent: 0,
    armorGivenPercent: 0,
    elementalResistance: 0,
    rearResistance: 0,
    criticalResistance: 0,
    range: 0,
    willpower: 0,
    criticalHitPercent: 0,
    parry: 0,
    lock: 0,
    dodge: 0,
    initiative: 0,
    indirectDamagePercent: 0,
  };
}

function createDefaultEquipmentCharacter(): SimulatedCharacter {
  return {
    ...createDefaultCharacter(),
    resources: createResources({ ap: 6, mp: 3, wp: 0, bq: 0 }),
    stats: {
      ...createEmptyEquipmentStats(),
      generalMastery: 1000,
    },
  };
}

function createDefaultEquipmentExtraStats(): EquipmentExtraStats {
  return {
    barrier: 0,
    equipmentKnowledge: 0,
    leadership: 0,
    lockDodge: 0,
    prospection: 0,
    wisdom: 0,
  };
}

function createCharacterFromBuild(
  characterConfig: SimulatedCharacter,
  aptitudeDistribution: AptitudeDistribution,
  equipmentCharacter: SimulatedCharacter,
): SimulatedCharacter {
  const aptitudeStats = computeAptitudeStats(aptitudeDistribution);
  const stats: BaseStats = {
    ...aptitudeStats.stats,
    elementalMastery: {
      fire: aptitudeStats.stats.elementalMastery.fire + equipmentCharacter.stats.elementalMastery.fire,
      water: aptitudeStats.stats.elementalMastery.water + equipmentCharacter.stats.elementalMastery.water,
      earth: aptitudeStats.stats.elementalMastery.earth + equipmentCharacter.stats.elementalMastery.earth,
      air: aptitudeStats.stats.elementalMastery.air + equipmentCharacter.stats.elementalMastery.air,
      light: aptitudeStats.stats.elementalMastery.light + equipmentCharacter.stats.elementalMastery.light,
      neutral: aptitudeStats.stats.elementalMastery.neutral + equipmentCharacter.stats.elementalMastery.neutral,
    },
  };

  for (const key of additiveStatKeys) {
    stats[key] = aptitudeStats.stats[key] + equipmentCharacter.stats[key];
  }

  return syncHuppermageBqFromWp({
    ...characterConfig,
    resources: createHuppermageBuildResources(aptitudeStats.resources, equipmentCharacter.resources),
    stats,
  });
}

function writeDragPayload(event: React.DragEvent, payload: DragPayload) {
  const serializedPayload = JSON.stringify(payload);
  event.dataTransfer.setData(dragPayloadType, serializedPayload);
  event.dataTransfer.setData("text/plain", serializedPayload);
}

function readDragPayload(event: React.DragEvent): DragPayload | null {
  const payload = event.dataTransfer.getData(dragPayloadType) || event.dataTransfer.getData("text/plain");
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as DragPayload;
    if (parsed.type === "spell" && parsed.spellId) {
      return parsed;
    }
    if (parsed.type === "timelineAction" && parsed.uid) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function createTimelineAction(spellId: string): TimelineAction {
  return {
    uid: crypto.randomUUID(),
    spellId,
    target: defaultActionTarget,
    context: defaultActionContext,
  };
}

function createDefaultTimeline(): TimelineAction[] {
  return [
    createTimelineAction("lueur-de-laube"),
    createTimelineAction("coeur-de-lumiere"),
    createTimelineAction("rayon-crepusculaire"),
  ];
}

function createTimelineActionFromAction(action: Action): TimelineAction {
  return {
    target: defaultActionTarget,
    context: defaultActionContext,
    ...action,
    uid: crypto.randomUUID(),
  };
}

function createEquipmentCharacterFromFinalCharacter(
  finalCharacter: SimulatedCharacter,
  aptitudeDistribution: AptitudeDistribution,
): SimulatedCharacter {
  const aptitudeStats = computeAptitudeStats(aptitudeDistribution);
  const stats: BaseStats = {
    ...finalCharacter.stats,
    elementalMastery: {
      fire: finalCharacter.stats.elementalMastery.fire - aptitudeStats.stats.elementalMastery.fire,
      water: finalCharacter.stats.elementalMastery.water - aptitudeStats.stats.elementalMastery.water,
      earth: finalCharacter.stats.elementalMastery.earth - aptitudeStats.stats.elementalMastery.earth,
      air: finalCharacter.stats.elementalMastery.air - aptitudeStats.stats.elementalMastery.air,
      light: finalCharacter.stats.elementalMastery.light - aptitudeStats.stats.elementalMastery.light,
      neutral: finalCharacter.stats.elementalMastery.neutral - aptitudeStats.stats.elementalMastery.neutral,
    },
  };

  for (const key of additiveStatKeys) {
    stats[key] = finalCharacter.stats[key] - aptitudeStats.stats[key];
  }

  return {
    ...createDefaultEquipmentCharacter(),
    resources: createResources({
      ap: finalCharacter.resources.ap - aptitudeStats.resources.ap,
      mp: finalCharacter.resources.mp - aptitudeStats.resources.mp,
      wp: finalCharacter.resources.wp - aptitudeStats.resources.wp,
      bq: 0,
    }),
    stats,
  };
}

function createMemoryStorageFallback() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

function getSnapshotIndexForAction(turnIndex: number, actionIndex: number, snapshots: TimelineSnapshot[]): number {
  const snapshotIndex = snapshots.findIndex((snapshot) => snapshot.turnIndex === turnIndex && snapshot.actionIndex === actionIndex);
  return snapshotIndex >= 0 ? snapshotIndex : Math.max(0, snapshots.length - 1);
}

function getFirstSnapshotIndexForTurn(turnIndex: number, snapshots: TimelineSnapshot[]): number {
  if (turnIndex === 0) {
    return 0;
  }

  const snapshotIndex = snapshots.findIndex((snapshot) => snapshot.turnIndex === turnIndex);
  return snapshotIndex >= 0 ? snapshotIndex : Math.max(0, snapshots.length - 1);
}

function getPlannedSnapshotIndexForAction(turns: TimelineAction[][], turnIndex: number, actionIndex: number): number {
  const previousActionCount = turns
    .slice(0, turnIndex)
    .reduce((total, turn) => total + turn.length, 0);
  return previousActionCount + actionIndex + 1;
}

function getTurnUids(turns: TimelineAction[][], turnIndex: number): string[] {
  return (turns[turnIndex] ?? []).map((action) => action.uid);
}

function findTimelineActionLocation(
  turns: TimelineAction[][],
  uid: string,
): { actionIndex: number; turnIndex: number } | null {
  for (const [turnIndex, turn] of turns.entries()) {
    const actionIndex = turn.findIndex((action) => action.uid === uid);
    if (actionIndex >= 0) {
      return { actionIndex, turnIndex };
    }
  }

  return null;
}

function getTimelineDropPreviewSpellId(intent: TimelineDropIntent | null, turns: TimelineAction[][]): string | null {
  if (!intent) {
    return null;
  }

  if (intent.kind === "insertSpell") {
    return intent.spellId;
  }

  const sourceLocation = findTimelineActionLocation(turns, intent.uid);
  return sourceLocation
    ? turns[sourceLocation.turnIndex]?.[sourceLocation.actionIndex]?.spellId ?? null
    : null;
}

function getTimelineLaneBounds(turnStack: HTMLDivElement | null): DOMRect[] {
  return Array.from(turnStack?.querySelectorAll<HTMLElement>(".turn-row .sequence-rack") ?? [])
    .map((element) => element.getBoundingClientRect());
}

function getBuilderBackLabel(route: ResearchRoute): string {
  switch (route.returnTo?.page) {
    case "setup":
      return "Retour au set";
    case "optimizer":
      return "Retour à l'optimizer";
    case "optimizerRun":
      return "Retour au run";
    case "savedCombos":
      return "Retour aux comparaisons";
    case "build":
      return "Retour au build";
    case "library":
      return "Retour aux builds";
    default:
      return "Retour";
  }
}

function areSublimationBuildsEqual(left: SublimationBuild | undefined, right: SublimationBuild | undefined): boolean {
  return createSublimationBuildComparisonKey(left) === createSublimationBuildComparisonKey(right);
}

function createSublimationBuildComparisonKey(build: SublimationBuild | undefined): string {
  return JSON.stringify({
    contactEnemiesAssumption: build?.contactEnemiesAssumption ?? null,
    hpAssumption: build?.hpAssumption ?? null,
    nearbyAlliesAssumption: build?.nearbyAlliesAssumption ?? null,
    selections: [...(build?.selections ?? [])]
      .map((selection) => selection.sublimationId)
      .sort(),
  });
}

function PanelHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="panel-header">
      <div className="panel-header-title">
        <h2>{title}</h2>
        {subtitle ? <span className="panel-header-subtitle">{subtitle}</span> : null}
      </div>
      {actions ? <div className="panel-header-actions">{actions}</div> : null}
    </div>
  );
}

function AppHeader({
  locale,
  onChangeLocale,
  onOpenLibrary,
}: {
  locale: UiLocale;
  onChangeLocale: (locale: UiLocale) => void;
  onOpenLibrary?: () => void;
}) {
  return (
    <header className="app-header" aria-label={t("app.title")}>
      <div className="project-brand">
        <strong>{t("app.projectName")}</strong>
      </div>
      <div className="app-header-actions">
        {onOpenLibrary ? (
          <button className="secondary-button" type="button" onClick={onOpenLibrary}>
            Laboratoire
          </button>
        ) : null}
        <LanguageSelector locale={locale} onChange={onChangeLocale} />
      </div>
    </header>
  );
}

function LanguageSelector({ locale, onChange }: { locale: UiLocale; onChange: (locale: UiLocale) => void }) {
  return (
    <label className="language-select" title={t("language.label")}>
      <select
        aria-label={t("language.label")}
        value={locale}
        onChange={(event) => onChange(event.target.value as UiLocale)}
      >
        {supportedLocales.map((option) => (
          <option key={option.locale} value={option.locale}>
            {option.flag} {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CenterTabs({ onChange, value }: { onChange: (tab: CenterTabId) => void; value: CenterTabId }) {
  const tabs: Array<{ id: CenterTabId; label: string }> = [
    { id: "combos", label: t("panel.combosTab") },
    { id: "aptitudes", label: t("panel.aptitudesTab") },
    { id: "equipment", label: t("panel.equipmentTab") },
  ];

  return (
    <div className="center-tabs" role="tablist" aria-label={t("panel.sequenceDetails")}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          aria-selected={value === tab.id}
          className={value === tab.id ? "active" : ""}
          role="tab"
          type="button"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ResourceStrip({ className = "huppermage", resources }: { className?: string; resources: SimulatedCharacter["resources"] }) {
  return (
    <div className="resource-strip" aria-label={t("resources.current")}>
      {getCombatResourceOptions(className).map((resource) => (
        <span
          key={resource}
          className={`resource-chip resource-${resource}`}
          title={formatUiMessage("resources.currentTitle", { resource: formatResourceLabel(resource) })}
        >
          <StatIcon src={getResourceIconSrc(resource)} label={formatResourceLabel(resource)} />
          {resources[resource]}
        </span>
      ))}
    </div>
  );
}

function StatIcon({ label, src }: { label: string; src: string }) {
  return <img className="stat-icon" src={src} alt="" title={label} draggable={false} />;
}

function SelectionDetail({
  action,
  actionIndex,
  actionResult,
  entry,
  onAddSpell,
  onDuplicateAction,
  onRemoveAction,
  snapshot,
}: {
  action: TimelineAction | undefined;
  actionIndex: number | null;
  actionResult: ActionResult | undefined;
  entry: CatalogEntry | undefined;
  onAddSpell: (spellId: string) => void;
  onDuplicateAction: (() => void) | undefined;
  onRemoveAction: (() => void) | undefined;
  snapshot: TimelineSnapshot;
}) {
  const huppermage = snapshot.classState.huppermage;
  const damageEffects = actionResult?.appliedEffects.filter((effect) => effect.type === "damage") ?? [];
  const selectedElement = entry ? entryPrimaryElement(entry) : undefined;

  return (
    <div className="detail-stack">
      <section className="detail-hero">
        {entry ? (
          <>
            <EntryIcon entryId={entry.id} label={entry.name} />
            <div className="detail-title">
              <span>
                <ElementIcon element={selectedElement} />
                {entry.kind === "passive" ? t("detail.passive") : action ? `${t("detail.action")} ${actionIndex !== null ? actionIndex + 1 : ""}` : t("detail.spell")}
              </span>
              <h3>{entry.name}</h3>
            </div>
            <div className="detail-actions">
              {entry.kind !== "passive" ? (
                <button className="primary-button" type="button" onClick={() => onAddSpell(entry.id)}>
                  <Plus size={15} />
                  {t("action.add")}
                </button>
              ) : null}
              {onDuplicateAction ? (
                <IconButton label={t("action.duplicate")} onClick={onDuplicateAction}>
                  <Copy size={15} />
                </IconButton>
              ) : null}
              {onRemoveAction ? (
                <IconButton label={t("action.remove")} onClick={onRemoveAction}>
                  <Trash2 size={15} />
                </IconButton>
              ) : null}
            </div>
          </>
        ) : (
          <p className="muted">{t("detail.emptySelection")}</p>
        )}
      </section>

      <section className="detail-metrics" aria-label={t("detail.stepSummary")}>
        <span title={t("detail.turnDamageTitle")}><b>{snapshot.totalDamageSoFar}</b> {t("metric.turn")}</span>
        <span title={t("detail.actionDamageTitle")}><b>{actionResult?.damage ?? 0}</b> {t("metric.action")}</span>
        <span title={t("detail.spellCountTitle")}><b>{action ? snapshot.index : 0}</b> {t("metric.step")}</span>
      </section>

      <section className="detail-section">
        <h3>{t("detail.state")}</h3>
        <ResourceStrip resources={snapshot.resources} />
        <RuneStrip huppermage={huppermage} resources={snapshot.resources} />
      </section>

      {entry ? (
        <section className="detail-section catalog-detail-summary">
          <h3>{t("tooltip.summary")}</h3>
          <div className="spell-info-meta">
            <CatalogMetaLine label={t("tooltip.cost")} tokens={getCatalogCostTokens(entry)} />
            <CatalogMetaLine label={t("tooltip.range")} tokens={getCatalogRangeTokens(entry)} />
          </div>
        </section>
      ) : null}

      {entry ? <CatalogEntryInfoSections entry={entry} /> : null}

      {actionResult && actionResult.appliedEffects.length > 0 ? (
        <section className="detail-section">
          <h3>{t("inspector.appliedEffects")}</h3>
          <ul className="compact-effect-list">
            {actionResult.appliedEffects.slice(0, 8).map((effect, index) => (
              <li key={`${effect.type}-${index}`} title={describeEffect(effect)}>
                {effect.type === "damage" ? <ElementIcon element={effect.element} /> : <span className="effect-icon-spacer" aria-hidden="true" />}
                <span className="effect-label">{describeEffect(effect)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {damageEffects.length > 0 ? (
        <section className="detail-section">
          <h3>{t("detail.formula")}</h3>
          <div className="formula-mini-list">
            {damageEffects.map((effect, index) => (
              <div
                key={`${effect.element}-${index}`}
                className="formula-mini"
                title={formatUiMessage("formula.miniTitle", {
                  baseDamage: effect.formula.baseDamage,
                  times: effect.formula.times,
                  masteryMultiplier: effect.formula.masteryMultiplier,
                  finalMultiplier: effect.formula.finalMultiplier,
                  criticalHit: effect.formula.effectiveCriticalHitPercent,
                })}
              >
                <ElementIcon element={effect.element} />
                <span>{effect.formula.baseDamage} x {effect.formula.times}</span>
                <b>{effect.amount}</b>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function RuneStrip({
  huppermage,
  resources,
  showFeuFollets = true,
}: {
  huppermage: TimelineSnapshot["classState"]["huppermage"];
  resources?: TimelineSnapshot["resources"];
  showFeuFollets?: boolean;
}) {
  const bqPercent = huppermage?.bqMax && huppermage.bqMax > 0
    ? clamp((resources?.bq ?? 0) / huppermage.bqMax, 0, 1)
    : 0;

  return (
    <div className="rune-strip" aria-label={t("runes.huppermage")}>
      {runeOptions.map((rune) => {
        const active = huppermage?.runes.active[rune] ?? false;
        const isLast = huppermage?.runes.lastGeneratedRune === rune;
        const element = runeToElement[rune];
        return (
          <HuppermageRuneAura
            active={active}
            activeHeart={huppermage?.activeHeart}
            bqPercent={bqPercent}
            className={`rune-chip ${isLast ? "last" : ""}`}
            element={element}
            key={rune}
            title={formatUiMessage("runes.activeTitle", {
              rune: formatRuneLabel(rune),
              state: active ? t("runes.active") : t("runes.inactive"),
              last: isLast ? ` - ${t("runes.last")}` : "",
            })}
          >
            <img
              className="huppermage-rune-aura-icon"
              alt=""
              src={getRuneIconSrc(rune)}
              style={{
                height: "calc(var(--rune-aura-size) * 0.7)",
                maxHeight: "100%",
                maxWidth: "100%",
                objectFit: "contain",
                width: "calc(var(--rune-aura-size) * 0.7)",
              }}
            />
          </HuppermageRuneAura>
        );
      })}
      {showFeuFollets ? (
        <span className="rune-meta" title={t("runes.feuFolletsTitle")}>FF {huppermage?.feuFolletsActive ?? 0}</span>
      ) : null}
    </div>
  );
}

function ElementIcon({ element }: { element: Element | undefined }) {
  return (
    <span
      className={`element-icon element-${element ?? "none"}`}
      title={element ? formatElementLabel(element) : t("element.none")}
      aria-label={element ? formatElementLabel(element) : t("element.none")}
    />
  );
}

function CostPills({ entry }: { entry: CatalogEntry }) {
  const costParts = Object.entries(entry.cost ?? {})
    .filter(([, value]) => value && value > 0);

  if (costParts.length === 0) {
    return <span className="cost-pills" title={t("cost.none")}><span>0</span></span>;
  }

  return (
    <span className="cost-pills" title={describeSpellCost(entry)}>
      {costParts.map(([resource, value]) => (
        <span key={resource} className={`cost-pill cost-${resource}`}>
          <StatIcon src={getResourceIconSrc(resource as Resource)} label={formatResourceLabel(resource as Resource)} />
          {value}
        </span>
      ))}
    </span>
  );
}

function CatalogLibrary({
  activePassives,
  activeSublimations,
  deckSpellLimit,
  hiddenEntries,
  passives,
  passiveLimit,
  showHiddenEntries,
  spells,
  temporaryUnlockedSpellElement,
  usedSpellIds,
  onDragEnd,
  onDragSpell,
  onHoverEntry,
  onSelectEntry,
  onShowHiddenEntriesChange,
  onToggleEntryHidden,
  onTogglePassive,
  onChangeSublimations,
}: {
  activePassives: string[];
  activeSublimations: SublimationBuild | undefined;
  deckSpellLimit: number;
  hiddenEntries: HiddenCatalogEntryState;
  passives: CatalogEntry[];
  passiveLimit: number;
  showHiddenEntries: boolean;
  spells: CatalogEntry[];
  temporaryUnlockedSpellElement: Element | null;
  usedSpellIds: string[];
  onDragEnd: () => void;
  onDragSpell: (event: React.DragEvent, spellId: string) => void;
  onHoverEntry: (entryId: string | null) => void;
  onSelectEntry: (entryId: string) => void;
  onShowHiddenEntriesChange: (showHiddenEntries: boolean) => void;
  onToggleEntryHidden: (entry: CatalogEntry) => void;
  onTogglePassive: (passiveId: string, active: boolean) => void;
  onChangeSublimations: (sublimations: SublimationBuild) => void;
}) {
  const [spellSearch, setSpellSearch] = useState("");
  const visibleSpells = getVisibleCatalogEntries(spells, hiddenEntries, showHiddenEntries)
    .filter((spell) => catalogSearchMatches(spell, spellSearch));
  const activePassiveRank = new Map(activePassives.map((passiveId, index) => [passiveId, index]));
  const visiblePassives = getVisibleCatalogEntries(passives, hiddenEntries, showHiddenEntries)
    .filter((passive) => catalogSearchMatches(passive, spellSearch))
    .sort((left, right) => {
      const leftActive = activePassiveRank.has(left.id);
      const rightActive = activePassiveRank.has(right.id);
      if (leftActive && rightActive) {
        return (activePassiveRank.get(left.id) ?? 0) - (activePassiveRank.get(right.id) ?? 0);
      }

      return Number(rightActive) - Number(leftActive);
  });
  const hiddenCount = countHiddenCatalogEntries(hiddenEntries);
  const usedDeckSpellIds = usedSpellIds.filter((spellId) => {
    const spell = spells.find((entry) => entry.id === spellId);
    return spell ? isDeckTrackedCatalogSpell(spell) : true;
  });
  const usedSpellCount = usedDeckSpellIds.length;
  const deckFull = usedSpellCount >= deckSpellLimit;
  const activePassiveCount = activePassives.length;
  const activeSublimationSelections = activeSublimations?.selections ?? [];
  const activeSublimationCount = activeSublimationSelections.length;
  const activeSublimationRank = new Map(activeSublimationSelections.map((selection, index) => [selection.sublimationId, index]));
  const activeSublimationCountsById = countSublimationSelectionsById(activeSublimationSelections);
  const selectedSublimationIds = new Set(activeSublimationSelections.map((selection) => selection.sublimationId));
  const selectedSublimationEntries = activeSublimationSelections
    .map((selection) => findSublimation(selection.sublimationId))
    .filter((sublimation): sublimation is SublimationCatalogEntry => Boolean(sublimation));
  const selectedSublimationCategoryCounts = countSublimationCategories(selectedSublimationEntries);
  const selectedSublimationFamilyLevels = countSublimationFamilyLevels(selectedSublimationEntries);
  const visibleSublimations = sublimationCatalog
    .filter((sublimation) => sublimationSearchMatches(sublimation, spellSearch))
    .sort((left, right) => compareSublimationCatalogEntries(
      left,
      right,
      selectedSublimationIds,
      activeSublimationRank,
      selectedSublimationCategoryCounts,
      selectedSublimationFamilyLevels,
    ));
  const sublimationValidation = validateSublimationBuild(activeSublimations);
  const [catalogTooltip, setCatalogTooltip] = useState<{ entry: CatalogEntry; left: number; top: number } | null>(null);
  const [sublimationTooltip, setSublimationTooltip] = useState<{ item: SublimationPreviewItem; left: number; top: number } | null>(null);
  const catalogTooltipSuppressedRef = useRef(false);

  useEffect(() => {
    function releaseCatalogTooltip() {
      catalogTooltipSuppressedRef.current = false;
    }

    window.addEventListener("blur", releaseCatalogTooltip);
    window.addEventListener("dragend", releaseCatalogTooltip);
    window.addEventListener("pointerup", releaseCatalogTooltip);

    return () => {
      window.removeEventListener("blur", releaseCatalogTooltip);
      window.removeEventListener("dragend", releaseCatalogTooltip);
      window.removeEventListener("pointerup", releaseCatalogTooltip);
    };
  }, []);

  function showCatalogTooltip(event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>, entry: CatalogEntry) {
    if (catalogTooltipSuppressedRef.current) {
      return;
    }

    const { left, top } = getLibraryTooltipPlacement(event.currentTarget);
    setCatalogTooltip({ entry, left, top });
  }

  function showSublimationTooltip(event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>, item: SublimationPreviewItem) {
    const { left, top } = getLibraryTooltipPlacement(event.currentTarget);
    setSublimationTooltip({ item, left, top });
  }

  function getLibraryTooltipPlacement(target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const tooltipWidth = 340;
    const preferredLeft = rect.left - tooltipWidth - 14;
    const fallbackLeft = rect.right + 14;
    const left = preferredLeft >= 12 ? preferredLeft : Math.min(window.innerWidth - tooltipWidth - 12, fallbackLeft);
    const top = clamp(rect.top + rect.height / 2, 160, window.innerHeight - 24);
    return { left: Math.max(12, left), top };
  }

  function hideSublimationTooltip() {
    setSublimationTooltip(null);
  }

  function hideCatalogTooltip() {
    setCatalogTooltip(null);
  }

  function hideLibraryTooltips() {
    hideCatalogTooltip();
    hideSublimationTooltip();
  }

  function suppressCatalogTooltip() {
    catalogTooltipSuppressedRef.current = true;
    hideLibraryTooltips();
    onHoverEntry(null);
  }

  function releaseCatalogTooltip() {
    catalogTooltipSuppressedRef.current = false;
    hideLibraryTooltips();
    onHoverEntry(null);
  }

  function startCatalogSpellDrag(event: React.DragEvent, spellId: string, deckUnavailable: boolean) {
    if (deckUnavailable) {
      event.preventDefault();
      return;
    }

    suppressCatalogTooltip();
    onDragSpell(event, spellId);
  }

  function finishCatalogSpellDrag() {
    releaseCatalogTooltip();
    onDragEnd();
  }

  function changeSublimationCount(sublimationId: string, delta: number) {
    hideSublimationTooltip();
    const selections = activeSublimations?.selections ?? [];
    const nextSublimations: SublimationBuild = {
      selections: delta > 0
        ? [...selections, { sublimationId }]
        : removeFirstSublimationSelection(selections, sublimationId),
      hpAssumption: activeSublimations?.hpAssumption ?? "normal",
      nearbyAlliesAssumption: activeSublimations?.nearbyAlliesAssumption ?? "unspecified",
      contactEnemiesAssumption: activeSublimations?.contactEnemiesAssumption ?? "unspecified",
    };

    onChangeSublimations(nextSublimations);
  }

  return (
    <div className="catalog-library">
      <div className="catalog-library-toolbar">
        <CatalogSearchField
          label={t("library.searchSpells")}
          value={spellSearch}
          onChange={setSpellSearch}
        />
        <IconButton
          className={`catalog-show-hidden ${showHiddenEntries && hiddenCount > 0 ? "active" : ""}`}
          disabled={hiddenCount === 0}
          label={showHiddenEntries && hiddenCount > 0 ? t("library.hideHidden") : t("library.showHidden")}
          onClick={() => onShowHiddenEntriesChange(!showHiddenEntries)}
        >
          <Eye size={15} />
          {hiddenCount > 0 ? <span>{hiddenCount}</span> : null}
        </IconButton>
      </div>
      <section>
        <div className="catalog-section-header">
          <h3>{t("library.spells")}</h3>
          <div className={`catalog-counter catalog-counter-compact ${deckFull ? "full" : ""}`}>
            <span>{formatUiMessage("deck.spellRatio", { used: usedSpellCount, limit: deckSpellLimit })}</span>
            {temporaryUnlockedSpellElement ? (
              <span>
                <ElementIcon element={temporaryUnlockedSpellElement} />
                {formatUiMessage("deck.temporary", { element: formatElementLabel(temporaryUnlockedSpellElement) })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="spell-library">
          {visibleSpells.map((spell) => {
            const hidden = isCatalogEntryHidden(hiddenEntries, spell);
            const deckTracked = isDeckTrackedCatalogSpell(spell);
            const inDeck = usedDeckSpellIds.includes(spell.id);
            const temporaryAvailable = temporaryUnlockedSpellElement !== null && spell.element === temporaryUnlockedSpellElement;
            const deckUnavailable = deckTracked && deckFull && !inDeck && !temporaryAvailable;
            return (
              <div key={spell.id} className={`library-spell-slot ${hidden ? "library-entry-hidden" : ""} ${deckUnavailable ? "library-entry-disabled" : ""} ${temporaryAvailable ? "library-entry-temporary" : ""}`}>
                <button
                  className="library-spell"
                  disabled={deckUnavailable}
                  draggable={!hidden && !deckUnavailable}
                  type="button"
                  title={deckUnavailable ? t("deck.unavailableTitle") : temporaryAvailable ? formatUiMessage("deck.temporaryTitle", { element: formatElementLabel(temporaryUnlockedSpellElement) }) : spell.name}
                  onClick={() => {
                    releaseCatalogTooltip();
                    onSelectEntry(spell.id);
                  }}
                  onDragEnd={finishCatalogSpellDrag}
                  onDragStart={(event) => startCatalogSpellDrag(event, spell.id, deckUnavailable)}
                  onMouseDown={suppressCatalogTooltip}
                  onMouseUp={releaseCatalogTooltip}
                  onPointerCancel={releaseCatalogTooltip}
                  onPointerDown={suppressCatalogTooltip}
                  onPointerUp={releaseCatalogTooltip}
                  onMouseEnter={(event) => {
                    onHoverEntry(spell.id);
                    showCatalogTooltip(event, spell);
                  }}
                  onMouseLeave={() => {
                    onHoverEntry(null);
                    hideCatalogTooltip();
                  }}
                  onMouseMove={(event) => showCatalogTooltip(event, spell)}
                  onFocus={(event) => {
                    onHoverEntry(spell.id);
                    showCatalogTooltip(event, spell);
                  }}
                  onBlur={() => {
                    onHoverEntry(null);
                    hideCatalogTooltip();
                  }}
                >
                  <EntryIcon entryId={spell.id} label={spell.name} />
                  <ElementIcon element={entryPrimaryElement(spell)} />
                </button>
                <IconButton
                  className="catalog-entry-visibility"
                  label={hidden ? t("library.showEntry") : t("library.hideEntry")}
                  onClick={() => onToggleEntryHidden(spell)}
                >
                  {hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                </IconButton>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="catalog-section-header">
          <h3>{t("library.passives")}</h3>
          <div className={`catalog-counter catalog-counter-compact ${activePassiveCount >= passiveLimit ? "full" : ""}`}>
            <span>{formatUiMessage("passive.ratio", { used: activePassiveCount, limit: passiveLimit })}</span>
          </div>
        </div>
        <div className="passive-library">
          {visiblePassives.map((passive) => {
            const active = activePassives.includes(passive.id);
            const hidden = isCatalogEntryHidden(hiddenEntries, passive);
            const passiveDisabled = !active && activePassiveCount >= passiveLimit;
            return (
              <div
                key={passive.id}
                className={`library-passive ${active ? "active" : ""} ${hidden ? "library-entry-hidden" : ""} ${passiveDisabled ? "library-entry-disabled" : ""}`}
                title={passiveDisabled ? t("passive.limitReached") : undefined}
                onFocus={(event) => {
                  onHoverEntry(passive.id);
                  showCatalogTooltip(event, passive);
                }}
                onBlur={() => {
                  onHoverEntry(null);
                  hideCatalogTooltip();
                }}
                onMouseEnter={(event) => {
                  onHoverEntry(passive.id);
                  showCatalogTooltip(event, passive);
                }}
                onMouseLeave={() => {
                  onHoverEntry(null);
                  hideCatalogTooltip();
                }}
                onMouseMove={(event) => showCatalogTooltip(event, passive)}
              >
                <label className="library-passive-choice">
                  <input
                    type="checkbox"
                    checked={active}
                    disabled={passiveDisabled}
                    onChange={(event) => onTogglePassive(passive.id, event.target.checked)}
                  />
                  <EntryIcon entryId={passive.id} label={passive.name} />
                  <span>
                    <strong>{passive.name}</strong>
                    <small>{summarizeEntryTags(passive)}</small>
                  </span>
                </label>
                <IconButton
                  className="catalog-entry-visibility"
                  label={hidden ? t("library.showEntry") : t("library.hideEntry")}
                  onClick={() => onToggleEntryHidden(passive)}
                >
                  {hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                </IconButton>
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <div className="catalog-section-header">
          <h3>Sublimations</h3>
          <div className={`catalog-counter catalog-counter-compact ${activeSublimationCount >= 12 ? "full" : ""}`}>
            <span>{activeSublimationCount}/12</span>
          </div>
        </div>
        {sublimationValidation.violations.length > 0 ? (
          <ul className="library-sublimation-violations">
            {sublimationValidation.violations.map((violation, index) => <li key={`${violation.type}-${index}`}>{violation.message}</li>)}
          </ul>
        ) : null}
        <div className="library-sublimation-list">
          {visibleSublimations.map((sublimation) => {
            const selected = selectedSublimationIds.has(sublimation.id);
            const selectedCount = activeSublimationCountsById.get(sublimation.id) ?? 0;
            const disabledReason = getSublimationSelectionDisabledReason(
              sublimation,
              selectedSublimationCategoryCounts,
              selectedSublimationFamilyLevels,
            );
            return (
              <SublimationCatalogChoice
                disabledReason={disabledReason}
                key={sublimation.id}
                selected={selected}
                selectedCount={selectedCount}
                sublimation={sublimation}
                onHideTooltip={hideSublimationTooltip}
                onShowTooltip={showSublimationTooltip}
                onDecrement={() => changeSublimationCount(sublimation.id, -1)}
                onIncrement={() => changeSublimationCount(sublimation.id, 1)}
              />
            );
          })}
          {visibleSublimations.length === 0 ? <span className="setup-detail-empty">Aucune sublimation trouvée</span> : null}
        </div>
      </section>
      {catalogTooltip ? (
        <CatalogInfoTooltip
          entry={catalogTooltip.entry}
          style={{ left: catalogTooltip.left, top: catalogTooltip.top }}
        />
      ) : null}
      {sublimationTooltip ? (
        <BuilderSublimationTooltip
          item={sublimationTooltip.item}
          style={{ left: sublimationTooltip.left, top: sublimationTooltip.top }}
        />
      ) : null}
    </div>
  );
}

function BuilderSublimationMiniCard({ item }: { item: SublimationPreviewItem }) {
  return (
    <div className={`sublimation-preview-card sublimation-preview-${item.category} sublimation-preview-tone-${item.tone}`} tabIndex={0}>
      {item.iconSrc ? (
        <img className="sublimation-preview-icon" src={item.iconSrc} alt="" draggable={false} />
      ) : (
        <span className="sublimation-preview-icon sublimation-preview-icon-fallback" aria-hidden="true">{item.name.slice(0, 1)}</span>
      )}
      <span className={`sublimation-preview-name sublimation-title-${item.tone}`}>{item.name}</span>
      <BuilderSublimationTooltip item={item} />
    </div>
  );
}

function SublimationCatalogChoice({
  disabledReason,
  onDecrement,
  onHideTooltip,
  onIncrement,
  onShowTooltip,
  selected,
  selectedCount,
  sublimation,
}: {
  disabledReason?: string;
  onDecrement: () => void;
  onHideTooltip: () => void;
  onIncrement: () => void;
  onShowTooltip: (event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>, item: SublimationPreviewItem) => void;
  selected: boolean;
  selectedCount: number;
  sublimation: SublimationCatalogEntry;
}) {
  const previewItem = createSublimationPreviewItem(sublimation);
  return (
    <div
      className={`library-sublimation-choice ${selected ? "selected" : ""} ${disabledReason ? "disabled" : ""}`}
      onBlur={onHideTooltip}
      onFocus={(event) => onShowTooltip(event, previewItem)}
      onMouseEnter={(event) => onShowTooltip(event, previewItem)}
      onMouseLeave={onHideTooltip}
      onMouseMove={(event) => onShowTooltip(event, previewItem)}
    >
      <div className="library-sublimation-row">
        <span className={`library-sublimation-icon library-sublimation-icon-${sublimation.category}`} aria-hidden="true">
          <SublimationCatalogIcon sublimation={sublimation} />
        </span>
        <span className="library-sublimation-main">
          <strong className={`sublimation-title-${previewItem.tone}`}>{sublimation.name}</strong>
          {disabledReason ? <small>{disabledReason}</small> : null}
        </span>
        <span className="library-sublimation-stepper">
          <IconButton
            className="library-sublimation-step"
            disabled={selectedCount === 0}
            label={`Retirer ${sublimation.name}`}
            onClick={onDecrement}
          >
            <Minus size={12} />
          </IconButton>
          <span className="library-sublimation-count" aria-label={`${selectedCount} sélection(s) de ${sublimation.name}`}>{selectedCount}</span>
          <IconButton
            className="library-sublimation-step"
            disabled={Boolean(disabledReason)}
            label={disabledReason ? `${sublimation.name} indisponible : ${disabledReason}` : `Ajouter ${sublimation.name}`}
            onClick={onIncrement}
          >
            <Plus size={12} />
          </IconButton>
        </span>
      </div>
    </div>
  );
}

function SublimationCatalogIcon({ sublimation }: { sublimation: SublimationCatalogEntry }) {
  const iconSrc = getWakfuliSublimationIconSrc(sublimation.id) ?? getWakfuliSublimationIconSrc(`${sublimation.familyId}-${sublimation.cumulativeMax}`);
  return iconSrc ? (
    <img src={iconSrc} alt="" title={sublimation.name} draggable={false} />
  ) : (
    <span>{sublimation.name.slice(0, 1)}</span>
  );
}

function BuilderSublimationTooltip({ item, style }: { item: SublimationPreviewItem; style?: React.CSSProperties }) {
  const effectLines = item.effectLines.length > 0 ? item.effectLines : item.sourceDescription ? [item.sourceDescription] : [];

  return (
    <aside className="spell-info-tooltip sublimation-info-tooltip" role="tooltip" style={style}>
      <div className="spell-info-header sublimation-info-header">
        <div>
          <span>Sublimation{item.displayLevel ? ` · niv. ${item.displayLevel}` : ""}</span>
          <strong className={`sublimation-title-${item.tone}`}>{item.name}</strong>
        </div>
      </div>
      <section className="spell-info-section">
        <h3>Effets</h3>
        <ul className="catalog-info-list">
          {effectLines.length > 0 ? effectLines.map((line) => (
            <li key={line}>{line}</li>
          )) : <li>Effet non renseigné dans Wakfu.Guide.</li>}
        </ul>
      </section>
      {item.supportReason ? (
        <section className="spell-info-section">
          <h3>Non supporté</h3>
          <ul className="catalog-info-list">
            <li>{item.supportReason}</li>
          </ul>
        </section>
      ) : null}
      {item.rawLevel !== item.effectiveLevel ? (
        <section className="spell-info-section">
          <h3>Cumul</h3>
          <ul className="catalog-info-list">
            <li>Niveau effectif {item.effectiveLevel}/{item.cumulativeMax} · brut {item.rawLevel}</li>
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

const sublimationSlotLimits: Record<SublimationCategory, number> = {
  normal: 10,
  epic: 1,
  relic: 1,
};

function createSublimationPreviewItem(sublimation: SublimationCatalogEntry): SublimationPreviewItem {
  return createSublimationPreviewItems({
    selections: [{ sublimationId: sublimation.id }],
    hpAssumption: "normal",
    nearbyAlliesAssumption: "unspecified",
    contactEnemiesAssumption: "unspecified",
  })[0] ?? {
    id: sublimation.id,
    name: sublimation.name,
    category: sublimation.category,
    tone: getSublimationPreviewTone(sublimation),
    iconSrc: getWakfuliSublimationIconSrc(sublimation.id) ?? getWakfuliSublimationIconSrc(`${sublimation.familyId}-${sublimation.cumulativeMax}`),
    displayLevel: sublimation.displayLevel,
    effectiveLevel: sublimation.level,
    rawLevel: sublimation.level,
    cumulativeMax: sublimation.cumulativeMax,
    effectLines: [],
    supportReason: sublimation.supportReason,
    socketPattern: sublimation.socketPattern,
    sourceDescription: sublimation.sourceDescription,
    sourceLocation: sublimation.sourceLocation,
  };
}

function compareSublimationCatalogEntries(
  left: SublimationCatalogEntry,
  right: SublimationCatalogEntry,
  selectedIds: Set<string>,
  selectedRank: Map<string, number>,
  categoryCounts: Record<SublimationCategory, number>,
  familyLevels: Map<string, number>,
): number {
  const leftSelected = selectedIds.has(left.id);
  const rightSelected = selectedIds.has(right.id);
  if (leftSelected || rightSelected) {
    if (leftSelected && rightSelected) {
      return (selectedRank.get(left.id) ?? 0) - (selectedRank.get(right.id) ?? 0);
    }

    return Number(rightSelected) - Number(leftSelected);
  }

  const leftUsable = !getSublimationSelectionDisabledReason(left, categoryCounts, familyLevels);
  const rightUsable = !getSublimationSelectionDisabledReason(right, categoryCounts, familyLevels);
  return Number(rightUsable) - Number(leftUsable);
}

function getSublimationSelectionDisabledReason(
  sublimation: SublimationCatalogEntry,
  categoryCounts: Record<SublimationCategory, number>,
  familyLevels: Map<string, number>,
): string | undefined {
  if (sublimation.supportStatus !== "supported") {
    return sublimation.supportReason ?? "Effet non supporté";
  }

  if (categoryCounts[sublimation.category] >= sublimationSlotLimits[sublimation.category]) {
    return "Slots pleins";
  }

  const currentLevel = familyLevels.get(sublimation.familyId) ?? 0;
  if (currentLevel >= sublimation.cumulativeMax) {
    return "Cumul maximal";
  }

  if (currentLevel + sublimation.level > sublimation.cumulativeMax) {
    return `Max ${sublimation.cumulativeMax}`;
  }

  return undefined;
}

function countSublimationSelectionsById(selections: SublimationBuild["selections"]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const selection of selections) {
    counts.set(selection.sublimationId, (counts.get(selection.sublimationId) ?? 0) + 1);
  }
  return counts;
}

function countSublimationCategories(entries: SublimationCatalogEntry[]): Record<SublimationCategory, number> {
  return entries.reduce<Record<SublimationCategory, number>>((counts, entry) => ({
    ...counts,
    [entry.category]: counts[entry.category] + 1,
  }), { normal: 0, epic: 0, relic: 0 });
}

function countSublimationFamilyLevels(entries: SublimationCatalogEntry[]): Map<string, number> {
  const levels = new Map<string, number>();
  for (const entry of entries) {
    levels.set(entry.familyId, (levels.get(entry.familyId) ?? 0) + entry.level);
  }
  return levels;
}

function removeFirstSublimationSelection(
  selections: SublimationBuild["selections"],
  sublimationId: string,
): SublimationBuild["selections"] {
  const removalIndex = selections.findIndex((selection) => selection.sublimationId === sublimationId);
  if (removalIndex < 0) {
    return [...selections];
  }

  return selections.filter((_, index) => index !== removalIndex);
}

function sublimationSearchMatches(sublimation: SublimationCatalogEntry, search: string): boolean {
  const query = normalizeCatalogSearchText(search);
  if (!query) {
    return true;
  }

  return [
    sublimation.name,
    sublimation.wakfuGuideName,
    sublimation.sourceDescription,
    sublimation.sourceLocation,
  ].some((value) => normalizeCatalogSearchText(value ?? "").includes(query));
}

function CatalogSearchField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="catalog-search">
      <span className="sr-only">{label}</span>
      <input
        aria-label={label}
        placeholder={label}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button
          aria-label={t("library.clearSearch")}
          className="catalog-search-clear"
          title={t("library.clearSearch")}
          type="button"
          onClick={() => onChange("")}
        >
          <X size={13} />
        </button>
      ) : null}
    </label>
  );
}

function CatalogInfoTooltip({ entry, style }: { entry: CatalogEntry; style: React.CSSProperties }) {
  const showSpellMeta = entry.kind === "spell";

  return (
    <aside className="spell-info-tooltip" style={style} role="tooltip">
      <div className="spell-info-header">
        <EntryIcon entryId={entry.id} label={entry.name} />
        <div>
          <span>{entry.kind === "passive" ? t("detail.passive") : `${t("detail.spell")} · niv. ${entry.level}`}</span>
          <strong>{entry.name}</strong>
        </div>
      </div>
      {showSpellMeta ? (
        <div className="spell-info-meta">
          <CatalogMetaLine label={t("tooltip.cost")} tokens={getCatalogCostTokens(entry)} />
          <CatalogMetaLine label={t("tooltip.range")} tokens={getCatalogRangeTokens(entry)} />
        </div>
      ) : null}
      <CatalogEntryInfoSections entry={entry} compact />
    </aside>
  );
}

function CatalogMetaLine({ label, tokens }: { label: string; tokens: Array<{ icon?: CatalogInfoIcon; text: string }> }) {
  return (
    <span className="catalog-meta-line">
      <b>{label}</b>
      <span className="catalog-meta-token-list">
        {tokens.map((token, index) => (
          <span key={`${token.text}-${index}`} className="catalog-meta-token">
            {token.icon ? <CatalogInfoIconImage icon={token.icon} /> : null}
            <span>{token.text}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

function CatalogEntryInfoSections({ compact = false, entry }: { compact?: boolean; entry: CatalogEntry }) {
  return (
    <>
      <section className={compact ? "spell-info-section" : "detail-section"}>
        <h3>{t("tooltip.effects")}</h3>
        <ul className="catalog-info-list">
          {entry.effects.map((effect, index) => {
            const line = describeCatalogEffectLine(effect);
            return (
              <CatalogInfoListItem
                key={`${effect.type}-${index}`}
                icons={line.icons}
                text={line.text}
              />
            );
          })}
        </ul>
      </section>
      {entry.constraints.length > 0 ? (
        <section className={compact ? "spell-info-section" : "detail-section"}>
          <h3>{t("tooltip.constraints")}</h3>
          <ul className="catalog-info-list">
            {entry.constraints.map((constraint, index) => (
              <li key={`${constraint.type}-${index}`}>{describeCatalogConstraint(constraint)}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {entry.tags.length > 0 ? (
        <section className={compact ? "spell-info-section" : "detail-section"}>
          <h3>{t("tooltip.tags")}</h3>
          <div className="catalog-tag-list">
            {entry.tags.map((tagName) => <span key={tagName}>{tagName}</span>)}
          </div>
        </section>
      ) : null}
    </>
  );
}

function CatalogInfoListItem({ icons, text }: { icons: CatalogInfoIcon[]; text: string }) {
  return (
    <li>
      {icons.length > 0 ? (
        <span className="catalog-line-icons">
          {icons.map((icon, index) => <CatalogInfoIconImage key={`${icon.label}-${icon.src}-${index}`} icon={icon} />)}
        </span>
      ) : (
        <span className="catalog-line-icons empty" aria-hidden="true" />
      )}
      <span className="catalog-line-text">{text}</span>
    </li>
  );
}

function CatalogInfoIconImage({ icon }: { icon: CatalogInfoIcon }) {
  return (
    <img
      className={`catalog-line-icon ${icon.tone ? `catalog-line-icon-${icon.tone}` : ""}`}
      src={icon.src}
      alt=""
      title={icon.label}
      aria-hidden="true"
    />
  );
}

function TimelineDropMarker({ active, entry }: { active: boolean; entry: CatalogEntry | undefined }) {
  return (
    <span className={`sequence-drop-marker ${active ? "active" : ""}`} aria-hidden="true">
      {active && entry ? (
        <span className="sequence-drop-preview">
          <EntryIcon entryId={entry.id} label={entry.name} />
        </span>
      ) : null}
    </span>
  );
}

function isTimelineDropMarkerActive(intent: TimelineDropIntent | null, index: number): boolean {
  if (!intent || intent.insertIndex !== index) {
    return false;
  }

  return intent.kind !== "moveAction" || !intent.isNoop;
}

function AptitudeDistributionEditor({
  distribution,
  onChange,
}: {
  distribution: AptitudeDistribution;
  onChange: (distribution: AptitudeDistribution) => void;
}) {
  const preview = useMemo(() => computeAptitudeStats(distribution), [distribution]);
  const serializedCode = useMemo(() => serializeAptitudeDistribution(distribution), [distribution]);
  const [draftCode, setDraftCode] = useState(serializedCode);
  const [codeMessage, setCodeMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    setDraftCode(serializedCode);
    setCodeMessage(null);
  }, [serializedCode]);

  function updateLevel(level: number) {
    onChange(setAptitudeLevel(distribution, level));
  }

  function updateRank(aptitudeId: number, rank: number) {
    onChange(setAptitudeRank(distribution, aptitudeId, rank));
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(serializedCode);
      setCodeMessage({ kind: "success", text: t("form.aptitudeCodeCopied") });
    } catch {
      setCodeMessage({ kind: "error", text: t("form.aptitudeCodeCopyFailed") });
    }
  }

  function importCode(code: string) {
    const result = parseAptitudeDistributionCode(code, distribution);
    if (result.ok) {
      onChange(result.distribution);
      setDraftCode(serializeAptitudeDistribution(result.distribution));
      setCodeMessage({ kind: "success", text: t("form.aptitudeCodeImported") });
      return;
    }

    setCodeMessage({ kind: "error", text: formatAptitudeCodeError(result) });
  }

  function importDraftCode() {
    importCode(draftCode);
  }

  return (
    <section className="form-section aptitude-panel">
      <div className="aptitude-heading">
        <div>
          <h3>{t("form.distribution")}</h3>
          <span>{t("form.distributionSource")}</span>
        </div>
      </div>

      <label className="field aptitude-code-field">
        <span>{t("form.aptitudeCode")}</span>
        <div className="aptitude-code-row">
          <input
            spellCheck={false}
            value={draftCode}
            onChange={(event) => {
              setDraftCode(event.target.value);
              setCodeMessage(null);
            }}
          />
          <IconButton label={t("form.copyAptitudeCode")} onClick={copyCode}>
            <Copy size={19} />
          </IconButton>
          <IconButton label={t("form.importAptitudeCode")} onClick={importDraftCode}>
            <ClipboardPaste size={19} />
          </IconButton>
        </div>
        {codeMessage ? (
          <small className={`aptitude-code-message ${codeMessage.kind}`}>{codeMessage.text}</small>
        ) : null}
      </label>

      <label className="field aptitude-level">
        <span>{t("form.level")}</span>
        <input
          max={245}
          min={1}
          type="number"
          value={distribution.level}
          onChange={(event) => updateLevel(Number(event.target.value))}
        />
      </label>

      <AptitudePreview preview={preview} />

      <div className="aptitude-family-list">
        {aptitudeFamilyOrder.map((familyId) => {
          const family = aptitudeFamilies[familyId];
          const available = getAvailableAptitudePoints(distribution.level, familyId);
          const spent = getSpentAptitudePoints(distribution, familyId);

          return (
            <section className="aptitude-family" key={familyId} style={{ borderColor: family.accent }}>
              <header>
                <strong>{formatAptitudeFamilyLabel(familyId)}</strong>
                <span>{formatUiMessage("form.remainingPoints", { remaining: available - spent, available })}</span>
              </header>
              <div className="aptitude-row-list">
                {aptitudeDefinitions.filter((definition) => definition.family === familyId).map((definition) => {
                  const rank = distribution.ranks[definition.id] ?? 0;
                  const remainingIncludingCurrent = available - spent + rank;
                  const maxRank = Math.min(definition.maxRank ?? available, remainingIncludingCurrent);

                  return (
                    <AptitudeRankRow
                      key={definition.id}
                      definitionId={definition.id}
                      label={formatAptitudeLabel(definition.id)}
                      maxRank={maxRank}
                      rank={rank}
                      onChange={updateRank}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function formatAptitudeCodeError(result: Exclude<ReturnType<typeof parseAptitudeDistributionCode>, { ok: true }>): string {
  if (result.error === "unknownAptitude" && result.aptitudeId !== undefined) {
    return formatUiMessage("form.aptitudeCodeUnknown", { id: result.aptitudeId });
  }

  if (result.error === "duplicateAptitude" && result.aptitudeId !== undefined) {
    return formatUiMessage("form.aptitudeCodeDuplicate", { id: result.aptitudeId });
  }

  if (result.error === "exceedsBudget") {
    return t("form.aptitudeCodeExceedsBudget");
  }

  return t("form.aptitudeCodeInvalid");
}

function AptitudePreview({ preview }: { preview: AppliedAptitudeStats }) {
  const chips = [
    { icon: getResourceIconSrc("ap"), label: formatResourceLabel("ap"), value: preview.resources.ap },
    { icon: getResourceIconSrc("mp"), label: formatResourceLabel("mp"), value: preview.resources.mp },
    { icon: getResourceIconSrc("wp"), label: formatResourceLabel("wp"), value: preview.resources.wp },
    { icon: getStatIconSrc("generalMastery"), label: t("stat.fullGeneralMastery"), value: preview.stats.generalMastery },
    { icon: getStatIconSrc("damageInflictedPercent"), label: t("stat.damageInflicted"), value: `${preview.stats.damageInflictedPercent}%` },
    { icon: getStatIconSrc("criticalHitPercent"), label: t("stat.criticalHit"), value: `${preview.stats.criticalHitPercent ?? 0}%` },
    { icon: getStatIconSrc("elementalResistance"), label: t("stat.elementalResistance"), value: preview.stats.elementalResistance ?? 0 },
  ];

  return (
    <div className="aptitude-preview" aria-label={t("form.computedBase")}>
      <strong>{t("form.computedBase")}</strong>
      <p>{t("form.distributionHint")}</p>
      <div className="aptitude-preview-grid">
        {chips.map(({ icon, label, value }) => (
          <span key={label}>
            <b><StatIcon src={icon} label={label} />{label}</b>
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function AptitudeRankRow({
  definitionId,
  label,
  maxRank,
  onChange,
  rank,
}: {
  definitionId: number;
  label: string;
  maxRank: number;
  onChange: (aptitudeId: number, rank: number) => void;
  rank: number;
}) {
  function adjust(event: React.MouseEvent<HTMLButtonElement>, direction: -1 | 1) {
    onChange(definitionId, rank + direction * getStatStep(event));
  }

  return (
    <div className="aptitude-row">
      <span>
        <StatIcon src={getAptitudeIconSrc(definitionId)} label={label} />
        {label}
      </span>
      <strong>{rank}/{maxRank}</strong>
      <span className="stat-stepper-actions">
        <button type="button" disabled={rank <= 0} onClick={(event) => adjust(event, -1)}>-</button>
        <button type="button" disabled={rank >= maxRank} onClick={(event) => adjust(event, 1)}>+</button>
      </span>
    </div>
  );
}

function ResourceEditor({ character, onChange }: { character: SimulatedCharacter; onChange: (character: SimulatedCharacter) => void }) {
  function adjustResource(resource: Resource, delta: number) {
    const value = Math.max(0, character.resources[resource] + delta);
    onChange({ ...character, resources: createResources({ ...character.resources, [resource]: value }) });
  }

  return (
    <section className="form-section">
      <h3>{t("form.resources")}</h3>
      <div className="stat-stepper-list">
        {getBuildResourceOptions(character.className).map((resource) => (
          <StatStepper
            key={resource}
            icon={getResourceIconSrc(resource)}
            label={formatResourceLabel(resource)}
            value={character.resources[resource]}
            onChange={(delta) => adjustResource(resource, delta)}
          />
        ))}
      </div>
    </section>
  );
}

function StatsEditor({ character, onChange }: { character: SimulatedCharacter; onChange: (character: SimulatedCharacter) => void }) {
  const statControls: Array<{
    iconKey: StatIconKey;
    key: Exclude<keyof BaseStats, "elementalMastery">;
    label: string;
    suffix?: string;
  }> = [
    { iconKey: "hitPoints", key: "hitPoints", label: t("stat.hitPoints") },
    { iconKey: "hitPointsPercent", key: "hitPointsPercent", label: t("stat.hitPointsPercent"), suffix: "%" },
    { iconKey: "generalMastery", key: "generalMastery", label: t("stat.generalMastery") },
    { iconKey: "damageInflictedPercent", key: "damageInflictedPercent", label: t("stat.damageInflicted"), suffix: "%" },
    { iconKey: "meleeMastery", key: "meleeMastery", label: t("stat.meleeMastery") },
    { iconKey: "distanceMastery", key: "distanceMastery", label: t("stat.distanceMastery") },
    { iconKey: "rearMastery", key: "rearMastery", label: t("stat.rearMastery") },
    { iconKey: "criticalMastery", key: "criticalMastery", label: t("stat.criticalMastery") },
    { iconKey: "berserkMastery", key: "berserkMastery", label: t("stat.berserkMastery") },
    { iconKey: "healingMastery", key: "healingMastery", label: t("stat.healingMastery") },
    { iconKey: "elementalResistance", key: "elementalResistance", label: t("stat.elementalResistance") },
    { iconKey: "rearResistance", key: "rearResistance", label: t("stat.rearResistance") },
    { iconKey: "criticalResistance", key: "criticalResistance", label: t("stat.criticalResistance") },
    { iconKey: "criticalHitPercent", key: "criticalHitPercent", label: t("stat.criticalHit"), suffix: "%" },
    { iconKey: "parry", key: "parry", label: t("stat.parry"), suffix: "%" },
    { iconKey: "range", key: "range", label: t("stat.range") },
    { iconKey: "willpower", key: "willpower", label: t("stat.willpower") },
    { iconKey: "lock", key: "lock", label: t("stat.lock") },
    { iconKey: "dodge", key: "dodge", label: t("stat.dodge") },
    { iconKey: "initiative", key: "initiative", label: t("stat.initiative") },
    { iconKey: "healsPerformedPercent", key: "healsPerformedPercent", label: t("stat.healsPerformed"), suffix: "%" },
    { iconKey: "healsReceivedPercent", key: "healsReceivedPercent", label: t("stat.healsReceived"), suffix: "%" },
    { iconKey: "armorGivenPercent", key: "armorGivenPercent", label: t("stat.armorGiven"), suffix: "%" },
    { iconKey: "armorReceivedPercent", key: "armorReceivedPercent", label: t("stat.armorReceived"), suffix: "%" },
    { iconKey: "indirectDamagePercent", key: "indirectDamagePercent", label: t("stat.indirectDamage"), suffix: "%" },
  ];

  function updateStats(patch: Partial<BaseStats>) {
    onChange({ ...character, stats: { ...character.stats, ...patch } });
  }

  function updateElementalMastery(element: Element, value: number) {
    updateStats({
      elementalMastery: {
        ...character.stats.elementalMastery,
        [element]: value,
      },
    });
  }

  function adjustStat(value: number, delta: number): number {
    return Math.max(0, value + delta);
  }

  function getNumericStatValue(key: Exclude<keyof BaseStats, "elementalMastery">): number {
    const value = character.stats[key];
    return typeof value === "number" ? value : 0;
  }

  function updateNumericStat(key: Exclude<keyof BaseStats, "elementalMastery">, value: number) {
    updateStats({ [key]: value } as Partial<BaseStats>);
  }

  return (
    <section className="form-section stats-section">
      <h3>{t("form.stats")}</h3>
      <div className="stat-stepper-list">
        {statControls.map((control) => {
          const value = getNumericStatValue(control.key);
          return (
            <StatStepper
              key={control.key}
              icon={getStatIconSrc(control.iconKey)}
              label={control.label}
              suffix={control.suffix}
              value={value}
              onChange={(delta) => updateNumericStat(control.key, adjustStat(value, delta))}
            />
          );
        })}
      </div>
      <div className="stat-stepper-list elemental-stat-list">
        {elementOptions.map((element) => (
          <StatStepper
            key={element}
            element={element}
            icon={getElementMasteryIconSrc(element)}
            label={formatElementLabel(element)}
            value={character.stats.elementalMastery[element] ?? 0}
            onChange={(delta) => updateElementalMastery(element, adjustStat(character.stats.elementalMastery[element] ?? 0, delta))}
          />
        ))}
      </div>
    </section>
  );
}

function EquipmentExtraStatsEditor({
  onChange,
  stats,
}: {
  onChange: (stats: EquipmentExtraStats) => void;
  stats: EquipmentExtraStats;
}) {
  const statControls: Array<{
    iconKey: StatIconKey;
    key: EquipmentExtraStatKey;
    label: string;
  }> = [
    { iconKey: "barrier", key: "barrier", label: t("stat.barrier") },
    { iconKey: "lockDodge", key: "lockDodge", label: t("stat.lockDodge") },
    { iconKey: "equipmentKnowledge", key: "equipmentKnowledge", label: t("stat.equipmentKnowledge") },
    { iconKey: "prospection", key: "prospection", label: t("stat.prospection") },
    { iconKey: "wisdom", key: "wisdom", label: t("stat.wisdom") },
    { iconKey: "leadership", key: "leadership", label: t("stat.leadership") },
  ];

  function updateExtraStat(key: EquipmentExtraStatKey, value: number) {
    onChange({ ...stats, [key]: Math.max(0, value) });
  }

  return (
    <section className="form-section equipment-extra-section">
      <h3>{t("form.additionalEquipmentStats")}</h3>
      <div className="stat-stepper-list">
        {statControls.map((control) => {
          const value = stats[control.key];
          return (
            <StatStepper
              key={control.key}
              icon={getStatIconSrc(control.iconKey)}
              label={control.label}
              value={value}
              onChange={(delta) => updateExtraStat(control.key, value + delta)}
            />
          );
        })}
      </div>
    </section>
  );
}

function HuppermageStateTracker({
  activeSublimations,
  initialConditionResources,
  initialConditionStats,
  resources,
  snapshot,
}: {
  activeSublimations: SublimationBuild | undefined;
  initialConditionResources: SimulatedCharacter["resources"];
  initialConditionStats: SimulatedCharacter["stats"];
  resources: SimulatedCharacter["resources"];
  snapshot: TimelineSnapshot | undefined;
}) {
  const huppermage = snapshot?.classState.huppermage;
  const sublimationStateItems = createSublimationStateItems({
    appliedEffects: snapshot?.appliedEffects ?? [],
    build: activeSublimations,
    initialConditionResources,
    initialConditionStats,
  });

  return (
    <section className="form-section state-tracker">
      <h3>{t("app.className")}</h3>
      <div className="state-resource-overview">
        <span>{t("form.resources")}</span>
        <ResourceStrip resources={resources} />
      </div>
      <div className="state-rune-overview">
        <span>{t("runes.short")}</span>
        <RuneStrip huppermage={huppermage} resources={snapshot?.resources} showFeuFollets={false} />
      </div>
      <dl className="state-list state-tracker-list">
        <div>
          <dt>{t("inspector.heart")}</dt>
          <dd>{formatHeart(huppermage?.activeHeart)}</dd>
        </div>
        <div>
          <dt>{t("huppermage.feuFollets")}</dt>
          <dd>{huppermage?.feuFolletsActive ?? 0}</dd>
        </div>
        <div>
          <dt>{t("state.storedBq")}</dt>
          <dd>{huppermage?.storedBq ?? 0}</dd>
        </div>
        <div>
          <dt>{t("state.haloMarks")}</dt>
          <dd>{huppermage?.haloChatoyantMarks ?? 0}</dd>
        </div>
        <div>
          <dt>{t("deck.limit")}</dt>
          <dd>{huppermage?.deckSpellLimit ?? 12}</dd>
        </div>
        <div>
          <dt>{t("passive.limit")}</dt>
          <dd>{huppermage?.passiveLimit ?? 6}</dd>
        </div>
      </dl>
      {sublimationStateItems.length > 0 ? (
        <div className="state-sublimation-overview">
          <span>Sublimations</span>
          <ul className="state-sublimation-list">
            {sublimationStateItems.map((item, index) => (
              <li className={`state-sublimation-item ${item.status}`} key={`${item.id}-${index}`}>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.detail}</small>
                </span>
                <em>{item.statusLabel}</em>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ActionEditor({ action, onChange }: { action: TimelineAction; onChange: (patch: Partial<Action>) => void }) {
  const context = { ...defaultActionContext, ...action.context };

  function updateContext(patch: Partial<ActionContext>) {
    onChange({ context: { ...context, ...patch } });
  }

  return (
    <section className="action-editor">
      <h3>{t("editor.actionContext")}</h3>
      <div className="editor-grid">
        <label className="field">
          <span>{t("editor.target")}</span>
          <select value={action.target?.kind ?? "enemy"} onChange={(event) => onChange({ target: { kind: event.target.value as ActionTarget["kind"] } })}>
            {targetOptions.map((target) => <option key={target} value={target}>{formatTargetLabel(target)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t("editor.position")}</span>
          <select value={context.position} onChange={(event) => updateContext({ position: event.target.value as AttackPosition })}>
            {positionOptions.map((position) => <option key={position} value={position}>{formatPositionLabel(position)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t("editor.range")}</span>
          <select
            value={context.rangeMode ?? "none"}
            onChange={(event) => updateContext({ rangeMode: event.target.value === "none" ? undefined : event.target.value as RangeMode })}
          >
            {rangeModeOptions.map((rangeMode) => <option key={rangeMode} value={rangeMode}>{formatRangeModeLabel(rangeMode)}</option>)}
          </select>
        </label>
      </div>
      <div className="toggle-row-group">
        <Toggle label={t("editor.critical")} checked={context.isCritical} onChange={(value) => updateContext({ isCritical: value })} />
        <Toggle label={t("editor.berserk")} checked={context.isBerserk} onChange={(value) => updateContext({ isBerserk: value })} />
        <Toggle label={t("editor.blocked")} checked={context.isBlocked} onChange={(value) => updateContext({ isBlocked: value })} />
      </div>
    </section>
  );
}

function CursorControl({
  marks,
  max,
  onChange,
  value,
}: {
  marks: ReturnType<typeof createTimelineCursorMarks>;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="cursor-control">
      <div className="cursor-track-wrap">
        <div className="cursor-action-marks" aria-hidden="true">
          {marks.actionSteps.map((step) => (
            <span
              key={step}
              className="cursor-action-mark"
              style={{ left: `${stepToPercent(step, max)}%` }}
            />
          ))}
        </div>
        <div className="cursor-turn-separators" aria-hidden="true">
          {marks.turns.map((turn) => (
            turn.actionCount > 0 ? (
              <span
                key={turn.turnIndex}
                className="cursor-turn-separator"
                style={{ left: `${stepToPercent(turn.endStep, max)}%` }}
              />
            ) : null
          ))}
        </div>
        <input
          aria-label={t("cursor.label")}
          type="range"
          min={0}
          max={max}
          step={1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
      <span>{formatUiMessage("cursor.step", { value, max })}</span>
    </div>
  );
}

function stepToPercent(step: number, max: number): number {
  return max <= 0 ? 0 : Math.max(0, Math.min(100, step / max * 100));
}

function SnapshotInspector({ snapshot }: { snapshot: TimelineSnapshot }) {
  const huppermage = snapshot.classState.huppermage;
  const huppermageRunes = huppermage?.runes;
  const activePassives = huppermage?.activePassives ?? [];
  const summarizedStatIcons = [
    getStatIconSrc("level"),
    getStatIconSrc("hitPoints"),
    getStatIconSrc("hitPointsPercent"),
    getStatIconSrc("generalMastery"),
    getElementMasteryIconSrc("fire"),
    getElementMasteryIconSrc("water"),
    getElementMasteryIconSrc("earth"),
    getElementMasteryIconSrc("air"),
    getElementMasteryIconSrc("light"),
    getStatIconSrc("damageInflictedPercent"),
    getStatIconSrc("meleeMastery"),
    getStatIconSrc("distanceMastery"),
    getStatIconSrc("rearMastery"),
    getStatIconSrc("criticalMastery"),
    getStatIconSrc("elementalResistance"),
    getStatIconSrc("criticalHitPercent"),
    getStatIconSrc("parry"),
    getStatIconSrc("range"),
    getStatIconSrc("willpower"),
  ];

  return (
    <div className="inspector-stack">
      <section>
        <h3>{t("form.resources")}</h3>
        <ResourceStrip resources={snapshot.resources} />
      </section>
      <section>
        <h3>{t("inspector.huppermageState")}</h3>
        <dl className="state-list">
          <div><dt>{t("inspector.heart")}</dt><dd>{formatHeart(huppermage?.activeHeart)}</dd></div>
          <div><dt>{t("inspector.lastRune")}</dt><dd>{huppermageRunes?.lastGeneratedRune ? formatRuneLabel(huppermageRunes.lastGeneratedRune) : t("value.nonePlural")}</dd></div>
          <div><dt>{t("huppermage.feuFollets")}</dt><dd>{huppermage?.feuFolletsActive ?? 0}</dd></div>
          <div><dt>{t("inspector.activeRunes")}</dt><dd>{runeOptions.filter((rune) => huppermageRunes?.active[rune]).map(formatRuneLabel).join(", ") || t("value.nonePlural")}</dd></div>
          <div><dt>{t("inspector.passives")}</dt><dd>{activePassives.join(", ") || t("value.none")}</dd></div>
        </dl>
      </section>
      <section>
        <h3>{t("inspector.currentStats")}</h3>
        <dl className="state-list stats-list">
          {summarizeStats(snapshot.stats).map(([label, value], index) => (
            <div key={label}>
              <dt>
                <StatIcon src={summarizedStatIcons[index] ?? getStatIconSrc("generalMastery")} label={label} />
                {label}
              </dt>
              <dd>{formatNumber(value)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h3>{t("inspector.appliedEffects")}</h3>
        {snapshot.appliedEffects.length > 0 ? (
          <ul className="effect-list">
            {snapshot.appliedEffects.map((effect, index) => <li key={`${effect.type}-${index}`}>{describeEffect(effect)}</li>)}
          </ul>
        ) : (
          <p className="muted">{t("detail.noEffects")}</p>
        )}
      </section>
      {snapshot.violations.length > 0 ? (
        <section className="violation-box">
          <h3>{t("inspector.violation")}</h3>
          {snapshot.violations.map((violation) => (
            <p key={`${violation.type}-${violation.actionIndex}`}>{describeViolation(violation)}</p>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function DamageBreakdown({ snapshot }: { snapshot: TimelineSnapshot | undefined }) {
  const damageEffects = snapshot?.appliedEffects.filter((effect) => effect.type === "damage") ?? [];

  if (!snapshot || damageEffects.length === 0) {
    return <p className="muted">{t("detail.formulaEmpty")}</p>;
  }

  return (
    <div className="formula-grid">
      {damageEffects.map((effect, index) => (
        <article key={`${effect.element}-${index}`} className="formula-card">
          <h3>{formatUiMessage("formula.title", { element: formatElementLabel(effect.element), amount: effect.amount })}</h3>
          <dl className="state-list">
            <div><dt>{t("formula.base")}</dt><dd>{effect.formula.baseDamage} x {effect.formula.times}</dd></div>
            <div><dt>{t("formula.elementalMastery")}</dt><dd>{effect.formula.elementalMastery}</dd></div>
            <div><dt>{t("formula.extraMastery")}</dt><dd>{effect.formula.extraMastery}</dd></div>
            <div><dt>{t("formula.masteryMultiplier")}</dt><dd>{effect.formula.masteryMultiplier}</dd></div>
            <div><dt>{t("formula.critical")}</dt><dd>{effect.formula.criticalMultiplier}</dd></div>
            <div><dt>{t("formula.criticalChance")}</dt><dd>{effect.formula.effectiveCriticalHitPercent}%</dd></div>
            <div><dt>{t("formula.nonCritical")}</dt><dd>{effect.formula.nonCriticalResult}</dd></div>
            <div><dt>{t("formula.criticalResult")}</dt><dd>{effect.formula.criticalResult}</dd></div>
            <div><dt>{t("formula.position")}</dt><dd>{effect.formula.positionMultiplier}</dd></div>
            <div><dt>{t("formula.inflicted")}</dt><dd>{effect.formula.finalMultiplier}</dd></div>
            <div><dt>{t("formula.block")}</dt><dd>{effect.formula.blockMultiplier}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function StatStepper({
  element,
  icon,
  label,
  onChange,
  suffix = "",
  value,
}: {
  element?: Element;
  icon: string;
  label: string;
  onChange: (delta: number) => void;
  suffix?: string;
  value: number;
}) {
  const [draftValue, setDraftValue] = useState(() => formatNumber(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraftValue(formatNumber(value));
    }
  }, [editing, value]);

  function adjust(event: React.MouseEvent<HTMLButtonElement>, direction: -1 | 1) {
    onChange(direction * getStatStep(event));
  }

  function commitDraft(nextDraft: string) {
    setDraftValue(nextDraft);
    const parsed = Number(nextDraft.replace(",", "."));
    if (Number.isFinite(parsed)) {
      onChange(parsed - value);
    }
  }

  function resetDraft() {
    setEditing(false);
    setDraftValue(formatNumber(value));
  }

  return (
    <div className="stat-stepper">
      <span className="stat-stepper-icon" title={label}>
        <img src={icon} alt="" draggable={false} />
        {element ? <ElementIcon element={element} /> : null}
      </span>
      <span className="stat-stepper-label">{label}</span>
      <strong className="stat-stepper-value">
        <input
          aria-label={label}
          className="stat-stepper-value-input"
          inputMode="decimal"
          value={editing ? draftValue : formatNumber(value)}
          onBlur={resetDraft}
          onChange={(event) => commitDraft(event.target.value)}
          onFocus={(event) => {
            setEditing(true);
            setDraftValue(formatNumber(value));
            event.currentTarget.select();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              resetDraft();
              event.currentTarget.blur();
            }
          }}
        />
        {suffix ? <span>{suffix}</span> : null}
      </strong>
      <span className="stat-stepper-actions">
        <button type="button" title={formatUiMessage("stat.decrementTitle", { label })} onClick={(event) => adjust(event, -1)}>-</button>
        <button type="button" title={formatUiMessage("stat.incrementTitle", { label })} onClick={(event) => adjust(event, 1)}>+</button>
      </span>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="toggle-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function IconButton({
  children,
  className,
  disabled = false,
  label,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={className ? `icon-button ${className}` : "icon-button"}
      disabled={disabled}
      title={label}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function EntryIcon({ entryId, label }: { entryId: string; label: string }) {
  const iconSrc = getHuppermageIconSrc(entryId);
  const iconClassName = `entry-icon entry-icon-${entryId}`;

  return iconSrc ? (
    <img className={iconClassName} src={iconSrc} alt="" title={label} draggable={false} />
  ) : (
    <span className={`${iconClassName} entry-icon-fallback`} title={label}>{label.slice(0, 1)}</span>
  );
}

function entryPrimaryElement(entry: CatalogEntry): Element | undefined {
  return entry.element ?? firstEffectElement(entry.effects);
}

function isDeckTrackedCatalogSpell(spell: CatalogEntry): boolean {
  return !nonDeckSpellIds.has(spell.id) && !spell.tags.includes("feu-follet");
}

function catalogSearchMatches(entry: CatalogEntry, query: string): boolean {
  const normalizedQuery = normalizeCatalogSearchText(query);
  if (!normalizedQuery) {
    return true;
  }

  return normalizeCatalogSearchText([entry.name, entry.id, ...entry.tags].join(" ")).includes(normalizedQuery);
}

function normalizeCatalogSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function firstEffectElement(effects: Effect[]): Element | undefined {
  for (const effect of effects) {
    if ((effect.type === "damage" || effect.type === "heal" || effect.type === "armor" || effect.type === "statModifier") && effect.element) {
      return effect.element;
    }

    if (effect.type === "conditional" || effect.type === "trigger") {
      const nestedElement = firstEffectElement(effect.effects);
      if (nestedElement) {
        return nestedElement;
      }
    }
  }

  return undefined;
}

function describeSpellCost(spell: CatalogEntry): string {
  const costParts = Object.entries(spell.cost ?? {})
    .filter(([, value]) => value && value > 0)
    .map(([resource, value]) => `${value} ${formatResourceLabel(resource as Resource)}`);

  return costParts.length > 0 ? costParts.join(" / ") : t("cost.zero");
}

function summarizeEntryTags(entry: CatalogEntry): string {
  return entry.tags.filter((tagName) => tagName !== "passive").slice(0, 3).join(" | ") || t("detail.passive").toLowerCase();
}
