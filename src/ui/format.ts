import type { AppliedEffect, BaseStats, HuppermageHeart, ResourcePool, SimulationViolation } from "../core/simulation/types.ts";
import type { Rune } from "../core/catalog/types.ts";
import { formatElementLabel, formatResourceLabel, formatRuneLabel, formatUiMessage, t } from "./i18n.ts";

const statLabels: Record<string, string> = {
  damageInflictedPercent: t("stat.damageInflicted"),
  elementalMastery: t("stat.fullGeneralMastery"),
  generalMastery: t("stat.fullGeneralMastery"),
  healsPerformedPercent: t("stat.healsPerformed"),
  healsReceivedPercent: t("stat.healsReceived"),
  armorReceivedPercent: t("stat.armorReceived"),
  elementalResistance: t("stat.elementalResistance"),
  range: t("stat.range"),
  willpower: t("stat.willpower"),
  criticalHitPercent: t("stat.criticalHit"),
  parry: t("stat.parry"),
  damageReceivedPercent: t("stat.damageReceived"),
};

export function formatHeart(heart: HuppermageHeart | null | undefined): string {
  return heart ? formatElementLabel(heart) : t("value.none");
}

export function formatResources(resources: ResourcePool): string {
  return `${formatResourceLabel("ap")} ${resources.ap} | ${formatResourceLabel("mp")} ${resources.mp} | ${formatResourceLabel("wp")} ${resources.wp} | ${formatResourceLabel("bq")} ${resources.bq}`;
}

export function formatNumber(value: number | undefined): string {
  return Number.isFinite(value) ? String(value) : "0";
}

export function summarizeStats(stats: BaseStats): Array<[string, number]> {
  return [
    [t("stat.level"), stats.level ?? 200],
    [t("stat.hitPoints"), stats.hitPoints ?? 0],
    [t("stat.hitPointsPercent"), stats.hitPointsPercent ?? 0],
    [t("stat.fullGeneralMastery"), stats.generalMastery],
    [formatUiMessage("stat.elementalMastery", { element: formatElementLabel("fire") }), stats.elementalMastery.fire ?? 0],
    [formatUiMessage("stat.elementalMastery", { element: formatElementLabel("water") }), stats.elementalMastery.water ?? 0],
    [formatUiMessage("stat.elementalMastery", { element: formatElementLabel("earth") }), stats.elementalMastery.earth ?? 0],
    [formatUiMessage("stat.elementalMastery", { element: formatElementLabel("air") }), stats.elementalMastery.air ?? 0],
    [formatUiMessage("stat.elementalMastery", { element: formatElementLabel("light") }), stats.elementalMastery.light ?? 0],
    [t("stat.damageInflicted"), stats.damageInflictedPercent],
    [formatUiMessage("stat.elementalMastery", { element: t("stat.meleeMastery") }), stats.meleeMastery ?? 0],
    [formatUiMessage("stat.elementalMastery", { element: t("stat.distanceMastery") }), stats.distanceMastery ?? 0],
    [formatUiMessage("stat.elementalMastery", { element: t("stat.rearMastery") }), stats.rearMastery ?? 0],
    [formatUiMessage("stat.elementalMastery", { element: t("stat.criticalMastery") }), stats.criticalMastery ?? 0],
    [t("stat.elementalResistance"), stats.elementalResistance ?? 0],
    [t("stat.criticalHit"), stats.criticalHitPercent ?? 0],
    [t("stat.parry"), stats.parry ?? 0],
    [t("stat.range"), stats.range ?? 0],
    [t("stat.willpower"), stats.willpower ?? 0],
  ];
}

