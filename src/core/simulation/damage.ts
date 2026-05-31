import type { DamageEffect, Element } from "../catalog/types.ts";
import type { ActionContext, BaseStats, CriticalEvaluationMode, DamageFormulaBreakdown } from "./types.ts";

export const defaultActionContext: ActionContext = {
  position: "face",
  isCritical: false,
  criticalMode: "forcedNonCritical",
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
  const criticalMode = resolveCriticalEvaluationMode(resolvedContext);
  const positionMultiplier = getPositionMultiplier(resolvedContext.position);
  const finalMultiplier = 1 + stats.damageInflictedPercent / 100;
  const blockMultiplier = resolvedContext.isBlocked ? 0.8 : 1;
  const times = effect.times ?? 1;
  const nonCriticalBranch = computeDamageBranch({
    stats,
    context: resolvedContext,
    effect,
    elementalMastery,
    isCritical: false,
    positionMultiplier,
    finalMultiplier,
    blockMultiplier,
    times,
  });
  const criticalBranch = computeDamageBranch({
    stats,
    context: resolvedContext,
    effect,
    elementalMastery,
    isCritical: true,
    positionMultiplier,
    finalMultiplier,
    blockMultiplier,
    times,
  });
  const effectiveCriticalHitPercent = criticalMode === "expected"
    ? clampPercent(stats.criticalHitPercent ?? 0)
    : criticalMode === "forcedCritical"
      ? 100
      : 0;
  const result = criticalMode === "expected"
    ? roundDamage(
      nonCriticalBranch.result * (1 - effectiveCriticalHitPercent / 100)
        + criticalBranch.result * (effectiveCriticalHitPercent / 100),
    )
    : criticalMode === "forcedCritical"
      ? criticalBranch.result
      : nonCriticalBranch.result;
  const selectedBranch = criticalMode === "forcedCritical" ? criticalBranch : nonCriticalBranch;

  return {
    baseDamage: effect.base,
    times,
    resolvedElement,
    elementalMastery,
    extraMastery: selectedBranch.extraMastery,
    masteryMultiplier: selectedBranch.masteryMultiplier,
    criticalMode,
    effectiveCriticalHitPercent,
    nonCriticalResult: nonCriticalBranch.result,
    criticalResult: criticalBranch.result,
    criticalMultiplier: selectedBranch.criticalMultiplier,
    positionMultiplier,
    finalMultiplier,
    blockMultiplier,
    result,
  };
}

type DamageBranchInput = {
  stats: BaseStats;
  context: ActionContext;
  effect: DamageEffect;
  elementalMastery: number;
  isCritical: boolean;
  positionMultiplier: number;
  finalMultiplier: number;
  blockMultiplier: number;
  times: number;
};

type DamageBranch = {
  extraMastery: number;
  masteryMultiplier: number;
  criticalMultiplier: number;
  result: number;
};

function computeDamageBranch(input: DamageBranchInput): DamageBranch {
  const extraMastery = getExtraMastery(input.stats, input.context, input.isCritical);
  const masteryMultiplier = 1 + (input.stats.generalMastery + input.elementalMastery + extraMastery) / 100;
  const criticalMultiplier = input.isCritical ? 1.25 : 1;
  const result = roundDamage(
    Math.max(
      0,
      input.effect.base *
        input.times *
        masteryMultiplier *
        criticalMultiplier *
        input.positionMultiplier *
        input.finalMultiplier *
        input.blockMultiplier,
    ),
  );

  return {
    extraMastery,
    masteryMultiplier,
    criticalMultiplier,
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
  const resolved = {
    ...defaultActionContext,
    ...context,
  };

  return {
    ...resolved,
    criticalMode: context.criticalMode ?? (context.isCritical ? "forcedCritical" : resolved.criticalMode),
  };
}

function resolveCriticalEvaluationMode(context: ActionContext): CriticalEvaluationMode {
  return context.criticalMode ?? (context.isCritical ? "forcedCritical" : "forcedNonCritical");
}

function getExtraMastery(stats: BaseStats, context: ActionContext, isCritical: boolean): number {
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
    (isCritical ? stats.criticalMastery ?? 0 : 0)
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

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}
