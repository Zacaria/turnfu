import type { Element, Resource } from "../core/catalog/types.ts";
import type { BaseStats } from "../core/simulation/types.ts";

type StatIconAsset =
  | "AP"
  | "MP"
  | "WP"
  | "HP"
  | "HUPPERMAGE_RESOURCE"
  | "DMG_IN_PERCENT"
  | "DMG_FIRE_PERCENT"
  | "DMG_WATER_PERCENT"
  | "DMG_EARTH_PERCENT"
  | "DMG_AIR_PERCENT"
  | "DMG_LIGHT_PERCENT"
  | "FINAL_DMG_IN_PERCENT"
  | "MELEE_DMG"
  | "RANGED_DMG"
  | "BACKSTAB_BONUS"
  | "CRITICAL_BONUS"
  | "BERSERK_DMG"
  | "HEAL_IN_PERCENT"
  | "FINAL_HEAL_IN_PERCENT"
  | "ARMOR_RECEIVED"
  | "ARMOR_GIVEN"
  | "ARMOR_PERCENT"
  | "RES_IN_PERCENT"
  | "RES_FIRE_PERCENT"
  | "RES_WATER_PERCENT"
  | "RES_EARTH_PERCENT"
  | "RES_AIR_PERCENT"
  | "RES_BACKSTAB"
  | "CRITICAL_RES"
  | "RANGE"
  | "WILLPOWER"
  | "FEROCITY"
  | "BLOCK"
  | "TACKLE"
  | "DODGE"
  | "TACKLE_DODGE"
  | "INIT"
  | "INDIRECT_DMG"
  | "LEADERSHIP"
  | "PROSPECTION"
  | "WISDOM"
  | "EQUIPMENT_KNOWLEDGE";

export type StatIconKey =
  | keyof BaseStats
  | "ap"
  | "mp"
  | "wp"
  | "bq"
  | "barrier"
  | "lockDodge"
  | "equipmentKnowledge"
  | "prospection"
  | "wisdom"
  | "leadership";

