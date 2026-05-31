import type { CatalogSource, Resource } from "../catalog/types.ts";
import type { BaseStats, RangeMode } from "../simulation/types.ts";

export type SublimationCategory = "normal" | "epic" | "relic";

export type SublimationSupportStatus = "supported" | "planned" | "ignored";

export type SublimationHpAssumption = "healthy90" | "normal" | "berserk50" | "berserk20";

export type SublimationHpRequirement = {
  minPercent?: number;
  maxPercent?: number;
};

export type SublimationCastGeometry = "line" | "diagonal";

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
    };

export type SublimationCatalogEntry = {
  id: string;
  familyId: string;
  name: string;
  category: SublimationCategory;
  level: number;
  cumulativeMax: number;
  supportStatus: SublimationSupportStatus;
  supportReason?: string;
  effects: SublimationEffect[];
  hpRequirement?: SublimationHpRequirement;
  runePrerequisites?: string[];
  sources: CatalogSource[];
};

export type SublimationSelection = {
  sublimationId: string;
};

export type SublimationBuild = {
  selections: SublimationSelection[];
  hpAssumption?: SublimationHpAssumption;
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
  | "hpConditionConflict";

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
