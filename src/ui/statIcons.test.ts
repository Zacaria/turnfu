import test from "node:test";
import assert from "node:assert/strict";

import {
  getAptitudeIconSrc,
  getElementMasteryIconSrc,
  getResourceIconSrc,
  getStatIconSrc,
} from "./statIcons.ts";

test("maps resources to stat icons", () => {
  assert.ok(getResourceIconSrc("ap").endsWith("/AP.webp"));
  assert.ok(getResourceIconSrc("mp").endsWith("/MP.webp"));
  assert.ok(getResourceIconSrc("wp").endsWith("/WP.webp"));
  assert.ok(getResourceIconSrc("bq").endsWith("/HUPPERMAGE_RESOURCE.webp"));
});

test("maps combat stats to stat icons", () => {
  assert.ok(getStatIconSrc("hitPoints").endsWith("/HP.webp"));
  assert.ok(getStatIconSrc("damageInflictedPercent").endsWith("/FINAL_DMG_IN_PERCENT.webp"));
  assert.ok(getStatIconSrc("distanceMastery").endsWith("/RANGED_DMG.webp"));
  assert.ok(getStatIconSrc("criticalHitPercent").endsWith("/FEROCITY.webp"));
});

test("maps aptitude ids to their icon types", () => {
  assert.ok(getAptitudeIconSrc(2).endsWith("/AP.webp"));
  assert.ok(getAptitudeIconSrc(21).endsWith("/TACKLE_DODGE.webp"));
  assert.ok(getAptitudeIconSrc(39).endsWith("/INDIRECT_DMG.webp"));
});

test("uses element-specific mastery icons", () => {
  assert.ok(getElementMasteryIconSrc("fire").endsWith("/DMG_FIRE_PERCENT.webp"));
  assert.ok(getElementMasteryIconSrc("water").endsWith("/DMG_WATER_PERCENT.webp"));
  assert.ok(getElementMasteryIconSrc("earth").endsWith("/DMG_EARTH_PERCENT.webp"));
  assert.ok(getElementMasteryIconSrc("air").endsWith("/DMG_AIR_PERCENT.webp"));
  assert.ok(getElementMasteryIconSrc("light").endsWith("/DMG_LIGHT_PERCENT.webp"));
});
