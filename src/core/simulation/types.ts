import type { CatalogEntry, CatalogSource, Element, Resource, Rune } from "../catalog/types.ts";

export type ResourcePool = Record<Resource, number>;

export type HuppermageHeart = "fire" | "water" | "earth" | "air";

export type HuppermageWaterHeartSpellKind = "elemental" | "light";

export type HuppermageRuneState = {
  active: Record<Rune, boolean>;
  lastGeneratedRune: Rune | null;
};

export type HuppermageTurnState = {
  runes: HuppermageRuneState;
  runeApGainsThisTurn: Record<Rune, boolean>;
  abundanceLevel: number;
  feuFolletsActive: number;
  feuFolletStoredRunes: Rune[][];
  feuFolletStoredLastRunes: Array<Rune | null>;
  temporaryUnlockedSpellElement: Element | null;
  usedSpellIds: string[];
  activePassives: string[];
  activeHeart: HuppermageHeart | null;
  waterHeartLastSpellKind: HuppermageWaterHeartSpellKind | null;
  bqMax: number;
  storedBq: number;
  haloChatoyantMarks: number;
  deckSpellLimit: number;
  passiveLimit: number;
};

export type ClassTurnState = {
  huppermage?: HuppermageTurnState;
};

export type AttackPosition = "face" | "side" | "rear";

export type RangeMode = "melee" | "distance";

export type ActionContext = {
  position: AttackPosition;
  rangeMode?: RangeMode;
  isCritical: boolean;
  isBerserk: boolean;
  isBlocked: boolean;
};

export type ActionTarget = {
  kind: "emptyCell" | "feuFollet" | "fighter" | "ally" | "enemy";
};

export type BaseStats = {
  level?: number;
  hitPoints?: number;
  hitPointsPercent?: number;
  generalMastery: number;
  elementalMastery: Partial<Record<Element, number>>;
  meleeMastery?: number;
  distanceMastery?: number;
  berserkMastery?: number;
  rearMastery?: number;
  criticalMastery?: number;
  healingMastery?: number;
  damageInflictedPercent: number;
  healsPerformedPercent?: number;
  healsReceivedPercent?: number;
  armorReceivedPercent?: number;
  armorGivenPercent?: number;
  elementalResistance?: number;
  rearResistance?: number;
  criticalResistance?: number;
  range?: number;
  willpower?: number;
  criticalHitPercent?: number;
  parry?: number;
  lock?: number;
  dodge?: number;
  initiative?: number;
  indirectDamagePercent?: number;
};

export type SimulatedCharacter = {
  id: string;
  className: "huppermage";
  stats: BaseStats;
  resources: ResourcePool;
  classState?: {
    huppermage?: {
      runes?: Partial<Record<Rune, boolean>>;
      lastGeneratedRune?: Rune | null;
      runeApGainsThisTurn?: Partial<Record<Rune, boolean>>;
      abundanceLevel?: number;
      feuFolletsActive?: number;
      feuFolletStoredRunes?: Rune[][];
      feuFolletStoredLastRunes?: Array<Rune | null>;
      temporaryUnlockedSpellElement?: Element | null;
      usedSpellIds?: string[];
      activePassives?: string[];
      activeHeart?: HuppermageHeart | null;
      waterHeartLastSpellKind?: HuppermageWaterHeartSpellKind | null;
      bqMax?: number;
      storedBq?: number;
      haloChatoyantMarks?: number;
      convertWpToBq?: boolean;
      deckSpellLimit?: number;
      passiveLimit?: number;
    };
  };
};

export type Action = {
  spellId: string;
  context?: Partial<ActionContext>;
  target?: ActionTarget;
};

export type ActionSequence = {
  actions: Action[];
};

export type TurnPlan = {
  actions: Action[];
};

export type ComboPlan = {
  turns: TurnPlan[];
};

export type SimulationViolationType =
  | "unknownSpell"
  | "insufficientResource"
  | "castLimitExceeded"
  | "unsupportedEntryKind"
  | "invalidClassStateAction"
  | "invalidTarget"
  | "deckLimitExceeded";

export type SimulationViolation = {
  type: SimulationViolationType;
  actionIndex: number;
  spellId?: string;
  resource?: Resource;
  required?: number;
  available?: number;
  message: string;
  source?: CatalogSource;
};

