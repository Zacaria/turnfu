import type { CatalogEntry, Condition, Effect, Element, Resource, Rune, SpellConstraint } from "../core/catalog/types.ts";
import { formatElementLabel, formatResourceLabel, formatRuneLabel, t } from "./i18n.ts";
import { getAreaIconSrc } from "./areaIcons.ts";
import { getResourceIconSrc, getElementMasteryIconSrc, getStatIconSrc, type StatIconKey } from "./statIcons.ts";
import { getRuneIconLabel, getRuneIconSrc, getSpellAttributeIconSrc } from "./spellAttributeIcons.ts";

export type CatalogInfoIcon = {
  src: string;
  label: string;
  tone?: "area" | "target" | "rune" | "resource" | "stat" | "damage";
};

export type CatalogInfoToken = {
  icon?: CatalogInfoIcon;
  text: string;
};

export type CatalogInfoLine = {
  icons: CatalogInfoIcon[];
  text: string;
};

export function formatCatalogCost(entry: CatalogEntry): string {
  const parts = Object.entries(entry.cost ?? {})
    .filter(([, value]) => value && value > 0)
    .map(([resource, value]) => `${value} ${formatResourceLabel(resource as never)}`);

  return parts.length > 0 ? parts.join(", ") : t("cost.none");
}

export function formatCatalogRange(entry: CatalogEntry): string {
  if (!entry.range) {
    return t("range.none");
  }

  const rangeValue = entry.range.min === entry.range.max ? `${entry.range.max} PO` : `${entry.range.min}-${entry.range.max} PO`;
  const details = [
    entry.range.lineOfSight === false ? "sans ligne de vue" : "ligne de vue",
    entry.range.modifiable === false ? "non modifiable" : "modifiable",
    ...(entry.range.notes ?? []),
  ];

  return [rangeValue, ...details].join(", ");
}

export function getCatalogCostTokens(entry: CatalogEntry): CatalogInfoToken[] {
  const parts = Object.entries(entry.cost ?? {})
    .filter(([, value]) => value && value > 0)
    .map(([resource, value]) => {
      const typedResource = resource as Resource;
      return {
        icon: resourceIcon(typedResource),
        text: String(value),
      };
    });

  return parts.length > 0 ? parts : [{ text: t("cost.none") }];
}

export function getCatalogRangeTokens(entry: CatalogEntry): CatalogInfoToken[] {
  if (!entry.range) {
    return [{ text: t("range.none") }];
  }

  const rangeValue = entry.range.min === entry.range.max ? `${entry.range.max} PO` : `${entry.range.min}-${entry.range.max} PO`;
  const details = [
    entry.range.lineOfSight === false ? "sans ligne de vue" : "ligne de vue",
    entry.range.modifiable === false ? "non modifiable" : "modifiable",
    ...(entry.range.notes ?? []),
  ];

  return [
    { icon: statIcon("range", t("stat.range")), text: rangeValue },
    ...details.map((detail) => ({ text: detail })),
  ];
}

export function describeCatalogEffectLine(effect: Effect): CatalogInfoLine {
  if (effect.type === "conditional") {
    const rune = getConditionRune(effect.condition);
    return {
      icons: rune ? [runeIcon(rune), ...effect.effects.flatMap(effectIcons)] : conditionIcons(effect.condition),
      text: appendNote(`${rune ? "" : `Si ${describeCondition(effect.condition)} : `}${effect.effects.map(describeCatalogEffect).join(" ; ")}`, effect.note),
    };
  }

  if (effect.type === "trigger") {
    return {
      icons: [statIcon("willpower", "Déclenchement")],
      text: appendNote(`Quand ${effect.event} : ${effect.effects.map(describeCatalogEffect).join(" ; ")}`, effect.note),
    };
  }

  return {
    icons: effectIcons(effect),
    text: describeCatalogEffect(effect),
  };
}

