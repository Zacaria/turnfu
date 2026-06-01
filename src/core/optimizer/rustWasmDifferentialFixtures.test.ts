import assert from "node:assert/strict";
import test from "node:test";

import {
  createRustWasmDifferentialFixtures,
  rustWasmDifferentialCiFixtureOptions,
} from "./rustWasmDifferentialFixtures.ts";

const targetedSublimationCandidateCount = 8;

test("creates the CI-sized Rust/WASM candidate batch by default", () => {
  const fixtures = createRustWasmDifferentialFixtures();
  const batchFixtures = fixtures.filter((fixture) => fixture.kind === "candidateBatch");

  assert.equal(batchFixtures.length, rustWasmDifferentialCiFixtureOptions.candidateBatchSeeds.length);
  assert.equal(batchFixtures[0]?.seed, rustWasmDifferentialCiFixtureOptions.candidateBatchSeeds[0]);
  assert.equal(
    batchFixtures[0]?.candidates.length,
    rustWasmDifferentialCiFixtureOptions.candidatesPerBatch + targetedSublimationCandidateCount,
  );
});

test("supports larger deterministic Rust/WASM differential batches", () => {
  const fixtures = createRustWasmDifferentialFixtures({
    candidateBatchSeeds: ["batch-a", "batch-b"],
    candidatesPerBatch: 3,
  });
  const batchFixtures = fixtures.filter((fixture) => fixture.kind === "candidateBatch");

  assert.deepEqual(batchFixtures.map((fixture) => fixture.seed), ["batch-a", "batch-b"]);
  assert.deepEqual(
    batchFixtures.map((fixture) => fixture.candidates.length),
    [3 + targetedSublimationCandidateCount, 3 + targetedSublimationCandidateCount],
  );
  assert.equal(batchFixtures[0]?.candidates[0]?.id, "batch-a:0");
  assert.equal(batchFixtures[1]?.candidates[0]?.id, "batch-b:0");
});
