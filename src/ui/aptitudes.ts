import { createResources } from "../core/simulation/index.ts";
import type { BaseStats, ResourcePool } from "../core/simulation/types.ts";

export type AptitudeFamilyId = "intelligence" | "strength" | "agility" | "chance" | "major";

export type AptitudeStat =
  | "hitPoints"
  | "hitPointsPercent"
  | "elementalResistance"
  | "barrier"
  | "healsReceivedPercent"
  | "armorReceivedPercent"
  | "generalMastery"
  | "meleeMastery"
  | "distanceMastery"
  | "lock"
  | "dodge"
  | "initiative"
  | "willpower"
  | "criticalHitPercent"
  | "parry"
  | "criticalMastery"
  | "rearMastery"
  | "berserkMastery"
  | "healingMastery"
  | "rearResistance"
  | "criticalResistance"
  | "ap"
  | "mp"
  | "range"
  | "wp"
  | "armorGivenPercent"
  | "damageInflictedPercent"
  | "healsPerformedPercent"
  | "indirectDamagePercent";

export type AptitudeDefinition = {
  id: number;
  family: AptitudeFamilyId;
  label: string;
  maxRank?: number;
  effects: Partial<Record<AptitudeStat, number>>;
};

export type AptitudeDistribution = {
  level: number;
  ranks: Record<number, number>;
};

export type AppliedAptitudeStats = {
  resources: ResourcePool;
  stats: BaseStats;
  totals: Partial<Record<AptitudeStat, number>>;
};

export type AptitudeCodeParseError =
  | "duplicateAptitude"
  | "exceedsBudget"
  | "invalidRank"
  | "invalidSegment"
  | "unknownAptitude";

export type AptitudeCodeParseResult =
  | { ok: true; distribution: AptitudeDistribution }
  | {
    ok: false;
    error: AptitudeCodeParseError;
    aptitudeId?: number;
    segment?: string;
  };

export const aptitudeFamilyOrder: AptitudeFamilyId[] = ["intelligence", "strength", "agility", "chance", "major"];

export const majorLevels = [25, 75, 125, 175, 225] as const;

export const aptitudeFamilies: Record<AptitudeFamilyId, { label: string; accent: string }> = {
  intelligence: { label: "Intelligence", accent: "#ff5656" },
  strength: { label: "Force", accent: "#b4e33a" },
  agility: { label: "Agilité", accent: "#d148ff" },
  chance: { label: "Chance", accent: "#20cfff" },
  major: { label: "Majeur", accent: "#f6d84c" },
};

export const aptitudeDefinitions: AptitudeDefinition[] = [
  { id: 1, family: "intelligence", label: "Points de vie", effects: { hitPointsPercent: 4 } },
  { id: 16, family: "intelligence", label: "Résistance élémentaire", maxRank: 10, effects: { elementalResistance: 10 } },
  { id: 17, family: "intelligence", label: "Barrière", maxRank: 10, effects: { barrier: 1 } },
  { id: 27, family: "intelligence", label: "Soins reçus", maxRank: 5, effects: { healsReceivedPercent: 10 } },
  { id: 36, family: "intelligence", label: "PV en armure", maxRank: 10, effects: { armorReceivedPercent: 4 } },
  { id: 23, family: "strength", label: "Maîtrise élémentaire", effects: { generalMastery: 5 } },
  { id: 26, family: "strength", label: "Maîtrise mêlée", maxRank: 40, effects: { meleeMastery: 8 } },
  { id: 30, family: "strength", label: "Maîtrise distance", maxRank: 40, effects: { distanceMastery: 8 } },
  { id: 31, family: "strength", label: "Points de vie fixes", effects: { hitPoints: 20 } },
  { id: 18, family: "agility", label: "Tacle", effects: { lock: 6 } },
  { id: 19, family: "agility", label: "Esquive", effects: { dodge: 6 } },
  { id: 20, family: "agility", label: "Initiative", maxRank: 20, effects: { initiative: 4 } },
  { id: 21, family: "agility", label: "Tacle et esquive", effects: { lock: 4, dodge: 4 } },
  { id: 37, family: "agility", label: "Volonté", maxRank: 20, effects: { willpower: 1 } },
  { id: 9, family: "chance", label: "Coup critique", maxRank: 20, effects: { criticalHitPercent: 1 } },
  { id: 10, family: "chance", label: "Parade", maxRank: 20, effects: { parry: 1 } },
  { id: 11, family: "chance", label: "Maîtrise critique", effects: { criticalMastery: 4 } },
  { id: 12, family: "chance", label: "Maîtrise dos", effects: { rearMastery: 6 } },
  { id: 13, family: "chance", label: "Maîtrise berserk", effects: { berserkMastery: 8 } },
  { id: 14, family: "chance", label: "Maîtrise soin", effects: { healingMastery: 6 } },
  { id: 15, family: "chance", label: "Résistance dos", maxRank: 20, effects: { rearResistance: 4 } },
  { id: 34, family: "chance", label: "Résistance critique", maxRank: 20, effects: { criticalResistance: 4 } },
  { id: 2, family: "major", label: "PA", maxRank: 1, effects: { ap: 1 } },
  { id: 3, family: "major", label: "PM et maîtrise", maxRank: 1, effects: { mp: 1, generalMastery: 20 } },
  { id: 4, family: "major", label: "Portée et maîtrise", maxRank: 1, effects: { range: 1, generalMastery: 40 } },
  { id: 5, family: "major", label: "PW", maxRank: 1, effects: { wp: 2 } },
  { id: 6, family: "major", label: "Armure donnée", maxRank: 1, effects: { armorGivenPercent: 20 } },
  { id: 8, family: "major", label: "Dommages infligés", maxRank: 1, effects: { damageInflictedPercent: 10 } },
  { id: 35, family: "major", label: "Résistance élémentaire", maxRank: 1, effects: { elementalResistance: 50 } },
  { id: 38, family: "major", label: "Soins réalisés", maxRank: 1, effects: { healsPerformedPercent: 10 } },
  { id: 39, family: "major", label: "Dommages indirects", maxRank: 1, effects: { indirectDamagePercent: 10, generalMastery: 40 } },
];

