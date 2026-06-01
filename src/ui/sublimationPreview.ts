import { findSublimation } from "../core/sublimations/catalog.ts";
import { isSublimationInitialConditionMet } from "../core/sublimations/initialConditions.ts";
import { aggregateSublimationStacks } from "../core/sublimations/validation.ts";
import type { Resource } from "../core/catalog/types.ts";
import type { AppliedEffect, BaseStats, ResourcePool } from "../core/simulation/types.ts";
import type { SublimationBuild, SublimationCatalogEntry, SublimationEffect } from "../core/sublimations/types.ts";
import { formatResourceLabel } from "./i18n.ts";
import { getWakfuliSublimationIconSrc } from "./sublimationIcons.ts";

export type SublimationPreviewTone = "level-1" | "level-2" | "level-3" | "epic" | "relic";

export type SublimationPreviewItem = {
  id: string;
  name: string;
  category: SublimationCatalogEntry["category"];
  tone: SublimationPreviewTone;
  iconSrc?: string;
  displayLevel?: string;
  effectiveLevel: number;
  rawLevel: number;
  cumulativeMax: number;
  effectLines: string[];
  supportReason?: string;
  socketPattern?: string;
  sourceDescription?: string;
  sourceLocation?: string;
};

export type SublimationStateItem = {
  id: string;
  name: string;
  status: "active" | "waiting";
  statusLabel: string;
  detail: string;
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
      tone: getSublimationPreviewTone(entry),
      iconSrc: getSublimationPreviewIconSrc(entry),
      displayLevel: entry.displayLevel,
      effectiveLevel: stack.effectiveLevel,
      rawLevel: stack.rawLevel,
      cumulativeMax: stack.cumulativeMax,
      effectLines: entry.effects.flatMap((effect) => formatSublimationEffect(effect, stack.effectiveLevel)),
      supportReason: entry.supportReason,
      socketPattern: entry.socketPattern,
      sourceDescription: entry.sourceDescription,
      sourceLocation: entry.sourceLocation,
    };
  });
}

export function getSublimationPreviewTone(entry: SublimationCatalogEntry): SublimationPreviewTone {
  if (entry.category === "epic") {
    return "epic";
  }

  if (entry.category === "relic") {
    return "relic";
  }

  if (entry.level <= 1) {
    return "level-1";
  }

  if (entry.level === 2) {
    return "level-2";
  }

  return "level-3";
}

function getSublimationPreviewIconSrc(entry: SublimationCatalogEntry): string | undefined {
  return getWakfuliSublimationIconSrc(entry.id) ?? getWakfuliSublimationIconSrc(`${entry.familyId}-${entry.cumulativeMax}`);
}

export function createSublimationStateItems(input: {
  build: SublimationBuild | undefined;
  appliedEffects: AppliedEffect[];
  initialConditionStats?: BaseStats;
  initialConditionResources?: ResourcePool;
}): SublimationStateItem[] {
  const entries = (input.build?.selections ?? [])
    .map((selection) => findSublimation(selection.sublimationId))
    .filter((entry): entry is SublimationCatalogEntry => Boolean(entry));

  return entries.map((entry) => {
    const appliedEffect = [...input.appliedEffects].reverse().find((effect) =>
      (effect.type === "sublimationEffect" || effect.type === "resourceCarryover")
      && (effect.sublimationId === entry.id || effect.sublimationId.startsWith(entry.familyId))
    );
    const initialConditionWaiting = isSublimationInitialConditionWaiting(
      entry,
      input.initialConditionStats,
      input.initialConditionResources,
    );
    const waiting = initialConditionWaiting || (appliedEffect?.type === "sublimationEffect" && appliedEffect.status === "skipped");

    return {
      id: entry.familyId,
      name: entry.name,
      status: waiting ? "waiting" : "active",
      statusLabel: waiting ? "En attente" : "Actif",
      detail: initialConditionWaiting ? "Condition non remplie" : describeSublimationStateDetail(appliedEffect),
    };
  });
}

function isSublimationInitialConditionWaiting(
  entry: SublimationCatalogEntry,
  stats: BaseStats | undefined,
  resources: ResourcePool | undefined,
): boolean {
  const initialEffects = entry.effects.filter((effect): effect is Extract<SublimationEffect, { type: "conditionalInitialStatModifier" }> =>
    effect.type === "conditionalInitialStatModifier"
  );
  if (initialEffects.length === 0 || !stats || !resources) {
    return false;
  }

  return initialEffects.some((effect) => !isSublimationInitialConditionMet(effect.condition, stats, resources));
}