const statIconAssetUrls: Record<StatIconAsset, string> = {
  AP: new URL("./assets/stats/game/AP.webp", import.meta.url).href,
  MP: new URL("./assets/stats/game/MP.webp", import.meta.url).href,
  WP: new URL("./assets/stats/game/WP.webp", import.meta.url).href,
  HP: new URL("./assets/stats/game/HP.webp", import.meta.url).href,
  HUPPERMAGE_RESOURCE: new URL("./assets/stats/game/HUPPERMAGE_RESOURCE.webp", import.meta.url).href,
  DMG_IN_PERCENT: new URL("./assets/stats/game/DMG_IN_PERCENT.webp", import.meta.url).href,
  DMG_FIRE_PERCENT: new URL("./assets/stats/game/DMG_FIRE_PERCENT.webp", import.meta.url).href,
  DMG_WATER_PERCENT: new URL("./assets/stats/game/DMG_WATER_PERCENT.webp", import.meta.url).href,
  DMG_EARTH_PERCENT: new URL("./assets/stats/game/DMG_EARTH_PERCENT.webp", import.meta.url).href,
  DMG_AIR_PERCENT: new URL("./assets/stats/game/DMG_AIR_PERCENT.webp", import.meta.url).href,
  DMG_LIGHT_PERCENT: new URL("./assets/stats/game/DMG_LIGHT_PERCENT.webp", import.meta.url).href,
  FINAL_DMG_IN_PERCENT: new URL("./assets/stats/game/FINAL_DMG_IN_PERCENT.webp", import.meta.url).href,
  MELEE_DMG: new URL("./assets/stats/game/MELEE_DMG.webp", import.meta.url).href,
  RANGED_DMG: new URL("./assets/stats/game/RANGED_DMG.webp", import.meta.url).href,
  BACKSTAB_BONUS: new URL("./assets/stats/game/BACKSTAB_BONUS.webp", import.meta.url).href,
  CRITICAL_BONUS: new URL("./assets/stats/game/CRITICAL_BONUS.webp", import.meta.url).href,
  BERSERK_DMG: new URL("./assets/stats/game/BERSERK_DMG.webp", import.meta.url).href,
  HEAL_IN_PERCENT: new URL("./assets/stats/game/HEAL_IN_PERCENT.webp", import.meta.url).href,
  FINAL_HEAL_IN_PERCENT: new URL("./assets/stats/game/FINAL_HEAL_IN_PERCENT.webp", import.meta.url).href,
  ARMOR_RECEIVED: new URL("./assets/stats/game/ARMOR_RECEIVED.webp", import.meta.url).href,
  ARMOR_GIVEN: new URL("./assets/stats/game/ARMOR_GIVEN.webp", import.meta.url).href,
  ARMOR_PERCENT: new URL("./assets/stats/game/ARMOR_PERCENT.webp", import.meta.url).href,
  RES_IN_PERCENT: new URL("./assets/stats/game/RES_IN_PERCENT.webp", import.meta.url).href,
  RES_FIRE_PERCENT: new URL("./assets/stats/game/RES_FIRE_PERCENT.webp", import.meta.url).href,
  RES_WATER_PERCENT: new URL("./assets/stats/game/RES_WATER_PERCENT.webp", import.meta.url).href,
  RES_EARTH_PERCENT: new URL("./assets/stats/game/RES_EARTH_PERCENT.webp", import.meta.url).href,
  RES_AIR_PERCENT: new URL("./assets/stats/game/RES_AIR_PERCENT.webp", import.meta.url).href,
  RES_BACKSTAB: new URL("./assets/stats/game/RES_BACKSTAB.webp", import.meta.url).href,
  CRITICAL_RES: new URL("./assets/stats/game/CRITICAL_RES.webp", import.meta.url).href,
  RANGE: new URL("./assets/stats/game/RANGE.webp", import.meta.url).href,
  WILLPOWER: new URL("./assets/stats/game/WILLPOWER.webp", import.meta.url).href,
  FEROCITY: new URL("./assets/stats/game/FEROCITY.webp", import.meta.url).href,
  BLOCK: new URL("./assets/stats/game/BLOCK.webp", import.meta.url).href,
  TACKLE: new URL("./assets/stats/game/TACKLE.webp", import.meta.url).href,
  DODGE: new URL("./assets/stats/game/DODGE.webp", import.meta.url).href,
  TACKLE_DODGE: new URL("./assets/stats/game/TACKLE_DODGE.webp", import.meta.url).href,
  INIT: new URL("./assets/stats/game/INIT.webp", import.meta.url).href,
  INDIRECT_DMG: new URL("./assets/stats/game/INDIRECT_DMG.webp", import.meta.url).href,
  LEADERSHIP: new URL("./assets/stats/game/LEADERSHIP.webp", import.meta.url).href,
  PROSPECTION: new URL("./assets/stats/game/PROSPECTION.webp", import.meta.url).href,
  WISDOM: new URL("./assets/stats/game/WISDOM.webp", import.meta.url).href,
  EQUIPMENT_KNOWLEDGE: new URL("./assets/stats/game/EQUIPMENT_KNOWLEDGE.webp", import.meta.url).href,
};

const resourceIconTypes: Record<Resource, StatIconAsset> = {
  ap: "AP",
  mp: "MP",
  wp: "WP",
  bq: "HUPPERMAGE_RESOURCE",
};

const elementMasteryIconTypes: Partial<Record<Element, StatIconAsset>> = {
  fire: "DMG_FIRE_PERCENT",
  water: "DMG_WATER_PERCENT",
  earth: "DMG_EARTH_PERCENT",
  air: "DMG_AIR_PERCENT",
  light: "DMG_LIGHT_PERCENT",
  neutral: "DMG_IN_PERCENT",
};

