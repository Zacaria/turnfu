export type CharacterClass = "huppermage";

export type CatalogEntryKind = "spell" | "passive" | "classMechanic";

export type Element =
  | "fire"
  | "water"
  | "earth"
  | "air"
  | "light"
  | "neutral";

export type Rune = "incandescent" | "aquatic" | "telluric" | "aerial";

export type Resource = "ap" | "mp" | "wp" | "bq";

export type VerificationStatus =
  | "demo"
  | "unverified"
  | "extracted"
  | "needsReview"
  | "verified";

export type SourceKind = "screenshot" | "manual" | "derived";

export type ScreenshotSource = {
  kind: "screenshot";
  path: string;
  imageId?: string;
};

export type CatalogSource =
  | ScreenshotSource
  | {
      kind: "manual" | "derived";
      label: string;
    };

export type ReviewMetadata = {
  reviewedBy: string;
  reviewedAt: string;
};

export type CatalogMetadata = {
  status: VerificationStatus;
  normalizedLevel: number;
  observedLevel?: number;
  valuesStableAtLevel200?: boolean;
  sources: CatalogSource[];
  extractionNotes?: string[];
  review?: ReviewMetadata;
};

export type SpellCost = Partial<Record<Resource, number>>;

export type RangeSpec = {
  min: number;
  max: number;
  lineOfSight?: boolean;
  modifiable?: boolean;
  notes?: string[];
};

export type Effect =
  | DamageEffect
  | HealEffect
  | ArmorEffect
  | ResourceDeltaEffect
  | StatModifierEffect
  | StateEffect
  | MovementEffect
  | ZoneEffect
  | TagEffect
  | ConditionalEffect
  | TriggerEffect
  | UnsupportedMechanicEffect;

export type EffectBase<Type extends string> = {
  type: Type;
  note?: string;
};

export type DamageEffect = EffectBase<"damage"> & {
  element: Element;
  base: number;
  times?: number;
};

export type HealEffect = EffectBase<"heal"> & {
  element?: Element;
  base: number;
  times?: number;
};

export type ArmorEffect = EffectBase<"armor"> & {
  amount: number;
  target?: "caster" | "target" | "ally" | "carrier";
  element?: Element;
};

export type ResourceDeltaEffect = EffectBase<"resourceDelta"> & {
  resource: Resource;
  amount: number;
  target?: "caster" | "target";
};

export type StatModifierEffect = EffectBase<"statModifier"> & {
  stat:
    | "damageInflictedPercent"
    | "healsPerformedPercent"
    | "healsReceivedPercent"
    | "armorReceivedPercent"
    | "elementalResistance"
    | "range"
    | "willpower"
    | "criticalHitPercent"
    | "parry"
    | "damageReceivedPercent"
    | "elementalMastery";
  amount: number;
  duration?: string;
  target?: "caster" | "target" | "ally" | "carrier";
  element?: Element;
};

export type StateEffect = EffectBase<"state"> & {
  state: string;
  level?: number;
  duration?: string;
  target?: "caster" | "target" | "ally" | "carrier";
};

export type MovementEffect = EffectBase<"movement"> & {
  mode:
    | "swapWithTarget"
    | "swapWithFeuFollet"
    | "teleportCaster"
    | "teleportTarget"
    | "push"
    | "pull"
    | "moveFeuFollet"
    | "placeSummon";
  cells?: number;
  target?: "caster" | "target" | "feuFollet" | "cell";
};

export type ZoneEffect = EffectBase<"zone"> & {
  shape: string;
  size?: number;
};

export type TagEffect = EffectBase<"tag"> & {
  tag: string;
  value?: string | number | boolean;
};

export type Condition =
  | {
      type: "hasRune";
      rune: Rune;
    }
  | {
      type: "lastRune";
      rune: Rune;
    }
  | {
      type: "exactRuneCount";
      count: number;
    }
  | {
      type: "hasAllRunes";
    }
  | {
      type: "minResource";
      resource: Resource;
      amount: number;
    }
  | {
      type: "targetIs";
      value: "fighter" | "feuFollet" | "emptyCell" | "ally" | "enemy";
    }
  | {
      type: "inState";
      state: string;
      target?: "caster" | "target" | "ally" | "carrier";
    }
  | {
      type: "event";
      event: string;
    }
  | {
      type: "custom";
      description: string;
    };

export type ConditionalEffect = EffectBase<"conditional"> & {
  condition: Condition;
  effects: Effect[];
};

export type TriggerEffect = EffectBase<"trigger"> & {
  event: string;
  effects: Effect[];
};

export type UnsupportedMechanicEffect = EffectBase<"unsupportedMechanic"> & {
  mechanic: string;
};

export type SpellConstraint =
  | {
      type: "maxCastsPerTurn";
      value: number;
    }
  | {
      type: "requiresTarget";
      target: "fighter" | "feuFollet" | "emptyCell" | "ally" | "enemy";
    }
  | {
      type: "custom";
      description: string;
    };

export type CatalogEntry = {
  kind: CatalogEntryKind;
  id: string;
  name: string;
  className: CharacterClass;
  level: number;
  cost?: SpellCost;
  range?: RangeSpec;
  element?: Element;
  effects: Effect[];
  constraints: SpellConstraint[];
  tags: string[];
  metadata: CatalogMetadata;
};

export type CatalogValidationError = {
  entryId?: string;
  field: string;
  message: string;
  source?: CatalogSource;
};
