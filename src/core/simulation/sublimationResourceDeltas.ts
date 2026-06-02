import type { Resource } from "../catalog/types.ts";
import { isSublimationHpRequirementSatisfied, validateSublimationBuild } from "../sublimations/validation.ts";
import type { SimulatedCharacter } from "./types.ts";

export function computeActiveInitialSublimationResourceDelta(
  character: Pick<SimulatedCharacter, "sublimations">,
  resource: Resource,
): number {
  const validation = validateSublimationBuild(character.sublimations);
  const hpAssumption = character.sublimations?.hpAssumption ?? "normal";

  return validation.effectiveStacks.reduce((total, stack) => {
    const entries = stack.entries.filter((entry) => isSublimationHpRequirementSatisfied(entry, hpAssumption));
    if (entries.length === 0) {
      return total;
    }

    const rawLevel = entries.reduce((levelTotal, entry) => levelTotal + entry.level, 0);
    const cumulativeMax = Math.max(...entries.map((entry) => entry.cumulativeMax));
    const effectiveLevel = Math.min(rawLevel, cumulativeMax);
    const resourceDelta = entries[0]?.effects.reduce((effectTotal, effect) => (
      effect.type === "resourceDelta" && effect.resource === resource
        ? effectTotal + effect.amount * effectiveLevel
        : effectTotal
    ), 0) ?? 0;

    return total + resourceDelta;
  }, 0);
}
