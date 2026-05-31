import type { CatalogEntry, Resource, SpellCost } from "../catalog/types.ts";
import { getCostAmount } from "./resources.ts";
import type { Action, ResourcePool, SimulationViolation, TurnState } from "./types.ts";

const resources: Resource[] = ["ap", "mp", "wp", "bq"];

export function findSpell(catalog: CatalogEntry[], spellId: string): CatalogEntry | undefined {
  return catalog.find((entry) => entry.id === spellId);
}

export function validateSpellAction(input: {
  spell?: CatalogEntry;
  spellId: string;
  actionIndex: number;
  state: TurnState;
  effectiveCost?: SpellCost;
  action?: Action;
  maxCastsPerTurnOverride?: number;
}): SimulationViolation | undefined {
  if (!input.spell) {
    return {
      type: "unknownSpell",
      actionIndex: input.actionIndex,
      spellId: input.spellId,
      message: `Unknown spell id '${input.spellId}'.`,
    };
  }

  if (input.spell.kind !== "spell") {
    return {
      type: "unsupportedEntryKind",
      actionIndex: input.actionIndex,
      spellId: input.spell.id,
      message: `Catalog entry '${input.spell.id}' is a ${input.spell.kind}, not a spell.`,
      source: input.spell.metadata.sources[0],
    };
  }

  const cooldownViolation = validateCooldown(input.spell, input.state, input.actionIndex);
  if (cooldownViolation) {
    return cooldownViolation;
  }

  const resourceViolation = validateResources(input.spell, input.effectiveCost ?? input.spell.cost, input.state.remainingResources, input.actionIndex);
  if (resourceViolation) {
    return resourceViolation;
  }

  return validateTarget(input.spell, input.action, input.actionIndex)
    ?? validateCastLimit(input.spell, input.state, input.actionIndex, input.maxCastsPerTurnOverride, input.action);
}

function validateCooldown(
  spell: CatalogEntry,
  state: TurnState,
  actionIndex: number,
): SimulationViolation | undefined {
  const cooldownRemaining = state.classState.huppermage?.cooldownsBySpellId[spell.id] ?? 0;
  if (cooldownRemaining <= 0) {
    return undefined;
  }

  const cooldown = spell.constraints.find((constraint) => constraint.type === "cooldownTurns");
  return {
    type: "cooldownActive",
    actionIndex,
    spellId: spell.id,
    required: cooldown?.type === "cooldownTurns" ? cooldown.value : undefined,
    available: cooldownRemaining,
    message: `Spell '${spell.id}' is on cooldown for ${cooldownRemaining} more turn(s).`,
    source: spell.metadata.sources[0],
  };
}

function validateResources(
  spell: CatalogEntry,
  cost: SpellCost | undefined,
  remainingResources: ResourcePool,
  actionIndex: number,
): SimulationViolation | undefined {
  for (const resource of resources) {
    const required = getCostAmount(cost, resource);
    const available = remainingResources[resource];
    if (required > available) {
      return {
        type: "insufficientResource",
        actionIndex,
        spellId: spell.id,
        resource,
        required,
        available,
        message: `Spell '${spell.id}' requires ${required} ${resource.toUpperCase()}, but only ${available} is available.`,
        source: spell.metadata.sources[0],
      };
    }
  }

  return undefined;
}

function validateTarget(
  spell: CatalogEntry,
  action: Action | undefined,
  actionIndex: number,
): SimulationViolation | undefined {
  const targetConstraint = spell.constraints.find((constraint) => constraint.type === "requiresTarget");
  if (!targetConstraint || targetConstraint.type !== "requiresTarget") {
    return undefined;
  }

  const actualTarget = action?.target?.kind;
  if (actualTarget === targetConstraint.target) {
    return undefined;
  }

  return {
    type: "invalidTarget",
    actionIndex,
    spellId: spell.id,
    message: `Spell '${spell.id}' requires target '${targetConstraint.target}'.`,
    source: spell.metadata.sources[0],
  };
}

function validateCastLimit(
  spell: CatalogEntry,
  state: TurnState,
  actionIndex: number,
  maxCastsPerTurnOverride?: number,
  action?: Action,
): SimulationViolation | undefined {
  const targetCastLimit = spell.constraints.find((constraint) => constraint.type === "maxCastsPerTarget");
  if (targetCastLimit?.type === "maxCastsPerTarget") {
    if (!countsAsTargetCast(action)) {
      return undefined;
    }

    const currentTargetCasts = state.targetCastsBySpellId[spell.id] ?? 0;
    if (currentTargetCasts >= targetCastLimit.value) {
      return {
        type: "castLimitExceeded",
        actionIndex,
        spellId: spell.id,
        required: targetCastLimit.value,
        available: currentTargetCasts,
        scope: "target",
        message: `Spell '${spell.id}' exceeds max casts per target (${targetCastLimit.value}).`,
        source: spell.metadata.sources[0],
      };
    }

    return undefined;
  }

  const castLimit = spell.constraints.find((constraint) => constraint.type === "maxCastsPerTurn");
  if (maxCastsPerTurnOverride === undefined && (!castLimit || castLimit.type !== "maxCastsPerTurn")) {
    return undefined;
  }

  const maxCastsPerTurn = maxCastsPerTurnOverride ?? castLimit?.value;
  if (maxCastsPerTurn === undefined) {
    return undefined;
  }

  const currentCasts = state.castsBySpellId[spell.id] ?? 0;
  if (currentCasts >= maxCastsPerTurn) {
    return {
      type: "castLimitExceeded",
      actionIndex,
      spellId: spell.id,
      required: maxCastsPerTurn,
      available: currentCasts,
      scope: "turn",
      message: `Spell '${spell.id}' exceeds max casts per turn (${maxCastsPerTurn}).`,
      source: spell.metadata.sources[0],
    };
  }

  return undefined;
}

function countsAsTargetCast(action: Action | undefined): boolean {
  return action?.target?.kind !== "emptyCell";
}