export type AppliedEffect =
  | {
      type: "damage";
      amount: number;
      element: Element;
      source: "spellEffect";
      formula: DamageFormulaBreakdown;
    }
  | {
      type: "resourceDelta";
      resource: Resource;
      amount: number;
      before: number;
      after: number;
      source: "spellEffect" | "huppermageClassMechanic";
    }
  | {
      type: "runeGenerated";
      rune: Rune;
      before: boolean;
      after: boolean;
      source: "elementalSpellCast" | "cycleElementaire";
    }
  | {
      type: "runeConsumed";
      runes: Rune[];
      source: "spellEffect";
    }
  | {
      type: "abundanceChanged";
      amount: number;
      before: number;
      after: number;
      source: "huppermageClassMechanic" | "spellEffect";
    }
  | {
      type: "heartChanged";
      heart: HuppermageHeart;
      source: "coeurDeLumiere";
    }
  | {
      type: "temporarySpellElementUnlocked";
      element: Element;
      source: "feuFollet";
    }
  | {
      type: "feuFolletChanged";
      operation: "placed" | "recovered";
      before: number;
      after: number;
      source: "huppermageClassMechanic";
    }
  | {
      type: "feuFolletRunesStored";
      runes: Rune[];
      source: "sauvegardeRuniquePassive";
    }
  | {
      type: "feuFolletRunesRecovered";
      runes: Rune[];
      lastGeneratedRuneBefore: Rune | null;
      lastGeneratedRuneAfter: Rune | null;
      source: "sauvegardeRuniquePassive";
    }
  | {
      type: "bqRegeneration";
      amount: number;
      before: number;
      after: number;
      source: "extensionDesSensPassive";
      heart: HuppermageHeart;
      triggerCount: number;
    }
  | {
      type: "statModifier";
      stat: string;
      amount: number;
      before: number;
      after: number;
      source: "spellEffect";
    }
  | {
      type: "lifeSteal";
      amount: number;
      percent: number;
      sourceDamage: number;
      source: "spellEffect";
    }
  | {
      type: "haloMarksChanged";
      before: number;
      after: number;
      triggered: number;
      source: "spellEffect";
    }
  | {
      type: "turnEndBq";
      amount: number;
      before: number;
      after: number;
      storedBefore: number;
      storedAfter: number;
      source: "huppermageClassMechanic";
    };

export type ActionResult = {
  actionIndex: number;
  spellId: string;
  spellName: string;
  damage: number;
  resourceBefore: ResourcePool;
  resourceAfter: ResourcePool;
  statsBefore: BaseStats;
  statsAfter: BaseStats;
  classStateBefore: ClassTurnState;
  classStateAfter: ClassTurnState;
  appliedEffects: AppliedEffect[];
};

export type TurnState = {
  remainingResources: ResourcePool;
  classState: ClassTurnState;
  currentStats: BaseStats;
  castsBySpellId: Record<string, number>;
  totalDamage: number;
  actionLog: ActionResult[];
  turnEndEffects: AppliedEffect[];
};

export type SimulationResult = {
  valid: boolean;
  sequence: ActionSequence;
  totalDamage: number;
  finalState: TurnState;
  breakdown: ActionResult[];
  violations: SimulationViolation[];
};

export type SimulationOptions = {
  catalog: CatalogEntry[];
  character: SimulatedCharacter;
  sequence: ActionSequence;
  defaultActionContext?: Partial<ActionContext>;
  includeTurnEnd?: boolean;
};

export type ComboTurnResult = {
  turnIndex: number;
  initialCharacter: SimulatedCharacter;
  result: SimulationResult;
};

export type ComboSimulationViolation = SimulationViolation & {
  turnIndex: number;
};

export type ComboSimulationResult = {
  valid: boolean;
  combo: ComboPlan;
  turns: ComboTurnResult[];
  totalDamage: number;
  finalState: TurnState;
  violations: ComboSimulationViolation[];
};

export type ComboSimulationOptions = {
  catalog: CatalogEntry[];
  character: SimulatedCharacter;
  combo: ComboPlan;
  defaultActionContext?: Partial<ActionContext>;
};

export type DamageFormulaBreakdown = {
  baseDamage: number;
  times: number;
  elementalMastery: number;
  extraMastery: number;
  masteryMultiplier: number;
  criticalMultiplier: number;
  positionMultiplier: number;
  finalMultiplier: number;
  blockMultiplier: number;
  result: number;
};
