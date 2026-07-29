import { invoke } from "@tauri-apps/api/core";
import { supabase, unwrap } from "./supabaseClient";
import type { PublicUser, UserRole, UserStatus } from "../types";

interface ProfileRow {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  avatar_path: string | null;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
}

function toPublicUser(row: ProfileRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    avatar_path: row.avatar_path,
    must_change_password: row.must_change_password,
    created_at: row.created_at,
    last_login_at: row.last_login_at,
  };
}

export interface LoginAccount {
  username: string;
  full_name: string;
  role: UserRole;
  avatar_path: string | null;
}

export async function getLoginAccounts(): Promise<LoginAccount[]> {
  try {
    const res = await invoke<LoginAccount[]>("get_login_accounts");
    if (res && res.length > 0) return res;
  } catch {
    // Fall back to Supabase RPC
  }

  try {
    const { data, error } = await supabase.rpc("list_login_accounts");
    if (!error && data) {
      return data as LoginAccount[];
    }
  } catch {
    // Ignore fallback failure
  }

  return [];
}

/** Creates the one administrator account from WARRAQ_ADMIN_USERNAME/PASSWORD if no staff profiles exist yet. */
export async function bootstrapAdminIfNeeded(): Promise<boolean> {
  return invoke<boolean>("admin_bootstrap_if_needed");
}

export async function login(username: string, password: string): Promise<PublicUser> {
  const email = unwrap(await supabase.rpc("resolve_login_email", { p_username: username }));
  if (!email) throw new Error("Invalid username or password.");

  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw new Error("Invalid username or password.");

  const row = unwrap<ProfileRow>(await supabase.from("profiles").select("*").eq("username", username.trim().toLowerCase()).single());
  if (row.status !== "active") {
    await supabase.auth.signOut();
    throw new Error("This account has been disabled. Contact your administrator.");
  }
  await supabase.rpc("touch_last_login");
  return toPublicUser(row);
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function currentSession(): Promise<PublicUser | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return null;
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error || !profile) return null;
  return toPublicUser(profile as ProfileRow);
}

export async function listUsers(): Promise<PublicUser[]> {
  const rows = unwrap(await supabase.from("profiles").select("*").order("full_name"));
  return (rows as ProfileRow[]).map(toPublicUser);
}

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You must be signed in.");
  return token;
}

export async function createUser(input: {
  username: string;
  fullName: string;
  email?: string | null;
  role: UserRole;
  password: string;
}): Promise<{ id: string; username: string }> {
  const access_token = await accessToken();
  return invoke("admin_create_staff", {
    accessToken: access_token,
    username: input.username,
    fullName: input.fullName,
    email: input.email ?? null,
    role: input.role,
    password: input.password,
  });
}

export async function updateUser(
  id: string,
  updates: { fullName?: string; email?: string | null; role?: UserRole; status?: UserStatus }
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (updates.fullName !== undefined) patch.full_name = updates.fullName;
  if (updates.role !== undefined) patch.role = updates.role;
  if (updates.status !== undefined) patch.status = updates.status;
  unwrap(await supabase.from("profiles").update(patch).eq("id", id).select().single());
}

export async function resetPassword(id: string, newPassword: string): Promise<void> {
  const access_token = await accessToken();
  await invoke("admin_reset_password", { accessToken: access_token, userId: id, newPassword });
}

export async function changeOwnPassword(_currentPassword: string, newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  await supabase.rpc("clear_must_change_password");
}

export async function deleteUser(id: string): Promise<void> {
  const access_token = await accessToken();
  await invoke("admin_delete_staff", { accessToken: access_token, userId: id });
}
