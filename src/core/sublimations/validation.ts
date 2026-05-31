import { findSublimation, sublimationCatalog } from "./catalog.ts";
import type {
  EffectiveSublimationStack,
  SublimationBuild,
  SublimationCatalogEntry,
  SublimationCategory,
  SublimationValidationResult,
  SublimationValidationViolation,
} from "./types.ts";

const slotLimits: Record<SublimationCategory, number> = {
  normal: 10,
  epic: 1,
  relic: 1,
};

export function validateSublimationBuild(
  build: SublimationBuild | undefined,
  catalog: SublimationCatalogEntry[] = sublimationCatalog,
): SublimationValidationResult {
  const selections = build?.selections ?? [];
  const violations: SublimationValidationViolation[] = [];
  const selectedEntries: SublimationCatalogEntry[] = [];

  for (const selection of selections) {
    const entry = findSublimation(selection.sublimationId, catalog);
    if (!entry) {
      violations.push({
        type: "unknownSublimation",
        sublimationId: selection.sublimationId,
        message: `Unknown sublimation '${selection.sublimationId}'.`,
      });
      continue;
    }

    selectedEntries.push(entry);
    if (entry.supportStatus === "ignored") {
      violations.push({
        type: "ignoredSublimation",
        sublimationId: entry.id,
        message: entry.supportReason ?? `Sublimation '${entry.name}' is ignored.`,
      });
    } else if (entry.supportStatus !== "supported") {
      violations.push({
        type: "unsupportedSublimation",
        sublimationId: entry.id,
        message: entry.supportReason ?? `Sublimation '${entry.name}' is not supported yet.`,
      });
    }
  }

  violations.push(...validateSlotLimits(selectedEntries));
  violations.push(...validateHpCompatibility(selectedEntries));

  return {
    valid: violations.length === 0,
    violations,
    effectiveStacks: aggregateSublimationStacks(selectedEntries),
  };
}

export function aggregateSublimationStacks(entries: SublimationCatalogEntry[]): EffectiveSublimationStack[] {
  const byFamily = new Map<string, SublimationCatalogEntry[]>();
  for (const entry of entries) {
    byFamily.set(entry.familyId, [...(byFamily.get(entry.familyId) ?? []), entry]);
  }

  return [...byFamily.entries()]
    .map(([familyId, familyEntries]) => {
      const rawLevel = familyEntries.reduce((total, entry) => total + entry.level, 0);
      const cumulativeMax = Math.max(...familyEntries.map((entry) => entry.cumulativeMax));
      return {
        familyId,
        rawLevel,
        effectiveLevel: Math.min(rawLevel, cumulativeMax),
        cumulativeMax,
        entries: familyEntries,
      };
    })
    .sort((left, right) => left.familyId.localeCompare(right.familyId));
}

function validateSlotLimits(entries: SublimationCatalogEntry[]): SublimationValidationViolation[] {
  const violations: SublimationValidationViolation[] = [];
  const counts = entries.reduce<Record<SublimationCategory, number>>((accumulator, entry) => ({
    ...accumulator,
    [entry.category]: accumulator[entry.category] + 1,
  }), { normal: 0, epic: 0, relic: 0 });

  for (const category of Object.keys(slotLimits) as SublimationCategory[]) {
    if (counts[category] > slotLimits[category]) {
      violations.push({
        type: "slotLimitExceeded",
        category,
        required: slotLimits[category],
        actual: counts[category],
        message: `Too many ${category} sublimations selected (${counts[category]}/${slotLimits[category]}).`,
      });
    }
  }

  return violations;
}

function validateHpCompatibility(entries: SublimationCatalogEntry[]): SublimationValidationViolation[] {
  const hpRequirements = entries.filter((entry) => entry.hpRequirement);
  const violations: SublimationValidationViolation[] = [];

  for (let index = 0; index < hpRequirements.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < hpRequirements.length; nextIndex += 1) {
      const left = hpRequirements[index]!;
      const right = hpRequirements[nextIndex]!;
      if (!rangesOverlap(left.hpRequirement!, right.hpRequirement!)) {
        violations.push({
          type: "hpConditionConflict",
          sublimationId: `${left.id},${right.id}`,
          message: `HP conditions for '${left.name}' and '${right.name}' cannot be true together.`,
        });
      }
    }
  }

  return violations;
}

function rangesOverlap(
  left: NonNullable<SublimationCatalogEntry["hpRequirement"]>,
  right: NonNullable<SublimationCatalogEntry["hpRequirement"]>,
): boolean {
  const leftMin = left.minPercent ?? 0;
  const leftMax = left.maxPercent ?? 100;
  const rightMin = right.minPercent ?? 0;
  const rightMax = right.maxPercent ?? 100;
  return Math.max(leftMin, rightMin) <= Math.min(leftMax, rightMax);
}
