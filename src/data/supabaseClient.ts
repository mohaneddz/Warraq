import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Add them to .env and restart the dev server / rebuild."
  );
}

/**
 * The publishable/anon key is meant to be public — every table it can reach is protected
 * by Postgres Row Level Security (see supabase/migrations/0004_rls.sql), not by keeping
 * this key secret. The service-role key never appears in frontend code; it only lives in
 * src-tauri/src/admin.rs.
 */
export const supabase = createClient(url, anonKey, {
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
