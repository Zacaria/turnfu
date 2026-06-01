import type { CatalogSource, Element, Resource } from "../catalog/types.ts";
import type { BaseStats, RangeMode } from "../simulation/types.ts";

export type SublimationCategory = "normal" | "epic" | "relic";

export type SublimationSupportStatus = "supported" | "planned" | "ignored";

export type SublimationHpAssumption = "healthy90" | "normal" | "berserk50" | "berserk20";

export type SublimationNearbyAlliesAssumption = "unspecified" | "none" | "one" | "twoPlus";

export type SublimationContactEnemiesAssumption = "unspecified" | "none" | "one" | "two" | "threePlus";

export type SublimationHpRequirement = {
  minPercent?: number;
  maxPercent?: number;
};

export type SublimationCastGeometry = "line" | "diagonal";

export type SublimationElement = Exclude<Element, "light" | "neutral">;

export type SublimationInitialCondition =
  | {
      type: "statAtMost";
      stat: keyof Omit<BaseStats, "elementalMastery">;
      value: number;
    }
  | {
      type: "resourceAtMost";
      resource: Resource;
      value: number;
    }
  | {
      type: "secondaryMasteriesAtMost";
      value: number;
    };

export type SublimationActionCondition =
  | {
      type: "rangeMode";
      mode: RangeMode;
      minRange?: number;
    }
  | {
      type: "zone";
    }
  | {
      type: "geometry";
      geometry: SublimationCastGeometry;
    }
  | {
      type: "spellElement";
      element: SublimationElement;
    };

export type SublimationEffect =
  | {
      type: "statModifier";
      stat: keyof Omit<BaseStats, "elementalMastery">;
      amount: number;
    }
  | {
      type: "resourceDelta";
      resource: Resource;
      amount: number;
    }
  | {
      type: "actionDamageInflictedPercent";
      amount: number;
      condition: SublimationActionCondition;
    }
  | {
      type: "carryoverResource";
      resource: Extract<Resource, "ap" | "mp">;
      maxAmount?: number;
    }
  | {
      type: "elementalCarryoverDamageInflictedPercent";
      triggerElements: SublimationElement[];
      targetElement: SublimationElement;
      amount: number;
      maxAmount: number;
    }
  | {
      type: "elementalMasteryPercentModifier";
      target: "weakest";
      count: number;
      percent: number;
    }
  | {
      type: "conditionalInitialStatModifier";
      stat: keyof Omit<BaseStats, "elementalMastery">;
      amount: number;
      condition: SublimationInitialCondition;
    }
  | {
      type: "alternatingElementDamageInflictedPercent";
      amount: number;
      mode: "singlePreviousElementThisTurn" | "previousDamageElement";
    }
  | {
      type: "spellCountCarryoverDamageInflictedPercent";
      qualifiedCostResource: Extract<Resource, "ap">;
      interval: number;
      amount: number;
    }
  | {
      type: "spentResourceDamageInflictedPercent";
      resources: Resource[];
      amount: number;
      maxAmount: number;
    };

export type SublimationCatalogEntry = {
  id: string;
  familyId: string;
  name: string;
  wakfuGuideName?: string;
  displayLevel?: string;
  category: SublimationCategory;
  level: number;
  cumulativeMax: number;
  supportStatus: SublimationSupportStatus;
  supportReason?: string;
  effects: SublimationEffect[];
  hpRequirement?: SublimationHpRequirement;
  runePrerequisites?: string[];
  socketPattern?: string;
  sourceDescription?: string;
  sourceLocation?: string;
  sources: CatalogSource[];
};

export type SublimationSelection = {
  sublimationId: string;
};

export type SublimationBuild = {
  selections: SublimationSelection[];
  hpAssumption?: SublimationHpAssumption;
  nearbyAlliesAssumption?: SublimationNearbyAlliesAssumption;
  contactEnemiesAssumption?: SublimationContactEnemiesAssumption;
};

export type EffectiveSublimationStack = {
  familyId: string;
  rawLevel: number;
  effectiveLevel: number;
  cumulativeMax: number;
  entries: SublimationCatalogEntry[];
};

export type SublimationValidationViolationType =
  | "unknownSublimation"
  | "slotLimitExceeded"
  | "unsupportedSublimation"
  | "ignoredSublimation"
  | "hpConditionConflict"
  | "hpAssumptionMismatch";

export type SublimationValidationViolation = {
  type: SublimationValidationViolationType;
  sublimationId?: string;
  category?: SublimationCategory;
  required?: number;
  actual?: number;
  message: string;
};

export type SublimationValidationResult = {
  valid: boolean;
  violations: SublimationValidationViolation[];
  effectiveStacks: EffectiveSublimationStack[];
};

export type SpellCastProfile = {
  canMelee?: boolean;
  canDistance?: boolean;
  maxDistance?: number;
  isZone?: boolean;
  geometry?: SublimationCastGeometry[];
};
