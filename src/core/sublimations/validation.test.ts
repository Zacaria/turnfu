import assert from "node:assert/strict";
import test from "node:test";

import { sublimationCatalog, validateSublimationBuild } from "./index.ts";
import { findSublimation } from "./catalog.ts";

test("exposes stackable sublimation scroll variants with their level increments", () => {
  assert.equal(findSublimation("influence-i")?.level, 1);
  assert.equal(findSublimation("influence-ii")?.level, 2);
  assert.equal(findSublimation("influence-iii")?.level, 3);
  assert.equal(findSublimation("influence-iii")?.cumulativeMax, 6);

  assert.equal(findSublimation("sauvegarde-ii")?.level, 2);
  assert.equal(findSublimation("sauvegarde-ii")?.cumulativeMax, 6);
  assert.equal(findSublimation("sauvegarde-i"), undefined);
  assert.equal(findSublimation("sauvegarde-iii"), undefined);
  assert.equal(findSublimation("force-vitale-i"), undefined);
  assert.equal(findSublimation("force-vitale-ii")?.level, 2);
  assert.equal(findSublimation("agilite-vitale-i"), undefined);
  assert.equal(findSublimation("agilite-vitale-ii")?.level, 2);
  assert.equal(findSublimation("vivacite-i"), undefined);
  assert.equal(findSublimation("vivacite-ii")?.level, 2);
  assert.equal(findSublimation("velocite-i"), undefined);
  assert.equal(findSublimation("velocite-ii")?.level, 2);
  assert.equal(findSublimation("influence-de-wakfu-ii")?.level, 2);
  assert.equal(findSublimation("influence-de-wakfu-ii")?.cumulativeMax, 4);
  assert.equal(sublimationCatalog.some((entry) => entry.id === "influence-6"), false);
});

test("aggregates sublimation scroll variants by family level", () => {
  const twoInfluenceThree = validateSublimationBuild({
    selections: [
      { sublimationId: "influence-iii" },
      { sublimationId: "influence-iii" },
    ],
    hpAssumption: "normal",
  });
  const sixInfluenceOne = validateSublimationBuild({
    selections: Array.from({ length: 6 }, () => ({ sublimationId: "influence-i" })),
    hpAssumption: "normal",
  });
  const saveTwo = validateSublimationBuild({
    selections: [{ sublimationId: "sauvegarde-ii" }],
    hpAssumption: "normal",
  });

  assert.equal(twoInfluenceThree.effectiveStacks.find((stack) => stack.familyId === "influence")?.effectiveLevel, 6);
  assert.equal(sixInfluenceOne.effectiveStacks.find((stack) => stack.familyId === "influence")?.effectiveLevel, 6);
  assert.equal(saveTwo.effectiveStacks.find((stack) => stack.familyId === "sauvegarde")?.effectiveLevel, 2);
});

test("validates slot limits and support status", () => {
  const result = validateSublimationBuild({
    selections: [
      ...Array.from({ length: 11 }, () => ({ sublimationId: "influence-6" })),
      { sublimationId: "absolution" },
      { sublimationId: "retour-pa-4" },
    ],
    hpAssumption: "normal",
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations.some((violation) => violation.type === "slotLimitExceeded"), true);
  assert.equal(result.violations.some((violation) => violation.type === "unsupportedSublimation"), true);
  assert.equal(result.violations.some((violation) => violation.type === "ignoredSublimation"), true);
});

test("caps duplicate levels at cumulative maximum", () => {
  const result = validateSublimationBuild({
    selections: [
      { sublimationId: "influence-iii" },
      { sublimationId: "influence-iii" },
      { sublimationId: "influence-iii" },
    ],
    hpAssumption: "normal",
  });

  assert.equal(result.valid, true);
  const influence = findSublimation("influence-iii");
  assert.ok(influence);
  assert.deepEqual(result.effectiveStacks.find((stack) => stack.familyId === "influence"), {
    familyId: "influence",
    rawLevel: 9,
    effectiveLevel: 6,
    cumulativeMax: 6,
    entries: [influence, influence, influence],
  });
});

test("allows mutually exclusive HP requirements because inactive bonuses are skipped", () => {
  const result = validateSublimationBuild({
    selections: [
      { sublimationId: "force-vitale-2" },
      { sublimationId: "critique-berserk-6" },
    ],
    hpAssumption: "normal",
  });

  assert.equal(result.valid, true);
  assert.equal(result.violations.length, 0);
});

test("allows HP-threshold sublimations that do not match the build assumption", () => {
  const normalResult = validateSublimationBuild({
    selections: [
      { sublimationId: "force-vitale-2" },
    ],
    hpAssumption: "normal",
  });
  const healthyResult = validateSublimationBuild({
    selections: [
      { sublimationId: "force-vitale-2" },
      { sublimationId: "carnage-6" },
    ],
    hpAssumption: "healthy90",
  });
  const berserkResult = validateSublimationBuild({
    selections: [
      { sublimationId: "critique-berserk-6" },
    ],
    hpAssumption: "berserk20",
  });

  assert.equal(normalResult.valid, true);
  assert.equal(normalResult.violations.length, 0);
  assert.equal(healthyResult.valid, true);
  assert.equal(berserkResult.valid, true);
});
