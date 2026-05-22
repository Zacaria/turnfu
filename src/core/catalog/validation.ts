import type {
  CatalogEntry,
  CatalogSource,
  CatalogValidationError,
  Condition,
  Effect,
  Resource,
  SpellConstraint,
} from "./types.ts";

const validResources = new Set<Resource>(["ap", "mp", "wp", "bq"]);
const validEffectTypes = new Set<Effect["type"]>([
  "damage",
  "heal",
  "armor",
  "resourceDelta",
  "statModifier",
  "state",
  "movement",
  "zone",
  "tag",
  "conditional",
  "trigger",
  "unsupportedMechanic",
]);
const validConstraintTypes = new Set<SpellConstraint["type"]>([
  "maxCastsPerTurn",
  "requiresTarget",
  "custom",
]);

export function validateCatalog(entries: CatalogEntry[]): CatalogValidationError[] {
  const errors: CatalogValidationError[] = [];
  const seenIds = new Set<string>();

  for (const entry of entries) {
    const source = entry.metadata.sources[0];

    if (!entry.id.trim()) {
      errors.push(error(entry, "id", "Entry id is required.", source));
    }

    if (seenIds.has(entry.id)) {
      errors.push(error(entry, "id", `Duplicate entry id '${entry.id}'.`, source));
    }
    seenIds.add(entry.id);

    if (!entry.name.trim()) {
      errors.push(error(entry, "name", "Entry name is required.", source));
    }

    if (entry.className !== "huppermage") {
      errors.push(error(entry, "className", "Only huppermage entries are supported in this catalog.", source));
    }

    if (entry.metadata.normalizedLevel !== 200) {
      errors.push(error(entry, "metadata.normalizedLevel", "Initial catalog entries must normalize to level 200.", source));
    }

    if (entry.metadata.status === "verified" && (!entry.metadata.review || entry.metadata.sources.length === 0)) {
      errors.push(error(entry, "metadata.status", "Verified entries require review metadata and at least one source.", source));
    }

    if (entry.cost) {
      for (const [resource, amount] of Object.entries(entry.cost)) {
        if (!validResources.has(resource as Resource)) {
          errors.push(error(entry, "cost", `Invalid resource '${resource}'.`, source));
        }
        if (typeof amount !== "number" || amount < 0) {
          errors.push(error(entry, `cost.${resource}`, "Cost values must be non-negative numbers.", source));
        }
      }
    }

    for (const constraint of entry.constraints) {
      if (!validConstraintTypes.has(constraint.type)) {
        errors.push(error(entry, "constraints", `Unknown constraint type '${String(constraint.type)}'.`, source));
      }
      if (constraint.type === "maxCastsPerTurn" && constraint.value <= 0) {
        errors.push(error(entry, "constraints.maxCastsPerTurn", "Max casts per turn must be positive.", source));
      }
    }

    entry.effects.forEach((effectValue, index) => validateEffect(effectValue, entry, `effects.${index}`, errors, source));
  }

  return errors;
}

export function assertValidCatalog(entries: CatalogEntry[]): void {
  const errors = validateCatalog(entries);
  if (errors.length > 0) {
    const summary = errors.map((catalogError) => `${catalogError.entryId ?? "unknown"} ${catalogError.field}: ${catalogError.message}`).join("\n");
    throw new Error(`Catalog validation failed:\n${summary}`);
  }
}

function validateEffect(
  value: Effect,
  entry: CatalogEntry,
  field: string,
  errors: CatalogValidationError[],
  source?: CatalogSource,
): void {
  if (!validEffectTypes.has(value.type)) {
    errors.push(error(entry, field, `Unknown effect type '${String(value.type)}'.`, source));
    return;
  }

  if (value.type === "resourceDelta" && !validResources.has(value.resource)) {
    errors.push(error(entry, `${field}.resource`, `Invalid resource '${value.resource}'.`, source));
  }

  if (value.type === "damage" && value.base < 0) {
    errors.push(error(entry, `${field}.base`, "Damage base must be non-negative.", source));
  }

  if (value.type === "heal" && value.base < 0) {
    errors.push(error(entry, `${field}.base`, "Heal base must be non-negative.", source));
  }

  if (value.type === "armor" && value.amount < 0) {
    errors.push(error(entry, `${field}.amount`, "Armor amount must be non-negative.", source));
  }

  if (value.type === "conditional") {
    validateCondition(value.condition, entry, `${field}.condition`, errors, source);
    value.effects.forEach((nestedEffect, index) => validateEffect(nestedEffect, entry, `${field}.effects.${index}`, errors, source));
  }

  if (value.type === "trigger") {
    if (!value.event.trim()) {
      errors.push(error(entry, `${field}.event`, "Trigger event is required.", source));
    }
    value.effects.forEach((nestedEffect, index) => validateEffect(nestedEffect, entry, `${field}.effects.${index}`, errors, source));
  }
}

function validateCondition(
  condition: Condition,
  entry: CatalogEntry,
  field: string,
  errors: CatalogValidationError[],
  source?: CatalogSource,
): void {
  if (condition.type === "minResource" && !validResources.has(condition.resource)) {
    errors.push(error(entry, `${field}.resource`, `Invalid resource '${condition.resource}'.`, source));
  }

  if (condition.type === "minResource" && condition.amount < 0) {
    errors.push(error(entry, `${field}.amount`, "Minimum resource amount must be non-negative.", source));
  }

  if (condition.type === "exactRuneCount" && condition.count < 0) {
    errors.push(error(entry, `${field}.count`, "Rune count must be non-negative.", source));
  }

  if (condition.type === "custom" && !condition.description.trim()) {
    errors.push(error(entry, `${field}.description`, "Custom condition description is required.", source));
  }
}

function error(entry: CatalogEntry, field: string, message: string, source?: CatalogSource): CatalogValidationError {
  return {
    entryId: entry.id,
    field,
    message,
    source,
  };
}