const statIconTypes: Record<StatIconKey, StatIconAsset> = {
  level: "WISDOM",
  hitPoints: "HP",
  hitPointsPercent: "FINAL_HEAL_IN_PERCENT",
  generalMastery: "DMG_IN_PERCENT",
  elementalMastery: "DMG_IN_PERCENT",
  meleeMastery: "MELEE_DMG",
  distanceMastery: "RANGED_DMG",
  berserkMastery: "BERSERK_DMG",
  rearMastery: "BACKSTAB_BONUS",
  criticalMastery: "CRITICAL_BONUS",
  healingMastery: "HEAL_IN_PERCENT",
  damageInflictedPercent: "FINAL_DMG_IN_PERCENT",
  healsPerformedPercent: "FINAL_HEAL_IN_PERCENT",
  healsReceivedPercent: "FINAL_HEAL_IN_PERCENT",
  armorReceivedPercent: "ARMOR_RECEIVED",
  armorGivenPercent: "ARMOR_GIVEN",
  elementalResistance: "RES_IN_PERCENT",
  rearResistance: "RES_BACKSTAB",
  criticalResistance: "CRITICAL_RES",
  range: "RANGE",
  willpower: "WILLPOWER",
  criticalHitPercent: "FEROCITY",
  parry: "BLOCK",
  lock: "TACKLE",
  dodge: "DODGE",
  initiative: "INIT",
  indirectDamagePercent: "INDIRECT_DMG",
  ap: "AP",
  mp: "MP",
  wp: "WP",
  bq: "HUPPERMAGE_RESOURCE",
  barrier: "ARMOR_PERCENT",
  lockDodge: "TACKLE_DODGE",
  equipmentKnowledge: "EQUIPMENT_KNOWLEDGE",
  prospection: "PROSPECTION",
  wisdom: "WISDOM",
  leadership: "LEADERSHIP",
};

const aptitudeIconTypes: Record<number, StatIconAsset> = {
  1: "FINAL_HEAL_IN_PERCENT",
  16: "RES_IN_PERCENT",
  17: "ARMOR_PERCENT",
  27: "FINAL_HEAL_IN_PERCENT",
  36: "ARMOR_PERCENT",
  23: "DMG_IN_PERCENT",
  26: "MELEE_DMG",
  30: "RANGED_DMG",
  31: "HP",
  18: "TACKLE",
  19: "DODGE",
  20: "INIT",
  21: "TACKLE_DODGE",
  37: "WILLPOWER",
  9: "FEROCITY",
  10: "BLOCK",
  11: "CRITICAL_BONUS",
  12: "BACKSTAB_BONUS",
  13: "BERSERK_DMG",
  14: "HEAL_IN_PERCENT",
  15: "RES_BACKSTAB",
  34: "CRITICAL_RES",
  2: "AP",
  3: "MP",
  4: "RANGE",
  5: "WP",
  6: "ARMOR_GIVEN",
  8: "FINAL_DMG_IN_PERCENT",
  35: "RES_IN_PERCENT",
  38: "FINAL_HEAL_IN_PERCENT",
  39: "INDIRECT_DMG",
};

function getStatIconAssetSrc(iconType: StatIconAsset): string {
  return statIconAssetUrls[iconType];
}

export function getResourceIconSrc(resource: Resource): string {
  return getStatIconAssetSrc(resourceIconTypes[resource]);
}

export function getElementMasteryIconSrc(element: Element): string {
  return getStatIconAssetSrc(elementMasteryIconTypes[element] ?? "DMG_IN_PERCENT");
}

export function getStatIconSrc(stat: StatIconKey): string {
  return getStatIconAssetSrc(statIconTypes[stat]);
}

export function getAptitudeIconSrc(aptitudeId: number): string {
  return getStatIconAssetSrc(aptitudeIconTypes[aptitudeId] ?? "DMG_IN_PERCENT");
}
