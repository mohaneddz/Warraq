import type { Connection } from "./connection";

export type ConnectionTest = "ok" | "unreachable" | "badKey" | "notFound";
export type SchemaState = "installed" | "missing" | "unknown";

/** Asks the project's auth service for its public settings, which needs a valid publishable key. */
export async function testConnection(connection: Connection): Promise<ConnectionTest> {
  let response: Response;
  try {
    response = await fetch(`${connection.url}/auth/v1/settings`, { headers: { apikey: connection.anonKey } });
  } catch {
    return "unreachable";
  }
  if (response.ok) return "ok";
  if (response.status === 401 || response.status === 403) return "badKey";
  if (response.status === 404) return "notFound";
  return "unreachable";
}

/**
 * Looks for the `profiles` table the schema script creates. A missing table answers 404 or the
 * PostgREST/Postgres "relation not found" codes; a permission error means the table is there and
 * row level security is doing its job.
 */
export async function checkSchema(connection: Connection): Promise<SchemaState> {
  let response: Response;
  try {
    response = await fetch(`${connection.url}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: connection.anonKey, Authorization: `Bearer ${connection.anonKey}` },
    });
  } catch {
    return "unknown";
  }
  if (response.ok) return "installed";
  const body = (await response.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code;
  if (response.status === 404 || code === "PGRST205" || code === "42P01") return "missing";
  if (code === "42501") return "installed";
  return "unknown";
}
