// Narrow, service-role-only Supabase operations that must never run in the frontend:
// creating a staff/admin auth user, resetting someone else's password, and deleting an
// account. Everything else (login, session, "who am I", listing/reading profiles,
// enabling/disabling via profiles.status) happens directly in the frontend through
// supabase-js against RLS-protected tables — no Rust involvement needed there.
//
// The service-role key lives only in this process's environment (loaded from .env via
// dotenvy, same trust tier as the WARRAQ_ADMIN_* bootstrap credentials) and is never sent
// to the webview. Every privileged command here re-validates the caller's own Supabase
// access token and requires their profile to be an active admin before doing anything.

use serde::{Deserialize, Serialize};
use serde_json::json;

fn supabase_url() -> Result<String, String> {
    let project_id = std::env::var("PROJECT_ID")
        .map_err(|_| "Server is missing PROJECT_ID in its environment.".to_string())?;
    Ok(format!("https://{project_id}.supabase.co"))
}

fn service_key() -> Result<String, String> {
    std::env::var("SECRET_KEY")
        .map_err(|_| "Server is missing SECRET_KEY in its environment.".to_string())
}

fn anon_key() -> Result<String, String> {
    std::env::var("PUBLISHABLE_KEY")
        .map_err(|_| "Server is missing PUBLISHABLE_KEY in its environment.".to_string())
}

fn validate_password(password: &str) -> Result<(), String> {
    if password.len() < 8 {
        return Err("Password must be at least 8 characters long.".into());
    }
    Ok(())
}

