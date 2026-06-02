import type { OptimizerWorkspaceSession } from "./ResearchWorkspacePages.tsx";

type OptimizerWorkspaceSessionNormalizer = (session: OptimizerWorkspaceSession) => OptimizerWorkspaceSession;

type OptimizerSessionsPayload = {
  schemaVersion?: number;
  sessions?: Record<string, OptimizerWorkspaceSession>;
};

const optimizerSessionsEndpoint = "/api/optimizer-sessions";

export async function restoreOptimizerWorkspaceSessions(
  normalizeSession: OptimizerWorkspaceSessionNormalizer,
  fetcher: typeof fetch = fetch,
): Promise<Record<string, OptimizerWorkspaceSession>> {
  const response = await fetcher(optimizerSessionsEndpoint, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return {};
  }

  const payload = await response.json() as unknown;
  return sanitizeOptimizerWorkspaceSessions(payload, normalizeSession) ?? {};
}

export async function saveOptimizerWorkspaceSession(
  setupId: string,
  session: OptimizerWorkspaceSession,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(`${optimizerSessionsEndpoint}/${encodeURIComponent(setupId)}`, {
    body: JSON.stringify({
      schemaVersion: 1,
      session,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`Optimizer session persistence failed with HTTP ${response.status}.`);
  }
}

export function sanitizeOptimizerWorkspaceSessions(
  value: unknown,
  normalizeSession: OptimizerWorkspaceSessionNormalizer,
): Record<string, OptimizerWorkspaceSession> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as OptimizerSessionsPayload;
  if (payload.schemaVersion !== 1 || !payload.sessions || typeof payload.sessions !== "object") {
    return null;
  }

  return Object.fromEntries(
    Object.entries(payload.sessions)
      .filter(([, session]) => isOptimizerWorkspaceSession(session))
      .map(([setupId, session]) => [setupId, normalizeSession(session)]),
  );
}

function isOptimizerWorkspaceSession(value: unknown): value is OptimizerWorkspaceSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as OptimizerWorkspaceSession;
  return Boolean(session.controls)
    && Array.isArray(session.pinnedIds)
    && typeof session.runProgress === "object"
    && ["idle", "running", "done", "stopped", "error"].includes(session.runStatus);
}
