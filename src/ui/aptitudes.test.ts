import test from "node:test";
import assert from "node:assert/strict";

import {
  computeAptitudeStats,
  createDefaultAptitudeDistribution,
  getAvailableAptitudePoints,
  setAptitudeLevel,
  setAptitudeRank,
} from "./aptitudes.ts";

test("computes Wakfuli regular and major point budgets", () => {
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
  assert.equal(result.stats.generalMastery, 310);
  assert.equal(result.stats.damageInflictedPercent, 10);
  assert.equal(result.stats.range, 1);
});
