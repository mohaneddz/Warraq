import { supabase } from "./supabaseClient";

/**
 * Verifies the Supabase connection is reachable and promotes any reservation queue that
 * became stale outside of a return (e.g. a fresh copy added directly onto the shelf).
 * Throws if the project is unreachable, which the Boot screen in App.tsx surfaces as a
 * blocking "no connection" state — this app is online-only, there is no local fallback.
 */
export async function initializeDatabase(): Promise<void> {
  // books is publicly readable (see migration 0004_rls.sql), so this succeeds whether or
  // not the user is signed in yet — it only proves the project is reachable.
  const { error } = await supabase.from("books").select("id").limit(1);
  if (error) {
    throw new Error(`Could not reach the Warraq database. Check your internet connection and try again. (${error.message})`);
  }
  const { data: session } = await supabase.auth.getSession();
  if (session.session) {
    await supabase.rpc("advance_reservation_queue", { p_book_id: null });
  }
}
