import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from "lucide-react";
import {
  getHuppermagePassives,
  getHuppermageSpells,
} from "../core/catalog/index.ts";
import type { CatalogEntry, Effect, Element, Resource, Rune } from "../core/catalog/types.ts";
import {
  createResources,
  simulateTurn,
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
  RangeMode,
  SimulatedCharacter,
} from "../core/simulation/types.ts";
import {
  applyAptitudesToCharacterStats,
  aptitudeDefinitions,
  aptitudeFamilies,
  aptitudeFamilyOrder,
  computeAptitudeStats,
  createDefaultAptitudeDistribution,
  getAvailableAptitudePoints,
  getSpentAptitudePoints,
  setAptitudeLevel,
  setAptitudeRank,
  type AppliedAptitudeStats,
  type AptitudeDistribution,
  type AptitudeFamilyId,
} from "./aptitudes.ts";
import { createDefaultCharacter, defaultActionContext, defaultActionTarget } from "./defaults.ts";
import { resolveDetailTarget } from "./detailSelection.ts";
import { describeEffect, describeViolation, formatHeart, formatNumber, summarizeStats } from "./format.ts";
import {
  elementToRune,
  huppermageElementChoices,
  type HuppermageElementChoice,
  runeToElementChoice,
} from "./huppermageElementControls.ts";
import { getHuppermageIconSrc } from "./icons.ts";
import {
  getAptitudeIconSrc,
  getElementMasteryIconSrc,
  getResourceIconSrc,
  getStatIconSrc,
  type StatIconKey,
} from "./statIcons.ts?v=module-stat-icons-v1";
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
} from "./i18n.ts?v=responsive-panels-v5";
import { getStatStep } from "./statControls.ts";
import { createTimelineDropIntent, type TimelineDropIntent } from "./timelineDnd.ts";
import { createTimelineSnapshots } from "./timelineSnapshots.ts";

type TimelineAction = Action & {
  uid: string;
};

type TimelineSnapshot = ReturnType<typeof createTimelineSnapshots>[number];

type SetupTabId = "distribution" | "adjustments" | "state";

type DragPayload =
  | { type: "spell"; spellId: string }
  | { type: "timelineAction"; uid: string };

