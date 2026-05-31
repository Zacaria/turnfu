import test from "node:test";
import assert from "node:assert/strict";

import {
  computeAptitudeStats,
  createDefaultAptitudeDistribution,
  getAvailableAptitudePoints,
  parseAptitudeDistributionCode,
  serializeAptitudeDistribution,
  setAptitudeLevel,
  setAptitudeRank,
} from "./aptitudes.ts";

test("computes regular and major aptitude point budgets", () => {
  assert.equal(getAvailableAptitudePoints(200, "intelligence"), 50);
  assert.equal(getAvailableAptitudePoints(200, "strength"), 50);
  assert.equal(getAvailableAptitudePoints(200, "agility"), 50);
  assert.equal(getAvailableAptitudePoints(200, "chance"), 49);
  assert.equal(getAvailableAptitudePoints(200, "major"), 4);
  assert.equal(getAvailableAptitudePoints(245, "major"), 5);
  assert.equal(getAvailableAptitudePoints(245, "chance"), 62);
});

test("clamps aptitude ranks to family budget and max rank", () => {
  let distribution = createDefaultAptitudeDistribution(200);
  distribution = setAptitudeRank(distribution, 16, 50);
  distribution = setAptitudeRank(distribution, 1, 50);

  assert.equal(distribution.ranks[16], 10);
  assert.equal(distribution.ranks[1], 40);
});

test("computes base resources and supported stats from allocation", () => {
  let distribution = setAptitudeLevel(createDefaultAptitudeDistribution(), 200);
  distribution = setAptitudeRank(distribution, 23, 50);
  distribution = setAptitudeRank(distribution, 2, 1);
  distribution = setAptitudeRank(distribution, 3, 1);
  distribution = setAptitudeRank(distribution, 4, 1);
  distribution = setAptitudeRank(distribution, 8, 1);

  const result = computeAptitudeStats(distribution);

  assert.equal(result.resources.ap, 7);
  assert.equal(result.resources.mp, 4);
  assert.equal(result.resources.wp, 6);
  assert.equal(result.resources.bq, 0);
  assert.equal(result.stats.generalMastery, 310);
  assert.equal(result.stats.damageInflictedPercent, 10);
  assert.equal(result.stats.range, 1);
});

test("serializes aptitude distribution strings in definition order", () => {
  let distribution = createDefaultAptitudeDistribution(200);
  distribution = setAptitudeRank(distribution, 1, 40);
  distribution = setAptitudeRank(distribution, 16, 10);
  distribution = setAptitudeRank(distribution, 23, 10);
  distribution = setAptitudeRank(distribution, 26, 40);
  distribution = setAptitudeRank(distribution, 19, 50);
  distribution = setAptitudeRank(distribution, 9, 20);
  distribution = setAptitudeRank(distribution, 11, 29);
  distribution = setAptitudeRank(distribution, 2, 1);
  distribution = setAptitudeRank(distribution, 3, 1);
  distribution = setAptitudeRank(distribution, 5, 1);
  distribution = setAptitudeRank(distribution, 8, 1);

  assert.equal(
    serializeAptitudeDistribution(distribution),
    "1:40-16:10-23:10-26:40-19:50-9:20-11:29-2:1-3:1-5:1-8:1",
  );
});

test("parses aptitude distribution strings without changing level", () => {
  const result = parseAptitudeDistributionCode(
    "1:40-16:10-23:10-26:40-19:50-9:20-11:29-2:1-3:1-5:1-8:1",
    createDefaultAptitudeDistribution(200),
  );

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.distribution.level, 200);
  assert.equal(result.distribution.ranks[1], 40);
  assert.equal(result.distribution.ranks[16], 10);
  assert.equal(result.distribution.ranks[19], 50);
  assert.equal(result.distribution.ranks[11], 29);
  assert.equal(result.distribution.ranks[8], 1);
});

test("rejects invalid aptitude distribution strings", () => {
  assert.deepEqual(
    parseAptitudeDistributionCode("1:40-999:1", createDefaultAptitudeDistribution(200)),
    { ok: false, error: "unknownAptitude", aptitudeId: 999, segment: "999:1" },
  );
  assert.deepEqual(
    parseAptitudeDistributionCode("1:40-1:1", createDefaultAptitudeDistribution(200)),
    { ok: false, error: "duplicateAptitude", aptitudeId: 1, segment: "1:1" },
  );
  assert.deepEqual(
    parseAptitudeDistributionCode("16:11", createDefaultAptitudeDistribution(200)),
    { ok: false, error: "exceedsBudget", aptitudeId: 16 },
  );
});