fn validate_username(username: &str) -> Result<String, String> {
    let trimmed = username.trim().to_lowercase();
    if trimmed.len() < 3 {
        return Err("Username must be at least 3 characters long.".into());
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
    {
        return Err("Username may only contain letters, numbers, '.', '_' and '-'.".into());
    }
    Ok(trimmed)
}

/// Synthesizes a technical email for a username-only account, since Supabase Auth
/// requires an email identifier. Real emails (when the user has one) are used as-is.
fn identity_email(username: &str, email: Option<&str>) -> String {
    match email.map(str::trim).filter(|e| !e.is_empty()) {
        Some(real) => real.to_string(),
        None => format!("{username}@warraq.local"),
    }
}

#[derive(Deserialize)]
struct SupabaseAuthUser {
    id: String,
}

#[derive(Deserialize)]
struct ProfileRoleRow {
    role: String,
    status: String,
}

/// Verifies the caller's Supabase access token is valid and belongs to an active admin.
/// Returns the admin's user id on success.
async fn require_admin_token(client: &reqwest::Client, access_token: &str) -> Result<String, String> {
    let url = supabase_url()?;
    let anon = anon_key()?;

    let who = client
        .get(format!("{url}/auth/v1/user"))
        .header("apikey", &anon)
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !who.status().is_success() {
        return Err("Your session has expired. Please sign in again.".into());
    }
    let user: SupabaseAuthUser = who.json().await.map_err(|e| e.to_string())?;

    let service = service_key()?;
    let profile_res = client
        .get(format!("{url}/rest/v1/profiles?id=eq.{}&select=role,status", user.id))
        .header("apikey", &service)
        .header("Authorization", format!("Bearer {service}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let profiles: Vec<ProfileRoleRow> = profile_res.json().await.map_err(|e| e.to_string())?;
    match profiles.first() {
        Some(p) if p.role == "admin" && p.status == "active" => Ok(user.id),
        Some(_) => Err("Administrator privileges are required for this action.".into()),
        None => Err("Your profile could not be found.".into()),
    }
}

#[derive(Serialize)]
pub struct CreatedStaff {
    id: String,
    username: String,
}

#[derive(Serialize, Deserialize)]
pub struct LoginAccount {
    pub username: String,
    pub full_name: String,
    pub role: String,
    pub avatar_path: Option<String>,
}

/// Retrieves list of active staff/admin accounts for the login screen selector.
#[tauri::command]
pub async fn get_login_accounts() -> Result<Vec<LoginAccount>, String> {
    let url = supabase_url()?;
    let service = service_key()?;
    let client = reqwest::Client::new();

    let res = client
        .get(format!("{url}/rest/v1/profiles?status=eq.active&select=username,full_name,role,avatar_path&order=full_name.asc"))
        .header("apikey", &service)
        .header("Authorization", format!("Bearer {service}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to fetch login accounts: {}", res.text().await.unwrap_or_default()));
    }

    let accounts: Vec<LoginAccount> = res.json().await.map_err(|e| e.to_string())?;
    Ok(accounts)
}

/// Creates the one administrator account from WARRAQ_ADMIN_USERNAME / WARRAQ_ADMIN_PASSWORD
/// (and optional WARRAQ_ADMIN_EMAIL) the first time the app runs against an empty
/// `profiles` table. Returns Ok(true) if an admin was just created, Ok(false) if one
/// already exists. Uses the service-role key directly (there is no admin yet to hold a
/// token), exactly like the previous SQLite bootstrap only ever ran once.
fn parse_auth_error(body: &str) -> String {
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(body) {
        let code = val.get("code").and_then(|c| c.as_str()).unwrap_or("");
        let msg = val
            .get("message")
            .or_else(|| val.get("msg"))
            .or_else(|| val.get("error_description"))
            .and_then(|m| m.as_str())
            .unwrap_or("");
        let detail = val.get("detail").and_then(|d| d.as_str()).unwrap_or("");

        if code == "23505"
            || msg.contains("users_email_partial_key")
            || detail.contains("users_email_partial_key")
            || msg.contains("already exists")
            || msg.contains("already been registered")
        {
            if !detail.is_empty() {
                if let Some(start) = detail.find("(email)=(") {
                    let rest = &detail[start + 9..];
                    if let Some(end) = rest.find(')') {
                        let email = &rest[..end];
                        return format!("An account with the email or username '{email}' already exists.");
                    }
                }
            }
            return "An account with this email address or username already exists.".to_string();
        }

        if !msg.is_empty() {
            return msg.to_string();
        }
    }
    if body.trim().is_empty() {
        "Unknown error occurred.".to_string()
    } else {
        body.to_string()
    }
}

async fn find_auth_user_by_email(
    client: &reqwest::Client,
    url: &str,
    service: &str,
    target_email: &str,
) -> Result<Option<String>, String> {
    let res = client
        .get(format!("{url}/auth/v1/admin/users"))
        .header("apikey", service)
        .header("Authorization", format!("Bearer {service}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Ok(None);
    }

    let val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let empty_vec = vec![];
    let users_list = if let Some(arr) = val.get("users").and_then(|v| v.as_array()) {
        arr
    } else if let Some(arr) = val.as_array() {
        arr
    } else {
        &empty_vec
    };

    for u in users_list {
        if let Some(email) = u.get("email").and_then(|e| e.as_str()) {
            if email.eq_ignore_ascii_case(target_email) {
                if let Some(id) = u.get("id").and_then(|i| i.as_str()) {
                    return Ok(Some(id.to_string()));
                }
            }
        }
    }
    Ok(None)
}

/// Creates the one administrator account from WARRAQ_ADMIN_USERNAME / WARRAQ_ADMIN_PASSWORD
/// (and optional WARRAQ_ADMIN_EMAIL) the first time the app runs against an empty
/// `profiles` table. Returns Ok(true) if an admin was just created, Ok(false) if one
/// already exists. Uses the service-role key directly (there is no admin yet to hold a
/// token), exactly like the previous SQLite bootstrap only ever ran once.
#[tauri::command]
pub async fn admin_bootstrap_if_needed() -> Result<bool, String> {
    let url = supabase_url()?;
    let service = service_key()?;
    let client = reqwest::Client::new();

    let existing = client
        .get(format!("{url}/rest/v1/profiles?select=id&limit=1"))
        .header("apikey", &service)
        .header("Authorization", format!("Bearer {service}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let rows: Vec<serde_json::Value> = existing.json().await.map_err(|e| e.to_string())?;
    if !rows.is_empty() {
        return Ok(false);
    }

    let username = std::env::var("WARRAQ_ADMIN_USERNAME").map_err(|_| {
        "No administrator account exists yet and WARRAQ_ADMIN_USERNAME is not set. Add WARRAQ_ADMIN_USERNAME and WARRAQ_ADMIN_PASSWORD to a .env file next to the application (or the environment) and restart Warraq.".to_string()
    })?;
    let password = std::env::var("WARRAQ_ADMIN_PASSWORD").map_err(|_| {
        "No administrator account exists yet and WARRAQ_ADMIN_PASSWORD is not set. Add WARRAQ_ADMIN_USERNAME and WARRAQ_ADMIN_PASSWORD to a .env file next to the application (or the environment) and restart Warraq.".to_string()
    })?;
    let username = validate_username(&username)?;
    validate_password(&password)?;
    let email_env = std::env::var("WARRAQ_ADMIN_EMAIL").ok();
    let email = identity_email(&username, email_env.as_deref());

    let user_id = match create_auth_user(&client, &url, &service, &email, &password).await {
        Ok(created) => created.id,
        Err(err) => {
            // If the user already exists in auth.users (e.g. profiles table was reset/cleared),
            // recover by finding the existing auth user and updating their password.
            if let Ok(Some(existing_id)) = find_auth_user_by_email(&client, &url, &service, &email).await {
                let _ = client
                    .put(format!("{url}/auth/v1/admin/users/{existing_id}"))
                    .header("apikey", &service)
                    .header("Authorization", format!("Bearer {service}"))
                    .header("Content-Type", "application/json")
                    .json(&json!({ "password": password }))
                    .send()
                    .await;
                existing_id
            } else {
                return Err(err);
            }
        }
    };

    let insert = client
        .post(format!("{url}/rest/v1/profiles"))
        .header("apikey", &service)
        .header("Authorization", format!("Bearer {service}"))
        .header("Content-Type", "application/json")
        .header("Prefer", "resolution=merge-duplicates,return=minimal")
        .json(&json!({
            "id": user_id,
            "username": username,
            "full_name": "Administrator",
            "email": email,
            "role": "admin",
            "status": "active",
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !insert.status().is_success() {
        return Err(format!("Failed to create the administrator profile: {}", insert.text().await.unwrap_or_default()));
    }
    Ok(true)
}

async fn create_auth_user(
    client: &reqwest::Client,
    url: &str,
    service: &str,
    email: &str,
    password: &str,
) -> Result<SupabaseAuthUser, String> {
    let res = client
        .post(format!("{url}/auth/v1/admin/users"))
        .header("apikey", service)
        .header("Authorization", format!("Bearer {service}"))
        .header("Content-Type", "application/json")
        .json(&json!({ "email": email, "password": password, "email_confirm": true }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Could not create the account: {}", parse_auth_error(&body)));
    }
    res.json().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn admin_create_staff(
    access_token: String,
    username: String,
    full_name: String,
    email: Option<String>,
    role: String,
    password: String,
) -> Result<CreatedStaff, String> {
    let url = supabase_url()?;
    let service = service_key()?;
    let client = reqwest::Client::new();
    require_admin_token(&client, &access_token).await?;

    if role != "admin" && role != "staff" {
        return Err("Role must be 'admin' or 'staff'.".into());
    }
    let uname = validate_username(&username)?;
    validate_password(&password)?;
    let name = full_name.trim().to_string();
    if name.is_empty() {
        return Err("Full name is required.".into());
    }
    let identity = identity_email(&uname, email.as_deref());

    let created = create_auth_user(&client, &url, &service, &identity, &password).await?;

    let insert = client
        .post(format!("{url}/rest/v1/profiles"))
        .header("apikey", &service)
        .header("Authorization", format!("Bearer {service}"))
        .header("Content-Type", "application/json")
        .header("Prefer", "return=minimal")
        .json(&json!({
            "id": created.id,
            "username": uname,
            "full_name": name,
            "email": identity,
            "role": role,
            "status": "active",
            "must_change_password": true,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !insert.status().is_success() {
        return Err(format!("Account created, but the staff profile failed: {}", insert.text().await.unwrap_or_default()));
    }

    Ok(CreatedStaff { id: created.id, username: uname })
}

#[tauri::command]
pub async fn admin_reset_password(
    access_token: String,
    user_id: String,
    new_password: String,
) -> Result<(), String> {
    let url = supabase_url()?;
    let service = service_key()?;
    let client = reqwest::Client::new();
    require_admin_token(&client, &access_token).await?;
    validate_password(&new_password)?;

    let res = client
        .put(format!("{url}/auth/v1/admin/users/{user_id}"))
        .header("apikey", &service)
        .header("Authorization", format!("Bearer {service}"))
        .header("Content-Type", "application/json")
        .json(&json!({ "password": new_password }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Could not reset the password: {}", res.text().await.unwrap_or_default()));
    }

    let patch = client
        .patch(format!("{url}/rest/v1/profiles?id=eq.{user_id}"))
        .header("apikey", &service)
        .header("Authorization", format!("Bearer {service}"))
        .header("Content-Type", "application/json")
        .header("Prefer", "return=minimal")
        .json(&json!({ "must_change_password": true }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !patch.status().is_success() {
        return Err(format!("Password reset, but the profile flag failed: {}", patch.text().await.unwrap_or_default()));
    }
    Ok(())
}

#[tauri::command]
pub async fn admin_delete_staff(access_token: String, user_id: String) -> Result<(), String> {
    let url = supabase_url()?;
    let service = service_key()?;
    let client = reqwest::Client::new();
    let acting_id = require_admin_token(&client, &access_token).await?;
    if acting_id == user_id {
        return Err("You cannot delete your own account while signed in.".into());
    }

    let target_res = client
        .get(format!("{url}/rest/v1/profiles?id=eq.{user_id}&select=role,status"))
        .header("apikey", &service)
        .header("Authorization", format!("Bearer {service}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let target: Vec<ProfileRoleRow> = target_res.json().await.map_err(|e| e.to_string())?;
    if let Some(p) = target.first() {
        if p.role == "admin" && p.status == "active" {
            let count_res = client
                .get(format!("{url}/rest/v1/profiles?role=eq.admin&status=eq.active&id=neq.{user_id}&select=id"))
                .header("apikey", &service)
                .header("Authorization", format!("Bearer {service}"))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let others: Vec<serde_json::Value> = count_res.json().await.map_err(|e| e.to_string())?;
            if others.is_empty() {
                return Err("This is the last active administrator and cannot be deleted.".into());
            }
        }
    }

    let res = client
        .delete(format!("{url}/auth/v1/admin/users/{user_id}"))
        .header("apikey", &service)
        .header("Authorization", format!("Bearer {service}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Could not delete the account: {}", res.text().await.unwrap_or_default()));
    }
    Ok(())
}
