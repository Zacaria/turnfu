import type {
  CatalogEntry,
  CatalogEntryKind,
  CatalogMetadata,
  CatalogSource,
  Condition,
  Effect,
  Element,
  RangeSpec,
  Resource,
  Rune,
  SpellConstraint,
  SpellCost,
} from "./types.ts";
import type { SpellCastProfile } from "../sublimations/types.ts";

const DSL_ENTRY = Symbol("wakfu.catalog.dslEntry");
const DSL_EFFECT = Symbol("wakfu.catalog.dslEffect");
const DSL_CONSTRAINT = Symbol("wakfu.catalog.dslConstraint");

export type DslEntry = Omit<CatalogEntry, "kind"> & {
  kind: CatalogEntryKind;
  [DSL_ENTRY]: true;
};

type DslEffect = Effect & {
  [DSL_EFFECT]: true;
};

type DslConstraint = SpellConstraint & {
  [DSL_CONSTRAINT]: true;
};

type EntryInput = {
  name: string;
  level?: number;
  observedLevel?: number;
  element?: Element;
  cost?: SpellCost;
  range?: RangeSpec;
  castProfile?: SpellCastProfile;
  effects?: Effect[];
  constraints?: SpellConstraint[];
  tags?: string[];
  metadata: Omit<CatalogMetadata, "normalizedLevel" | "observedLevel"> & {
    observedLevel?: number;
    normalizedLevel?: number;
  };
};

function createEntry(kind: CatalogEntryKind, id: string, input: EntryInput): DslEntry {
  return {
    [DSL_ENTRY]: true,
    kind,
    id,
    name: input.name,
    className: "huppermage",
    level: input.level ?? 200,
    element: input.element,
    cost: input.cost,
    range: input.range,
    castProfile: input.castProfile,
    effects: input.effects ?? [],
    constraints: input.constraints ?? [],
    tags: input.tags ?? [],
    metadata: {
      ...input.metadata,
      normalizedLevel: input.metadata.normalizedLevel ?? 200,
      observedLevel: input.metadata.observedLevel ?? input.observedLevel ?? input.level ?? 200,
    },
  };
}

export function spell(id: string, input: EntryInput): DslEntry {
  return createEntry("spell", id, input);
}

export function passive(id: string, input: EntryInput): DslEntry {
  return createEntry("passive", id, input);
}

export function classMechanic(id: string, input: EntryInput): DslEntry {
  return createEntry("classMechanic", id, input);
}

export function cost(values: SpellCost): SpellCost {
  return values;
}

export function range(min: number, max = min, options: Omit<RangeSpec, "min" | "max"> = {}): RangeSpec {
  return { min, max, ...options };
}

function effect<T extends Effect>(value: T): DslEffect {
  return { ...value, [DSL_EFFECT]: true } as DslEffect;
}

export function damage(input: Omit<Extract<Effect, { type: "damage" }>, "type">): Effect {
  return effect({ type: "damage", ...input });
}

export function heal(input: Omit<Extract<Effect, { type: "heal" }>, "type">): Effect {
  return effect({ type: "heal", ...input });
}

export function armor(input: Omit<Extract<Effect, { type: "armor" }>, "type">): Effect {
  return effect({ type: "armor", ...input });
}

export function resourceDelta(input: {
  resource: Resource;
  amount: number;
  target?: "caster" | "target";
  note?: string;
}): Effect {
  return effect({ type: "resourceDelta", ...input });
}

export function statModifier(input: Omit<Extract<Effect, { type: "statModifier" }>, "type">): Effect {
  return effect({ type: "statModifier", ...input });
}

export function state(input: Omit<Extract<Effect, { type: "state" }>, "type">): Effect {
  return effect({ type: "state", ...input });
}

export function movement(input: Omit<Extract<Effect, { type: "movement" }>, "type">): Effect {
  return effect({ type: "movement", ...input });
}

export function zone(input: Omit<Extract<Effect, { type: "zone" }>, "type">): Effect {
  return effect({ type: "zone", ...input });
}