const familyIndex: Record<AptitudeFamilyId, number> = {
  intelligence: 0,
  strength: 1,
  agility: 2,
  chance: 3,
  major: 4,
};

export function createDefaultAptitudeDistribution(level = 200): AptitudeDistribution {
  return { level, ranks: {} };
}

export function serializeAptitudeDistribution(distribution: AptitudeDistribution): string {
  return aptitudeDefinitions
    .map((definition) => ({ id: definition.id, rank: distribution.ranks[definition.id] ?? 0 }))
    .filter(({ rank }) => rank > 0)
    .map(({ id, rank }) => `${id}:${rank}`)
    .join("-");
}

export function parseAptitudeDistributionCode(
  code: string,
  currentDistribution: AptitudeDistribution,
): AptitudeCodeParseResult {
  const trimmedCode = code.trim();
  const nextDistribution: AptitudeDistribution = { level: currentDistribution.level, ranks: {} };

  if (trimmedCode.length === 0) {
    return { ok: true, distribution: nextDistribution };
  }

  const seenAptitudeIds = new Set<number>();
  const definitionsById = new Map(aptitudeDefinitions.map((definition) => [definition.id, definition]));

  for (const segment of trimmedCode.split("-")) {
    const match = segment.match(/^(\d+):(\d+)$/);
    if (!match) {
      return { ok: false, error: "invalidSegment", segment };
    }

    const aptitudeId = Number(match[1]);
    const rank = Number(match[2]);
    const definition = definitionsById.get(aptitudeId);

    if (!definition) {
      return { ok: false, error: "unknownAptitude", aptitudeId, segment };
    }

    if (!Number.isSafeInteger(rank)) {
      return { ok: false, error: "invalidRank", aptitudeId, segment };
    }

    if (seenAptitudeIds.has(aptitudeId)) {
      return { ok: false, error: "duplicateAptitude", aptitudeId, segment };
    }
    seenAptitudeIds.add(aptitudeId);

    if (rank > 0) {
      nextDistribution.ranks[aptitudeId] = rank;
    }
  }

  for (const definition of aptitudeDefinitions) {
    const rank = nextDistribution.ranks[definition.id] ?? 0;
    if (rank > (definition.maxRank ?? Number.POSITIVE_INFINITY)) {
      return { ok: false, error: "exceedsBudget", aptitudeId: definition.id };
    }
  }

  for (const family of aptitudeFamilyOrder) {
    if (getSpentAptitudePoints(nextDistribution, family) > getAvailableAptitudePoints(nextDistribution.level, family)) {
      return { ok: false, error: "exceedsBudget" };
    }
  }

  return { ok: true, distribution: nextDistribution };
}

export function clampAptitudeLevel(level: number): number {
  return Math.max(1, Math.min(245, Math.trunc(level || 1)));
}

export function getAvailableAptitudePoints(level: number, family: AptitudeFamilyId): number {
  const clampedLevel = clampAptitudeLevel(level);
  const index = familyIndex[family];

  if (family === "major") {
    return majorLevels.filter((majorLevel) => clampedLevel >= majorLevel).length;
  }

  let regularPointCursor = clampedLevel - 1;
  if (clampedLevel >= 230) {
    regularPointCursor += 3;
  }
  if (clampedLevel >= 245) {
    regularPointCursor += 1;
  }

  const remainder = regularPointCursor % 4;
  return (regularPointCursor - remainder) / 4 + (remainder > index ? 1 : 0);
}

