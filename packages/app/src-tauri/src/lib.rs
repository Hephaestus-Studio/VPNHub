//! # VPNHub Desktop Client Backend (`src-tauri`)

pub mod commands;
pub mod error;
pub mod ipc;
pub mod storage;
pub mod tray;

use std::sync::Arc;
use tauri::Manager;
use tracing::{error, info};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::commands::*;
use crate::ipc::{start_ipc_monitor_worker, DaemonClient};
use crate::storage::StorageManager;
use crate::tray::setup_system_tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 1. Initialize structured logging
    let _ = tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,vpnhub=debug")),
        )
        .with(tracing_subscriber::fmt::layer())
        .try_init();

    info!("Starting VPNHub Desktop Tauri Client");

    // 2. Initialize Daemon IPC Client
    let daemon_client = Arc::new(DaemonClient::new());

    // 3. Initialize Persistent Encrypted Storage
    let storage_manager = match StorageManager::new() {
        Ok(mgr) => Arc::new(mgr),
        Err(e) => {
            error!("Fatal: Failed to initialize persistent storage: {}", e);
            panic!("Failed to initialize storage: {}", e);
        }
    };

    // 4. Build Tauri Application
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .manage(daemon_client.clone())
        .manage(storage_manager.clone())
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // Check if application was launched with minimized/background flag
            let is_minimized_arg = std::env::args().any(|arg| {
                arg == "--minimized" || arg == "-m" || arg == "--hidden" || arg == "--background"
            });
            if is_minimized_arg {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            // Setup System Tray
            if let Err(e) = setup_system_tray(&app_handle) {
                tracing::warn!("Failed to setup system tray: {}", e);
            }

            // Spawn Background IPC Monitor Worker
            let client = daemon_client.clone();
            tauri::async_runtime::spawn(async move {
                start_ipc_monitor_worker(app_handle, client).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            vpn_connect,
            vpn_disconnect,
            get_daemon_status,
            get_metrics,
            set_kill_switch,
            ping_daemon,
            ping_server,
            window_start_dragging,
            window_start_resize_dragging,
            window_minimize,
            window_maximize,
            window_toggle_maximize,
            window_close,
            window_show,
            window_set_size,
            window_set_position,
            window_get_geometry,
            storage_load_all,
            storage_save_profile,
            storage_delete_profile,
            storage_save_security_settings,
            storage_save_split_rules,
            read_text_file,
            tray_set_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
