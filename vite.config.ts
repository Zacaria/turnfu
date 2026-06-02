import { mkdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const optimizerSessionsApiPrefix = "/api/optimizer-sessions";
const researchWorkspaceApiPath = "/api/research-workspace";
const optimizerSearchDatabasePath = resolve(process.env.WAKFU_OPTIMIZER_DB ?? ".optimizer/rust-wasm-search.sqlite");

export default defineConfig({
  plugins: [optimizerSessionsSqliteApi(), react()],
});

function optimizerSessionsSqliteApi(): Plugin {
  return {
    name: "wakfu-optimizer-sessions-sqlite-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = new URL(request.url ?? "/", "http://localhost");
        if (!requestUrl.pathname.startsWith(optimizerSessionsApiPrefix) && requestUrl.pathname !== researchWorkspaceApiPath) {
          next();
          return;
        }

        try {
          if (request.method === "GET" && requestUrl.pathname === researchWorkspaceApiPath) {
            sendJson(response, 200, { schemaVersion: 1, workspace: readResearchWorkspace() });
            return;
          }

          if (request.method === "PUT" && requestUrl.pathname === researchWorkspaceApiPath) {
            const body = await readJsonBody(request);
            const workspace = body && typeof body === "object" && "workspace" in body
              ? (body as { workspace: unknown }).workspace
              : undefined;
            if (!workspace || typeof workspace !== "object") {
              sendJson(response, 400, { error: "Missing research workspace." });
              return;
            }

            writeResearchWorkspace(workspace);
            sendJson(response, 204, null);
            return;
          }

          if (request.method === "GET" && requestUrl.pathname === optimizerSessionsApiPrefix) {
            sendJson(response, 200, { schemaVersion: 1, sessions: readOptimizerSessions() });
            return;
          }

          if (request.method === "PUT" && requestUrl.pathname.startsWith(`${optimizerSessionsApiPrefix}/`)) {
            const setupId = decodeURIComponent(requestUrl.pathname.slice(optimizerSessionsApiPrefix.length + 1));
            if (!setupId) {
              sendJson(response, 400, { error: "Missing setup id." });
              return;
            }

            const body = await readJsonBody(request);
            const session = body && typeof body === "object" && "session" in body
              ? (body as { session: unknown }).session
              : undefined;
            if (!session || typeof session !== "object") {
              sendJson(response, 400, { error: "Missing optimizer session." });
              return;
            }

            writeOptimizerSession(setupId, session);
            sendJson(response, 204, null);
            return;
          }

          sendJson(response, 405, { error: "Unsupported optimizer session API method." });
        } catch (error) {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : "Unexpected optimizer session API error.",
          });
        }
      });
    },
  };
}

function readResearchWorkspace(): unknown | null {
  const database = openOptimizerDatabase();
  try {
    const row = database
      .prepare("SELECT document_json FROM optimizer_ui_documents WHERE document_key = ?")
      .get("researchWorkspace") as { document_json: string } | undefined;
    return row ? JSON.parse(row.document_json) as unknown : null;
  } finally {
    database.close();
  }
}

function writeResearchWorkspace(workspace: unknown): void {
  const database = openOptimizerDatabase();
  try {
    database.prepare(`
      INSERT INTO optimizer_ui_documents (document_key, document_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(document_key) DO UPDATE SET
        document_json = excluded.document_json,
        updated_at = CURRENT_TIMESTAMP
    `).run("researchWorkspace", JSON.stringify(workspace));
  } finally {
    database.close();
  }
}

function readOptimizerSessions(): Record<string, unknown> {
  const database = openOptimizerDatabase();
  try {
    const rows = database
      .prepare("SELECT setup_id, session_json FROM optimizer_ui_sessions")
      .all() as Array<{ setup_id: string; session_json: string }>;
    return Object.fromEntries(rows.map((row) => [row.setup_id, JSON.parse(row.session_json) as unknown]));
  } finally {
    database.close();
  }
}

function writeOptimizerSession(setupId: string, session: unknown): void {
  const database = openOptimizerDatabase();
  try {
    database.prepare(`
      INSERT INTO optimizer_ui_sessions (setup_id, session_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(setup_id) DO UPDATE SET
        session_json = excluded.session_json,
        updated_at = CURRENT_TIMESTAMP
    `).run(setupId, JSON.stringify(session));
  } finally {
    database.close();
  }
}

function openOptimizerDatabase(): DatabaseSync {
  mkdirSync(dirname(optimizerSearchDatabasePath), { recursive: true });
  const database = new DatabaseSync(optimizerSearchDatabasePath);
  database.exec(`
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS optimizer_ui_sessions (
      setup_id TEXT PRIMARY KEY,
      session_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS optimizer_ui_documents (
      document_key TEXT PRIMARY KEY,
      document_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return database;
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolveRequest, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => {
      try {
        const serialized = Buffer.concat(chunks).toString("utf8");
        resolveRequest(serialized ? JSON.parse(serialized) as unknown : null);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.statusCode = statusCode;
  if (body === null) {
    response.end();
    return;
  }

  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}