const dragPayloadType = "application/x-wakfu-turn-action";
const runeOptions: Rune[] = ["incandescent", "aquatic", "telluric", "aerial"];
const resourceOptions: Resource[] = ["ap", "mp", "wp", "bq"];
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
  const [character, setCharacter] = useState<SimulatedCharacter>(() => createDefaultCharacter());
  const [locale, setLocale] = useState<UiLocale>("fr");
  const [setupTab, setSetupTab] = useState<SetupTabId>("distribution");
  const [aptitudeDistribution, setAptitudeDistribution] = useState<AptitudeDistribution>(() => createDefaultAptitudeDistribution());
  const [timeline, setTimeline] = useState<TimelineAction[]>(() => [
    createTimelineAction("lueur-de-laube"),
    createTimelineAction("coeur-de-lumiere"),
    createTimelineAction("rayon-crepusculaire"),
  ]);
  const [selectedStep, setSelectedStep] = useState(0);
  const [selectedTimelineUid, setSelectedTimelineUid] = useState<string | null>(() => timeline[0]?.uid ?? null);
  const [selectedCatalogEntryId, setSelectedCatalogEntryId] = useState<string | null>(null);
  const [hoveredCatalogEntryId, setHoveredCatalogEntryId] = useState<string | null>(null);
  const [hiddenCatalogEntries, setHiddenCatalogEntries] = useState<HiddenCatalogEntryState>(() => createHiddenCatalogEntryState());
  const [showHiddenCatalogEntries, setShowHiddenCatalogEntries] = useState(false);
  const [timelineDropIntent, setTimelineDropIntent] = useState<TimelineDropIntent | null>(null);

  const sequence = useMemo(
    () => ({ actions: timeline.map(({ uid: _uid, ...action }) => action) }),
    [timeline],
  );
  const timelineUids = useMemo(() => timeline.map((action) => action.uid), [timeline]);
  const simulation = useMemo(
    () => simulateTurn({ catalog: [...spells, ...passives], character, sequence }),
    [character, passives, sequence, spells],
  );
  const snapshots = useMemo(() => createTimelineSnapshots(simulation, character), [character, simulation]);
  const currentSnapshot = snapshots[Math.min(selectedStep, snapshots.length - 1)] ?? snapshots[0];
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
    ? simulation.breakdown.find((entry) => entry.actionIndex === selectedActionIndex)
    : undefined;
  const selectedCatalogEntry = detailTarget.kind === "catalog"
    ? [...spells, ...passives].find((entry) => entry.id === detailTarget.entryId)
    : selectedAction
      ? spells.find((entry) => entry.id === selectedAction.spellId)
      : undefined;

  useEffect(() => {
    setSelectedStep((step) => Math.min(step, Math.max(0, snapshots.length - 1)));
  }, [snapshots.length]);

  useEffect(() => {
    setUiLocale(locale);
    document.documentElement.lang = locale;
    document.title = t("app.title");
  }, [locale]);

  function changeLocale(nextLocale: UiLocale) {
    setUiLocale(nextLocale);
    setLocale(nextLocale);
  }

  function insertAction(spellId: string, index = timeline.length) {
    const targetIndex = clamp(index, 0, timeline.length);
    const nextAction = createTimelineAction(spellId);
    setTimeline((actions) => {
      return [
        ...actions.slice(0, targetIndex),
        nextAction,
        ...actions.slice(targetIndex),
      ];
    });
    setSelectedTimelineUid(nextAction.uid);
    setSelectedCatalogEntryId(null);
    setSelectedStep(clamp(targetIndex + 1, 1, timeline.length + 1));
  }

  function updateAction(index: number, patch: Partial<Action>) {
    setTimeline((actions) => actions.map((action, actionIndex) => actionIndex === index ? { ...action, ...patch } : action));
  }

  function moveAction(index: number, direction: -1 | 1) {
    setTimeline((actions) => {
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
    const sourceIndex = timeline.findIndex((action) => action.uid === uid);
    if (sourceIndex < 0) {
      return;
    }

    const adjustedIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const boundedIndex = clamp(adjustedIndex, 0, timeline.length - 1);

    setTimeline((actions) => {
      const nextActions = [...actions];
      const [movedAction] = nextActions.splice(sourceIndex, 1);
      nextActions.splice(boundedIndex, 0, movedAction);
      return nextActions;
    });
    setSelectedStep(boundedIndex + 1);
  }

  function duplicateAction(index: number) {
    setTimeline((actions) => {
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
    setTimeline((actions) => actions.filter((_action, actionIndex) => actionIndex !== index));
    if (removedUid && removedUid === selectedTimelineUid) {
      setSelectedTimelineUid(timeline[index + 1]?.uid ?? timeline[index - 1]?.uid ?? null);
    }
    setSelectedStep((step) => Math.max(0, Math.min(step, timeline.length - 1)));
  }

  function selectTimelineAction(uid: string, index: number) {
    setSelectedTimelineUid(uid);
    setSelectedCatalogEntryId(null);
    setSelectedStep(Math.min(index + 1, snapshots.length - 1));
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
    const huppermage = character.classState?.huppermage;
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

    setCharacter({
      ...character,
      classState: {
        ...character.classState,
        huppermage: {
          ...huppermage,
          activePassives: [...activePassives],
        },
      },
    });
  }

  function applyAptitudeDistribution(distribution = aptitudeDistribution) {
    const applied = applyAptitudesToCharacterStats(distribution, character.stats, character.resources);
    setCharacter({
      ...character,
      resources: applied.resources,
      stats: applied.stats,
    });
  }

  function startSpellDrag(event: React.DragEvent, spellId: string) {
    writeDragPayload(event, { type: "spell", spellId });
    event.dataTransfer.effectAllowed = "copy";
    setTimelineDropIntent(null);
  }

  function startTimelineDrag(event: React.DragEvent, uid: string) {
    writeDragPayload(event, { type: "timelineAction", uid });
    event.dataTransfer.effectAllowed = "move";
    setTimelineDropIntent(null);
  }

  function allowTimelineDrop(event: React.DragEvent, index: number) {
    event.preventDefault();
    const payload = readDragPayload(event);
    event.dataTransfer.dropEffect = payload?.type === "timelineAction" ? "move" : "copy";
    setTimelineDropIntent(payload ? createTimelineDropIntent(payload, timelineUids, index) : null);
  }

  function clearTimelineDrop() {
    setTimelineDropIntent(null);
  }

  function leaveTimelineDrop(event: React.DragEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (!nextTarget || !(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      clearTimelineDrop();
    }
  }

  function dropOnTimeline(event: React.DragEvent, index = timeline.length) {
    event.preventDefault();
    event.stopPropagation();

    const payload = readDragPayload(event);
    const intent = payload ? createTimelineDropIntent(payload, timelineUids, index) : null;
    clearTimelineDrop();
    if (!payload) {
      return;
    }

    if (intent?.kind === "insertSpell") {
      insertAction(intent.spellId, intent.insertIndex);
      return;
    }

    if (intent?.kind === "moveAction" && !intent.isNoop) {
      moveActionToIndex(intent.uid, intent.insertIndex);
    }
  }

  return (
    <>
      <header className="app-header" aria-label={t("app.title")}>
        <div className="project-brand">
          <strong>{t("app.projectName")}</strong>
        </div>
        <LanguageSelector locale={locale} onChange={changeLocale} />
      </header>

      <main className="app-shell">
        <section className="live-results" aria-label={t("app.liveResults")}>
          <div className="brand-block">
            <span>{t("app.className")}</span>
            <h1>{t("app.heading")}</h1>
          </div>
          <div className="live-score-card" title={t("metric.turnDamage")}>
            <span>{t("metric.turnDamage")}</span>
            <b>{simulation.totalDamage}</b>
          </div>
          <div className="live-support">
            <div className="live-metrics">
              <div>
                <span>{t("metric.stepDamage")}</span>
                <b>{currentSnapshot?.totalDamageSoFar ?? 0}</b>
              </div>
              <div>
                <span>{t("metric.actions")}</span>
                <b>{simulation.breakdown.length}/{timeline.length}</b>
              </div>
            </div>
            <ResourceStrip resources={currentSnapshot?.resources ?? character.resources} />
            <RuneStrip huppermage={currentSnapshot?.classState.huppermage} />
            <div className={simulation.valid ? "status-pill status-ok" : "status-pill status-error"}>
              {simulation.valid ? t("status.valid") : t("status.invalid")}
            </div>
          </div>
          <CursorControl value={selectedStep} max={Math.max(0, snapshots.length - 1)} onChange={setSelectedStep} />
        </section>

        <section className="workspace">
          <aside className="panel setup-panel" aria-label={t("panel.characterConfig")}>
            <PanelHeader title={t("panel.initialStats")} subtitle={t("panel.startingPoint")} />
            <SetupTabs value={setupTab} onChange={setSetupTab} />
            {setupTab === "distribution" ? (
              <AptitudeDistributionEditor
                distribution={aptitudeDistribution}
                onApply={applyAptitudeDistribution}
                onChange={setAptitudeDistribution}
              />
            ) : null}
            {setupTab === "adjustments" ? (
              <>
                <ResourceEditor character={character} onChange={setCharacter} />
                <StatsEditor character={character} onChange={setCharacter} />
              </>
            ) : null}
            {setupTab === "state" ? (
              <HuppermageStateEditor character={character} onChange={setCharacter} />
            ) : null}
          </aside>

          <section className="panel center-panel" aria-label={t("panel.sequenceDetails")}>
            <PanelHeader title={t("panel.sequence")} subtitle={t("panel.actionOrder")} />
            <div
              className={`sequence-rack ${timeline.length === 0 ? "empty" : ""} ${timelineDropIntent ? "dragging" : ""}`}
              onDragLeave={leaveTimelineDrop}
              onDragOver={(event) => allowTimelineDrop(event, timeline.length)}
              onDrop={(event) => dropOnTimeline(event, timeline.length)}
            >
              {timeline.map((action, index) => {
                const spell = spells.find((entry) => entry.id === action.spellId);
                const isFailed = simulation.violations.some((violation) => violation.actionIndex === index);
                const isSelected = selectedTimelineUid === action.uid;
                const isCursorStep = selectedStep === index + 1;
                const isDragSource = timelineDropIntent?.kind === "moveAction" && timelineDropIntent.sourceIndex === index;

                return (
                  <Fragment key={action.uid}>
                    <TimelineDropMarker active={isTimelineDropMarkerActive(timelineDropIntent, index)} />
                    <button
                      aria-label={`${index + 1}. ${spell?.name ?? t("action.unknownSpell")}`}
                      className={`sequence-tile ${isSelected ? "selected" : ""} ${isCursorStep ? "cursor-step" : ""} ${isFailed ? "failed" : ""} ${isDragSource ? "drag-source" : ""}`}
                      draggable
                      type="button"
                      onClick={() => selectTimelineAction(action.uid, index)}
                      onDragEnd={clearTimelineDrop}
                      onDragStart={(event) => startTimelineDrag(event, action.uid)}
                      onDragOver={(event) => allowTimelineDrop(event, index)}
                      onDrop={(event) => dropOnTimeline(event, index)}
                    >
                      <span className="tile-index">{index + 1}</span>
                      <EntryIcon entryId={action.spellId} label={spell?.name ?? t("action.unknownSpell")} />
                      {isFailed ? <span className="tile-warning" title={t("action.invalid")}>!</span> : null}
                    </button>
                  </Fragment>
                );
              })}
              <TimelineDropMarker active={isTimelineDropMarkerActive(timelineDropIntent, timeline.length)} />
              <button
                aria-label={t("action.addToEnd")}
                className="sequence-add"
                type="button"
                onDragOver={(event) => allowTimelineDrop(event, timeline.length)}
                onDrop={(event) => dropOnTimeline(event, timeline.length)}
                onClick={() => selectedCatalogEntry?.kind !== "passive" && selectedCatalogEntry ? insertAction(selectedCatalogEntry.id) : undefined}
              >
                <Plus size={18} />
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
          </section>

        <aside className="panel library-panel" aria-label={t("panel.library")}>
          <PanelHeader title={t("panel.library")} subtitle={t("panel.build")} />
          <CatalogLibrary
            activePassives={character.classState?.huppermage?.activePassives ?? []}
            deckSpellLimit={deckSpellLimit}
            hiddenEntries={hiddenCatalogEntries}
            passives={passives}
            passiveLimit={passiveLimit}
            showHiddenEntries={showHiddenCatalogEntries}
            spells={spells}
            temporaryUnlockedSpellElement={temporaryUnlockedSpellElement}
            usedSpellIds={usedSpellIds}
            onDragSpell={startSpellDrag}
            onDragEnd={clearTimelineDrop}
            onHoverEntry={setHoveredCatalogEntryId}
            onSelectEntry={selectCatalogEntry}
            onShowHiddenEntriesChange={setShowHiddenCatalogEntries}
            onToggleEntryHidden={toggleCatalogEntryHidden}
            onTogglePassive={togglePassive}
          />
        </aside>
      </section>
      </main>
    </>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
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

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      <span>{subtitle}</span>
    </div>
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

function SetupTabs({ onChange, value }: { onChange: (tab: SetupTabId) => void; value: SetupTabId }) {
  const tabs: Array<{ id: SetupTabId; label: string }> = [
    { id: "distribution", label: t("panel.distributionTab") },
    { id: "adjustments", label: t("panel.adjustmentsTab") },
    { id: "state", label: t("panel.stateTab") },
  ];

  return (
    <div className="setup-tabs" role="tablist" aria-label={t("panel.characterConfig")}>
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

function ResourceStrip({ resources }: { resources: SimulatedCharacter["resources"] }) {
  return (
    <div className="resource-strip" aria-label={t("resources.current")}>
      {resourceOptions.map((resource) => (
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
        <RuneStrip huppermage={huppermage} />
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

function RuneStrip({ huppermage }: { huppermage: TimelineSnapshot["classState"]["huppermage"] }) {
  return (
    <div className="rune-strip" aria-label={t("runes.huppermage")}>
      {runeOptions.map((rune) => {
        const active = huppermage?.runes.active[rune] ?? false;
        const isLast = huppermage?.runes.lastGeneratedRune === rune;
        return (
          <span
            key={rune}
            className={`rune-chip ${active ? "active" : ""} ${isLast ? "last" : ""}`}
            title={formatUiMessage("runes.activeTitle", {
              rune: formatRuneLabel(rune),
              state: active ? t("runes.active") : t("runes.inactive"),
              last: isLast ? ` - ${t("runes.last")}` : "",
            })}
          >
            <ElementIcon element={runeToElement[rune]} />
          </span>
        );
      })}
      <span className="rune-meta" title={t("runes.feuFolletsTitle")}>FF {huppermage?.feuFolletsActive ?? 0}</span>
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
}: {
  activePassives: string[];
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
}) {
  const visibleSpells = getVisibleCatalogEntries(spells, hiddenEntries, showHiddenEntries);
  const visiblePassives = getVisibleCatalogEntries(passives, hiddenEntries, showHiddenEntries);
  const hiddenCount = countHiddenCatalogEntries(hiddenEntries);
  const usedDeckSpellIds = usedSpellIds.filter((spellId) => {
    const spell = spells.find((entry) => entry.id === spellId);
    return spell ? isDeckTrackedCatalogSpell(spell) : true;
  });
  const usedSpellCount = usedDeckSpellIds.length;
  const deckFull = usedSpellCount >= deckSpellLimit;
  const activePassiveCount = activePassives.length;
  const [spellTooltip, setSpellTooltip] = useState<{ entry: CatalogEntry; left: number; top: number } | null>(null);

  function showSpellTooltip(event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>, entry: CatalogEntry) {
    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipWidth = 340;
    const preferredLeft = rect.left - tooltipWidth - 14;
    const fallbackLeft = rect.right + 14;
    const left = preferredLeft >= 12 ? preferredLeft : Math.min(window.innerWidth - tooltipWidth - 12, fallbackLeft);
    const top = clamp(rect.top + rect.height / 2, 160, window.innerHeight - 24);
    setSpellTooltip({ entry, left: Math.max(12, left), top });
  }

  function hideSpellTooltip() {
    setSpellTooltip(null);
  }

  return (
    <div className="catalog-library">
      <div className="catalog-library-toolbar">
        <div className={`catalog-counter catalog-counter-inline ${deckFull ? "full" : ""}`}>
          <span>{formatUiMessage("deck.spellCount", { used: usedSpellCount, limit: deckSpellLimit })}</span>
          {temporaryUnlockedSpellElement ? (
            <span>
              <ElementIcon element={temporaryUnlockedSpellElement} />
              {formatUiMessage("deck.temporary", { element: formatElementLabel(temporaryUnlockedSpellElement) })}
            </span>
          ) : null}
        </div>
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
        <h3>{t("library.spells")}</h3>
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
                  onClick={() => onSelectEntry(spell.id)}
                  onDragEnd={onDragEnd}
                  onDragStart={(event) => {
                    if (deckUnavailable) {
                      event.preventDefault();
                      return;
                    }
                    onDragSpell(event, spell.id);
                  }}
                  onMouseEnter={(event) => {
                    onHoverEntry(spell.id);
                    showSpellTooltip(event, spell);
                  }}
                  onMouseLeave={() => {
                    onHoverEntry(null);
                    hideSpellTooltip();
                  }}
                  onMouseMove={(event) => showSpellTooltip(event, spell)}
                  onFocus={(event) => {
                    onHoverEntry(spell.id);
                    showSpellTooltip(event, spell);
                  }}
                  onBlur={() => {
                    onHoverEntry(null);
                    hideSpellTooltip();
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
        <h3>{t("library.passives")}</h3>
        <div className="passive-library">
          {visiblePassives.map((passive) => {
            const active = activePassives.includes(passive.id);
            const hidden = isCatalogEntryHidden(hiddenEntries, passive);
            const passiveDisabled = !active && activePassiveCount >= passiveLimit;
            return (
              <div
                key={passive.id}
                className={`library-passive ${active ? "active" : ""} ${hidden ? "library-entry-hidden" : ""} ${passiveDisabled ? "library-entry-disabled" : ""}`}
                title={passiveDisabled ? t("passive.limitReached") : passive.name}
                onMouseEnter={() => onHoverEntry(passive.id)}
                onMouseLeave={() => onHoverEntry(null)}
              >
                <label className="library-passive-choice">
                  <input
                    type="checkbox"
                    checked={active}
                    disabled={passiveDisabled}
                    onChange={(event) => onTogglePassive(passive.id, event.target.checked)}
                    onFocus={() => onHoverEntry(passive.id)}
                    onBlur={() => onHoverEntry(null)}
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
        <div className={`catalog-counter ${activePassiveCount >= passiveLimit ? "full" : ""}`}>
          <span>{formatUiMessage("passive.count", { used: activePassiveCount, limit: passiveLimit })}</span>
        </div>
      </section>
      {spellTooltip ? (
        <SpellInfoTooltip
          entry={spellTooltip.entry}
          style={{ left: spellTooltip.left, top: spellTooltip.top }}
        />
      ) : null}
    </div>
  );
}

function SpellInfoTooltip({ entry, style }: { entry: CatalogEntry; style: React.CSSProperties }) {
  return (
    <aside className="spell-info-tooltip" style={style} role="tooltip">
      <div className="spell-info-header">
        <EntryIcon entryId={entry.id} label={entry.name} />
        <div>
          <span>{t("detail.spell")} · niv. {entry.level}</span>
          <strong>{entry.name}</strong>
        </div>
      </div>
      <div className="spell-info-meta">
        <CatalogMetaLine label={t("tooltip.cost")} tokens={getCatalogCostTokens(entry)} />
        <CatalogMetaLine label={t("tooltip.range")} tokens={getCatalogRangeTokens(entry)} />
      </div>
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

function TimelineDropMarker({ active }: { active: boolean }) {
  return <span className={`sequence-drop-marker ${active ? "active" : ""}`} aria-hidden="true" />;
}

function isTimelineDropMarkerActive(intent: TimelineDropIntent | null, index: number): boolean {
  if (!intent || intent.insertIndex !== index) {
    return false;
  }

  return intent.kind !== "moveAction" || !intent.isNoop;
}

function AptitudeDistributionEditor({
  distribution,
  onApply,
  onChange,
}: {
  distribution: AptitudeDistribution;
  onApply: (distribution?: AptitudeDistribution) => void;
  onChange: (distribution: AptitudeDistribution) => void;
}) {
  const preview = useMemo(() => computeAptitudeStats(distribution), [distribution]);

  function updateLevel(level: number) {
    onChange(setAptitudeLevel(distribution, level));
  }

  function updateRank(aptitudeId: number, rank: number) {
    onChange(setAptitudeRank(distribution, aptitudeId, rank));
  }

  return (
    <section className="form-section aptitude-panel">
      <div className="aptitude-heading">
        <div>
          <h3>{t("form.distribution")}</h3>
          <span>{t("form.distributionSource")}</span>
        </div>
        <button className="primary-button aptitude-apply" type="button" onClick={() => onApply(distribution)}>
          <Check size={15} />
          {t("form.applyDistribution")}
        </button>
      </div>

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
        {resourceOptions.map((resource) => (
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

function HuppermageStateEditor({
  character,
  onChange,
}: {
  character: SimulatedCharacter;
  onChange: (character: SimulatedCharacter) => void;
}) {
  const huppermage = character.classState?.huppermage;

  function updateHuppermage(patch: NonNullable<SimulatedCharacter["classState"]>["huppermage"]) {
    onChange({
      ...character,
      classState: {
        ...character.classState,
        huppermage: {
          ...huppermage,
          ...patch,
        },
      },
    });
  }

  return (
    <section className="form-section">
      <h3>{t("app.className")}</h3>
      <ElementIconPicker
        label={t("huppermage.activeHeart")}
        value={huppermage?.activeHeart ?? null}
        onChange={(element) => updateHuppermage({ activeHeart: element })}
      />
      <ElementIconPicker
        label={t("huppermage.lastElement")}
        value={runeToElementChoice(huppermage?.lastGeneratedRune)}
        onChange={(element) => updateHuppermage({
          lastGeneratedRune: element ? elementToRune(element) : null,
        })}
      />
      <NumberField
        label={t("huppermage.feuFollets")}
        value={huppermage?.feuFolletsActive ?? 0}
        onChange={(value) => updateHuppermage({ feuFolletsActive: value })}
      />
      <NumberField
        label={t("deck.limit")}
        value={huppermage?.deckSpellLimit ?? 12}
        onChange={(value) => updateHuppermage({ deckSpellLimit: value })}
      />
      <NumberField
        label={t("passive.limit")}
        value={huppermage?.passiveLimit ?? 6}
        onChange={(value) => updateHuppermage({ passiveLimit: value })}
      />
      <div className="toggle-group">
        {runeOptions.map((rune) => (
          <label key={rune} className="toggle-row">
            <input
              type="checkbox"
              checked={huppermage?.runes?.[rune] ?? false}
              onChange={(event) => updateHuppermage({
                runes: {
                  ...huppermage?.runes,
                  [rune]: event.target.checked,
                },
              })}
            />
            <span>{formatRuneLabel(rune)}</span>
          </label>
        ))}
      </div>
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

function CursorControl({ value, max, onChange }: { value: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="cursor-control">
      <input
        aria-label={t("cursor.label")}
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span>{formatUiMessage("cursor.step", { value, max })}</span>
    </div>
  );
}

function SnapshotInspector({ snapshot }: { snapshot: ReturnType<typeof createTimelineSnapshots>[number] }) {
  const huppermage = snapshot.classState.huppermage;
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
          <div><dt>{t("inspector.lastRune")}</dt><dd>{huppermage?.runes.lastGeneratedRune ? formatRuneLabel(huppermage.runes.lastGeneratedRune) : t("value.nonePlural")}</dd></div>
          <div><dt>{t("huppermage.feuFollets")}</dt><dd>{huppermage?.feuFolletsActive ?? 0}</dd></div>
          <div><dt>{t("inspector.activeRunes")}</dt><dd>{runeOptions.filter((rune) => huppermage?.runes.active[rune]).map(formatRuneLabel).join(", ") || t("value.nonePlural")}</dd></div>
          <div><dt>{t("inspector.passives")}</dt><dd>{huppermage?.activePassives.join(", ") || t("value.none")}</dd></div>
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

function DamageBreakdown({ snapshot }: { snapshot: ReturnType<typeof createTimelineSnapshots>[number] | undefined }) {
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
            <div><dt>{t("formula.position")}</dt><dd>{effect.formula.positionMultiplier}</dd></div>
            <div><dt>{t("formula.inflicted")}</dt><dd>{effect.formula.finalMultiplier}</dd></div>
            <div><dt>{t("formula.block")}</dt><dd>{effect.formula.blockMultiplier}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="field number-field">
      <span>{label}</span>
      <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
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
  function adjust(event: React.MouseEvent<HTMLButtonElement>, direction: -1 | 1) {
    onChange(direction * getStatStep(event));
  }

  return (
    <div className="stat-stepper">
      <span className="stat-stepper-icon" title={label}>
        <img src={icon} alt="" draggable={false} />
        {element ? <ElementIcon element={element} /> : null}
      </span>
      <span className="stat-stepper-label">{label}</span>
      <strong className="stat-stepper-value">{formatNumber(value)}{suffix}</strong>
      <span className="stat-stepper-actions">
        <button type="button" title={formatUiMessage("stat.decrementTitle", { label })} onClick={(event) => adjust(event, -1)}>-</button>
        <button type="button" title={formatUiMessage("stat.incrementTitle", { label })} onClick={(event) => adjust(event, 1)}>+</button>
      </span>
    </div>
  );
}

function ElementIconPicker({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (element: HuppermageElementChoice | null) => void;
  value: HuppermageElementChoice | null;
}) {
  return (
    <div className="element-picker-field">
      <span>{label}</span>
      <div className="element-picker" role="group" aria-label={label}>
        <button
          aria-label={`${label}: ${t("value.nonePlural").toLowerCase()}`}
          className={`element-choice none-choice ${value === null ? "selected" : ""}`}
          title={t("value.none")}
          type="button"
          onClick={() => onChange(null)}
        >
          <span aria-hidden="true">-</span>
        </button>
        {huppermageElementChoices.map((element) => (
          <button
            aria-label={`${label}: ${formatElementLabel(element)}`}
            className={`element-choice ${value === element ? "selected" : ""}`}
            key={element}
            title={formatElementLabel(element)}
            type="button"
            onClick={() => onChange(element)}
          >
            <ElementIcon element={element} />
          </button>
        ))}
      </div>
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