export function describeEffect(effect: AppliedEffect): string {
  if (effect.type === "damage") {
    return formatUiMessage("effect.damage", { element: formatElementLabel(effect.element), amount: effect.amount });
  }

  if (effect.type === "resourceDelta") {
    return formatUiMessage("effect.resourceDelta", {
      resource: formatResourceLabel(effect.resource),
      amount: formatSignedNumber(effect.amount),
      before: effect.before,
      after: effect.after,
    });
  }

  if (effect.type === "runeGenerated") {
    return formatUiMessage("effect.runeGenerated", {
      rune: formatRuneLabel(effect.rune),
      state: effect.before ? t("effect.runeAlreadyActive") : t("effect.runeActivated"),
    });
  }

  if (effect.type === "runeConsumed") {
    return formatUiMessage("effect.runeConsumed", { runes: formatRuneList(effect.runes) });
  }

  if (effect.type === "feuFolletChanged") {
    return formatUiMessage("effect.feuFolletChanged", {
      operation: effect.operation === "placed" ? t("effect.feuFolletPlaced") : t("effect.feuFolletRecovered"),
      before: effect.before,
      after: effect.after,
    });
  }

  if (effect.type === "feuFolletRunesStored") {
    return formatUiMessage("effect.runesStored", { runes: formatRuneList(effect.runes) });
  }

  if (effect.type === "feuFolletRunesRecovered") {
    return formatUiMessage("effect.runesRecovered", {
      runes: formatRuneList(effect.runes),
      lastRune: effect.lastGeneratedRuneAfter ? formatRuneLabel(effect.lastGeneratedRuneAfter) : t("value.nonePlural").toLowerCase(),
    });
  }

  if (effect.type === "bqRegeneration") {
    return formatUiMessage("effect.bqRegeneration", { heart: formatHeart(effect.heart), amount: effect.amount });
  }

  if (effect.type === "lifeSteal") {
    return formatUiMessage("effect.lifeSteal", { amount: effect.amount, percent: effect.percent });
  }

  if (effect.type === "haloMarksChanged") {
    return formatUiMessage("effect.haloMarksChanged", { before: effect.before, after: effect.after, triggered: effect.triggered });
  }

  if (effect.type === "turnEndBq") {
    return formatUiMessage("effect.turnEndBq", {
      amount: formatSignedNumber(effect.amount),
      before: effect.before,
      after: effect.after,
      storedBefore: effect.storedBefore,
      storedAfter: effect.storedAfter,
    });
  }

  if (effect.type === "sublimationEffect") {
    return `${effect.sublimationName}: ${effect.status === "applied" ? "appliquée" : "ignorée"} (${effect.reason})${effect.amount ? ` ${formatSignedNumber(effect.amount)}%` : ""}`;
  }

  if (effect.type === "resourceCarryover") {
    return `${effect.sublimationName}: ${formatSignedNumber(effect.amount)} ${formatResourceLabel(effect.resource)} reporté`;
  }

  return formatUiMessage("effect.statModifier", {
    stat: formatStatLabel(effect.stat),
    amount: formatSignedNumber(effect.amount),
    before: effect.before,
    after: effect.after,
  });
}

export function describeViolation(violation: SimulationViolation): string {
  const spellId = violation.spellId ?? t("action.unknownSpell");
  if (violation.type === "unknownSpell") {
    return formatUiMessage("violation.unknownSpell", { spellId });
  }

  if (violation.type === "insufficientResource") {
    return formatUiMessage("violation.insufficientResource", {
      required: violation.required ?? 0,
      resource: violation.resource ? formatResourceLabel(violation.resource) : "",
      available: violation.available ?? 0,
    });
  }

  if (violation.type === "castLimitExceeded") {
    return formatUiMessage(violation.scope === "target" ? "violation.castLimitExceededTarget" : "violation.castLimitExceeded", {
      spellId,
      required: violation.required ?? 0,
    });
  }

  if (violation.type === "cooldownActive") {
    return formatUiMessage("violation.cooldownActive", {
      spellId,
      available: violation.available ?? 0,
    });
  }

  if (violation.type === "unsupportedEntryKind") {
    return formatUiMessage("violation.unsupportedEntryKind", { spellId });
  }

  if (violation.type === "invalidClassStateAction") {
    return formatUiMessage("violation.invalidClassStateAction", { spellId });
  }

  return violation.message;
}

function formatSignedNumber(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

function formatRuneList(runes: Rune[]): string {
  return runes.map(formatRuneLabel).join(", ");
}

function formatStatLabel(stat: string): string {
  return statLabels[stat] ?? stat;
}
