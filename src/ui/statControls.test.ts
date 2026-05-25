import assert from "node:assert/strict";
import test from "node:test";

import { getStatStep } from "./statControls.ts";

test("uses a step of one for normal stat clicks", () => {
  assert.equal(getStatStep({ shiftKey: false }), 1);
});

test("uses a step of ten for shifted stat clicks", () => {
  assert.equal(getStatStep({ shiftKey: true }), 10);
});
