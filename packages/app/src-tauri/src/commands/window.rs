//! # Tauri Frameless Window Control Commands

use crate::error::AppError;
use tauri::{LogicalPosition, LogicalSize, Manager, Window};

#[tauri::command]
pub async fn window_start_dragging(window: Window) -> Result<(), AppError> {
    window
        .start_dragging()
        .map_err(|e| AppError::Tauri(e.to_string()))
}

#[tauri::command]
pub async fn window_minimize(window: Window) -> Result<(), AppError> {
    window
        .minimize()
        .map_err(|e| AppError::Tauri(e.to_string()))
}

#[tauri::command]
pub async fn window_start_resize_dragging(
    window: Window,
    direction: String,
) -> Result<(), AppError> {
    use tauri_runtime::ResizeDirection;

    let dir = match direction.to_lowercase().as_str() {
        "n" | "north" | "top" => ResizeDirection::North,
        "s" | "south" | "bottom" => ResizeDirection::South,
        "e" | "east" | "right" => ResizeDirection::East,
        "w" | "west" | "left" => ResizeDirection::West,
        "ne" | "northeast" | "topright" => ResizeDirection::NorthEast,
        "nw" | "northwest" | "topleft" => ResizeDirection::NorthWest,
        "se" | "southeast" | "bottomright" => ResizeDirection::SouthEast,
        "sw" | "southwest" | "bottomleft" => ResizeDirection::SouthWest,
        _ => {
            return Err(AppError::Tauri(format!(
                "Invalid resize direction: {}",
                direction
            )))
        }
    };

    window
        .start_resize_dragging(dir)
        .map_err(|e| AppError::Tauri(e.to_string()))
}

#[tauri::command]
pub async fn window_maximize(window: Window) -> Result<(), AppError> {
    window
        .maximize()
        .map_err(|e| AppError::Tauri(e.to_string()))
}

#[tauri::command]
pub async fn window_toggle_maximize(window: Window) -> Result<(), AppError> {
    let is_maximized = window
        .is_maximized()
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    if is_maximized {
        window
            .unmaximize()
            .map_err(|e| AppError::Tauri(e.to_string()))?;
    } else {
        window
            .maximize()
            .map_err(|e| AppError::Tauri(e.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn window_close(window: Window, minimize_to_tray: Option<bool>) -> Result<(), AppError> {
    if minimize_to_tray.unwrap_or(true) {
        window.hide().map_err(|e| AppError::Tauri(e.to_string()))
    } else {
        crate::ipc::client::send_synchronous_disconnect();
        window.app_handle().exit(0);
        Ok(())
    }
}

#[tauri::command]
pub async fn window_show(window: Window) -> Result<(), AppError> {
    window.show().map_err(|e| AppError::Tauri(e.to_string()))?;
    window
        .set_focus()
        .map_err(|e| AppError::Tauri(e.to_string()))
}

#[tauri::command]
pub async fn window_set_size(window: Window, width: f64, height: f64) -> Result<(), AppError> {
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| AppError::Tauri(e.to_string()))
}

#[tauri::command]
pub async fn window_set_position(window: Window, x: f64, y: f64) -> Result<(), AppError> {
    window
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| AppError::Tauri(e.to_string()))
}

#[tauri::command]
pub async fn window_get_geometry(window: Window) -> Result<serde_json::Value, AppError> {
    let size = window
        .inner_size()
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    let pos = window
        .outer_position()
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    let factor = window
        .scale_factor()
        .map_err(|e| AppError::Tauri(e.to_string()))?;

    let logical_size = size.to_logical::<f64>(factor);
    let logical_pos = pos.to_logical::<f64>(factor);

    Ok(serde_json::json!({
        "x": logical_pos.x,
        "y": logical_pos.y,
        "width": logical_size.width,
        "height": logical_size.height,
        "scale_factor": factor,
    }))
}

#[tauri::command]
pub async fn tray_set_status(app: tauri::AppHandle, state: String) -> Result<(), AppError> {
    crate::tray::update_tray_status(&app, &state);
    Ok(())
}
