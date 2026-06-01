import assert from "node:assert/strict";
import test from "node:test";

import {
  createRustWasmDifferentialFixtures,
  rustWasmDifferentialCiFixtureOptions,
} from "./rustWasmDifferentialFixtures.ts";
import { sublimationCatalog } from "../sublimations/catalog.ts";

const supportedSublimationCandidateCount = sublimationCatalog
  .filter((entry) => entry.supportStatus === "supported")
  .length + 1;
const assumptionFixtureCountPerSeed = 4;

test("creates the CI-sized Rust/WASM candidate batch by default", () => {
  const fixtures = createRustWasmDifferentialFixtures();
  const batchFixtures = fixtures.filter((fixture) => fixture.kind === "candidateBatch");

  assert.equal(
    batchFixtures.length,
    rustWasmDifferentialCiFixtureOptions.candidateBatchSeeds.length * assumptionFixtureCountPerSeed,
  );
  assert.equal(batchFixtures[0]?.seed, rustWasmDifferentialCiFixtureOptions.candidateBatchSeeds[0]);
  assert.equal(
    batchFixtures[0]?.candidates.length,
    rustWasmDifferentialCiFixtureOptions.candidatesPerBatch + supportedSublimationCandidateCount,
  );
});

test("supports larger deterministic Rust/WASM differential batches", () => {
  const fixtures = createRustWasmDifferentialFixtures({
    candidateBatchSeeds: ["batch-a", "batch-b"],
    candidatesPerBatch: 3,
  });
  const batchFixtures = fixtures.filter((fixture) => fixture.kind === "candidateBatch");

  assert.deepEqual(batchFixtures.map((fixture) => fixture.seed), [
    "batch-a",
    "batch-a:healthy90",
    "batch-a:berserk50",
    "batch-a:low-ap",
    "batch-b",
    "batch-b:healthy90",
    "batch-b:berserk50",
    "batch-b:low-ap",
  ]);
  assert.deepEqual(
    batchFixtures.map((fixture) => fixture.candidates.length),
    [
      3 + supportedSublimationCandidateCount,
      4,
      1,
      3,
      3 + supportedSublimationCandidateCount,
      4,
      1,
      3,
    ],
  );
  assert.equal(batchFixtures[0]?.candidates[0]?.id, "batch-a:0");
  assert.equal(batchFixtures[4]?.candidates[0]?.id, "batch-b:0");
});
