import { ArrowLeft, BarChart3, Boxes, Check, Pin, Play, Plus, Save, Search, Trash2, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogEntry } from "../core/catalog/types.ts";
import {
  createDefaultOptimizerControls,
  createOptimizerCandidateSpellIconRows,
  getPinnedCandidates,
  normalizeOptimizerControls,
  runOptimizerForControlsLive,
  summarizeOptimizerControls,
  togglePinnedCandidate,
  type DurationGroupedResults,
  type OptimizerCandidateViewModel,
  type OptimizerWorkspaceControls,
} from "./optimizerWorkspace.ts";
import {
  filterBuildsByClass,
  formatWakfuClassLabel,
  getBuildRuns,
  getBuildSavedCombos,
  getBuildSetups,
  type OptimizerRunReference,
  wakfuClassOptions,
  type ResearchBuild,
  type ResearchWorkspaceData,
  type SavedComboReference,
  type SetupSnapshot,
  type WakfuClassId,
} from "./researchWorkspace.ts";
import {
  filterSavedCombosForComparison,
  getSavedComboDurationsForSet,
  groupSavedCombosByDuration,
  type SavedComboComparisonGroups,
  type SavedComboComparisonRow,
} from "./savedComboComparison.ts";
import { getHuppermageIconSrc } from "./icons.ts";

export type OptimizerRunStatus = "idle" | "running" | "done" | "stopped" | "error";

export type OptimizerRunProgressState = {
  attempts: number;
  bestScore?: number;
  invalidCandidates: number;
  label: string;
  percent: number;
  validCandidates: number;
};

export type OptimizerRunSnapshot = {
  controls: OptimizerWorkspaceControls;
  results: OptimizerCandidateViewModel[];
};

export type OptimizerWorkspaceSession = {
  controls: OptimizerWorkspaceControls;
  lastRun: OptimizerRunSnapshot | null;
  pinnedIds: string[];
  runError: string | null;
  runProgress: OptimizerRunProgressState;
  runStatus: OptimizerRunStatus;
};

function createOptimizerWorkspaceSession(session: OptimizerWorkspaceSession): OptimizerWorkspaceSession {
  if (session.runStatus !== "running") {
    return session;
  }

  return {
    ...session,
    runProgress: {
      ...session.runProgress,
      label: session.lastRun ? "Optimisation stoppée" : session.runProgress.label,
    },
    runStatus: session.lastRun ? "stopped" : "idle",
  };
}

