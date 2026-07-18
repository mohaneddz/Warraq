use tauri::{Emitter, Manager, WindowEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_sql::{Migration, MigrationKind};
use url::Url;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::State;

pub struct TrayConfig(pub AtomicBool);

fn migrations() -> Vec<Migration> {
    vec![
        Migration { version: 1, description: "initial_library_schema", sql: include_str!("../migrations/0001_initial.sql"), kind: MigrationKind::Up },
        Migration { version: 2, description: "library_indexes_and_fts", sql: include_str!("../migrations/0002_indexes.sql"), kind: MigrationKind::Up },
        Migration { version: 3, description: "add_arabic_title_and_tags", sql: include_str!("../migrations/0003_add_arabic_title.sql"), kind: MigrationKind::Up },
    ]
}

#[tauri::command]
fn validate_provider_url(value: String) -> Result<(), String> {
    let url = Url::parse(&value).map_err(|_| "Enter a valid provider URL.")?;
    let local = url.host_str().is_some_and(|host| host == "localhost" || host == "127.0.0.1");
    if url.scheme() != "https" && !local {
        return Err("Provider URLs must use HTTPS (except local development).".into());
    }
    if url.username() != "" || url.password().is_some() {
        return Err("Provider URLs must not contain credentials.".into());
    }
    Ok(())
}

#[tauri::command]
fn application_diagnostics() -> serde_json::Value {
    serde_json::json!({ "database": "sqlite:warraq.db", "mode": "local-first", "secrets": "stronghold" })
}

#[tauri::command]
fn set_close_to_tray(config: State<'_, TrayConfig>, enabled: bool) {
    config.0.store(enabled, Ordering::Relaxed);
}

fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn install_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("show", "Show / Hide Warraq").build(app)?;
    let search = MenuItemBuilder::with_id("search", "Quick Search").build(app)?;
    let checkout = MenuItemBuilder::with_id("checkout", "New Loan").build(app)?;
    let return_book = MenuItemBuilder::with_id("return", "Return Book").build(app)?;
    let settings = MenuItemBuilder::with_id("settings", "Settings").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
    let menu = MenuBuilder::new(app).items(&[&show, &search, &checkout, &return_book, &settings, &quit]).build()?;
    let tray_builder = TrayIconBuilder::with_id("warraq-tray")
        .menu(&menu)
        .tooltip("Warraq");

    let tray_builder = if let Some(icon) = app.default_window_icon() {
        tray_builder.icon(icon.clone())
    } else {
        tray_builder
    };

    tray_builder
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            "show" => focus_main_window(app),
            "search" => { focus_main_window(app); let _ = app.emit("warraq://quick-search", ()); }
            "checkout" => { focus_main_window(app); let _ = app.emit("warraq://navigate", "/circulation"); }
            "return" => { focus_main_window(app); let _ = app.emit("warraq://navigate", "/circulation"); }
            "settings" => { focus_main_window(app); let _ = app.emit("warraq://navigate", "/settings"); }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                focus_main_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:warraq.db", migrations()).build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| focus_main_window(app)))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(TrayConfig(AtomicBool::new(true)));
            let salt = app.path().app_local_data_dir()?.join("stronghold.salt");
            app.handle().plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt).build())?;
            install_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let config = window.try_state::<TrayConfig>();
                let close_to_tray = config.map(|c| c.0.load(Ordering::Relaxed)).unwrap_or(true);
                if close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![validate_provider_url, application_diagnostics, set_close_to_tray])
        .run(tauri::generate_context!())
        .expect("error while running Warraq");
}
