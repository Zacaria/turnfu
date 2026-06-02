import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizeOptimizerWorkspaceSessions,
} from "./optimizerSessionPersistence.ts";
import type { OptimizerWorkspaceSession } from "./ResearchWorkspacePages.tsx";

test("sanitizes persisted optimizer sessions and normalizes restored running state", () => {
  const runningSession = {
    controls: { duration: 3 },
    lastRun: null,
    pinnedIds: ["candidate-1"],
    runError: null,
    runProgress: {
      attempts: 10,
      invalidCandidates: 2,
      label: "running",
      percent: 50,
      validCandidates: 8,
    },
    runStatus: "running",
  } as unknown as OptimizerWorkspaceSession;

  const restored = sanitizeOptimizerWorkspaceSessions({
    schemaVersion: 1,
    sessions: {
      "setup-1": runningSession,
      invalid: { controls: {}, runStatus: "done" },
    },
  }, (session) => ({
    ...session,
    runStatus: session.runStatus === "running" ? "stopped" : session.runStatus,
  }));

  assert.deepEqual(Object.keys(restored ?? {}), ["setup-1"]);
  assert.equal(restored?.["setup-1"]?.runStatus, "stopped");
  assert.deepEqual(restored?.["setup-1"]?.pinnedIds, ["candidate-1"]);
});

test("rejects unknown optimizer session payloads", () => {
  assert.equal(sanitizeOptimizerWorkspaceSessions(null, (session) => session), null);
  assert.equal(sanitizeOptimizerWorkspaceSessions({ schemaVersion: 2, sessions: {} }, (session) => session), null);
  assert.equal(sanitizeOptimizerWorkspaceSessions({ schemaVersion: 1 }, (session) => session), null);
});