function describeSublimationStateDetail(effect: AppliedEffect | undefined): string {
  if (!effect) {
    return "Bonus permanent";
  }

  if (effect.type === "resourceCarryover") {
    return `${formatSigned(effect.amount)} ${formatResourceLabel(effect.resource)} reporté`;
  }

  if (effect.type !== "sublimationEffect") {
    return "Bonus permanent";
  }

  if (effect.status === "skipped") {
    return "Condition non remplie";
  }

  return effect.amount === undefined ? "Effet appliqué" : `${formatSigned(effect.amount)} % dégâts`;
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

  if (effect.type === "elementalCarryoverDamageInflictedPercent") {
    const targetElement = formatElementCondition(effect.targetElement);
    const triggerElements = formatElementList(effect.triggerElements);
    return [`${formatSigned(effect.amount * effectiveLevel)} % dégâts au prochain sort ${targetElement} après sort ${triggerElements} (max ${effect.maxAmount} %, hors Lumière)`];
  }

  if (effect.type === "elementalMasteryPercentModifier") {
    return [`${formatSigned(effect.percent)} % Maîtrise sur les ${effect.count} éléments les plus faibles`];
  }

  if (effect.type === "conditionalInitialStatModifier") {
    return [`${formatSigned(effect.amount)} ${formatStat(effect.stat)} si ${formatInitialCondition(effect.condition)}`];
  }

  if (effect.type === "alternatingElementDamageInflictedPercent") {
    return [`${formatSigned(effect.amount)} % dégâts au ${effect.mode === "previousDamageElement" ? "prochain sort" : "sort"} d’un autre élément`];
  }

  if (effect.type === "spellCountCarryoverDamageInflictedPercent") {
    return [`${formatSigned(effect.amount)} % dégâts au prochain sort tous les ${effect.interval} sorts à PA`];
  }

  if (effect.type === "spentResourceDamageInflictedPercent") {
    return [`${formatSigned(effect.amount * effectiveLevel)} % dégâts par ${formatResourceList(effect.resources)} dépensé ce tour (max ${effect.maxAmount * effectiveLevel} %)`];
  }

  return [`Reporte ${effect.maxAmount ? `${effect.maxAmount * effectiveLevel} ` : ""}${formatResourceLabel(effect.resource)}`];
}

function formatStat(stat: keyof BaseStats): string {
  const labels: Partial<Record<typeof stat, string>> = {
    criticalHitPercent: "% Coup critique",
    criticalMastery: "Maîtrise critique",
    damageInflictedPercent: "% Dommages infligés",
    elementalResistance: "Résistance élémentaire",
    generalMastery: "Maîtrise",
    healsPerformedPercent: "% Soins réalisés",
    hitPointsPercent: "% PV",
    range: "Portée",
    willpower: "Volonté",
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

  if (condition.type === "spellElement") {
    return `sort ${formatElementCondition(condition.element)} (hors Lumière)`;
  }

  return condition.mode === "distance" ? "distance" : "mêlée";
}

function formatElementCondition(element: "air" | "earth" | "fire" | "water"): string {
  const labels: Record<typeof element, string> = {
    air: "air",
    earth: "terre",
    fire: "feu",
    water: "eau",
  };
  return labels[element] ?? element;
}

function formatElementList(elements: Array<"air" | "earth" | "fire" | "water">): string {
  const labels = elements.map((element) => formatElementCondition(element));
  if (labels.length <= 1) {
    return labels.join("");
  }

  return `${labels.slice(0, -1).join(", ")} ou ${labels.at(-1)}`;
}

function formatResourceList(resources: Resource[]): string {
  const labels = resources.map((resource) => formatResourceLabel(resource));
  if (labels.length <= 1) {
    return labels.join("");
  }

  return `${labels.slice(0, -1).join(", ")} ou ${labels.at(-1)}`;
}

function formatInitialCondition(condition: Extract<SublimationEffect, { type: "conditionalInitialStatModifier" }>["condition"]): string {
  if (condition.type === "resourceAtMost") {
    return `${formatResourceLabel(condition.resource)} <= ${condition.value}`;
  }

  if (condition.type === "secondaryMasteriesAtMost") {
    return `maîtrises secondaires <= ${condition.value}`;
  }

  return `${formatStat(condition.stat)} <= ${condition.value}`;
}

function formatSigned(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}