export function describeCatalogEffect(effect: Effect): string {
  if (effect.type === "damage") {
    return appendNote(`Dégâts ${formatElementLabel(effect.element)} : ${formatTimes(effect.base, effect.times)}`, effect.note);
  }

  if (effect.type === "heal") {
    const element = effect.element ? ` ${formatElementLabel(effect.element)}` : "";
    return appendNote(`Soin${element} : ${formatTimes(effect.base, effect.times)}`, effect.note);
  }

  if (effect.type === "armor") {
    return appendNote(`Armure : ${effect.amount}`, effect.note);
  }

  if (effect.type === "resourceDelta") {
    return appendNote(`${formatResourceLabel(effect.resource)} ${formatSignedNumber(effect.amount)}`, effect.note);
  }

  if (effect.type === "statModifier") {
    return appendNote(`${formatStat(effect.stat)} ${formatSignedNumber(effect.amount)}`, effect.note);
  }

  if (effect.type === "state") {
    const level = effect.level ? ` niv. ${effect.level}` : "";
    const duration = effect.duration ? ` (${effect.duration})` : "";
    return appendNote(`${effect.state}${level}${duration}`, effect.note);
  }

  if (effect.type === "movement") {
    const cells = effect.cells ? ` de ${effect.cells} ${effect.cells > 1 ? "cases" : "case"}` : "";
    return appendNote(`${formatMovement(effect.mode)}${cells}`, effect.note);
  }

  if (effect.type === "zone") {
    if (effect.shape === "unknown" && effect.note?.includes("zone devient")) {
      return "La zone devient";
    }

    return appendNote(`Zone ${effect.shape}${effect.size ? ` ${effect.size}` : ""}`, effect.note);
  }

  if (effect.type === "conditional") {
    return appendNote(`Si ${describeCondition(effect.condition)} : ${effect.effects.map(describeCatalogEffect).join(" ; ")}`, effect.note);
  }

  if (effect.type === "trigger") {
    return appendNote(`Quand ${effect.event} : ${effect.effects.map(describeCatalogEffect).join(" ; ")}`, effect.note);
  }

  if (effect.type === "unsupportedMechanic") {
    return appendNote(effect.mechanic, effect.note);
  }

  return appendNote(formatTagEffect(effect.tag, effect.value), effect.note);
}

export function describeCatalogConstraint(constraint: SpellConstraint): string {
  if (constraint.type === "maxCastsPerTurn") {
    return `${constraint.value} lancer(s) par tour`;
  }

  if (constraint.type === "requiresTarget") {
    return `Cible requise : ${constraint.target}`;
  }

  return constraint.description;
}

function appendNote(text: string, note: string | undefined): string {
  return note ? `${text} (${note})` : text;
}

function formatTimes(base: number, times: number | undefined): string {
  return times && times > 1 ? `${base} x${times}` : String(base);
}

function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function describeCondition(condition: Condition): string {
  if (condition.type === "hasRune") {
    return `Rune ${condition.rune}`;
  }
  if (condition.type === "lastRune") {
    return `dernière Rune ${condition.rune}`;
  }
  if (condition.type === "exactRuneCount") {
    return `${condition.count} Rune(s)`;
  }
  if (condition.type === "hasAllRunes") {
    return "toutes les Runes";
  }
  if (condition.type === "minResource") {
    return `${condition.amount} ${formatResourceLabel(condition.resource)}`;
  }
  if (condition.type === "targetIs") {
    return `cible ${condition.value}`;
  }
  if (condition.type === "inState") {
    return `état ${condition.state}`;
  }
  if (condition.type === "event") {
    return condition.event;
  }
  return condition.description;
}

function formatMovement(mode: string): string {
  const labels: Record<string, string> = {
    moveFeuFollet: "Déplace le Feu-Follet",
    placeSummon: "Pose une invocation",
    pull: "Attire",
    push: "Pousse",
    swapWithFeuFollet: "Échange avec le Feu-Follet",
    swapWithTarget: "Échange avec la cible",
    teleportCaster: "Téléporte le lanceur",
    teleportTarget: "Téléporte la cible",
  };

  return labels[mode] ?? mode;
}

