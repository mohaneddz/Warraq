import { invoke } from "@tauri-apps/api/core";
import type { PublicUser, UserRole, UserStatus } from "../types";

/** Creates the one administrator account from WARRAQ_ADMIN_USERNAME/PASSWORD if no users exist yet. */
export async function bootstrapAdminIfNeeded(): Promise<boolean> {
  return invoke<boolean>("bootstrap_admin_if_needed");
}

export async function login(username: string, password: string): Promise<PublicUser> {
  return invoke<PublicUser>("auth_login", { username, password });
}

export async function logout(): Promise<void> {
  return invoke("auth_logout");
}

export async function currentSession(): Promise<PublicUser | null> {
  return invoke<PublicUser | null>("auth_current_session");
}

export async function listUsers(): Promise<PublicUser[]> {
  return invoke<PublicUser[]>("auth_list_users");
}

export async function createUser(input: {
  username: string;
  fullName: string;
  email?: string | null;
  role: UserRole;
  password: string;
}): Promise<PublicUser> {
  return invoke<PublicUser>("auth_create_user", input);
}

export async function updateUser(
  id: string,
  updates: { fullName?: string; email?: string | null; role?: UserRole; status?: UserStatus }
): Promise<void> {
  return invoke("auth_update_user", { id, ...updates });
}

export async function resetPassword(id: string, newPassword: string): Promise<void> {
  return invoke("auth_reset_password", { id, newPassword });
}

export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  return invoke("auth_change_own_password", { currentPassword, newPassword });
}

export async function deleteUser(id: string): Promise<void> {
  return invoke("auth_delete_user", { id });
}
