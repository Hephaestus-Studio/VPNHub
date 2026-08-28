//! # System Tray Configuration for Tauri v2

use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Runtime,
};
use tracing::info;

pub const TRAY_ID: &str = "main_tray";

pub const STATUS_ITEM_ID: &str = "tray_status";
pub const TOGGLE_ITEM_ID: &str = "tray_toggle";
pub const SHOW_ITEM_ID: &str = "tray_show";
pub const QUIT_ITEM_ID: &str = "tray_quit";

static LAST_TRAY_STATE: Mutex<Option<String>> = Mutex::new(None);

/// Builds the system tray menu according to the current VPN session state.
pub fn build_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    state: &str,
) -> Result<Menu<R>, Box<dyn std::error::Error>> {
    let state_lower = state.to_lowercase();
    let is_connected = state_lower == "connected";
    let is_connecting = state_lower == "connecting" || state_lower == "reconnecting";

    let (toggle_text, toggle_enabled) = if is_connected {
        ("Disconnect", true)
    } else if is_connecting {
        ("Connecting...", false)
    } else if state_lower == "disconnecting" {
        ("Disconnecting...", false)
    } else {
        ("Connect", true)
    };

    let toggle_item = MenuItemBuilder::with_id(TOGGLE_ITEM_ID, toggle_text)
        .enabled(toggle_enabled)
        .build(app)?;

    let show_item = MenuItemBuilder::with_id(SHOW_ITEM_ID, "Open VPNHub")
        .enabled(true)
        .build(app)?;

    let separator = PredefinedMenuItem::separator(app)?;

    let quit_item = MenuItemBuilder::with_id(QUIT_ITEM_ID, "Quit")
        .enabled(true)
        .build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&toggle_item, &show_item, &separator, &quit_item])
        .build()?;

    Ok(menu)
}

/// Updates the tray icon, tooltip, and context menu depending on the current VPN session state.
pub fn update_tray_status<R: Runtime>(app: &AppHandle<R>, state: &str) {
    let state_lower = state.to_lowercase();

    // Prevent tray flickering by skipping redundant menu rebuilds and icon resets if state hasn't changed
    if let Ok(mut last) = LAST_TRAY_STATE.lock() {
        if last.as_deref() == Some(&state_lower) {
            return;
        }
        *last = Some(state_lower.clone());
    }

    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let is_connected = state_lower == "connected";
        let is_connecting = state_lower == "connecting" || state_lower == "reconnecting";

        let icon_bytes = if is_connected {
            include_bytes!("../icons/tray_connected.png").as_slice()
        } else if is_connecting {
            include_bytes!("../icons/tray_connecting.png").as_slice()
        } else {
            include_bytes!("../icons/tray_disconnected.png").as_slice()
        };

        if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
            let _ = tray.set_icon(Some(icon));
        }

        let tooltip = match state_lower.as_str() {
            "connected" => "VPNHub: Connected & Protected (Tunnel Active)",
            "connecting" => "VPNHub: Connecting to VPN Gateway...",
            "reconnecting" => "VPNHub: Reconnecting VPN tunnel...",
            "disconnecting" => "VPNHub: Disconnecting...",
            "error" => "VPNHub: Connection Error",
            _ => "VPNHub: Disconnected (Unprotected)",
        };
        let _ = tray.set_tooltip(Some(tooltip));

        // Dynamically update tray menu items
        if let Ok(menu) = build_tray_menu(app, state) {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

pub fn setup_system_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let menu = build_tray_menu(app, "disconnected")?;

    let icon_bytes = include_bytes!("../icons/tray_disconnected.png");
    let icon = tauri::image::Image::from_bytes(icon_bytes)
        .unwrap_or_else(|_| app.default_window_icon().unwrap().clone());

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("VPNHub: Disconnected (Unprotected)")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            SHOW_ITEM_ID => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            TOGGLE_ITEM_ID => {
                info!("Quick Toggle VPN triggered from System Tray");
                let _ = app.emit("vpn:tray-toggle", ());
            }
            QUIT_ITEM_ID => {
                info!("Quit triggered from System Tray Menu");
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    info!("System Tray initialized successfully with MenuBuilder and dynamic state updates");
    Ok(())
}
