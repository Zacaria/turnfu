import {
  researchWorkspaceStorageKey,
  type ResearchWorkspaceData,
} from "./researchWorkspace.ts";

type LegacyWorkspaceStorage = Pick<Storage, "getItem" | "removeItem">;

const researchWorkspaceEndpoint = "/api/research-workspace";

export async function restoreResearchWorkspaceFromSqlite(
  legacyStorage?: LegacyWorkspaceStorage,
  fetcher: typeof fetch = fetch,
): Promise<ResearchWorkspaceData | null> {
  const response = await fetcher(researchWorkspaceEndpoint, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as {
    schemaVersion?: number;
    workspace?: unknown;
  };
  const workspace = sanitizeResearchWorkspace(payload.workspace);
  if (workspace) {
    return workspace;
  }

  const legacyWorkspace = restoreLegacyResearchWorkspace(legacyStorage);
  if (legacyWorkspace) {
    await saveResearchWorkspaceToSqlite(legacyWorkspace, fetcher);
    legacyStorage?.removeItem(researchWorkspaceStorageKey);
  }
  return legacyWorkspace;
}

export async function saveResearchWorkspaceToSqlite(
  workspace: ResearchWorkspaceData,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(researchWorkspaceEndpoint, {
    body: JSON.stringify({
      schemaVersion: 1,
      workspace,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`Research workspace persistence failed with HTTP ${response.status}.`);
  }
}

export function sanitizeResearchWorkspace(value: unknown): ResearchWorkspaceData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const workspace = value as ResearchWorkspaceData;
  if (
    workspace.schemaVersion === 1
    && Array.isArray(workspace.builds)
    && Array.isArray(workspace.setupSnapshots)
    && Array.isArray(workspace.optimizerRuns)
    && Array.isArray(workspace.savedCombos)
  ) {
    return workspace;
  }
  return null;
}

function restoreLegacyResearchWorkspace(storage?: LegacyWorkspaceStorage): ResearchWorkspaceData | null {
  const serialized = storage?.getItem(researchWorkspaceStorageKey);
  if (!serialized) {
    return null;
  }

  try {
    return sanitizeResearchWorkspace(JSON.parse(serialized));
  } catch {
    storage?.removeItem(researchWorkspaceStorageKey);
    return null;
  }
}
