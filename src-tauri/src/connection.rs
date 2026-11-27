// The Supabase project a public install talks to, as far as the Rust side needs it.
//
// The client edition compiles its project in (see build.rs). The public edition has nothing
// compiled in, so the first-run setup hands the project over through save_connection. The
// service-role key is the one value that must never reach the webview, so it is kept in the
// Windows Credential Manager (per user, protected by the login) rather than in a file the
// webview's filesystem scope could read. The publishable key and project URL are public by
// design; the frontend keeps its own copy of those.

use serde::{Deserialize, Serialize};
use std::sync::{OnceLock, RwLock};
use url::Url;

#[derive(Clone, Serialize, Deserialize)]
struct Saved {
    project_id: String,
    publishable_key: String,
    service_key: String,
}

static CURRENT: OnceLock<RwLock<Option<Saved>>> = OnceLock::new();

fn cell() -> &'static RwLock<Option<Saved>> {
    CURRENT.get_or_init(|| RwLock::new(None))
}

fn saved() -> Option<Saved> {
    cell().read().ok().and_then(|guard| guard.clone())
}

pub fn saved_project_id() -> Option<String> {
    saved().map(|s| s.project_id)
}

pub fn saved_publishable_key() -> Option<String> {
    saved().map(|s| s.publishable_key)
}

pub fn saved_service_key() -> Option<String> {
    saved().map(|s| s.service_key)
}

/// Loads whatever a previous run saved. Call once at startup; a missing or unreadable entry just
/// means "not set up".
pub fn load() {
    if let Ok(mut guard) = cell().write() {
        *guard = read_store().ok().flatten();
    }
}

fn is_project_id(value: &str) -> bool {
    value.len() == 20 && value.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
}

/// Pulls the 20 character project reference out of a bare reference, a hosted
/// `https://<ref>.supabase.co` URL, or a dashboard link. Only hosted Supabase is accepted.
pub fn parse_project_id(input: &str) -> Option<String> {
    let raw = input.trim();
    if is_project_id(raw) {
        return Some(raw.to_string());
    }
    let url = Url::parse(&if raw.contains("://") { raw.to_string() } else { format!("https://{raw}") }).ok()?;
    let host = url.host_str()?.to_ascii_lowercase();
    if let Some(id) = host.strip_suffix(".supabase.co") {
        return is_project_id(id).then(|| id.to_string());
    }
    if host == "supabase.com" || host == "app.supabase.com" {
        let mut segments = url.path_segments()?;
        while let Some(segment) = segments.next() {
            if segment == "project" {
                let id = segments.next()?;
                return is_project_id(id).then(|| id.to_string());
            }
        }
    }
    None
}

#[cfg(windows)]
fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new("com.warraq", "supabase-connection").map_err(|e| e.to_string())
}

#[cfg(windows)]
fn read_store() -> Result<Option<Saved>, String> {
    match entry()?.get_password() {
        Ok(json) => Ok(serde_json::from_str(&json).ok()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(windows)]
fn write_store(saved: &Saved) -> Result<(), String> {
    let json = serde_json::to_string(saved).map_err(|e| e.to_string())?;
    entry()?.set_password(&json).map_err(|e| e.to_string())
}

#[cfg(windows)]
fn delete_store() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(not(windows))]
fn read_store() -> Result<Option<Saved>, String> {
    Ok(None)
}

#[cfg(not(windows))]
fn write_store(_saved: &Saved) -> Result<(), String> {
    Err("Saving the connection is only supported on Windows builds of Warraq.".into())
}

#[cfg(not(windows))]
fn delete_store() -> Result<(), String> {
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStatus {
    saved: bool,
    project_id: Option<String>,
}

#[tauri::command]
pub fn save_connection(project_url: String, publishable_key: String, service_key: String) -> Result<(), String> {
    let project_id = parse_project_id(&project_url).ok_or_else(|| "That is not a hosted Supabase project URL.".to_string())?;
    let publishable_key = publishable_key.trim().to_string();
    let service_key = service_key.trim().to_string();
    if publishable_key.is_empty() || service_key.is_empty() {
        return Err("Both the publishable key and the secret (service role) key are required.".into());
    }
    let entry = Saved { project_id, publishable_key, service_key };
    write_store(&entry)?;
    *cell().write().map_err(|_| "The saved connection is locked.".to_string())? = Some(entry);
    Ok(())
}

#[tauri::command]
pub fn clear_connection() -> Result<(), String> {
    delete_store()?;
    *cell().write().map_err(|_| "The saved connection is locked.".to_string())? = None;
    Ok(())
}

#[tauri::command]
pub fn connection_status() -> ConnectionStatus {
    let current = saved();
    ConnectionStatus { saved: current.is_some(), project_id: current.map(|s| s.project_id) }
}

#[cfg(test)]
mod tests {
    use super::parse_project_id;

    const ID: &str = "abcdefghijklmnopqrst";

    #[test]
    fn accepts_reference_url_and_dashboard_link() {
        assert_eq!(parse_project_id(ID).as_deref(), Some(ID));
        assert_eq!(parse_project_id(&format!("https://{ID}.supabase.co")).as_deref(), Some(ID));
        assert_eq!(parse_project_id(&format!("{ID}.supabase.co/rest/v1/")).as_deref(), Some(ID));
        assert_eq!(parse_project_id(&format!("https://supabase.com/dashboard/project/{ID}/settings/api")).as_deref(), Some(ID));
        assert_eq!(parse_project_id(&format!("  {ID}  ")).as_deref(), Some(ID));
    }

    #[test]
    fn rejects_everything_else() {
        assert_eq!(parse_project_id(""), None);
        assert_eq!(parse_project_id("https://example.com"), None);
        assert_eq!(parse_project_id("https://short.supabase.co"), None);
        assert_eq!(parse_project_id("https://supabase.com/dashboard/projects"), None);
        assert_eq!(parse_project_id("not a url at all"), None);
    }
}