export function ResearchLibraryPage({
  classFilter,
  onClassFilterChange,
  onCreateBuild,
  onOpenBuild,
  onOpenQuickBuilder,
  workspace,
}: {
  classFilter: WakfuClassId | "all";
  onClassFilterChange: (classId: WakfuClassId | "all") => void;
  onCreateBuild: (input: { classId: WakfuClassId; gameplayLabel: string; name: string }) => void;
  onOpenBuild: (buildId: string) => void;
  onOpenQuickBuilder: () => void;
  workspace: ResearchWorkspaceData;
}) {
  const [draftName, setDraftName] = useState("Nouveau build Huppermage");
  const [draftGameplay, setDraftGameplay] = useState("Gameplay à définir");
  const [draftClassId, setDraftClassId] = useState<WakfuClassId>("huppermage");
  const builds = useMemo(() => filterBuildsByClass(workspace.builds, classFilter), [classFilter, workspace.builds]);

  function createDraftBuild() {
    onCreateBuild({
      classId: draftClassId,
      gameplayLabel: draftGameplay,
      name: draftName,
    });
  }

  return (
    <main className="research-shell">
      <section className="research-hero">
        <div>
          <span>Laboratoire</span>
          <h1>Builds</h1>
        </div>
        <button className="secondary-button" type="button" onClick={onOpenQuickBuilder}>
          <Wrench size={16} />
          Builder rapide
        </button>
      </section>

      <section className="research-layout">
        <aside className="research-sidebar" aria-label="Créer un build">
          <h2>Nouveau build</h2>
          <label className="field">
            Nom
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
          </label>
          <label className="field">
            Gameplay
            <input value={draftGameplay} onChange={(event) => setDraftGameplay(event.target.value)} />
          </label>
          <fieldset className="class-choice-list">
            <legend>Classe</legend>
            {wakfuClassOptions.map((option) => (
              <label key={option.id} className={option.selectable ? "class-choice" : "class-choice disabled"}>
                <input
                  type="radio"
                  checked={draftClassId === option.id}
                  disabled={!option.selectable}
                  onChange={() => setDraftClassId(option.id)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
          <button className="primary-button wide-button" type="button" onClick={createDraftBuild}>
            <Plus size={16} />
            Créer
          </button>
        </aside>

        <section className="research-main-list" aria-label="Liste des builds">
          <div className="research-toolbar">
            <label className="search-control">
              <Search size={15} />
              <select value={classFilter} onChange={(event) => onClassFilterChange(event.target.value as WakfuClassId | "all")}>
                <option value="all">Toutes les classes</option>
                {wakfuClassOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <span>{builds.length} build{builds.length > 1 ? "s" : ""}</span>
          </div>

          {workspace.builds.length === 0 ? (
            <EmptyState title="Aucun build" body="Crée un build Huppermage, puis configure ses sets pour chercher des combos." />
          ) : null}
          {workspace.builds.length > 0 && builds.length === 0 ? (
            <EmptyState title="Aucun résultat" body="Aucun build ne correspond au filtre de classe actuel." />
          ) : null}

          <div className="build-list">
            {builds.map((build) => (
              <BuildRow
                build={build}
                key={build.id}
                runCount={getBuildRuns(workspace, build.id).length}
                savedComboCount={getBuildSavedCombos(workspace, build.id).length}
                setupCount={getBuildSetups(workspace, build.id).length}
                onOpen={() => onOpenBuild(build.id)}
              />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export function BuildPage({
  build,
  onBack,
  onCreateBalancedSet,
  onOpenBuilder,
  onOpenOptimizer,
  onOpenRun,
  onOpenSavedCombos,
  onOpenSetup,
  runs,
  savedCombos,
  setups,
}: {
  build: ResearchBuild;
  onBack: () => void;
  onCreateBalancedSet: (setup: SetupSnapshot) => void;
  onOpenBuilder: (setup: SetupSnapshot) => void;
  onOpenOptimizer: (setup: SetupSnapshot) => void;
  onOpenRun: (run: OptimizerRunReference) => void;
  onOpenSavedCombos: () => void;
  onOpenSetup: (setup: SetupSnapshot) => void;
  runs: ReturnType<typeof getBuildRuns>;
  savedCombos: ReturnType<typeof getBuildSavedCombos>;
  setups: SetupSnapshot[];
}) {
  return (
    <main className="research-shell">
      <PageBackButton onBack={onBack} label="Builds" />
      <section className="build-header">
        <div>
          <span>{formatWakfuClassLabel(build.classId)} · {build.gameplayLabel}</span>
          <h1>{build.name}</h1>
        </div>
        <span className="status-pill status-ok">localStorage</span>
      </section>

      <section className="build-columns">
        <section className="workspace-section">
          <h2>Sets</h2>
          {setups.length === 0 ? <EmptyState title="Aucun set" body="Ce build n'a pas encore de set sauvegardé." /> : null}
          {setups.map((setup) => (
            <SetupSummary
              key={setup.id}
              setup={setup}
              onCreateBalancedSet={() => onCreateBalancedSet(setup)}
              onOpenBuilder={() => onOpenBuilder(setup)}
              onOpenOptimizer={() => onOpenOptimizer(setup)}
              onOpenSetup={() => onOpenSetup(setup)}
            />
          ))}
        </section>
        <section className="workspace-section">
          <h2>Runs optimizer</h2>
          {runs.length === 0 ? <EmptyState title="Aucun run" body="Lance une recherche depuis un set pour conserver des résultats." /> : null}
          {runs.map((run) => (
            <button className="thin-row action-row" type="button" key={run.id} onClick={() => onOpenRun(run)}>
              <b>{run.label}</b>
              <span>{run.criteriaSummary}</span>
            </button>
          ))}
        </section>
        <section className="workspace-section">
          <div className="section-title-row">
            <h2>Combos sauvegardés</h2>
            {savedCombos.length > 0 ? (
              <button className="secondary-button" type="button" onClick={onOpenSavedCombos}>
                <BarChart3 size={15} />
                Comparer
              </button>
            ) : null}
          </div>
          {savedCombos.length === 0 ? <EmptyState title="Aucun combo" body="Épingle ou sauvegarde des candidats depuis l'optimizer." /> : null}
          {savedCombos.map((combo) => (
            <div className="thin-row" key={combo.id}>
              <b>{combo.name}</b>
              <span>{combo.totalDamage ?? 0} dégâts</span>
            </div>
          ))}
        </section>
      </section>
    </main>
  );
}

export function OptimizerRunDetailPage({
  build,
  onBack,
  onOpenCombo,
  run,
  savedCombos,
  setup,
  setups,
}: {
  build: ResearchBuild;
  onBack: () => void;
  onOpenCombo: (combo: SavedComboReference) => void;
  run: OptimizerRunReference;
  savedCombos: SavedComboReference[];
  setup?: SetupSnapshot;
  setups: SetupSnapshot[];
}) {
  const setupCombos = savedCombos.filter((combo) => combo.setupSnapshotId === run.setupSnapshotId);
  const groups = useMemo(() => groupSavedCombosByDuration(setupCombos), [setupCombos]);

  return (
    <main className="research-shell">
      <PageBackButton onBack={onBack} label={build.name} />
      <section className="build-header">
        <div>
          <span>{setup?.name ?? "Set introuvable"} · {formatDateTime(run.createdAt)}</span>
          <h1>{run.label}</h1>
        </div>
        <span className="status-pill status-ok">Run sauvegardé</span>
      </section>
      <section className="workspace-section">
        <h2>Critères</h2>
        <p>{run.criteriaSummary}</p>
      </section>
      <section className="workspace-section comparison-section">
        <h2>Combos sauvegardés sur ce set</h2>
        <SavedComboDurationGroups groups={groups} setups={setups} onOpenCombo={onOpenCombo} />
      </section>
    </main>
  );
}

export function SavedComboComparisonPage({
  build,
  onBack,
  onDeleteCombo,
  onDeleteVisibleCombos,
  onOpenCombo,
  savedCombos,
  setups,
}: {
  build: ResearchBuild;
  onBack: () => void;
  onDeleteCombo: (comboId: string) => void;
  onDeleteVisibleCombos: (comboIds: string[]) => void;
  onOpenCombo: (combo: SavedComboReference) => void;
  savedCombos: SavedComboReference[];
  setups: SetupSnapshot[];
}) {
  const defaultSetupId = useMemo(
    () => setups.find((setup) => savedCombos.some((combo) => combo.setupSnapshotId === setup.id))?.id ?? setups[0]?.id ?? "",
    [savedCombos, setups],
  );
  const [selectedSetupId, setSelectedSetupId] = useState(defaultSetupId);
  const activeSetupId = setups.some((setup) => setup.id === selectedSetupId) ? selectedSetupId : defaultSetupId;
  const availableDurations = useMemo(
    () => getSavedComboDurationsForSet(savedCombos, activeSetupId),
    [activeSetupId, savedCombos],
  );
  const [selectedDuration, setSelectedDuration] = useState(availableDurations[0] ?? 1);
  const activeDuration = availableDurations.includes(selectedDuration) ? selectedDuration : (availableDurations[0] ?? 1);
  const comparableRows = useMemo(
    () => filterSavedCombosForComparison(savedCombos, {
      duration: activeDuration,
      setupSnapshotId: activeSetupId,
    }),
    [activeDuration, activeSetupId, savedCombos],
  );
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const visibleComboIds = useMemo(
    () => comparableRows.map((row) => row.combo.id),
    [comparableRows],
  );
  const visibleComboCount = comparableRows.length;
  const visibleComboLabel = `${visibleComboCount} combo${visibleComboCount > 1 ? "s" : ""} visible${visibleComboCount > 1 ? "s" : ""}`;

  useEffect(() => {
    setConfirmDeleteVisible(false);
  }, [activeDuration, activeSetupId, visibleComboCount]);

  function selectSetup(setupId: string) {
    setSelectedSetupId(setupId);
    setSelectedDuration(getSavedComboDurationsForSet(savedCombos, setupId)[0] ?? 1);
  }

  function deleteVisibleCombos() {
    onDeleteVisibleCombos(visibleComboIds);
    setConfirmDeleteVisible(false);
  }

  function deleteCombo(comboId: string) {
    onDeleteCombo(comboId);
    setConfirmDeleteVisible(false);
  }

  return (
    <main className="research-shell">
      <PageBackButton onBack={onBack} label={build.name} />
      <section className="build-header">
        <div>
          <span>{formatWakfuClassLabel(build.classId)} · {savedCombos.length} combo{savedCombos.length > 1 ? "s" : ""}</span>
          <h1>Comparaison des combos</h1>
        </div>
        <span className="status-pill status-ok">Par durée exacte</span>
      </section>
      <section className="workspace-section comparison-section">
        <div className="comparison-filter-bar">
          <label className="field">
            Set
            <select value={activeSetupId} onChange={(event) => selectSetup(event.target.value)}>
              {setups.map((setup) => (
                <option key={setup.id} value={setup.id}>{setup.name}</option>
              ))}
            </select>
          </label>
          <fieldset className="duration-segmented">
            <legend>Durée</legend>
            {[1, 2, 3].map((duration) => (
              <button
                className={activeDuration === duration ? "duration-segment active" : "duration-segment"}
                key={duration}
                type="button"
                onClick={() => setSelectedDuration(duration)}
              >
                {duration}T
              </button>
            ))}
          </fieldset>
          {visibleComboCount > 0 ? (
            <button
              className="danger-button"
              type="button"
              onClick={() => setConfirmDeleteVisible(true)}
            >
              <Trash2 size={15} />
              Tout supprimer
            </button>
          ) : null}
        </div>
        {confirmDeleteVisible ? (
          <div className="comparison-confirmation" role="alert">
            <p>Supprimer les {visibleComboLabel} pour ce set en {activeDuration}T ?</p>
            <div>
              <button className="danger-button" type="button" onClick={deleteVisibleCombos}>
                Confirmer la suppression
              </button>
              <button className="secondary-button" type="button" onClick={() => setConfirmDeleteVisible(false)}>
                Annuler
              </button>
            </div>
          </div>
        ) : null}
        <SavedComboExactDurationTable
          duration={activeDuration}
          onDeleteCombo={deleteCombo}
          onOpenCombo={onOpenCombo}
          rows={comparableRows}
        />
      </section>
    </main>
  );
}

export function SetupPage({
  build,
  onBack,
  onOpenBuilder,
  onOpenOptimizer,
  setup,
}: {
  build: ResearchBuild;
  onBack: () => void;
  onOpenBuilder: () => void;
  onOpenOptimizer: () => void;
  setup: SetupSnapshot;
}) {
  const stats = setup.character.stats;
  return (
    <main className="research-shell">
      <PageBackButton onBack={onBack} label={build.name} />
      <section className="build-header">
        <div>
          <span>Set v{setup.version} · {formatWakfuClassLabel(setup.classId)}</span>
          <h1>{setup.name}</h1>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={onOpenBuilder}>
            <Wrench size={16} />
            Builder
          </button>
          <button className="primary-button" type="button" onClick={onOpenOptimizer}>
            <BarChart3 size={16} />
            Optimizer
          </button>
        </div>
      </section>
      <section className="setup-detail-grid">
        <MetricTile label="PA" value={setup.character.resources.ap} />
        <MetricTile label="PM" value={setup.character.resources.mp} />
        <MetricTile label="PW" value={setup.character.resources.wp} />
        <MetricTile label="BQ" value={setup.character.resources.bq} />
        <MetricTile label="Maîtrise générale" value={stats.generalMastery} />
        <MetricTile label="Maîtrise feu" value={stats.elementalMastery.fire} />
        <MetricTile label="Maîtrise eau" value={stats.elementalMastery.water} />
        <MetricTile label="Maîtrise terre" value={stats.elementalMastery.earth} />
        <MetricTile label="Maîtrise air" value={stats.elementalMastery.air} />
        <MetricTile label="Maîtrise distance" value={stats.distanceMastery ?? 0} />
        <MetricTile label="Dommages infligés" value={`${stats.damageInflictedPercent ?? 0}%`} />
      </section>
      <section className="workspace-section">
        <h2>Contexte du set</h2>
        <p>{setup.equipmentNotes}</p>
        <p>Passifs: {setup.passiveIds.join(", ") || "Aucun"}</p>
        <p>Cible: {setup.target.kind}</p>
      </section>
    </main>
  );
}

export function OptimizerWorkspacePage({
  build,
  catalog,
  initialSession,
  onBack,
  onOpenCandidate,
  onSaveCandidate,
  onSaveRun,
  onSessionChange,
  savedCandidateIds,
  savedRunKeys,
  setup,
}: {
  build: ResearchBuild;
  catalog: CatalogEntry[];
  initialSession?: OptimizerWorkspaceSession;
  onBack: () => void;
  onOpenCandidate: (candidate: OptimizerCandidateViewModel) => void;
  onSaveCandidate: (candidate: OptimizerCandidateViewModel, controls: OptimizerWorkspaceControls) => void;
  onSaveRun: (controls: OptimizerWorkspaceControls) => void;
  onSessionChange?: (session: OptimizerWorkspaceSession) => void;
  savedCandidateIds: string[];
  savedRunKeys: string[];
  setup: SetupSnapshot;
}) {
  const [controls, setControls] = useState<OptimizerWorkspaceControls>(() => initialSession?.controls ?? createDefaultOptimizerControls());
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => initialSession?.pinnedIds ?? []);
  const [runStatus, setRunStatus] = useState<OptimizerRunStatus>(() => initialSession?.runStatus ?? "idle");
  const [runProgress, setRunProgress] = useState<OptimizerRunProgressState>(() => initialSession?.runProgress ?? {
    attempts: 0,
    bestScore: undefined as number | undefined,
    invalidCandidates: 0,
    label: "",
    percent: 0,
    validCandidates: 0,
  });
  const [runError, setRunError] = useState<string | null>(() => initialSession?.runError ?? null);
  const [lastRun, setLastRun] = useState<OptimizerRunSnapshot | null>(() => initialSession?.lastRun ?? null);
  const runTimerRef = useRef<number | null>(null);
  const runSequenceRef = useRef(0);
  const runAbortRef = useRef<AbortController | null>(null);
  const onSessionChangeRef = useRef(onSessionChange);
  const normalizedControls = normalizeOptimizerControls(controls);
  const savedCandidateIdSet = useMemo(() => new Set(savedCandidateIds), [savedCandidateIds]);
  const lastRunGroups: DurationGroupedResults = lastRun ? { [lastRun.controls.duration]: lastRun.results } : {};
  const pinnedCandidates = getPinnedCandidates(lastRunGroups, pinnedIds);
  const isRunning = runStatus === "running";
  const controlsDirty = lastRun !== null && createOptimizerControlsKey(lastRun.controls) !== createOptimizerControlsKey(normalizedControls);
  const currentRunSaveKey = lastRun ? createOptimizerRunSaveKey(setup.id, lastRun.controls) : null;
  const currentRunSaved = currentRunSaveKey ? savedRunKeys.includes(currentRunSaveKey) : false;

  useEffect(() => () => {
    if (runTimerRef.current !== null) {
      window.clearTimeout(runTimerRef.current);
    }
    runAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    onSessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);

  useEffect(() => {
    onSessionChangeRef.current?.(createOptimizerWorkspaceSession({
      controls,
      lastRun,
      pinnedIds,
      runError,
      runProgress,
      runStatus,
    }));
  }, [controls, lastRun, pinnedIds, runError, runProgress, runStatus]);

  function updateControls(patch: Partial<OptimizerWorkspaceControls>) {
    if (isRunning) {
      return;
    }

    setControls((current) => normalizeOptimizerControls({ ...current, ...patch }));
  }

  async function launchOptimizerRun() {
    if (isRunning) {
      return;
    }

    const runControls = normalizeOptimizerControls(controls);
    const runSequence = runSequenceRef.current + 1;
    runSequenceRef.current = runSequence;
    if (runTimerRef.current !== null) {
      window.clearTimeout(runTimerRef.current);
    }
    runAbortRef.current?.abort();
    const abortController = new AbortController();
    runAbortRef.current = abortController;

    setPinnedIds([]);
    setRunError(null);
    setRunStatus("running");
    setLastRun({ controls: runControls, results: [] });
    setRunProgress({
      attempts: 0,
      bestScore: undefined,
      invalidCandidates: 0,
      label: "Préparation du run",
      percent: 1,
      validCandidates: 0,
    });

    try {
      let latestRunProgress = {
        attempts: 0,
        invalidCandidates: 0,
        validCandidates: 0,
      };
      const results = await runOptimizerForControlsLive(setup, catalog, runControls, (progress) => {
        if (runSequenceRef.current !== runSequence) {
          return;
        }

        latestRunProgress = {
          attempts: progress.attempts,
          invalidCandidates: progress.invalidCandidates,
          validCandidates: progress.validCandidates,
        };
        const percent = Math.min(99, Math.max(1, Math.round((progress.attempts / runControls.iterationBudget) * 100)));
        setLastRun({ controls: runControls, results: progress.results });
        setRunProgress({
          attempts: progress.attempts,
          bestScore: progress.bestScore,
          invalidCandidates: progress.invalidCandidates,
          label: `${runControls.searchMethod} · génération ${progress.batch}`,
          percent,
          validCandidates: progress.validCandidates,
        });
      }, abortController.signal);

      if (runSequenceRef.current !== runSequence) {
        return;
      }

      setLastRun({ controls: runControls, results });
      if (abortController.signal.aborted) {
        setRunProgress((current) => ({
          ...current,
          attempts: latestRunProgress.attempts,
          bestScore: results[0]?.score,
          invalidCandidates: latestRunProgress.invalidCandidates,
          label: "Optimisation stoppée",
          validCandidates: latestRunProgress.validCandidates,
        }));
        setRunStatus("stopped");
        return;
      }

      setRunProgress({
        attempts: runControls.iterationBudget,
        bestScore: results[0]?.score,
        invalidCandidates: latestRunProgress.invalidCandidates,
        label: "Résultats prêts",
        percent: 100,
        validCandidates: latestRunProgress.validCandidates,
      });
      setRunStatus("done");
    } catch (error) {
      if (runSequenceRef.current !== runSequence) {
        return;
      }
      setRunError(error instanceof Error ? error.message : "Erreur optimizer inconnue");
      setRunProgress({
        attempts: 0,
        bestScore: undefined,
        invalidCandidates: 0,
        label: "Erreur",
        percent: 0,
        validCandidates: 0,
      });
      setRunStatus("error");
    } finally {
      if (runAbortRef.current === abortController) {
        runAbortRef.current = null;
      }
    }
  }

  function stopOptimizerRun() {
    runAbortRef.current?.abort();
  }

  return (
    <main className="research-shell optimizer-shell">
      <PageBackButton onBack={onBack} label={build.name} />
      <section className="build-header">
        <div>
          <span>Set: {setup.name} · {formatWakfuClassLabel(build.classId)}</span>
          <h1>Recherche de combos</h1>
        </div>
        <div className="header-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => lastRun ? onSaveRun(lastRun.controls) : undefined}
            disabled={!lastRun || isRunning || currentRunSaved}
          >
            <Save size={16} />
            {currentRunSaved ? "Run sauvegardé" : "Sauvegarder run"}
          </button>
          <span className="status-pill status-ok">{lastRun ? `${lastRun.controls.duration}T` : "Prêt"}</span>
        </div>
      </section>

      <section className="optimizer-controls">
        <fieldset className="duration-segmented optimizer-duration-choice">
          <legend>Objectif</legend>
          {[1, 2, 3].map((duration) => (
            <button
              className={controls.duration === duration ? "duration-segment active" : "duration-segment"}
              disabled={isRunning}
              key={duration}
              type="button"
              onClick={() => updateControls({ duration })}
            >
              {duration} tour{duration > 1 ? "s" : ""}
            </button>
          ))}
        </fieldset>
        <label className="field">
          Scoring
          <select
            value={controls.scoreCriterion}
            disabled={isRunning}
            onChange={(event) => updateControls({ scoreCriterion: event.target.value as OptimizerWorkspaceControls["scoreCriterion"] })}
          >
            <option value="totalDamage">Dégâts totaux</option>
            <option value="elementDamage">Dégâts élément</option>
          </select>
        </label>
        <label className="field">
          Élément
          <select
            value={controls.targetElement}
            disabled={isRunning || controls.scoreCriterion !== "elementDamage"}
            onChange={(event) => updateControls({ targetElement: event.target.value as OptimizerWorkspaceControls["targetElement"] })}
          >
            <option value="fire">Feu</option>
            <option value="water">Eau</option>
            <option value="earth">Terre</option>
            <option value="air">Air</option>
          </select>
        </label>
        <label className="field">
          Méthode
          <select
            value={controls.searchMethod}
            disabled={isRunning}
            onChange={(event) => updateControls({ searchMethod: event.target.value as OptimizerWorkspaceControls["searchMethod"] })}
          >
            <option value="hybrid">Hybride</option>
            <option value="genetic">Génétique</option>
            <option value="mcts">MCTS</option>
            <option value="annealing">Recuit</option>
            <option value="novelty">Novelty search</option>
            <option value="random">Baseline aléatoire</option>
          </select>
        </label>
        <label className="field">
          Itérations
          <input
            type="number"
            min={10}
            max={1000000}
            step={100}
            value={controls.iterationBudget}
            disabled={isRunning}
            onChange={(event) => updateControls({ iterationBudget: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          Résultats
          <input
            type="number"
            min={1}
            max={50}
            value={controls.maxResultsPerDuration}
            disabled={isRunning}
            onChange={(event) => updateControls({ maxResultsPerDuration: Number(event.target.value) })}
          />
        </label>
        <label className="inline-choice">
          <input
            type="checkbox"
            checked={controls.requireSustainableCycle}
            disabled={isRunning}
            onChange={(event) => updateControls({ requireSustainableCycle: event.target.checked })}
          />
          Cycle soutenable
        </label>
        <button
          className={isRunning ? "secondary-button optimizer-run-button optimizer-stop-button" : "primary-button optimizer-run-button"}
          type="button"
          onClick={isRunning ? stopOptimizerRun : launchOptimizerRun}
        >
          {isRunning ? <X size={16} /> : <Play size={16} />}
          {isRunning ? "Stopper" : lastRun ? "Relancer" : "Lancer l'optimisation"}
        </button>
      </section>

      <section className="workspace-section optimizer-run-panel">
        <div className="section-title-row">
          <h2>{lastRun ? `Résultats ${lastRun.controls.duration}T` : "Résultats"}</h2>
          <div className="header-actions">
            {controlsDirty ? <span className="status-pill status-warn">Paramètres modifiés</span> : null}
            {runStatus === "done" && lastRun ? <span className="status-pill status-ok">{lastRun.results.length} candidat{lastRun.results.length > 1 ? "s" : ""}</span> : null}
            {runStatus === "stopped" && lastRun ? <span className="status-pill status-warn">Stoppé · {lastRun.results.length} candidat{lastRun.results.length > 1 ? "s" : ""}</span> : null}
            {runStatus === "running" ? <span className="status-pill status-ok">Calcul</span> : null}
            {runStatus === "error" ? <span className="status-pill status-error">Erreur</span> : null}
          </div>
        </div>

        {runStatus === "running" ? (
          <div className="optimizer-progress" role="status" aria-live="polite">
            <div>
              <b>{runProgress.label}</b>
              <span>{runProgress.percent}% · {runProgress.attempts}/{normalizedControls.iterationBudget}</span>
            </div>
            <progress value={runProgress.percent} max={100}>{runProgress.percent}%</progress>
            <div className="optimizer-progress-stats">
              <span>Valides: {runProgress.validCandidates}</span>
              <span>Invalides: {runProgress.invalidCandidates}</span>
              <span>Meilleur: {runProgress.bestScore ?? "—"}</span>
            </div>
          </div>
        ) : null}

        {runError ? <EmptyState title="Optimisation interrompue" body={runError} /> : null}
        {!lastRun && runStatus === "idle" ? <EmptyState title="Aucun run lancé" body="Choisis un objectif, puis lance l'optimisation." /> : null}

        {lastRun ? (
          <>
            <p className="run-criteria-summary">{summarizeOptimizerControls(lastRun.controls)}</p>
            <section className="optimizer-result-list">
              {lastRun.results.length ? lastRun.results.map((candidate) => (
              <CandidateRow
                candidate={candidate}
                catalog={catalog}
                key={candidate.id}
                pinned={pinnedIds.includes(candidate.id)}
                saved={savedCandidateIdSet.has(candidate.id)}
                onOpen={() => {
                  onSessionChange?.(createOptimizerWorkspaceSession({
                    controls,
                    lastRun,
                    pinnedIds,
                    runError,
                    runProgress,
                    runStatus,
                  }));
                  onOpenCandidate(candidate);
                }}
                onSave={() => onSaveCandidate(candidate, lastRun.controls)}
                onTogglePin={() => setPinnedIds((current) => togglePinnedCandidate(current, candidate))}
              />
              )) : <EmptyState title="Aucun candidat" body="Aucun combo valide pour cet objectif et ces critères." />}
            </section>
          </>
        ) : null}
      </section>

      <section className="workspace-section comparison-section">
        <h2>Comparaison</h2>
        {pinnedCandidates.length === 0 ? <EmptyState title="Aucun combo épinglé" body="Épingle des candidats pour comparer les métriques normalisées." /> : null}
        {pinnedCandidates.length > 0 ? (
          <div className="comparison-table" role="table">
            <div className="comparison-row comparison-head" role="row">
              <span>Durée</span>
              <span>Total</span>
              <span>/ tour</span>
              <span>/ PA</span>
              <span>Fin</span>
              <span>Cycle</span>
            </div>
            {pinnedCandidates.map((candidate) => (
              <div className="comparison-row" role="row" key={candidate.id}>
                <span>{candidate.duration}T</span>
                <span>{candidate.totalDamage}</span>
                <span>{candidate.damagePerTurn}</span>
                <span>{candidate.damagePerAp}</span>
                <span>{candidate.finalResources.bq} BQ · {candidate.finalResources.wp} PW</span>
                <span>{candidate.sustainable ? "OK" : "Non"}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function PageBackButton({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button className="back-button" type="button" onClick={onBack}>
      <ArrowLeft size={16} />
      {label}
    </button>
  );
}

function BuildRow({
  build,
  onOpen,
  runCount,
  savedComboCount,
  setupCount,
}: {
  build: ResearchBuild;
  onOpen: () => void;
  runCount: number;
  savedComboCount: number;
  setupCount: number;
}) {
  return (
    <button className="build-row" type="button" onClick={onOpen}>
      <span className="build-row-icon"><Boxes size={18} /></span>
      <span>
        <b>{build.name}</b>
        <small>{formatWakfuClassLabel(build.classId)} · {build.gameplayLabel}</small>
      </span>
      <span className="build-row-metrics">
        {setupCount} set · {runCount} run · {savedComboCount} combo
      </span>
    </button>
  );
}

function SetupSummary({
  onCreateBalancedSet,
  onOpenBuilder,
  onOpenOptimizer,
  onOpenSetup,
  setup,
}: {
  onCreateBalancedSet: () => void;
  onOpenBuilder: () => void;
  onOpenOptimizer: () => void;
  onOpenSetup: () => void;
  setup: SetupSnapshot;
}) {
  return (
    <article className="setup-summary">
      <button className="setup-summary-main" type="button" onClick={onOpenSetup}>
        <b>{setup.name}</b>
        <span>v{setup.version} · {setup.character.resources.ap} PA · {setup.character.resources.bq} BQ · stats sauvegardées</span>
      </button>
      <div className="setup-summary-actions">
        <button className="secondary-button" type="button" onClick={onCreateBalancedSet}>
          <Plus size={15} />
          Set équilibré
        </button>
        <button className="secondary-button" type="button" onClick={onOpenBuilder}>Builder</button>
        <button className="primary-button" type="button" onClick={onOpenOptimizer}>Optimizer</button>
      </div>
    </article>
  );
}

function CandidateRow({
  candidate,
  catalog,
  onOpen,
  onSave,
  onTogglePin,
  pinned,
  saved,
}: {
  candidate: OptimizerCandidateViewModel;
  catalog: CatalogEntry[];
  onOpen: () => void;
  onSave: () => void;
  onTogglePin: () => void;
  pinned: boolean;
  saved: boolean;
}) {
  const spellRows = createOptimizerCandidateSpellIconRows(candidate.plan, catalog);
  const catalogNamesById = new Map(catalog.map((entry) => [entry.id, entry.name]));
  const passiveIcons = candidate.passiveIds.map((passiveId) => ({
    label: catalogNamesById.get(passiveId) ?? passiveId,
    passiveId,
  }));

  return (
    <article className="candidate-row">
      <div>
        <b>{candidate.score}</b>
        <span>{candidate.totalDamage} total · {candidate.damagePerTurn}/tour · {candidate.damagePerAp}/PA</span>
        <small>{candidate.actionCount} actions · {candidate.finalResources.bq} BQ · {candidate.finalResources.wp} PW</small>
        {passiveIcons.length > 0 ? (
          <div className="candidate-spell-icon-rows candidate-passive-icons" aria-label="Passifs du candidat">
            <small>Passifs</small>
            <div className="candidate-spell-icon-row">
              {passiveIcons.map((icon) => (
                <PassiveMiniIcon key={icon.passiveId} label={icon.label} passiveId={icon.passiveId} />
              ))}
            </div>
          </div>
        ) : null}
        <div className="candidate-spell-icon-rows" aria-label="Sorts du candidat">
          {spellRows.map((row) => (
            <div className="candidate-spell-icon-row" aria-label={`Tour ${row.turn}`} key={row.turn}>
              {row.icons.map((icon, iconIndex) => (
                <SpellMiniIcon
                  key={`${row.turn}-${icon.spellId}-${iconIndex}`}
                  label={icon.label}
                  spellId={icon.spellId}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="candidate-actions">
        <button
          aria-label={pinned ? "Retirer de la comparaison" : "Épingler pour comparer"}
          className={pinned ? "icon-button active" : "icon-button"}
          type="button"
          onClick={onTogglePin}
          title={pinned ? "Retirer de la comparaison" : "Épingler pour comparer"}
        >
          {pinned ? <Check size={15} /> : <Pin size={15} />}
        </button>
        <button
          aria-label={saved ? "Combo sauvegardé" : "Sauvegarder combo"}
          className={saved ? "icon-button active" : "icon-button"}
          type="button"
          onClick={onSave}
          title={saved ? "Combo sauvegardé" : "Sauvegarder combo"}
          disabled={saved}
        >
          {saved ? <Check size={15} /> : <Save size={15} />}
        </button>
        <button className="secondary-button" type="button" onClick={onOpen}>Ouvrir</button>
      </div>
    </article>
  );
}

function SpellMiniIcon({ label, spellId }: { label: string; spellId: string }) {
  const iconSrc = getHuppermageIconSrc(spellId);

  return iconSrc ? (
    <img className="candidate-spell-icon" src={iconSrc} alt={label} title={label} draggable={false} />
  ) : (
    <span className="candidate-spell-icon candidate-spell-icon-fallback" title={label}>{label.slice(0, 1)}</span>
  );
}

function PassiveMiniIcon({ label, passiveId }: { label: string; passiveId: string }) {
  const iconSrc = getHuppermageIconSrc(passiveId);

  return iconSrc ? (
    <img className="candidate-spell-icon" src={iconSrc} alt={label} title={label} draggable={false} />
  ) : (
    <span className="candidate-spell-icon candidate-spell-icon-fallback" title={label}>{label.slice(0, 1)}</span>
  );
}

function SavedComboExactDurationTable({
  duration,
  onDeleteCombo,
  onOpenCombo,
  rows,
}: {
  duration: number;
  onDeleteCombo: (comboId: string) => void;
  onOpenCombo: (combo: SavedComboReference) => void;
  rows: SavedComboComparisonRow[];
}) {
  if (rows.length === 0) {
    return <EmptyState title={`Aucun combo ${duration}T`} body="Choisis un autre set ou sauvegarde des candidats de cette durée depuis l'optimizer." />;
  }

  return (
    <div className="comparison-table saved-combo-table" role="table">
      <div className="comparison-row comparison-head" role="row">
        <span>Combo</span>
        <span>Total</span>
        <span>/ tour</span>
        <span>Actions</span>
        <span>Critères</span>
        <span>Inspection</span>
        <span>Suppression</span>
      </div>
      {rows.map((row) => (
        <div className="comparison-row" role="row" key={row.combo.id}>
          <span>{row.combo.name}</span>
          <span>{row.totalDamage}</span>
          <span>{row.damagePerTurn}</span>
          <span>{row.actionCount}</span>
          <span>{row.combo.criteriaSummary ?? "Critères non enregistrés"}</span>
          <span>
            <button className="secondary-button" type="button" onClick={() => onOpenCombo(row.combo)}>
              Ouvrir
            </button>
          </span>
          <span>
            <button
              aria-label={`Supprimer ${row.combo.name}`}
              className="icon-button danger-icon-button"
              title={`Supprimer ${row.combo.name}`}
              type="button"
              onClick={() => onDeleteCombo(row.combo.id)}
            >
              <Trash2 size={15} />
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function SavedComboDurationGroups({
  groups,
  onOpenCombo,
  setups,
}: {
  groups: SavedComboComparisonGroups;
  onOpenCombo: (combo: SavedComboReference) => void;
  setups: SetupSnapshot[];
}) {
  const setupById = new Map(setups.map((setup) => [setup.id, setup]));
  const hasAnyCombo = Object.values(groups).some((rows) => rows.length > 0);

  if (!hasAnyCombo) {
    return <EmptyState title="Aucun combo" body="Sauvegarde des candidats depuis l'optimizer pour les comparer ici." />;
  }

  return (
    <section className="saved-combo-groups">
      {[1, 2, 3].map((duration) => (
        <section className="workspace-section saved-combo-group" key={duration}>
          <h2>{duration} tour{duration > 1 ? "s" : ""}</h2>
          {groups[duration]?.length ? (
            <div className="comparison-table saved-combo-table saved-combo-table-with-set" role="table">
              <div className="comparison-row comparison-head" role="row">
                <span>Combo</span>
                <span>Total</span>
                <span>/ tour</span>
                <span>Actions</span>
                <span>Set</span>
                <span>Critères</span>
                <span>Inspection</span>
              </div>
              {groups[duration].map((row) => (
                <div className="comparison-row" role="row" key={row.combo.id}>
                  <span>{row.combo.name}</span>
                  <span>{row.totalDamage}</span>
                  <span>{row.damagePerTurn}</span>
                  <span>{row.actionCount}</span>
                  <span>{setupById.get(row.combo.setupSnapshotId)?.name ?? "Set introuvable"}</span>
                  <span>{row.combo.criteriaSummary ?? "Critères non enregistrés"}</span>
                  <span>
                    <button className="secondary-button" type="button" onClick={() => onOpenCombo(row.combo)}>
                      Ouvrir
                    </button>
                  </span>
                </div>
              ))}
            </div>
          ) : <EmptyState title={`Aucun combo ${duration}T`} body="Les durées restent séparées pour éviter les comparaisons trompeuses." />}
        </section>
      ))}
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function formatDateTime(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}

function createOptimizerControlsKey(controls: OptimizerWorkspaceControls): string {
  const normalized = normalizeOptimizerControls(controls);
  return JSON.stringify({
    beamWidth: normalized.beamWidth,
    duration: normalized.duration,
    iterationBudget: normalized.iterationBudget,
    maxResultsPerDuration: normalized.maxResultsPerDuration,
    requireSustainableCycle: normalized.requireSustainableCycle,
    scoreCriterion: normalized.scoreCriterion,
    searchMethod: normalized.searchMethod,
    targetElement: normalized.targetElement,
  });
}

export function createOptimizerRunSaveKey(setupId: string, controls: OptimizerWorkspaceControls): string {
  return `${setupId}:${summarizeOptimizerControls(controls)}`;
}

function EmptyState({ body, title }: { body: string; title: string }) {
  return (
    <div className="empty-state">
      <b>{title}</b>
      <span>{body}</span>
    </div>
  );
}
