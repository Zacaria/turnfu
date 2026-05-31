import { findSublimation } from "../core/sublimations/catalog.ts";
import { aggregateSublimationStacks } from "../core/sublimations/validation.ts";
import type { SublimationBuild, SublimationCatalogEntry, SublimationEffect } from "../core/sublimations/types.ts";
import { formatResourceLabel } from "./i18n.ts";

type StatModifierEffect = Extract<SublimationEffect, { type: "statModifier" }>;

export type SublimationPreviewItem = {
  id: string;
  name: string;
  category: SublimationCatalogEntry["category"];
  effectiveLevel: number;
  rawLevel: number;
  cumulativeMax: number;
  effectLines: string[];
};

export function createSublimationPreviewItems(build: SublimationBuild | undefined): SublimationPreviewItem[] {
  const entries = (build?.selections ?? [])
    .map((selection) => findSublimation(selection.sublimationId))
    .filter((entry): entry is SublimationCatalogEntry => Boolean(entry));

  return aggregateSublimationStacks(entries).map((stack) => {
    const entry = stack.entries.reduce((highest, current) => (current.level > highest.level ? current : highest), stack.entries[0]!);
    return {
      id: stack.familyId,
      name: entry.name,
      category: entry.category,
      effectiveLevel: stack.effectiveLevel,
      rawLevel: stack.rawLevel,
      cumulativeMax: stack.cumulativeMax,
      effectLines: entry.effects.flatMap((effect) => formatSublimationEffect(effect, stack.effectiveLevel)),
    };
  });
}

function formatSublimationEffect(effect: SublimationEffect, effectiveLevel: number): string[] {
  if (effect.type === "statModifier") {
    return [`${formatSigned(effect.amount * effectiveLevel)} ${formatStat(effect.stat)}`];
  }

  if (effect.type === "resourceDelta") {
    return [`${formatSigned(effect.amount * effectiveLevel)} ${formatResourceLabel(effect.resource)}`];
  }

  if (effect.type === "actionDamageInflictedPercent") {
    return [`${formatSigned(effect.amount * effectiveLevel)} % dégâts si ${formatCondition(effect.condition)}`];
  }

  return [`Reporte ${effect.maxAmount ? `${effect.maxAmount * effectiveLevel} ` : ""}${formatResourceLabel(effect.resource)}`];
}

function formatStat(stat: StatModifierEffect["stat"]): string {
  const labels: Partial<Record<typeof stat, string>> = {
    criticalHitPercent: "% Coup critique",
    criticalMastery: "Maîtrise critique",
    damageInflictedPercent: "% Dommages infligés",
    range: "Portée",
  };

  return labels[stat] ?? stat;
}

function formatCondition(condition: Extract<SublimationEffect, { type: "actionDamageInflictedPercent" }>["condition"]): string {
  if (condition.type === "zone") {
    return "sort de zone";
  }

  if (condition.type === "geometry") {
    return condition.geometry === "diagonal" ? "lancer diagonal" : "lancer en ligne";
  }

  return condition.mode === "distance" ? "distance" : "mêlée";
}

function formatSigned(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}
