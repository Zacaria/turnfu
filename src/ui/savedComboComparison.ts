import type { SavedComboReference } from "./researchWorkspace.ts";

export type SavedComboComparisonRow = {
  combo: SavedComboReference;
  duration: number;
  actionCount: number;
  totalDamage: number;
  damagePerTurn: number;
};

export type SavedComboComparisonGroups = Record<number, SavedComboComparisonRow[]>;

export function createSavedComboComparisonRow(combo: SavedComboReference): SavedComboComparisonRow {
  const duration = Math.max(1, combo.plan.turns.length);
  const totalDamage = combo.totalDamage ?? 0;

  return {
    combo,
    duration,
    actionCount: combo.plan.turns.reduce((total, turn) => total + turn.actions.length, 0),
    totalDamage,
    damagePerTurn: roundMetric(totalDamage / duration),
  };
}

export function groupSavedCombosByDuration(combos: SavedComboReference[]): SavedComboComparisonGroups {
  const groups: SavedComboComparisonGroups = {
    1: [],
    2: [],
    3: [],
  };

  for (const combo of combos) {
    const row = createSavedComboComparisonRow(combo);
    if (!groups[row.duration]) {
      groups[row.duration] = [];
    }
    groups[row.duration].push(row);
  }

  for (const rows of Object.values(groups)) {
    rows.sort((left, right) => right.totalDamage - left.totalDamage || left.combo.createdAt.localeCompare(right.combo.createdAt));
  }

  return groups;
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}
