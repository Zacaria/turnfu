import type { BaseStats, ResourcePool } from "../simulation/types.ts";
import type { SublimationInitialCondition } from "./types.ts";

export function isSublimationInitialConditionMet(
  condition: SublimationInitialCondition,
  stats: BaseStats,
  resources: ResourcePool,
): boolean {
  if (condition.type === "resourceAtMost") {
    return resources[condition.resource] <= condition.value;
  }

  if (condition.type === "secondaryMasteriesAtMost") {
    return getSecondaryMasteryValues(stats).every((value) => value <= condition.value);
  }

  const value = stats[condition.stat];
  return (typeof value === "number" ? value : 0) <= condition.value;
}

function getSecondaryMasteryValues(stats: BaseStats): number[] {
  return [
    stats.meleeMastery ?? 0,
    stats.distanceMastery ?? 0,
    stats.berserkMastery ?? 0,
    stats.rearMastery ?? 0,
    stats.criticalMastery ?? 0,
    stats.healingMastery ?? 0,
  ];
}
