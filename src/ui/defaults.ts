import { createResources } from "../core/simulation/index.ts";
import type { ActionContext, ActionTarget, BaseStats, SimulatedCharacter } from "../core/simulation/types.ts";
import { syncHuppermageBqFromWp } from "./statControls.ts";

export const defaultActionContext: ActionContext = {
  position: "face",
  rangeMode: "distance",
  isCritical: false,
  isBerserk: false,
  isBlocked: false,
};

export const defaultActionTarget: ActionTarget = {
  kind: "enemy",
};

export const defaultStats: BaseStats = {
  level: 200,
  hitPoints: 2050,
  hitPointsPercent: 0,
  generalMastery: 1000,
  elementalMastery: {
    fire: 0,
    water: 0,
    earth: 0,
    air: 0,
    light: 0,
    neutral: 0,
  },
  meleeMastery: 0,
  distanceMastery: 0,
  berserkMastery: 0,
  rearMastery: 0,
  criticalMastery: 0,
  healingMastery: 0,
  damageInflictedPercent: 0,
  healsPerformedPercent: 0,
  healsReceivedPercent: 0,
  armorReceivedPercent: 0,
  armorGivenPercent: 0,
  elementalResistance: 0,
  rearResistance: 0,
  criticalResistance: 0,
  range: 0,
  willpower: 0,
  criticalHitPercent: 3,
  parry: 0,
  lock: 0,
  dodge: 0,
  initiative: 0,
  indirectDamagePercent: 0,
};

export function createDefaultCharacter(): SimulatedCharacter {
  return syncHuppermageBqFromWp({
    id: "huppermage-ui",
    className: "huppermage",
    resources: createResources({ ap: 12, mp: 6, wp: 6, bq: 0 }),
    stats: defaultStats,
    classState: {
      huppermage: {
        runes: {},
        lastGeneratedRune: null,
        feuFolletsActive: 0,
        feuFolletStoredRunes: [],
        feuFolletStoredLastRunes: [],
        temporaryUnlockedSpellElement: null,
        usedSpellIds: [],
        activePassives: ["extension-des-sens"],
        activeHeart: null,
        waterHeartLastSpellKind: null,
        bqMax: 0,
        storedBq: 0,
        haloChatoyantMarks: 0,
        deckSpellLimit: 12,
        passiveLimit: 6,
      },
    },
  });
}
