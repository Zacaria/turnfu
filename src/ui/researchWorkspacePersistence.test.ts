import assert from "node:assert/strict";
import test from "node:test";

import { createSeedResearchWorkspace } from "./researchWorkspace.ts";
import { sanitizeResearchWorkspace } from "./researchWorkspacePersistence.ts";

test("accepts valid persisted research workspace data", () => {
  const workspace = createSeedResearchWorkspace({ now: "2026-06-01T10:00:00.000Z" });

  assert.deepEqual(sanitizeResearchWorkspace(workspace), workspace);
});

test("rejects unknown research workspace payloads", () => {
  assert.equal(sanitizeResearchWorkspace(null), null);
  assert.equal(sanitizeResearchWorkspace({ schemaVersion: 2, builds: [] }), null);
  assert.equal(sanitizeResearchWorkspace({ schemaVersion: 1, builds: [] }), null);
});