export function tag(tagName: string, value?: string | number | boolean): Effect {
  return effect({ type: "tag", tag: tagName, value });
}

export function when(condition: Condition, effects: Effect[], note?: string): Effect {
  return effect({ type: "conditional", condition, effects, note });
}

export function on(event: string, effects: Effect[], note?: string): Effect {
  return effect({ type: "trigger", event, effects, note });
}

export function unsupported(mechanic: string, note?: string): Effect {
  return effect({ type: "unsupportedMechanic", mechanic, note });
}

export function maxCastsPerTurn(value: number): SpellConstraint {
  return { [DSL_CONSTRAINT]: true, type: "maxCastsPerTurn", value } as DslConstraint;
}

export function maxCastsPerTarget(value: number): SpellConstraint {
  return { [DSL_CONSTRAINT]: true, type: "maxCastsPerTarget", value } as DslConstraint;
}

export function cooldownTurns(value: number): SpellConstraint {
  return { [DSL_CONSTRAINT]: true, type: "cooldownTurns", value } as DslConstraint;
}

export function requiresTarget(target: Extract<SpellConstraint, { type: "requiresTarget" }>["target"]): SpellConstraint {
  return { [DSL_CONSTRAINT]: true, type: "requiresTarget", target } as DslConstraint;
}

export function customConstraint(description: string): SpellConstraint {
  return { [DSL_CONSTRAINT]: true, type: "custom", description } as DslConstraint;
}

export function screenshot(path: string, imageId?: string): CatalogSource {
  return { kind: "screenshot", path, imageId };
}

export function manual(label: string): CatalogSource {
  return { kind: "manual", label };
}

export function normalizeCatalog(entries: unknown[]): CatalogEntry[] {
  return entries.map((entry) => normalizeEntry(entry));
}

export function normalizeEntry(entry: unknown): CatalogEntry {
  if (!isDslEntry(entry)) {
    throw new Error("Unknown DSL entry. Use spell(), passive(), or classMechanic().");
  }

  return {
    kind: entry.kind,
    id: entry.id,
    name: entry.name,
    className: entry.className,
    level: entry.level,
    element: entry.element,
    cost: entry.cost,
    range: entry.range,
    castProfile: entry.castProfile ?? inferCastProfile(entry),
    effects: entry.effects.map((entryEffect) => normalizeEffect(entryEffect)),
    constraints: entry.constraints,
    tags: entry.tags,
    metadata: entry.metadata,
  };
}

function inferCastProfile(entry: DslEntry): SpellCastProfile | undefined {
  if (!entry.range) {
    return undefined;
  }

  return {
    canMelee: entry.range.min <= 1,
    canDistance: entry.range.max >= 3,
    maxDistance: entry.range.max,
    isZone: entry.tags.includes("zone") || entry.effects.some(isZoneEffect),
  };
}

function isZoneEffect(effectValue: Effect): boolean {
  if (effectValue.type === "zone") {
    return true;
  }

  if (effectValue.type === "damage" && effectValue.note?.toLowerCase().includes("zone")) {
    return true;
  }

  if (effectValue.type === "conditional") {
    return effectValue.effects.some(isZoneEffect);
  }

  if (effectValue.type === "trigger") {
    return effectValue.effects.some(isZoneEffect);
  }

  return false;
}

function normalizeEffect(value: unknown): Effect {
  if (!isObject(value) || !("type" in value)) {
    throw new Error("Unknown DSL effect. Use registered DSL effect primitives.");
  }

  const effectValue = value as Effect;
  if (effectValue.type === "conditional") {
    return {
      ...effectValue,
      effects: effectValue.effects.map((nestedEffect) => normalizeEffect(nestedEffect)),
    };
  }

  if (effectValue.type === "trigger") {
    return {
      ...effectValue,
      effects: effectValue.effects.map((nestedEffect) => normalizeEffect(nestedEffect)),
    };
  }

  return effectValue;
}

function isDslEntry(value: unknown): value is DslEntry {
  return isObject(value) && value[DSL_ENTRY] === true;
}

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null;
}
