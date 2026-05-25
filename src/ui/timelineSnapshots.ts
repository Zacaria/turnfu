import type {
  ActionResult,
  BaseStats,
  ClassTurnState,
  ResourcePool,
  SimulatedCharacter,
  ComboSimulationResult,
  SimulationResult,
  SimulationViolation,
} from "../core/simulation/types.ts";
import { t } from "./i18n.ts";

export type TimelineSnapshot = {
  index: number;
  kind: "initial" | "action";
  label: string;
  turnIndex: number;
  actionIndex?: number;
  spellId?: string;
  spellName?: string;
  action?: ActionResult;
  resources: ResourcePool;
  classState: ClassTurnState;
  stats: BaseStats;
  appliedEffects: ActionResult["appliedEffects"];
  damage: number;
  totalDamageSoFar: number;
  violations: SimulationViolation[];
};

export function createTimelineSnapshots(
  result: SimulationResult,
  character: SimulatedCharacter,
): TimelineSnapshot[] {
  const firstAction = result.breakdown[0];
  const snapshots: TimelineSnapshot[] = [
    {
      index: 0,
      kind: "initial",
      label: t("timeline.initial"),
      turnIndex: 0,
      resources: firstAction ? firstAction.resourceBefore : result.finalState.remainingResources,
      classState: firstAction ? firstAction.classStateBefore : result.finalState.classState,
      stats: firstAction ? firstAction.statsBefore : result.finalState.currentStats,
      appliedEffects: [],
      damage: 0,
      totalDamageSoFar: 0,
      violations: [],
    },
  ];

  let totalDamageSoFar = 0;
  for (const action of result.breakdown) {
    totalDamageSoFar = roundSnapshotDamage(totalDamageSoFar + action.damage);
    snapshots.push({
      index: action.actionIndex + 1,
      kind: "action",
      label: `${action.actionIndex + 1}. ${action.spellName}`,
      turnIndex: 0,
      actionIndex: action.actionIndex,
      spellId: action.spellId,
      spellName: action.spellName,
      action,
      resources: action.resourceAfter,
      classState: action.classStateAfter,
      stats: action.statsAfter,
      appliedEffects: action.appliedEffects,
      damage: action.damage,
      totalDamageSoFar,
      violations: [],
    });
  }

  if (result.violations.length > 0) {
    snapshots.at(-1)?.violations.push(...result.violations);
  }

  return snapshots;
}

export function createComboTimelineSnapshots(
  result: ComboSimulationResult,
  character: SimulatedCharacter,
): TimelineSnapshot[] {
  const firstTurn = result.turns[0];
  const firstAction = firstTurn?.result.breakdown[0];
  const snapshots: TimelineSnapshot[] = [
    {
      index: 0,
      kind: "initial",
      label: t("timeline.initial"),
      turnIndex: 0,
      resources: firstAction ? firstAction.resourceBefore : character.resources,
      classState: firstAction ? firstAction.classStateBefore : firstTurn?.result.finalState.classState ?? {},
      stats: firstAction ? firstAction.statsBefore : character.stats,
      appliedEffects: [],
      damage: 0,
      totalDamageSoFar: 0,
      violations: [],
    },
  ];

  let totalDamageSoFar = 0;
  for (const turn of result.turns) {
    for (const action of turn.result.breakdown) {
      totalDamageSoFar = roundSnapshotDamage(totalDamageSoFar + action.damage);
      snapshots.push({
        index: snapshots.length,
        kind: "action",
        label: `${t("metric.turn")} ${turn.turnIndex + 1} / ${action.actionIndex + 1}. ${action.spellName}`,
        turnIndex: turn.turnIndex,
        actionIndex: action.actionIndex,
        spellId: action.spellId,
        spellName: action.spellName,
        action,
        resources: action.resourceAfter,
        classState: action.classStateAfter,
        stats: action.statsAfter,
        appliedEffects: action.appliedEffects,
        damage: action.damage,
        totalDamageSoFar,
        violations: [],
      });
    }
  }

  if (result.violations.length > 0) {
    snapshots.at(-1)?.violations.push(...result.violations);
  }

  return snapshots;
}

function roundSnapshotDamage(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
