import assert from "node:assert/strict";
import test from "node:test";

import { optimizeCombo, scoreComboSimulation } from "./index.ts";

test("optimizer entrypoint exports core optimization APIs without UI imports", () => {
  assert.equal(typeof optimizeCombo, "function");
  assert.equal(typeof scoreComboSimulation, "function");
});
