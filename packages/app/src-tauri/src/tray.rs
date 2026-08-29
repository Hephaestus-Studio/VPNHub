//! # System Tray Configuration for Tauri v2

use std::sync::Mutex;
use tauri::{
    menu::{MenuBuilder, MenuItem, MenuItemBuilder, PredefinedMenuItem},
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
static TOGGLE_MENU_ITEM: Mutex<Option<MenuItem<tauri::Wry>>> = Mutex::new(None);

/// Updates the tray icon, tooltip, and context menu items in-place depending on the current VPN session state.
pub fn update_tray_status<R: Runtime>(app: &AppHandle<R>, state: &str) {
    let state_lower = state.to_lowercase();

    // Prevent tray flickering and redundant D-Bus updates if state hasn't changed
    if let Ok(mut last) = LAST_TRAY_STATE.lock() {
        if last.as_deref() == Some(&state_lower) {
            return;
        }
        *last = Some(state_lower.clone());
    }

    let is_connected = state_lower == "connected";
    let is_connecting = state_lower == "connecting" || state_lower == "reconnecting";

    // 1. Update Menu Item in-place (avoids D-Bus menu detachment on Linux AppIndicator)
    if let Ok(guard) = TOGGLE_MENU_ITEM.lock() {
        if let Some(ref item) = *guard {
            let (toggle_text, toggle_enabled) = if is_connected {
                ("Disconnect", true)
            } else if is_connecting {
                ("Connecting...", false)
            } else if state_lower == "disconnecting" {
                ("Disconnecting...", false)
            } else {
                ("Connect", true)
            };

            let _ = item.set_text(toggle_text);
            let _ = item.set_enabled(toggle_enabled);
        }
    }

    // 2. Update Tray Icon & Tooltip
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
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
    }
}

pub fn setup_system_tray(app: &AppHandle<tauri::Wry>) -> Result<(), Box<dyn std::error::Error>> {
    let toggle_item = MenuItemBuilder::with_id(TOGGLE_ITEM_ID, "Connect")
        .enabled(true)
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

    // Save toggle menu item reference for in-place text & state updates
    if let Ok(mut guard) = TOGGLE_MENU_ITEM.lock() {
        *guard = Some(toggle_item);
    }

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
                crate::ipc::client::send_synchronous_disconnect();
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    info!("System Tray initialized successfully with MenuBuilder and in-place D-Bus updates");
    Ok(())
}
