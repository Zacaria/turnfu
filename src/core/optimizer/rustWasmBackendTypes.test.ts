import assert from "node:assert/strict";
import test from "node:test";

import { cost, normalizeCatalog, spell } from "../catalog/index.ts";
import { createResources } from "../simulation/index.ts";
import { createRustWasmOptimizerRequest, serializeRustWasmOptimizerRequest } from "./rustWasmBackendTypes.ts";

const catalog = normalizeCatalog([
  spell("z-hit", {
    name: "Z Hit",
    level: 200,
    cost: cost({ ap: 1 }),
    effects: [],
    constraints: [],
    metadata: { status: "verified", sources: [] },
  }),
  spell("a-hit", {
    name: "A Hit",
    level: 200,
    cost: cost({ ap: 1 }),
    effects: [],
    constraints: [],
    metadata: { status: "verified", sources: [] },
  }),
]);

test("creates deterministic Rust/WASM optimizer requests", () => {
  const request = createRustWasmOptimizerRequest({
    catalog,
    character: {
      id: "request-test",
      className: "huppermage",
      resources: createResources({ ap: 12, mp: 6, wp: 6, bq: 500 }),
      stats: {
        generalMastery: 0,
        elementalMastery: {},
        damageInflictedPercent: 0,
      },
    },
    duration: 3.9,
    engines: ["hybrid"],
    budget: { iterations: 100 },
    seed: "same-seed",
    availableSpellIds: ["z-hit", "a-hit"],
    availablePassiveIds: ["passive-b", "passive-a"],
    maxActionsPerTurn: 8,
    maxPassiveCount: 3,
    requireSustainableCycle: true,
  });

  assert.equal(request.schemaVersion, 1);
  assert.equal(request.engine, "hybrid");
  assert.equal(request.duration, 3);
  assert.deepEqual(request.availableSpellIds, ["a-hit", "z-hit"]);
  assert.deepEqual(request.availablePassiveIds, ["passive-a", "passive-b"]);
  assert.deepEqual(request.catalog.map((entry) => entry.id), ["a-hit", "z-hit"]);
  assert.equal(request.requireSustainableCycle, true);
});

test("serializes Rust/WASM optimizer requests as JSON", () => {
  const serialized = serializeRustWasmOptimizerRequest({
    catalog,
    character: {
      id: "request-test",
      className: "huppermage",
      resources: createResources({ ap: 12, mp: 6, wp: 6, bq: 500 }),
      stats: {
        generalMastery: 0,
        elementalMastery: {},
        damageInflictedPercent: 0,
      },
    },
    duration: 2,
    engines: ["hybrid"],
    budget: { iterations: 50 },
  });

  assert.equal(JSON.parse(serialized).schemaVersion, 1);
});