function formatStat(stat: string): string {
  const labels: Record<string, string> = {
    armorReceivedPercent: t("stat.armorReceived"),
    criticalHitPercent: t("stat.criticalHit"),
    damageInflictedPercent: t("stat.damageInflicted"),
    damageReceivedPercent: t("stat.damageReceived"),
    elementalMastery: t("stat.fullGeneralMastery"),
    elementalResistance: t("stat.elementalResistance"),
    healsPerformedPercent: t("stat.healsPerformed"),
    healsReceivedPercent: t("stat.healsReceived"),
    parry: t("stat.parry"),
    range: t("stat.range"),
    willpower: t("stat.willpower"),
  };

  return labels[stat] ?? stat;
}

function formatTagEffect(tagName: string, value: string | number | boolean | undefined): string {
  const labels: Record<string, string> = {
    additionalBqCostPerRune: "Coût BQ supplémentaire par Rune",
    bqGainMultiplier: "Multiplicateur de gain BQ",
    bqGainsDeltaPercent: "Variation des gains BQ",
    coeurDeLumiereDuration: "Durée du Coeur de Lumière",
    coeurDeLumiereMaxCastsPerTurn: "Lancers max. de Coeur de Lumière par tour",
    consumeAllRunes: "Consomme toutes les Runes",
    consumeMark: "Consomme la Marque",
    consumeRune: "Consomme une Rune",
    consumesRunes: "Consomme les Runes",
    costDelta: "Variation de coût",
    damageBypassesArmor: "Ignore l'Armure",
    doesNotRecoverRune: "Ne récupère pas la Rune",
    doubleArmor: "Double l'Armure",
    doubleBonusValue: "Double la valeur du bonus",
    doubleBqGains: "Double les gains BQ",
    doubleMovementValue: "Double la valeur des déplacements",
    doubleRemovalValue: "Double la valeur du retrait",
    dynamicBqCostPerRune: "Coût BQ par Rune",
    feuFolletMaxCastsPerTurn: "Lancers max. de Feu-Follet par tour",
    increasingBqCostPerUseThisTurn: "Coût BQ croissant ce tour",
    lineOfSightRequired: "Ligne de vue requise",
    maxFeuFollet: "Feu-Follets maximum",
    recoverSavedRune: "Récupère la Rune sauvegardée",
    runesDisappearAtTurnEnd: "Les Runes disparaissent en fin de tour",
    savesLastGeneratedRune: "Sauvegarde la dernière Rune générée",
    storeBq: "Stocke de la BQ",
    storesNaturalBqRegeneration: "Stocke la regeneration naturelle de BQ",
    triggerMarkImmediately: "Déclenche la Marque immédiatement",
    unlocksSpell: "Débloque le sort",
  };
  const label = labels[tagName] ?? tagName;

  if (value === undefined || value === true) {
    return label;
  }

  if (value === false) {
    return `${label} : non`;
  }

  if (tagName === "consumeRune" && isRune(value)) {
    return `${label} ${formatRuneLabel(value)}`;
  }

  if (tagName === "costDelta" && typeof value === "string") {
    return `${label} : ${formatCostDelta(value)}`;
  }

  return `${label} : ${String(value)}`;
}

function formatCostDelta(value: string): string {
  const [resource, amount] = value.split(":");
  if (!resource || !amount) {
    return value;
  }

  return `${amount} ${formatResourceLabel(resource as Resource)}`;
}

