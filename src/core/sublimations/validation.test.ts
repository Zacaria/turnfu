import assert from "node:assert/strict";
import test from "node:test";

import { sublimationCatalog, validateSublimationBuild } from "./index.ts";

test("validates slot limits and support status", () => {
  const result = validateSublimationBuild({
    selections: [
      ...Array.from({ length: 11 }, () => ({ sublimationId: "critique-maitrise-1" })),
      { sublimationId: "premier-critique" },
      { sublimationId: "retour-pa" },
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
      { sublimationId: "appret-3" },
      { sublimationId: "appret-3" },
    ],
    hpAssumption: "normal",
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.effectiveStacks.find((stack) => stack.familyId === "appret"), {
    familyId: "appret",
    rawLevel: 6,
    effectiveLevel: 4,
    cumulativeMax: 4,
    entries: [sublimationCatalog[0], sublimationCatalog[0]],
  });
});

test("rejects mutually exclusive HP requirements", () => {
  const result = validateSublimationBuild({
    selections: [
      { sublimationId: "vitalite-90" },
      { sublimationId: "berserk-20" },
    ],
    hpAssumption: "normal",
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations.some((violation) => violation.type === "hpConditionConflict"), true);
});
