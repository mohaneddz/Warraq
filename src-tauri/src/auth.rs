use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use serde::Serialize;
use sqlx::{Row, SqlitePool};
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};
use tokio::sync::Mutex;
use uuid::Uuid;

const DB_URL: &str = "sqlite:warraq.db";

#[derive(Clone, Serialize)]
pub struct PublicUser {
    pub id: String,
    pub username: String,
    pub full_name: String,
    pub email: Option<String>,
    pub role: String,
    pub status: String,
    pub avatar_path: Option<String>,
    pub must_change_password: bool,
    pub created_at: String,
    pub last_login_at: Option<String>,
}

#[derive(Clone)]
struct Session {
    user_id: String,
    role: String,
}

/// In-memory, process-lifetime session. Deliberately not persisted to disk:
/// hiding the window to the tray keeps it (no re-login needed), but a full
/// app restart always requires signing in again.
#[derive(Default)]
pub struct SessionState(Mutex<Option<Session>>);

fn now_iso() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default()
}

fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| e.to_string())
}

fn verify_password(password: &str, hash: &str) -> bool {
    match PasswordHash::new(hash) {
        Ok(parsed) => Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok(),
        Err(_) => false,
    }
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

#[allow(unreachable_patterns)]
async fn get_sqlite_pool(db_instances: &State<'_, DbInstances>) -> Result<SqlitePool, String> {
    let instances = db_instances.0.read().await;
    match instances.get(DB_URL) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        Some(_) => Err("Only the SQLite driver is supported.".into()),
        None => Err("Database is not loaded yet.".into()),
    }
}

fn row_to_public_user(row: &sqlx::sqlite::SqliteRow) -> PublicUser {
    PublicUser {
        id: row.get("id"),
        username: row.get("username"),
        full_name: row.get("full_name"),
        email: row.get("email"),
        role: row.get("role"),
        status: row.get("status"),
        avatar_path: row.get("avatar_path"),
        must_change_password: row.get::<i64, _>("must_change_password") != 0,
        created_at: row.get("created_at"),
        last_login_at: row.get("last_login_at"),
    }
}

async fn require_admin(session: &State<'_, SessionState>) -> Result<String, String> {
    let guard = session.0.lock().await;
    match guard.as_ref() {
        Some(s) if s.role == "admin" => Ok(s.user_id.clone()),
        Some(_) => Err("Administrator privileges are required for this action.".into()),
        None => Err("You must be signed in.".into()),
    }
}

