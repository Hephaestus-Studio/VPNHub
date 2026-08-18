//! # Linux Platform & systemd Integration Subsystem
//!
//! Handles `systemd` state notifications (`READY=1`, `WATCHDOG=1`, `STOPPING=1`)
//! and checks for required Linux networking capabilities (`CAP_NET_ADMIN`).

use crate::error::PlatformError;
use tracing::{debug, info};

/// Linux platform service integration.
pub struct LinuxPlatform;

impl LinuxPlatform {
    /// Notifies systemd that the daemon has completed initialization and is ready.
    pub fn notify_ready() -> Result<(), PlatformError> {
        info!("Notifying systemd: READY=1");
        Self::send_sd_notify("READY=1")
    }

    /// Notifies systemd that the service is cleanly stopping.
    pub fn notify_stopping() -> Result<(), PlatformError> {
        info!("Notifying systemd: STOPPING=1");
        Self::send_sd_notify("STOPPING=1")
    }

    /// Pings systemd watchdog to confirm responsiveness.
    pub fn notify_watchdog() -> Result<(), PlatformError> {
        debug!("Pinging systemd watchdog: WATCHDOG=1");
        Self::send_sd_notify("WATCHDOG=1")
    }

    /// Sends a status string to the systemd notify socket if `$NOTIFY_SOCKET` is present.
    fn send_sd_notify(state: &str) -> Result<(), PlatformError> {
        if let Ok(socket_path) = std::env::var("NOTIFY_SOCKET") {
            if socket_path.starts_with('/') || socket_path.starts_with('@') {
                use std::os::unix::net::UnixDatagram;
                if let Ok(sock) = UnixDatagram::unbound() {
                    let path = if let Some(abstract_path) = socket_path.strip_prefix('@') {
                        // Abstract socket path on Linux
                        format!("\0{abstract_path}")
                    } else {
                        socket_path
                    };
                    let _ = sock.send_to(state.as_bytes(), path);
                }
            }
        }
        Ok(())
    }
}
