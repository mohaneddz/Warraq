import { createClient } from "@supabase/supabase-js";
import { getConnection } from "./connection";

const connection = getConnection();

if (!connection) {
  // main.tsx shows the first-run setup instead of loading the app when nothing is configured, so
  // reaching this means something imported the client too early.
  throw new Error("Warraq is not connected to a database yet. Finish the first-run setup before using the data layer.");
}

/**
 * The publishable/anon key is meant to be public — every table it can reach is protected
 * by Postgres Row Level Security (see supabase/migrations/0004_rls.sql), not by keeping
 * this key secret. The service-role key never appears in frontend code; it only lives in
 * src-tauri/src/admin.rs.
 */
export const supabase = createClient(connection.url, connection.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/** Throws the PostgREST/RPC error's message so callers can surface it directly to the UI. */
export function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}
