//! # Background IPC Health & Event Monitor Worker

use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tracing::{debug, info};

use crate::ipc::client::DaemonClient;
use vpnhub_daemon::ipc::protocol::DaemonRequest;

/// Background task that monitors Daemon health and pushes updates to the React UI.
pub async fn start_ipc_monitor_worker(app_handle: AppHandle, client: Arc<DaemonClient>) {
    info!("Starting Tauri Background IPC Monitor Worker");

    let mut interval = tokio::time::interval(Duration::from_millis(1000));
    let mut was_online = false;
    let mut first_tick = true;

    loop {
        interval.tick().await;

        let is_alive = client.ping().await;

        if is_alive != was_online || first_tick {
            first_tick = false;
            was_online = is_alive;
            let status_str = if is_alive { "connected" } else { "offline" };
            debug!("Daemon health state: {}", status_str);

            let _ = app_handle.emit("daemon-status", status_str);
        }

        // If daemon is online, fetch metrics and snapshot
        if is_alive {
            if let Ok(response) = client.send_request(DaemonRequest::GetStatus).await {
                let _ = app_handle.emit("vpn-status-update", response);
            }

            if let Ok(response) = client.send_request(DaemonRequest::GetMetrics).await {
                let _ = app_handle.emit("vpn-metrics-update", response);
            }
        }
    }
}
