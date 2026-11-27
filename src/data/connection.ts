/**
 * Which Supabase project the app talks to.
 *
 * Two editions share this code. The client edition is built with the hospital's values from
 * `.env` compiled in (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). The public edition is built
 * without them: a new install has no database, so the first-run setup asks for the user's own
 * Supabase project and keeps it here, in the webview's local storage.
 *
 * Only the project URL and the publishable (anon) key live in this file's storage. Both are
 * designed to be public: row level security, not secrecy, protects the data. The service-role
 * key is never kept here; it goes to the Rust side (see src-tauri/src/connection.rs).
 */

export interface Connection {
  url: string;
  anonKey: string;
}

export type KeyRole = "anon" | "service_role" | "unknown";

const STORAGE_KEY = "warraq-connection";
const PROJECT_REF = /^[a-z0-9]{20}$/;
const HOSTED_SUFFIX = ".supabase.co";

/** Values compiled into the client edition. Both are empty strings in the public edition. */
function bakedConnection(): Connection | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  return url && anonKey ? { url, anonKey } : null;
}

export function storedConnection(): Connection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Connection>;
    return parsed.url && parsed.anonKey ? { url: parsed.url, anonKey: parsed.anonKey } : null;
  } catch {
    return null;
  }
}

/** The client edition's built-in connection wins; otherwise whatever the user set up. */
export function getConnection(): Connection | null {
  return bakedConnection() ?? storedConnection();
}

export function connectionSource(): "built-in" | "saved" | "none" {
  if (bakedConnection()) return "built-in";
  return storedConnection() ? "saved" : "none";
}

export function saveConnection(connection: Connection): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
}

export function clearConnection(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Pulls the 20 character project reference out of whatever the user pasted: the bare reference,
 * the `https://<ref>.supabase.co` URL, or a dashboard link such as
 * `https://supabase.com/dashboard/project/<ref>/settings/api`.
 */
export function projectRefFrom(input: string): string | null {
  const raw = input.trim();
  if (PROJECT_REF.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host.endsWith(HOSTED_SUFFIX)) {
    const ref = host.slice(0, -HOSTED_SUFFIX.length);
    return PROJECT_REF.test(ref) ? ref : null;
  }
  if (host === "supabase.com" || host === "app.supabase.com") {
    const match = url.pathname.match(/\/project\/([a-z0-9]{20})(?:\/|$)/);
    return match ? match[1] : null;
  }
  return null;
}

/** Hosted Supabase only: the app's content security policy allows `*.supabase.co` and nothing else. */
export function projectUrlFrom(input: string): string | null {
  const ref = projectRefFrom(input);
  return ref ? `https://${ref}${HOSTED_SUFFIX}` : null;
}

/** Link to the project's SQL editor, where the schema script gets pasted. */
export function sqlEditorUrl(ref: string): string {
  return `https://supabase.com/dashboard/project/${ref}/sql/new`;
}

/** Link to the page that lists the project's API keys. */
export function apiKeysUrl(ref: string): string {
  return `https://supabase.com/dashboard/project/${ref}/settings/api-keys`;
}

/**
 * Tells a publishable key from a secret one without contacting Supabase, so pasting the
 * service-role key into the wrong box is caught before it goes anywhere.
 */
export function keyRole(key: string): KeyRole {
  const value = key.trim();
  if (value.startsWith("sb_publishable_")) return "anon";
  if (value.startsWith("sb_secret_")) return "service_role";
  const payload = value.split(".")[1];
  if (!payload) return "unknown";
  try {
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { role?: string };
    return decoded.role === "anon" || decoded.role === "service_role" ? decoded.role : "unknown";
  } catch {
    return "unknown";
  }
}