/// Creates the one administrator account from WARRAQ_ADMIN_USERNAME /
/// WARRAQ_ADMIN_PASSWORD when the users table is still empty. Returns
/// Ok(true) if an admin was just created, Ok(false) if one already exists.
/// The plaintext password is read here (Rust) only, hashed immediately,
/// and never returned to the frontend.
#[tauri::command]
pub async fn bootstrap_admin_if_needed(
    db_instances: State<'_, DbInstances>,
) -> Result<bool, String> {
    let pool = get_sqlite_pool(&db_instances).await?;
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    if count > 0 {
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

    let hash = hash_password(&password)?;
    let id = Uuid::new_v4().to_string();
    let now = now_iso();

    let insert = sqlx::query(
        "INSERT INTO users (id, username, full_name, email, role, password_hash, status, must_change_password, created_at, updated_at) VALUES (?, ?, 'Administrator', NULL, 'admin', ?, 'active', 0, ?, ?)"
    )
    .bind(&id)
    .bind(&username)
    .bind(&hash)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await;

    match insert {
        Ok(_) => Ok(true),
        // Two near-simultaneous bootstrap calls (e.g. React StrictMode double-invoking
        // the boot effect in dev) can both see an empty table before either has
        // inserted. Whichever loses the race just finds the admin already there.
        Err(sqlx::Error::Database(db_err)) if db_err.is_unique_violation() => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn auth_login(
    db_instances: State<'_, DbInstances>,
    session: State<'_, SessionState>,
    username: String,
    password: String,
) -> Result<PublicUser, String> {
    let pool = get_sqlite_pool(&db_instances).await?;
    let uname = username.trim().to_lowercase();
    let row = sqlx::query("SELECT * FROM users WHERE username = ?")
        .bind(&uname)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Invalid username or password.".to_string())?;

    let stored_hash: String = row.get("password_hash");
    let status: String = row.get("status");
    if !verify_password(&password, &stored_hash) {
        return Err("Invalid username or password.".into());
    }
    if status != "active" {
        return Err("This account has been disabled. Contact your administrator.".into());
    }

    let id: String = row.get("id");
    let role: String = row.get("role");
    let now = now_iso();
    sqlx::query("UPDATE users SET last_login_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    *session.0.lock().await = Some(Session {
        user_id: id.clone(),
        role,
    });

    let refreshed = sqlx::query("SELECT * FROM users WHERE id = ?")
        .bind(&id)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(row_to_public_user(&refreshed))
}

#[tauri::command]
pub async fn auth_logout(session: State<'_, SessionState>) -> Result<(), String> {
    *session.0.lock().await = None;
    Ok(())
}

#[tauri::command]
pub async fn auth_current_session(
    db_instances: State<'_, DbInstances>,
    session: State<'_, SessionState>,
) -> Result<Option<PublicUser>, String> {
    let user_id = {
        let guard = session.0.lock().await;
        match guard.as_ref() {
            Some(s) => s.user_id.clone(),
            None => return Ok(None),
        }
    };
    let pool = get_sqlite_pool(&db_instances).await?;
    let row = sqlx::query("SELECT * FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(row.map(|r| row_to_public_user(&r)))
}

#[tauri::command]
pub async fn auth_list_users(
    db_instances: State<'_, DbInstances>,
    session: State<'_, SessionState>,
) -> Result<Vec<PublicUser>, String> {
    require_admin(&session).await?;
    let pool = get_sqlite_pool(&db_instances).await?;
    let rows = sqlx::query("SELECT * FROM users ORDER BY full_name")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows.iter().map(row_to_public_user).collect())
}

#[tauri::command]
pub async fn auth_create_user(
    db_instances: State<'_, DbInstances>,
    session: State<'_, SessionState>,
    username: String,
    full_name: String,
    email: Option<String>,
    role: String,
    password: String,
) -> Result<PublicUser, String> {
    require_admin(&session).await?;
    if role != "admin" && role != "staff" {
        return Err("Role must be 'admin' or 'staff'.".into());
    }
    let uname = validate_username(&username)?;
    validate_password(&password)?;
    let name = full_name.trim().to_string();
    if name.is_empty() {
        return Err("Full name is required.".into());
    }

    let pool = get_sqlite_pool(&db_instances).await?;
    let existing: Option<(String,)> = sqlx::query_as("SELECT id FROM users WHERE username = ?")
        .bind(&uname)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;
    if existing.is_some() {
        return Err(format!("A user with the username \"{uname}\" already exists."));
    }

    let clean_email = email
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let hash = hash_password(&password)?;
    let id = Uuid::new_v4().to_string();
    let now = now_iso();
    sqlx::query(
        "INSERT INTO users (id, username, full_name, email, role, password_hash, status, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)"
    )
    .bind(&id)
    .bind(&uname)
    .bind(&name)
    .bind(&clean_email)
    .bind(&role)
    .bind(&hash)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let row = sqlx::query("SELECT * FROM users WHERE id = ?")
        .bind(&id)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(row_to_public_user(&row))
}

async fn assert_not_last_admin(pool: &SqlitePool, user_id: &str) -> Result<(), String> {
    let target: Option<(String, String)> =
        sqlx::query_as("SELECT role, status FROM users WHERE id = ?")
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;
    let Some((role, status)) = target else {
        return Err("User not found.".into());
    };
    if role == "admin" && status == "active" {
        let active_admins: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'")
                .fetch_one(pool)
                .await
                .map_err(|e| e.to_string())?;
        if active_admins <= 1 {
            return Err("This is the last active administrator and cannot be demoted, disabled, or deleted.".into());
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn auth_update_user(
    db_instances: State<'_, DbInstances>,
    session: State<'_, SessionState>,
    id: String,
    full_name: Option<String>,
    email: Option<String>,
    role: Option<String>,
    status: Option<String>,
) -> Result<(), String> {
    require_admin(&session).await?;
    if let Some(r) = &role {
        if r != "admin" && r != "staff" {
            return Err("Role must be 'admin' or 'staff'.".into());
        }
    }
    if let Some(s) = &status {
        if s != "active" && s != "disabled" {
            return Err("Status must be 'active' or 'disabled'.".into());
        }
    }

    let pool = get_sqlite_pool(&db_instances).await?;
    if role.as_deref() == Some("staff") || status.as_deref() == Some("disabled") {
        assert_not_last_admin(&pool, &id).await?;
    }

    let mut set_clauses: Vec<&str> = Vec::new();
    if full_name.is_some() {
        set_clauses.push("full_name = ?");
    }
    if email.is_some() {
        set_clauses.push("email = ?");
    }
    if role.is_some() {
        set_clauses.push("role = ?");
    }
    if status.is_some() {
        set_clauses.push("status = ?");
    }
    if set_clauses.is_empty() {
        return Ok(());
    }
    set_clauses.push("updated_at = ?");

    let sql = format!("UPDATE users SET {} WHERE id = ?", set_clauses.join(", "));
    let mut q = sqlx::query(&sql);
    if let Some(v) = &full_name {
        q = q.bind(v.trim().to_string());
    }
    if let Some(v) = &email {
        let t = v.trim();
        q = q.bind(if t.is_empty() { None } else { Some(t.to_string()) });
    }
    if let Some(v) = &role {
        q = q.bind(v.clone());
    }
    if let Some(v) = &status {
        q = q.bind(v.clone());
    }
    q = q.bind(now_iso());
    q = q.bind(&id);

    let result = q.execute(&pool).await.map_err(|e| e.to_string())?;
    if result.rows_affected() == 0 {
        return Err("User not found.".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn auth_reset_password(
    db_instances: State<'_, DbInstances>,
    session: State<'_, SessionState>,
    id: String,
    new_password: String,
) -> Result<(), String> {
    require_admin(&session).await?;
    validate_password(&new_password)?;
    let pool = get_sqlite_pool(&db_instances).await?;
    let hash = hash_password(&new_password)?;
    let now = now_iso();
    let result = sqlx::query(
        "UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?",
    )
    .bind(&hash)
    .bind(&now)
    .bind(&id)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;
    if result.rows_affected() == 0 {
        return Err("User not found.".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn auth_change_own_password(
    db_instances: State<'_, DbInstances>,
    session: State<'_, SessionState>,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    let user_id = {
        let guard = session.0.lock().await;
        guard
            .as_ref()
            .map(|s| s.user_id.clone())
            .ok_or_else(|| "You must be signed in.".to_string())?
    };
    validate_password(&new_password)?;
    let pool = get_sqlite_pool(&db_instances).await?;
    let row = sqlx::query("SELECT password_hash FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let current_hash: String = row.get("password_hash");
    if !verify_password(&current_password, &current_hash) {
        return Err("Current password is incorrect.".into());
    }
    let new_hash = hash_password(&new_password)?;
    let now = now_iso();
    sqlx::query(
        "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?",
    )
    .bind(&new_hash)
    .bind(&now)
    .bind(&user_id)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn auth_delete_user(
    db_instances: State<'_, DbInstances>,
    session: State<'_, SessionState>,
    id: String,
) -> Result<(), String> {
    let acting_user_id = require_admin(&session).await?;
    if acting_user_id == id {
        return Err("You cannot delete your own account while signed in.".into());
    }
    let pool = get_sqlite_pool(&db_instances).await?;
    assert_not_last_admin(&pool, &id).await?;
    let result = sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    if result.rows_affected() == 0 {
        return Err("User not found.".into());
    }
    Ok(())
}