export function getSpentAptitudePoints(distribution: AptitudeDistribution, family: AptitudeFamilyId): number {
  return aptitudeDefinitions
    .filter((definition) => definition.family === family)
    .reduce((sum, definition) => sum + (distribution.ranks[definition.id] ?? 0), 0);
}

export function setAptitudeRank(
  distribution: AptitudeDistribution,
  aptitudeId: number,
  rank: number,
): AptitudeDistribution {
  const definition = aptitudeDefinitions.find((candidate) => candidate.id === aptitudeId);
  if (!definition) {
    return distribution;
  }

  const previousRank = distribution.ranks[aptitudeId] ?? 0;
  const withoutCurrent = getSpentAptitudePoints(distribution, definition.family) - previousRank;
  const remainingFamilyPoints = getAvailableAptitudePoints(distribution.level, definition.family) - withoutCurrent;
  const maxByDefinition = definition.maxRank ?? Number.POSITIVE_INFINITY;
  const nextRank = Math.max(0, Math.min(Math.trunc(rank || 0), remainingFamilyPoints, maxByDefinition));
  const nextRanks = { ...distribution.ranks };

  if (nextRank === 0) {
    delete nextRanks[aptitudeId];
  } else {
    nextRanks[aptitudeId] = nextRank;
  }

  return { ...distribution, ranks: nextRanks };
}

export function setAptitudeLevel(distribution: AptitudeDistribution, level: number): AptitudeDistribution {
  const nextLevel = clampAptitudeLevel(level);
  return aptitudeDefinitions.reduce(
    (nextDistribution, definition) => setAptitudeRank(
      nextDistribution,
      definition.id,
      nextDistribution.ranks[definition.id] ?? 0,
    ),
    { ...distribution, level: nextLevel },
  );
}

export function computeAptitudeStats(distribution: AptitudeDistribution): AppliedAptitudeStats {
  const totals: Partial<Record<AptitudeStat, number>> = {};

  for (const definition of aptitudeDefinitions) {
    const rank = distribution.ranks[definition.id] ?? 0;
    if (rank === 0) {
      continue;
    }

    for (const [stat, value] of Object.entries(definition.effects) as Array<[AptitudeStat, number]>) {
      totals[stat] = (totals[stat] ?? 0) + value * rank;
    }
  }

  const level = clampAptitudeLevel(distribution.level);
  const stats: BaseStats = {
    level,
    hitPoints: 50 + 10 * level + (totals.hitPoints ?? 0),
    hitPointsPercent: totals.hitPointsPercent ?? 0,
    generalMastery: totals.generalMastery ?? 0,
    elementalMastery: {
      fire: 0,
      water: 0,
      earth: 0,
      air: 0,
      light: 0,
      neutral: 0,
    },
    meleeMastery: totals.meleeMastery ?? 0,
    distanceMastery: totals.distanceMastery ?? 0,
    berserkMastery: totals.berserkMastery ?? 0,
    rearMastery: totals.rearMastery ?? 0,
    criticalMastery: totals.criticalMastery ?? 0,
    healingMastery: totals.healingMastery ?? 0,
    damageInflictedPercent: totals.damageInflictedPercent ?? 0,
    healsPerformedPercent: totals.healsPerformedPercent ?? 0,
    healsReceivedPercent: totals.healsReceivedPercent ?? 0,
    armorReceivedPercent: totals.armorReceivedPercent ?? 0,
    armorGivenPercent: totals.armorGivenPercent ?? 0,
    elementalResistance: totals.elementalResistance ?? 0,
    rearResistance: totals.rearResistance ?? 0,
    criticalResistance: totals.criticalResistance ?? 0,
    range: totals.range ?? 0,
    willpower: totals.willpower ?? 0,
    criticalHitPercent: totals.criticalHitPercent ?? 3,
    parry: totals.parry ?? 0,
    lock: totals.lock ?? 0,
    dodge: totals.dodge ?? 0,
    initiative: totals.initiative ?? 0,
    indirectDamagePercent: totals.indirectDamagePercent ?? 0,
  };

  return {
    resources: createResources({
      ap: 6 + (totals.ap ?? 0),
      mp: 3 + (totals.mp ?? 0),
      wp: 6 + (totals.wp ?? 0),
      bq: 0,
    }),
    stats,
    totals,
  };
}

export function applyAptitudesToCharacterStats(
  distribution: AptitudeDistribution,
  currentStats: BaseStats,
  currentResources: ResourcePool,
): { stats: BaseStats; resources: ResourcePool } {
  const applied = computeAptitudeStats(distribution);

  return {
    resources: createResources({
      ...currentResources,
      ap: applied.resources.ap,
      mp: applied.resources.mp,
      wp: applied.resources.wp,
    }),
    stats: {
      ...currentStats,
      ...applied.stats,
      elementalMastery: {
        ...currentStats.elementalMastery,
        ...applied.stats.elementalMastery,
      },
    },
  };
}