function effectIcons(effect: Effect): CatalogInfoIcon[] {
  if (effect.type === "damage") {
    return [targetIcon("enemy"), elementDamageIcon(effect.element)];
  }

  if (effect.type === "heal") {
    return [statIcon("healsPerformedPercent", t("stat.healsPerformed")), ...(effect.element ? [elementDamageIcon(effect.element)] : [])];
  }

  if (effect.type === "armor") {
    return targetAwareIcons(effect.target, [statIcon("barrier", "Armure")]);
  }

  if (effect.type === "resourceDelta") {
    return targetAwareIcons(effect.target, [resourceIcon(effect.resource)]);
  }

  if (effect.type === "statModifier") {
    return targetAwareIcons(effect.target, [statIcon(statIconKey(effect.stat), formatStat(effect.stat))]);
  }

  if (effect.type === "state") {
    return targetAwareIcons(effect.target, [statIcon("willpower", "Etat")]);
  }

  if (effect.type === "movement") {
    return targetAwareIcons(effect.target, [statIcon("dodge", formatMovement(effect.mode))]);
  }

  if (effect.type === "zone") {
    return [effect.shape === "unknown" ? areaIcon("cone", "Zone conique") : statIcon("range", "Zone")];
  }

  if (effect.type === "tag" && effect.tag === "consumeRune" && isRune(effect.value)) {
    return [runeIcon(effect.value)];
  }

  return [];
}

function conditionIcons(condition: Condition): CatalogInfoIcon[] {
  if (condition.type === "hasRune" || condition.type === "lastRune") {
    return [runeIcon(condition.rune)];
  }

  if (condition.type === "minResource") {
    return [resourceIcon(condition.resource)];
  }

  if (condition.type === "targetIs") {
    return condition.value === "enemy" ? [targetIcon("enemy")] : [];
  }

  return [];
}

function getConditionRune(condition: Condition): Rune | undefined {
  return condition.type === "hasRune" || condition.type === "lastRune" ? condition.rune : undefined;
}

function targetAwareIcons(target: "caster" | "target" | "ally" | "carrier" | "feuFollet" | "cell" | undefined, icons: CatalogInfoIcon[]): CatalogInfoIcon[] {
  if (target === "caster" || target === "carrier") {
    return [targetIcon("caster"), ...icons];
  }

  if (target === "target") {
    return [targetIcon("enemy"), ...icons];
  }

  return icons;
}

function targetIcon(target: "caster" | "enemy"): CatalogInfoIcon {
  return {
    src: getSpellAttributeIconSrc(target),
    label: target === "caster" ? "Lanceur" : "Cible ennemie",
    tone: "target",
  };
}

function runeIcon(rune: Rune): CatalogInfoIcon {
  return {
    src: getRuneIconSrc(rune),
    label: getRuneIconLabel(rune),
    tone: "rune",
  };
}

function resourceIcon(resource: Resource): CatalogInfoIcon {
  return {
    src: getResourceIconSrc(resource),
    label: formatResourceLabel(resource),
    tone: "resource",
  };
}

function elementDamageIcon(element: Element): CatalogInfoIcon {
  return {
    src: getElementMasteryIconSrc(element),
    label: `Dégâts ${formatElementLabel(element)}`,
    tone: "damage",
  };
}

function areaIcon(iconKey: "cone", label: string): CatalogInfoIcon {
  return {
    src: getAreaIconSrc(iconKey),
    label,
    tone: "area",
  };
}

function statIcon(stat: StatIconKey, label: string): CatalogInfoIcon {
  return {
    src: getStatIconSrc(stat),
    label,
    tone: "stat",
  };
}

function statIconKey(stat: string): StatIconKey {
  const keys: Partial<Record<string, StatIconKey>> = {
    armorReceivedPercent: "armorReceivedPercent",
    criticalHitPercent: "criticalHitPercent",
    damageInflictedPercent: "damageInflictedPercent",
    elementalMastery: "elementalMastery",
    elementalResistance: "elementalResistance",
    healsPerformedPercent: "healsPerformedPercent",
    healsReceivedPercent: "healsReceivedPercent",
    parry: "parry",
    range: "range",
    willpower: "willpower",
  };

  return keys[stat] ?? "elementalMastery";
}

function isRune(value: unknown): value is Rune {
  return value === "incandescent" || value === "aquatic" || value === "telluric" || value === "aerial";
}
