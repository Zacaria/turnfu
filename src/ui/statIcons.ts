import type { Element, Resource } from "../core/catalog/types.ts";
import type { BaseStats } from "../core/simulation/types.ts";

type WakfuliStatIcon =
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

const wakfuliStatIconUrls: Record<WakfuliStatIcon, string> = {
  AP: new URL("./assets/stats/wakfuli/AP.webp", import.meta.url).href,
  MP: new URL("./assets/stats/wakfuli/MP.webp", import.meta.url).href,
  WP: new URL("./assets/stats/wakfuli/WP.webp", import.meta.url).href,
  HP: new URL("./assets/stats/wakfuli/HP.webp", import.meta.url).href,
  HUPPERMAGE_RESOURCE: new URL("./assets/stats/wakfuli/HUPPERMAGE_RESOURCE.webp", import.meta.url).href,
  DMG_IN_PERCENT: new URL("./assets/stats/wakfuli/DMG_IN_PERCENT.webp", import.meta.url).href,
  DMG_FIRE_PERCENT: new URL("./assets/stats/wakfuli/DMG_FIRE_PERCENT.webp", import.meta.url).href,
  DMG_WATER_PERCENT: new URL("./assets/stats/wakfuli/DMG_WATER_PERCENT.webp", import.meta.url).href,
  DMG_EARTH_PERCENT: new URL("./assets/stats/wakfuli/DMG_EARTH_PERCENT.webp", import.meta.url).href,
  DMG_AIR_PERCENT: new URL("./assets/stats/wakfuli/DMG_AIR_PERCENT.webp", import.meta.url).href,
  DMG_LIGHT_PERCENT: new URL("./assets/stats/wakfuli/DMG_LIGHT_PERCENT.webp", import.meta.url).href,
  FINAL_DMG_IN_PERCENT: new URL("./assets/stats/wakfuli/FINAL_DMG_IN_PERCENT.webp", import.meta.url).href,
  MELEE_DMG: new URL("./assets/stats/wakfuli/MELEE_DMG.webp", import.meta.url).href,
  RANGED_DMG: new URL("./assets/stats/wakfuli/RANGED_DMG.webp", import.meta.url).href,
  BACKSTAB_BONUS: new URL("./assets/stats/wakfuli/BACKSTAB_BONUS.webp", import.meta.url).href,
  CRITICAL_BONUS: new URL("./assets/stats/wakfuli/CRITICAL_BONUS.webp", import.meta.url).href,
  BERSERK_DMG: new URL("./assets/stats/wakfuli/BERSERK_DMG.webp", import.meta.url).href,
  HEAL_IN_PERCENT: new URL("./assets/stats/wakfuli/HEAL_IN_PERCENT.webp", import.meta.url).href,
  FINAL_HEAL_IN_PERCENT: new URL("./assets/stats/wakfuli/FINAL_HEAL_IN_PERCENT.webp", import.meta.url).href,
  ARMOR_RECEIVED: new URL("./assets/stats/wakfuli/ARMOR_RECEIVED.webp", import.meta.url).href,
  ARMOR_GIVEN: new URL("./assets/stats/wakfuli/ARMOR_GIVEN.webp", import.meta.url).href,
  ARMOR_PERCENT: new URL("./assets/stats/wakfuli/ARMOR_PERCENT.webp", import.meta.url).href,
  RES_IN_PERCENT: new URL("./assets/stats/wakfuli/RES_IN_PERCENT.webp", import.meta.url).href,
  RES_FIRE_PERCENT: new URL("./assets/stats/wakfuli/RES_FIRE_PERCENT.webp", import.meta.url).href,
  RES_WATER_PERCENT: new URL("./assets/stats/wakfuli/RES_WATER_PERCENT.webp", import.meta.url).href,
  RES_EARTH_PERCENT: new URL("./assets/stats/wakfuli/RES_EARTH_PERCENT.webp", import.meta.url).href,
  RES_AIR_PERCENT: new URL("./assets/stats/wakfuli/RES_AIR_PERCENT.webp", import.meta.url).href,
  RES_BACKSTAB: new URL("./assets/stats/wakfuli/RES_BACKSTAB.webp", import.meta.url).href,
  CRITICAL_RES: new URL("./assets/stats/wakfuli/CRITICAL_RES.webp", import.meta.url).href,
  RANGE: new URL("./assets/stats/wakfuli/RANGE.webp", import.meta.url).href,
  WILLPOWER: new URL("./assets/stats/wakfuli/WILLPOWER.webp", import.meta.url).href,
  FEROCITY: new URL("./assets/stats/wakfuli/FEROCITY.webp", import.meta.url).href,
  BLOCK: new URL("./assets/stats/wakfuli/BLOCK.webp", import.meta.url).href,
  TACKLE: new URL("./assets/stats/wakfuli/TACKLE.webp", import.meta.url).href,
  DODGE: new URL("./assets/stats/wakfuli/DODGE.webp", import.meta.url).href,
  TACKLE_DODGE: new URL("./assets/stats/wakfuli/TACKLE_DODGE.webp", import.meta.url).href,
  INIT: new URL("./assets/stats/wakfuli/INIT.webp", import.meta.url).href,
  INDIRECT_DMG: new URL("./assets/stats/wakfuli/INDIRECT_DMG.webp", import.meta.url).href,
  LEADERSHIP: new URL("./assets/stats/wakfuli/LEADERSHIP.webp", import.meta.url).href,
  PROSPECTION: new URL("./assets/stats/wakfuli/PROSPECTION.webp", import.meta.url).href,
  WISDOM: new URL("./assets/stats/wakfuli/WISDOM.webp", import.meta.url).href,
  EQUIPMENT_KNOWLEDGE: new URL("./assets/stats/wakfuli/EQUIPMENT_KNOWLEDGE.webp", import.meta.url).href,
};

const resourceIconTypes: Record<Resource, WakfuliStatIcon> = {
  ap: "AP",
  mp: "MP",
  wp: "WP",
  bq: "HUPPERMAGE_RESOURCE",
};

const elementMasteryIconTypes: Partial<Record<Element, WakfuliStatIcon>> = {
  fire: "DMG_FIRE_PERCENT",
  water: "DMG_WATER_PERCENT",
  earth: "DMG_EARTH_PERCENT",
  air: "DMG_AIR_PERCENT",
  light: "DMG_LIGHT_PERCENT",
  neutral: "DMG_IN_PERCENT",
};

const statIconTypes: Record<StatIconKey, WakfuliStatIcon> = {
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

const aptitudeIconTypes: Record<number, WakfuliStatIcon> = {
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

function getWakfuliStatIconSrc(iconType: WakfuliStatIcon): string {
  return wakfuliStatIconUrls[iconType];
}

export function getResourceIconSrc(resource: Resource): string {
  return getWakfuliStatIconSrc(resourceIconTypes[resource]);
}

export function getElementMasteryIconSrc(element: Element): string {
  return getWakfuliStatIconSrc(elementMasteryIconTypes[element] ?? "DMG_IN_PERCENT");
}

export function getStatIconSrc(stat: StatIconKey): string {
  return getWakfuliStatIconSrc(statIconTypes[stat]);
}

export function getAptitudeIconSrc(aptitudeId: number): string {
  return getWakfuliStatIconSrc(aptitudeIconTypes[aptitudeId] ?? "DMG_IN_PERCENT");
}
