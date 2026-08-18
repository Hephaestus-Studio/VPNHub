//! # Daemon Configuration Subsystem
//!
//! Defines global runtime parameters, filesystem paths, socket names,
//! timeouts, and telemetry sampling intervals used across the daemon.

use clap::Parser;
use std::path::PathBuf;

/// Default Unix domain socket path on Linux.
pub const DEFAULT_LINUX_SOCKET_PATH: &str = "/run/vpnhub/vpnhub.sock";

/// Default Windows Named Pipe name.
pub const DEFAULT_WINDOWS_PIPE_NAME: &str = r"\\.\pipe\vpnhub-daemon";

/// Maximum allowed IPC frame size in bytes (16 MiB) to guard against buffer exhaustion.
pub const MAX_IPC_FRAME_SIZE: usize = 16 * 1024 * 1024;

/// Capacity of the in-memory circular log ring buffer for live streaming and diagnostics.
pub const LOG_RING_BUFFER_CAPACITY: usize = 500;

/// Default DPD (Dead Peer Detection) probe interval in seconds.
pub const DEFAULT_DPD_INTERVAL_SECS: u64 = 10;

/// Default DPD consecutive failure threshold before declaring a dead peer.
pub const DEFAULT_DPD_MAX_FAILURES: u32 = 3;

/// Default telemetry sampling interval in milliseconds.
pub const DEFAULT_METRICS_INTERVAL_MS: u64 = 1000;

/// Command-line arguments and configuration settings for the VPNHub Daemon.
#[derive(Debug, Clone, Parser)]
#[command(name = "vpnhub-daemon", version, about = "VPNHub Daemon Service")]
pub struct DaemonConfig {
    /// Custom path for the Unix Domain Socket (Linux) or Pipe Name (Windows).
    #[arg(
        long,
        env = "VPNHUB_SOCKET_PATH",
        default_value = DEFAULT_LINUX_SOCKET_PATH
    )]
    pub socket_path: PathBuf,

    /// Group name authorized to communicate with the daemon on Linux (default: "vpnhub").
    #[arg(long, env = "VPNHUB_AUTH_GROUP", default_value = "vpnhub")]
    pub auth_group: String,

    /// Logging level filter (trace, debug, info, warn, error).
    #[arg(long, env = "VPNHUB_LOG_LEVEL", default_value = "info")]
    pub log_level: String,

    /// Run as a background service (signals systemd notify or registers Windows SCM).
    #[arg(long, env = "VPNHUB_SERVICE_MODE", default_value_t = false)]
    pub service_mode: bool,

    /// Enable JSON formatted output on stdout (recommended for production systemd/journald).
    #[arg(long, env = "VPNHUB_JSON_LOGS", default_value_t = false)]
    pub json_logs: bool,

    /// Dead Peer Detection interval in seconds.
    #[arg(long, env = "VPNHUB_DPD_INTERVAL", default_value_t = DEFAULT_DPD_INTERVAL_SECS)]
    pub dpd_interval_secs: u64,

    /// Telemetry metrics refresh interval in milliseconds.
    #[arg(long, env = "VPNHUB_METRICS_INTERVAL", default_value_t = DEFAULT_METRICS_INTERVAL_MS)]
    pub metrics_interval_ms: u64,
}

impl Default for DaemonConfig {
    fn default() -> Self {
        Self {
            socket_path: PathBuf::from(DEFAULT_LINUX_SOCKET_PATH),
            auth_group: "vpnhub".to_string(),
            log_level: "info".to_string(),
            service_mode: false,
            json_logs: false,
            dpd_interval_secs: DEFAULT_DPD_INTERVAL_SECS,
            metrics_interval_ms: DEFAULT_METRICS_INTERVAL_MS,
        }
    }
}
