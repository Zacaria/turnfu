import { ArrowLeft, BarChart3, Boxes, Check, Pencil, Pin, Play, Plus, RotateCcw, Save, ScrollText, Search, Swords, Trash2, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogEntry } from "../core/catalog/types.ts";
import type {
  SublimationBuild,
  SublimationContactEnemiesAssumption,
  SublimationHpAssumption,
  SublimationNearbyAlliesAssumption,
} from "../core/sublimations/types.ts";
import { validateSublimationBuild } from "../core/sublimations/index.ts";
import {
  createContinuousOptimizerPageViewModel,
  createDefaultContinuousOptimizerControls,
  streamContinuousOptimizerRun,
  type ContinuousOptimizerCheckpointSummary,
  type ContinuousOptimizerControls,
  type ContinuousOptimizerSessionSummary,
  type ContinuousOptimizerStatus,
} from "./continuousOptimizerWorkspace.ts";
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
import { createSublimationPreviewItems, type SublimationPreviewItem } from "./sublimationPreview.ts";

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

export function createOptimizerWorkspaceSession(session: OptimizerWorkspaceSession): OptimizerWorkspaceSession {
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

function isContinuousSessionMismatchError(error: string | null): boolean {
  return Boolean(error?.includes("fingerprint mismatch") && error.includes("--reset"));
}

function createOptimizerRunDiagnosticLines(error: string | null, messages: string[]): string[] {
  const lines = [
    ...(error?.split("\n").slice(1) ?? []),
    ...messages,
  ].map((line) => line.trim()).filter((line) => line.length > 0);

  return [...new Set(lines)].slice(0, 10);
}

export function ResearchLibraryPage({
  classFilter,
  onClassFilterChange,
  onCreateBuild,
  onOpenContinuousOptimizer,
  onOpenBuild,
  onOpenQuickBuilder,
  workspace,
}: {
  classFilter: WakfuClassId | "all";
  onClassFilterChange: (classId: WakfuClassId | "all") => void;
  onCreateBuild: (input: { classId: WakfuClassId; gameplayLabel: string; name: string }) => void;
  onOpenContinuousOptimizer: () => void;
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
        <div className="row-actions">
          <button className="secondary-button" type="button" onClick={onOpenContinuousOptimizer}>
            <Search size={16} />
            Continuous diagnostics
          </button>
          <button className="secondary-button" type="button" onClick={onOpenQuickBuilder}>
            <Wrench size={16} />
            Builder rapide
          </button>
        </div>
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
  onDeleteSetup,
  onOpenBuilder,
  onOpenOptimizer,
  onOpenRun,
  onOpenSavedCombos,
  onOpenSetup,
  onRenameBuild,
  onRenameSetup,
  runs,
  savedCombos,
  setups,
}: {
  build: ResearchBuild;
  onBack: () => void;
  onCreateBalancedSet: (setup: SetupSnapshot) => void;
  onDeleteSetup: (setup: SetupSnapshot) => void;
  onOpenBuilder: (setup: SetupSnapshot) => void;
  onOpenOptimizer: (setup: SetupSnapshot) => void;
  onOpenRun: (run: OptimizerRunReference) => void;
  onOpenSavedCombos: () => void;
  onOpenSetup: (setup: SetupSnapshot) => void;
  onRenameBuild: (name: string) => void;
  onRenameSetup: (setup: SetupSnapshot, name: string) => void;
  runs: ReturnType<typeof getBuildRuns>;
  savedCombos: ReturnType<typeof getBuildSavedCombos>;
  setups: SetupSnapshot[];
}) {
  const [setupPendingDeleteId, setSetupPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setSetupPendingDeleteId(null);
  }, [build.id, setups.length]);

  function deleteSetup(setup: SetupSnapshot) {
    onDeleteSetup(setup);
    setSetupPendingDeleteId(null);
  }

  return (
    <main className="research-shell">
      <PageBackButton onBack={onBack} label="Builds" />
      <section className="build-header">
        <div className="build-header-title">
          <span>{formatWakfuClassLabel(build.classId)} · {build.gameplayLabel}</span>
          <EditableInlineName
            ariaLabel="Nom du build"
            className="build-title-input"
            name={build.name}
            onRename={onRenameBuild}
          />
        </div>
        <span className="status-pill status-ok">SQLite local</span>
      </section>

      <section className="build-columns">
        <section className="workspace-section">
          <h2>Sets</h2>
          {setups.length === 0 ? <EmptyState title="Aucun set" body="Ce build n'a pas encore de set sauvegardé." /> : null}
          {setups.map((setup) => (
            <SetupSummary
              key={setup.id}
              canDelete={setups.length > 1}
              confirmDelete={setupPendingDeleteId === setup.id}
              setup={setup}
              onCreateBalancedSet={() => onCreateBalancedSet(setup)}
              onCancelDelete={() => setSetupPendingDeleteId(null)}
              onConfirmDelete={() => deleteSetup(setup)}
              onDeleteSetup={() => setSetupPendingDeleteId(setup.id)}
              onOpenBuilder={() => onOpenBuilder(setup)}
              onOpenOptimizer={() => onOpenOptimizer(setup)}
              onOpenSetup={() => onOpenSetup(setup)}
              onRenameSetup={(name) => onRenameSetup(setup, name)}
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
          {savedCombos.map((combo) => {
            const sublimationItems = createSublimationPreviewItems(combo.sublimations);
            return (
              <div className="thin-row saved-combo-row" key={combo.id}>
                <b>{combo.name}</b>
                <span>{combo.totalDamage ?? 0} dégâts</span>
                {sublimationItems.length > 0 ? (
                  <div className="candidate-sublimation-row saved-combo-sublimations" aria-label="Sublimations sauvegardées">
                    {sublimationItems.map((item) => <SublimationMiniCard item={item} key={item.id} />)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      </section>
    </main>
  );
}

export function ContinuousOptimizerPage({ onBack }: { onBack: () => void }) {
  const [controls, setControls] = useState(() => createDefaultContinuousOptimizerControls());
  const abortControllerRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<ContinuousOptimizerStatus>("idle");
  const [session, setSession] = useState<ContinuousOptimizerSessionSummary | null>(null);
  const [checkpoints, setCheckpoints] = useState<ContinuousOptimizerCheckpointSummary[]>([]);
  const [runMessages, setRunMessages] = useState<string[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const displayedSession = session ? { ...session, status } : null;
  const view = createContinuousOptimizerPageViewModel({
    controls,
    session: displayedSession,
    checkpoints,
    reuseTrials: [],
    motifs: [],
  });

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  function startContinuousRun() {
    if (!view.operations.canStart || abortControllerRef.current) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const startedAt = new Date().toISOString();
    setStatus("running");
    setRunError(null);
    setRunMessages([]);
    setSession({
      id: controls.sessionId,
      status: "running",
      totalAttempts: 0,
      validRate: 0,
      bestScore: null,
      workerCount: controls.workerCount,
      updatedAt: startedAt,
    });

    void streamContinuousOptimizerRun({
      args: view.launchArgs,
      onComplete: () => setStatus("stopped"),
      onLog: (line) => {
        setRunMessages((current) => [line, ...current].slice(0, 4));
      },
      onProgress: (payload) => {
        const checkpoint = {
          totalAttempts: payload.totalAttempts,
          score: payload.score,
          validRate: payload.validRate,
        };
        setCheckpoints((current) => {
          const next = current.filter((entry) => entry.totalAttempts !== checkpoint.totalAttempts);
          next.push(checkpoint);
          return next.sort((left, right) => left.totalAttempts - right.totalAttempts);
        });
        setSession({
          id: controls.sessionId,
          status: "running",
          totalAttempts: payload.totalAttempts,
          validRate: payload.validRate,
          bestScore: payload.score,
          workerCount: controls.workerCount,
          updatedAt: new Date().toISOString(),
        });
      },
      onStopped: () => setStatus("stopped"),
      signal: controller.signal,
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("stopped");
        return;
      }
      setStatus("error");
      setRunError(error instanceof Error ? error.message : "Continuous optimizer failed.");
    }).finally(() => {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    });
  }

  function stopContinuousRun() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStatus("stopped");
  }

  function updateControls(next: Partial<ContinuousOptimizerControls>) {
    if (status === "running") {
      return;
    }
    setControls((current) => ({ ...current, ...next }));
  }

  return (
    <main className="research-shell optimizer-shell">
      <PageBackButton onBack={onBack} label="Laboratoire" />
      <section className="build-header">
        <div className="build-header-title">
          <span>Rust/WASM · {view.controls.dbPath}</span>
          <h1>Continuous diagnostics</h1>
        </div>
        <span className="status-pill">{view.statusLabel}</span>
      </section>

      <section className="build-columns">
        <section className="workspace-section">
          <h2>Session</h2>
          <div className="thin-row">
            <b>{view.controls.sessionId}</b>
            <span>
              {view.controls.scenarioId} · {view.controls.workerCount} workers · chunk {view.controls.chunkSize} · {view.qualityPresetLabel}
            </span>
          </div>
          <label className="field">
            Scenario
            <select
              disabled={status === "running"}
              value={view.controls.scenarioId}
              onChange={(event) => updateControls({
                scenarioId: event.currentTarget.value as ContinuousOptimizerControls["scenarioId"],
              })}
            >
              <option value="t1-full">t1-full</option>
              <option value="t2-full">t2-full</option>
              <option value="t3-full">t3-full</option>
            </select>
          </label>
          <label className="field">
            Policy
            <select
              disabled={status === "running"}
              value={view.controls.qualityPreset}
              onChange={(event) => updateControls({
                qualityPreset: event.currentTarget.value as ContinuousOptimizerControls["qualityPreset"],
              })}
            >
              <option value="validated-contextual">Validated contextual</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="field">
            Score
            <select
              disabled={status === "running"}
              value={view.controls.scoreCriterion}
              onChange={(event) => updateControls({
                scoreCriterion: event.currentTarget.value as ContinuousOptimizerControls["scoreCriterion"],
              })}
            >
              <option value="total-damage">Total damage</option>
              <option value="element-damage">Element damage</option>
            </select>
          </label>
          <label className="field">
            Element
            <select
              disabled={status === "running" || view.controls.scoreCriterion === "total-damage"}
              value={view.controls.targetElement}
              onChange={(event) => updateControls({
                targetElement: event.currentTarget.value as ContinuousOptimizerControls["targetElement"],
              })}
            >
              <option value="fire">fire</option>
              <option value="water">water</option>
              <option value="earth">earth</option>
              <option value="air">air</option>
            </select>
          </label>
          <label className="field continuous-checkbox-row">
            <input
              checked={view.controls.requireSustainableCycle}
              disabled={status === "running"}
              type="checkbox"
              onChange={(event) => updateControls({ requireSustainableCycle: event.currentTarget.checked })}
            />
            Sustainable cycle
          </label>
          <div className="row-actions">
            <button className="primary-button" type="button" disabled={!view.operations.canStart} onClick={startContinuousRun}>
              <Play size={16} />
              Start
            </button>
            <button className="secondary-button" type="button" disabled={!view.operations.canPause} onClick={stopContinuousRun}>
              <X size={15} />
              Stop
            </button>
          </div>
        </section>

        <section className="workspace-section">
          <h2>Best combos</h2>
          <div className="thin-row">
            <b>{view.bestCombos.bestScore?.toFixed(2) ?? "Aucun score"}</b>
            <span>{view.bestCombos.totalAttempts.toLocaleString("fr-FR")} attempts · valid {(view.bestCombos.validRate * 100).toFixed(1)}%</span>
          </div>
          {view.bestCombos.checkpoints.length === 0 ? (
            <EmptyState title="Aucun checkpoint" body="La session n'a pas encore publié de checkpoint." />
          ) : null}
          {view.bestCombos.checkpoints.slice(-4).map((checkpoint) => (
            <div className="thin-row" key={checkpoint.totalAttempts}>
              <b>{checkpoint.score.toFixed(2)}</b>
              <span>
                {checkpoint.totalAttempts.toLocaleString("fr-FR")} attempts · valid {(checkpoint.validRate * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </section>

        {runError || runMessages.length > 0 ? (
          <section className="workspace-section">
            <h2>Runner</h2>
            {runError ? <div className="thin-row"><b>Error</b><span>{runError}</span></div> : null}
            {runMessages.map((message, index) => (
              <div className="thin-row" key={`${index}-${message}`}>
                <b>Log</b>
                <span>{message}</span>
              </div>
            ))}
          </section>
        ) : null}

        <section className="workspace-section">
          <h2>Learned evidence</h2>
          {view.learnedEvidence.reuseTrials.length === 0 && view.learnedEvidence.motifs.length === 0 ? (
            <EmptyState title="Aucune évidence" body="Les motifs et essais de réutilisation apparaîtront ici après minage du corpus." />
          ) : null}
          {view.learnedEvidence.reuseTrials.map((trial) => (
            <div className="thin-row" key={trial.label}>
              <b>{trial.label}</b>
              <span>
                source {trial.sourceScore?.toFixed(2) ?? "-"} · result {trial.resultScore?.toFixed(2) ?? "-"}
                {trial.improvedGlobalBest ? " · improved" : ""}
              </span>
            </div>
          ))}
          {view.learnedEvidence.motifs.map((motif) => (
            <div className="thin-row" key={motif.label}>
              <b>{motif.label}</b>
              <span>{motif.bestScore.toFixed(2)} · support {motif.supportCount} · confidence {(motif.confidence * 100).toFixed(0)}%</span>
            </div>
          ))}
        </section>
      </section>
    </main>
  );
}

function EditableInlineName({
  ariaLabel,
  className,
  name,
  onRename,
}: {
  ariaLabel: string;
  className: string;
  name: string;
  onRename: (name: string) => void;
}) {
  const [draftName, setDraftName] = useState(name);
  const skipNextCommitRef = useRef(false);

  useEffect(() => {
    setDraftName(name);
  }, [name]);

  function commitName(candidateName = draftName) {
    if (skipNextCommitRef.current) {
      skipNextCommitRef.current = false;
      setDraftName(name);
      return;
    }

    const nextName = candidateName.trim();
    if (!nextName) {
      setDraftName(name);
      return;
    }
    if (nextName !== name) {
      onRename(nextName);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      commitName(event.currentTarget.value);
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      skipNextCommitRef.current = true;
      setDraftName(name);
      event.currentTarget.blur();
    }
  }

  return (
    <span className={`editable-inline-name ${className}-shell`}>
      <input
        aria-label={ariaLabel}
        className={className}
        value={draftName}
        onBlur={(event) => commitName(event.currentTarget.value)}
        onChange={(event) => setDraftName(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <Pencil aria-hidden="true" className="editable-inline-name-icon" size={15} strokeWidth={2.2} />
    </span>
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
  catalog,
  onBack,
  onChangeSublimations,
  onOpenBuilder,
  onOpenOptimizer,
  onRenameSetup,
  setup,
}: {
  build: ResearchBuild;
  catalog: CatalogEntry[];
  onBack: () => void;
  onChangeSublimations: (sublimations: SublimationBuild) => void;
  onOpenBuilder: () => void;
  onOpenOptimizer: () => void;
  onRenameSetup: (name: string) => void;
  setup: SetupSnapshot;
}) {
  const stats = setup.character.stats;
  const catalogNamesById = new Map(catalog.map((entry) => [entry.id, entry.name]));
  const deckSpellItems = setup.deckSpellIds.map((spellId) => ({
    label: catalogNamesById.get(spellId) ?? spellId,
    spellId,
  }));
  const passiveItems = setup.passiveIds.map((passiveId) => ({
    label: catalogNamesById.get(passiveId) ?? passiveId,
    passiveId,
  }));
  const setupSublimationItems = createSublimationPreviewItems(setup.sublimations);
  const sublimationValidation = validateSublimationBuild(setup.sublimations);

  function changeHpAssumption(hpAssumption: SublimationHpAssumption) {
    onChangeSublimations({
      ...setup.sublimations,
      hpAssumption,
      selections: [...setup.sublimations.selections],
    });
  }

  function changeNearbyAlliesAssumption(nearbyAlliesAssumption: SublimationNearbyAlliesAssumption) {
    onChangeSublimations({
      ...setup.sublimations,
      hpAssumption: setup.sublimations.hpAssumption ?? setup.hpAssumption,
      nearbyAlliesAssumption,
      selections: [...setup.sublimations.selections],
    });
  }

  function changeContactEnemiesAssumption(contactEnemiesAssumption: SublimationContactEnemiesAssumption) {
    onChangeSublimations({
      ...setup.sublimations,
      hpAssumption: setup.sublimations.hpAssumption ?? setup.hpAssumption,
      contactEnemiesAssumption,
      selections: [...setup.sublimations.selections],
    });
  }

  return (
    <main className="research-shell">
      <PageBackButton onBack={onBack} label={build.name} />
      <section className="build-header">
        <div className="build-header-title">
          <span>Set v{setup.version} · {formatWakfuClassLabel(setup.classId)}</span>
          <EditableInlineName
            ariaLabel={`Nom du set v${setup.version}`}
            className="build-title-input"
            name={setup.name}
            onRename={onRenameSetup}
          />
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
        <div className="setup-detail-blocks">
          <section className="setup-detail-block">
            <h3>Sorts</h3>
            <div className="setup-detail-scroll setup-detail-icon-grid">
              {deckSpellItems.length > 0 ? deckSpellItems.map((item) => (
                <SpellMiniIcon key={item.spellId} label={item.label} spellId={item.spellId} />
              )) : <span className="setup-detail-empty">Aucun sort</span>}
            </div>
          </section>
          <section className="setup-detail-block">
            <h3>Passifs</h3>
            <div className="setup-detail-scroll setup-detail-passive-list">
              {passiveItems.length > 0 ? passiveItems.map((item) => (
                <span className="setup-detail-passive" key={item.passiveId}>
                  <PassiveMiniIcon label={item.label} passiveId={item.passiveId} />
                  <span>{item.label}</span>
                </span>
              )) : <span className="setup-detail-empty">Aucun passif</span>}
            </div>
          </section>
          <section className="setup-detail-block setup-detail-sublimations">
            <h3>Sublimations</h3>
            <div className="candidate-sublimation-row">
              {setupSublimationItems.length > 0 ? setupSublimationItems.map((item) => (
                <SublimationMiniCard item={item} key={item.id} />
              )) : <span className="setup-detail-empty">Aucune sublimation</span>}
            </div>
          </section>
        </div>
        <p>Cible: {setup.target.kind}</p>
        <p>Hypothèse PV: {formatHpAssumption(setup.hpAssumption)}</p>
        <p>Alliés proches: {formatNearbyAlliesAssumption(setup.sublimations.nearbyAlliesAssumption)}</p>
        <p>Ennemis au contact: {formatContactEnemiesAssumption(setup.sublimations.contactEnemiesAssumption)}</p>
      </section>
      <section className="workspace-section">
        <h2>Sublimations</h2>
        <div className="sublimation-assumption-grid">
          <fieldset className="sublimation-assumption-control hp-assumption-control">
            <legend>Hypothèse PV</legend>
            <div className="sublimation-assumption-options">
              {hpAssumptionChoices.map((choice) => {
                const selected = (setup.sublimations.hpAssumption ?? setup.hpAssumption) === choice.value;
                return (
                  <button
                    aria-pressed={selected}
                    className={selected ? "sublimation-assumption-choice selected" : "sublimation-assumption-choice"}
                    key={choice.value}
                    type="button"
                    onClick={() => changeHpAssumption(choice.value)}
                  >
                    {selected ? <Check size={14} /> : null}
                    <span>{choice.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="sublimation-assumption-control">
            <legend>Alliés proches</legend>
            <div className="sublimation-assumption-options">
              {nearbyAlliesAssumptionChoices.map((choice) => {
                const selected = (setup.sublimations.nearbyAlliesAssumption ?? "unspecified") === choice.value;
                return (
                  <button
                    aria-pressed={selected}
                    className={selected ? "sublimation-assumption-choice selected" : "sublimation-assumption-choice"}
                    key={choice.value}
                    type="button"
                    onClick={() => changeNearbyAlliesAssumption(choice.value)}
                  >
                    {selected ? <Check size={14} /> : null}
                    <span>{choice.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="sublimation-assumption-control">
            <legend>Ennemis au contact</legend>
            <div className="sublimation-assumption-options">
              {contactEnemiesAssumptionChoices.map((choice) => {
                const selected = (setup.sublimations.contactEnemiesAssumption ?? "unspecified") === choice.value;
                return (
                  <button
                    aria-pressed={selected}
                    className={selected ? "sublimation-assumption-choice selected" : "sublimation-assumption-choice"}
                    key={choice.value}
                    type="button"
                    onClick={() => changeContactEnemiesAssumption(choice.value)}
                  >
                    {selected ? <Check size={14} /> : null}
                    <span>{choice.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
        {sublimationValidation.violations.length > 0 ? (
          <ul className="compact-effect-list">
            {sublimationValidation.violations.map((violation, index) => <li key={`${violation.type}-${index}`}>{violation.message}</li>)}
          </ul>
        ) : null}
        {sublimationValidation.effectiveStacks.length > 0 ? (
          <ul className="compact-effect-list">
            {sublimationValidation.effectiveStacks.map((stack) => (
              <li key={stack.familyId}>
                {stack.familyId}: niveau {stack.effectiveLevel}/{stack.cumulativeMax}
                {stack.rawLevel !== stack.effectiveLevel ? ` (brut ${stack.rawLevel})` : ""}
              </li>
            ))}
          </ul>
        ) : null}
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
  const [runMessages, setRunMessages] = useState<string[]>([]);
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false);
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
  const runDiagnosticLines = createOptimizerRunDiagnosticLines(runError, runMessages);
  const isContinuousMethod = normalizedControls.searchMethod === "continuous";

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

  async function launchOptimizerRun(options: { resetContinuousSession?: boolean } = {}) {
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
    setRunMessages([]);
    setRunStatus("running");
    setLastRun({ controls: runControls, results: [] });
    let latestRunProgress = {
      attempts: 0,
      invalidCandidates: 0,
      validCandidates: 0,
    };
    setRunProgress({
      attempts: 0,
      bestScore: undefined,
      invalidCandidates: 0,
      label: options.resetContinuousSession ? "Réinitialisation de la session" : "Préparation du run",
      percent: 1,
      validCandidates: 0,
    });

    try {
      await waitForUiFrame();
      if (runSequenceRef.current !== runSequence || abortController.signal.aborted) {
        return;
      }

      const targetAttempts = runControls.iterationBudget;
      const results = await runOptimizerForControlsLive(setup, catalog, runControls, (progress) => {
        if (runSequenceRef.current !== runSequence) {
          return;
        }

        latestRunProgress = {
          attempts: progress.attempts,
          invalidCandidates: progress.invalidCandidates,
          validCandidates: progress.validCandidates,
        };
        const percent = Math.min(99, Math.max(1, Math.round((progress.attempts / targetAttempts) * 100)));
        setLastRun({ controls: runControls, results: progress.results });
        setRunProgress({
          attempts: progress.attempts,
          bestScore: progress.bestScore,
          invalidCandidates: progress.invalidCandidates,
          label: progress.label ?? (runControls.searchMethod === "continuous"
            ? `continuous · checkpoint ${progress.batch}`
            : `${runControls.searchMethod} · génération ${progress.batch}`),
          percent,
          validCandidates: progress.validCandidates,
        });
      }, abortController.signal, {
        resetContinuousSession: options.resetContinuousSession,
        onLog: (line) => {
          if (runSequenceRef.current !== runSequence) {
            return;
          }

          setRunMessages((current) => [line, ...current.filter((entry) => entry !== line)].slice(0, 8));
        },
      });

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
      if (abortController.signal.aborted) {
        setRunProgress((current) => ({
          ...current,
          attempts: latestRunProgress.attempts,
          invalidCandidates: latestRunProgress.invalidCandidates,
          label: "Optimisation stoppée",
          validCandidates: latestRunProgress.validCandidates,
        }));
        setRunStatus("stopped");
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
    <>
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
            <option value="continuous">Continuous</option>
            <option value="genetic">Génétique</option>
            <option value="mcts">MCTS</option>
            <option value="annealing">Recuit</option>
            <option value="novelty">Novelty search</option>
            <option value="random">Baseline aléatoire</option>
          </select>
        </label>
        <label className="field">
          Essais par lot
          <input
            type="number"
            min={controls.searchMethod === "continuous" ? 1000000 : 10}
            max={controls.searchMethod === "continuous" ? 100000000 : 1000000}
            step={controls.searchMethod === "continuous" ? 1000000 : 100}
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
          onClick={() => {
            if (isRunning) {
              stopOptimizerRun();
              return;
            }

            void launchOptimizerRun();
          }}
        >
          {isRunning ? <X size={16} /> : <Play size={16} />}
          {isRunning ? "Stopper" : lastRun ? "Relancer" : "Lancer l'optimisation"}
        </button>
        {isContinuousMethod ? (
          <button
            className="secondary-button optimizer-reset-button"
            type="button"
            disabled={isRunning}
            onClick={() => setResetConfirmationOpen(true)}
          >
            <RotateCcw size={16} />
            Reset session
          </button>
        ) : null}
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
              <span>{runProgress.attempts} essais explorés</span>
            </div>
            <div className="optimizer-progress-stats">
              <span>Valides: {runProgress.validCandidates}</span>
              <span>Invalides: {runProgress.invalidCandidates}</span>
              <span>Meilleur: {runProgress.bestScore ?? "—"}</span>
            </div>
          </div>
        ) : null}

        {runError ? (
          <div className="optimizer-run-error" role="alert">
            <div>
              <h3>Optimisation interrompue</h3>
              <p>{runError.split("\n")[0]}</p>
            </div>
            {runDiagnosticLines.length > 0 ? (
              <details>
                <summary>Détails du runner</summary>
                <pre>{runDiagnosticLines.join("\n")}</pre>
              </details>
            ) : null}
            {isContinuousSessionMismatchError(runError) ? <p>Utilise Reset session pour relancer avec l'état courant.</p> : null}
          </div>
        ) : null}
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
                sublimations={candidate.sublimations}
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
    {resetConfirmationOpen ? (
      <div className="optimizer-reset-modal-backdrop" role="presentation">
        <div
          aria-labelledby="optimizer-reset-title"
          aria-modal="true"
          className="optimizer-reset-modal"
          role="dialog"
        >
          <h2 id="optimizer-reset-title">Réinitialiser la session Continuous ?</h2>
          <p>
            L'état de recherche persisté pour cet objectif sera remplacé, puis le run redémarrera avec les sorts,
            passifs, sublimations et contraintes actuellement sélectionnés.
          </p>
          <div className="optimizer-reset-modal-actions">
            <button className="secondary-button" type="button" onClick={() => setResetConfirmationOpen(false)}>
              Annuler
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setResetConfirmationOpen(false);
                void launchOptimizerRun({ resetContinuousSession: true });
              }}
            >
              <RotateCcw size={16} />
              Réinitialiser et relancer
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}

function waitForUiFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
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
  canDelete,
  confirmDelete,
  onCancelDelete,
  onConfirmDelete,
  onCreateBalancedSet,
  onDeleteSetup,
  onOpenBuilder,
  onOpenOptimizer,
  onOpenSetup,
  onRenameSetup,
  setup,
}: {
  canDelete: boolean;
  confirmDelete: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onCreateBalancedSet: () => void;
  onDeleteSetup: () => void;
  onOpenBuilder: () => void;
  onOpenOptimizer: () => void;
  onOpenSetup: () => void;
  onRenameSetup: (name: string) => void;
  setup: SetupSnapshot;
}) {
  return (
    <article className="setup-summary">
      <div className="setup-summary-main">
        <EditableInlineName
          ariaLabel={`Nom du set v${setup.version}`}
          className="setup-name-input"
          name={setup.name}
          onRename={onRenameSetup}
        />
        <button className="setup-summary-open" type="button" onClick={onOpenSetup}>
          v{setup.version} · {setup.character.resources.ap} PA · {setup.character.resources.bq} BQ · stats sauvegardées
        </button>
      </div>
      <div className="setup-summary-actions">
        <button className="secondary-button" type="button" onClick={onCreateBalancedSet}>
          <Plus size={15} />
          Set équilibré
        </button>
        <button className="secondary-button" type="button" onClick={onOpenBuilder}>Builder</button>
        <button className="primary-button" type="button" onClick={onOpenOptimizer}>Optimizer</button>
        {canDelete ? (
          <button
            aria-label={`Supprimer ${setup.name} v${setup.version}`}
            className="icon-button danger-icon-button"
            title={`Supprimer ${setup.name} v${setup.version}`}
            type="button"
            onClick={onDeleteSetup}
          >
            <Trash2 size={15} />
          </button>
        ) : null}
      </div>
      {confirmDelete ? (
        <div className="setup-summary-confirmation" role="alert">
          <p>Supprimer ce set et ses runs/combos sauvegardés ?</p>
          <div>
            <button className="danger-button" type="button" onClick={onConfirmDelete}>
              Confirmer
            </button>
            <button className="secondary-button" type="button" onClick={onCancelDelete}>
              Annuler
            </button>
          </div>
        </div>
      ) : null}
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
  sublimations,
}: {
  candidate: OptimizerCandidateViewModel;
  catalog: CatalogEntry[];
  onOpen: () => void;
  onSave: () => void;
  onTogglePin: () => void;
  pinned: boolean;
  saved: boolean;
  sublimations: SublimationBuild | undefined;
}) {
  const spellRows = createOptimizerCandidateSpellIconRows(candidate.plan, catalog);
  const catalogNamesById = new Map(catalog.map((entry) => [entry.id, entry.name]));
  const passiveIcons = candidate.passiveIds.map((passiveId) => ({
    label: catalogNamesById.get(passiveId) ?? passiveId,
    passiveId,
  }));
  const sublimationItems = createSublimationPreviewItems(sublimations);

  return (
    <article className="candidate-row">
      <div>
        <small className="candidate-score-label">Score objectif</small>
        <b>{candidate.score}</b>
        <span>Dégâts totaux {candidate.totalDamage} · {candidate.damagePerTurn}/tour · {candidate.damagePerAp}/PA</span>
        <small>
          {candidate.actionCount} actions · {candidate.finalResources.bq} BQ · {candidate.finalResources.wp} PW
          {candidate.sustainabilityRequired ? ` · cycle ${candidate.sustainable ? "OK" : "Non"}` : ""}
        </small>
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
        {sublimationItems.length > 0 ? (
          <div className="candidate-spell-icon-rows candidate-sublimation-preview" aria-label="Sublimations du candidat">
            <small>Sublimations</small>
            <div className="candidate-sublimation-row">
              {sublimationItems.map((item) => <SublimationMiniCard item={item} key={item.id} />)}
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

function SublimationMiniCard({ item }: { item: SublimationPreviewItem }) {
  return (
    <div className={`sublimation-preview-card sublimation-preview-${item.category} sublimation-preview-tone-${item.tone}`} tabIndex={0}>
      {item.iconSrc ? (
        <img className="sublimation-preview-icon" src={item.iconSrc} alt="" draggable={false} />
      ) : (
        <span className="sublimation-preview-icon sublimation-preview-icon-fallback" aria-hidden="true">{item.name.slice(0, 1)}</span>
      )}
      <span className={`sublimation-preview-name sublimation-title-${item.tone}`}>{item.name}</span>
      <SublimationInfoTooltip item={item} />
    </div>
  );
}

function SublimationInfoTooltip({ item }: { item: SublimationPreviewItem }) {
  const effectLines = item.effectLines.length > 0 ? item.effectLines : item.sourceDescription ? [item.sourceDescription] : [];

  return (
    <aside className="spell-info-tooltip sublimation-info-tooltip" role="tooltip">
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

function SavedComboNameCell({ combo }: { combo: SavedComboReference }) {
  const sublimationItems = createSublimationPreviewItems(combo.sublimations);

  return (
    <div className="saved-combo-name-cell">
      <b>{combo.name}</b>
      {sublimationItems.length > 0 ? (
        <div className="candidate-sublimation-row saved-combo-sublimations" aria-label="Sublimations sauvegardées">
          {sublimationItems.map((item) => <SublimationMiniCard item={item} key={item.id} />)}
        </div>
      ) : null}
    </div>
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
          <SavedComboNameCell combo={row.combo} />
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
                  <SavedComboNameCell combo={row.combo} />
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

const hpAssumptionChoices: Array<{ value: SublimationHpAssumption; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "healthy90", label: "90%+" },
  { value: "berserk50", label: "Berserk 50%-" },
  { value: "berserk20", label: "Berserk 20%-" },
];

const nearbyAlliesAssumptionChoices: Array<{ value: SublimationNearbyAlliesAssumption; label: string }> = [
  { value: "unspecified", label: "Non fixé" },
  { value: "none", label: "0" },
  { value: "one", label: "1" },
  { value: "twoPlus", label: "2+" },
];

const contactEnemiesAssumptionChoices: Array<{ value: SublimationContactEnemiesAssumption; label: string }> = [
  { value: "unspecified", label: "Non fixé" },
  { value: "none", label: "0" },
  { value: "one", label: "1" },
  { value: "two", label: "2" },
  { value: "threePlus", label: "3+" },
];

function formatHpAssumption(assumption: SetupSnapshot["hpAssumption"]): string {
  if (assumption === "healthy90") {
    return "90%+";
  }

  if (assumption === "berserk50") {
    return "Berserk 50%-";
  }

  if (assumption === "berserk20") {
    return "Berserk 20%-";
  }

  return "Normal";
}

function formatNearbyAlliesAssumption(assumption: SublimationNearbyAlliesAssumption | undefined): string {
  if (assumption === "none") {
    return "0";
  }

  if (assumption === "one") {
    return "1";
  }

  if (assumption === "twoPlus") {
    return "2+";
  }

  return "Non fixé";
}

function formatContactEnemiesAssumption(assumption: SublimationContactEnemiesAssumption | undefined): string {
  if (assumption === "none") {
    return "0";
  }

  if (assumption === "one") {
    return "1";
  }

  if (assumption === "two") {
    return "2";
  }

  if (assumption === "threePlus") {
    return "3+";
  }

  return "Non fixé";
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
