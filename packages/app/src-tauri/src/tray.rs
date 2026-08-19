//! # System Tray Configuration for Tauri v2

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use tracing::info;

pub const TRAY_ID: &str = "main_tray";

/// Updates the tray icon and tooltip depending on the current VPN session state.
pub fn update_tray_status(app: &AppHandle, state: &str) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let state_lower = state.to_lowercase();
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
    }
}

pub fn setup_system_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "Open VPNHub", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "Hide to Tray", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit VPNHub", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

    let icon_bytes = include_bytes!("../icons/tray_disconnected.png");
    let icon = tauri::image::Image::from_bytes(icon_bytes)
        .unwrap_or_else(|_| app.default_window_icon().unwrap().clone());

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("VPNHub: Disconnected (Unprotected)")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => {
                info!("Quit triggered from System Tray Menu");
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let is_visible = window.is_visible().unwrap_or(false);
                    if is_visible {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    info!("System Tray initialized successfully with dynamic state icons");
    Ok(())
}
