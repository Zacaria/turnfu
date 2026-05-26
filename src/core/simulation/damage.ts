import type { DamageEffect, Element } from "../catalog/types.ts";
import type { ActionContext, BaseStats, DamageFormulaBreakdown } from "./types.ts";

export const defaultActionContext: ActionContext = {
  position: "face",
  isCritical: false,
  isBerserk: false,
  isBlocked: false,
};

export function computeRawDamage(
  stats: BaseStats,
  effect: DamageEffect,
  context: Partial<ActionContext> = {},
): DamageFormulaBreakdown {
  const resolvedContext = resolveActionContext(context);
  const resolvedElement = resolveDamageElement(effect.element, stats);
  const elementalMastery = stats.elementalMastery[resolvedElement] ?? 0;
  const extraMastery = getExtraMastery(stats, resolvedContext);
  const masteryMultiplier = 1 + (stats.generalMastery + elementalMastery + extraMastery) / 100;
  const criticalMultiplier = resolvedContext.isCritical ? 1.25 : 1;
  const positionMultiplier = getPositionMultiplier(resolvedContext.position);
  const finalMultiplier = 1 + stats.damageInflictedPercent / 100;
  const blockMultiplier = resolvedContext.isBlocked ? 0.8 : 1;
  const times = effect.times ?? 1;
  const result = roundDamage(
    Math.max(
      0,
      effect.base *
        times *
        masteryMultiplier *
        criticalMultiplier *
        positionMultiplier *
        finalMultiplier *
        blockMultiplier,
    ),
  );

  return {
    baseDamage: effect.base,
    times,
    resolvedElement,
    elementalMastery,
    extraMastery,
    masteryMultiplier,
    criticalMultiplier,
    positionMultiplier,
    finalMultiplier,
    blockMultiplier,
    result,
  };
}

export function resolveDamageElement(element: Element, stats: BaseStats): Element {
  if (element !== "light") {
    return element;
  }

  return getHighestElementalMasteryElement(stats);
}

export function resolveActionContext(context: Partial<ActionContext> = {}): ActionContext {
  return {
    ...defaultActionContext,
    ...context,
  };
}

function getExtraMastery(stats: BaseStats, context: ActionContext): number {
  const rangeMastery =
    context.rangeMode === "melee"
      ? stats.meleeMastery ?? 0
      : context.rangeMode === "distance"
        ? stats.distanceMastery ?? 0
        : 0;

  return (
    rangeMastery +
    (context.isBerserk ? stats.berserkMastery ?? 0 : 0) +
    (context.position === "rear" ? stats.rearMastery ?? 0 : 0) +
    (context.isCritical ? stats.criticalMastery ?? 0 : 0)
  );
}

function getHighestElementalMasteryElement(stats: BaseStats): Exclude<Element, "light" | "neutral"> {
  const elementOrder: Array<Exclude<Element, "light" | "neutral">> = ["fire", "water", "earth", "air"];
  return elementOrder.reduce((bestElement, element) => {
    const bestMastery = stats.elementalMastery[bestElement] ?? 0;
    const mastery = stats.elementalMastery[element] ?? 0;
    return mastery > bestMastery ? element : bestElement;
  }, elementOrder[0]);
}

function getPositionMultiplier(position: ActionContext["position"]): number {
  if (position === "rear") {
    return 1.25;
  }

  if (position === "side") {
    return 1.1;
  }

  return 1;
}

export function roundDamage(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
