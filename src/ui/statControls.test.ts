import assert from "node:assert/strict";
import test from "node:test";

import { createHuppermageBuildResources, getBuildResourceOptions, getCombatResourceOptions, getStatStep } from "./statControls.ts";

test("uses a step of one for normal stat clicks", () => {
  assert.equal(getStatStep({ shiftKey: false }), 1);
});

test("uses a step of ten for shifted stat clicks", () => {
  assert.equal(getStatStep({ shiftKey: true }), 10);
});

test("shows BQ but not PW in Huppermage combat resources", () => {
  assert.deepEqual(getCombatResourceOptions("huppermage"), ["ap", "mp", "bq"]);
});

test("shows PW but not BQ in Huppermage build resources", () => {
  assert.deepEqual(getBuildResourceOptions("huppermage"), ["ap", "mp", "wp"]);
});

test("derives Huppermage BQ from total build PW", () => {
  const resources = createHuppermageBuildResources(
    { ap: 6, mp: 3, wp: 6, bq: 0 },
    { ap: 1, mp: 1, wp: 2, bq: 999 },
  );

  assert.deepEqual(resources, { ap: 7, mp: 4, wp: 8, bq: 650 });
});
