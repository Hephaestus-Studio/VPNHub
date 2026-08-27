//! # VPNHub Background Daemon (`vpnhub-daemon`)
//!
//! High-privilege background daemon responsible for network routing, virtual interface allocation,
//! fail-closed Kill Switch firewall enforcement, multi-tiered DNS leak protection, multi-protocol
//! VPN tunnel drivers (OpenVPN 3 Core / WireGuard), and secure IPC transport.

pub mod config;
pub mod core;
pub mod engine;
pub mod error;
pub mod health;
pub mod ipc;
pub mod network;
pub mod platform;
pub mod security;

use clap::Parser;
use std::sync::Arc;
use tracing::{error, info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::config::{DaemonConfig, LOG_RING_BUFFER_CAPACITY};
use crate::core::DaemonOrchestrator;
use crate::ipc::IpcServer;
use crate::platform::PlatformService;
use crate::security::LogRingBuffer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 1. Parse CLI arguments
    let config = DaemonConfig::parse();

    #[cfg(target_os = "windows")]
    if config.service_mode {
        if let Err(e) = crate::platform::windows::WindowsPlatform::run_service() {
            eprintln!("Failed to start Windows Service: {}", e);
        }
        return Ok(());
    }

    // 2. Initialize structured logging
    init_logging(&config);

    info!(
        "Starting VPNHub Daemon v{} [PID: {}]",
        env!("CARGO_PKG_VERSION"),
        std::process::id()
    );

    // 3. Initialize in-memory sanitized circular log buffer
    let ring_buffer = Arc::new(LogRingBuffer::new(LOG_RING_BUFFER_CAPACITY));

    // 4. Initialize Core Orchestrator
    let orchestrator = Arc::new(DaemonOrchestrator::new(ring_buffer.clone()));

    // 5. Setup panic hook with emergency rollback safety
    let panic_orchestrator = orchestrator.clone();
    std::panic::set_hook(Box::new(move |info| {
        error!("CRITICAL PANIC ENCOUNTERED: {}", info);
        // Synchronous best-effort rollback on panic
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                warn!("Executing emergency panic rollback in orchestrator");
                let _ = panic_orchestrator.disconnect().await;
            });
        });
    }));

    // 6. Notify OS service manager (systemd / Windows SCM)
    let _ = PlatformService::notify_ready();

    // 7. Create IPC Server
    let ipc_server = IpcServer::new(config.clone(), orchestrator.clone());

    // 8. Run server with graceful signal trap
    tokio::select! {
        res = ipc_server.run() => {
            if let Err(e) = res {
                error!("IPC server error: {}", e);
            }
        }
        _ = wait_for_shutdown_signal() => {
            info!("Shutdown signal received; initiating graceful termination sequence");
        }
    }

    // 9. Graceful teardown
    let _ = PlatformService::notify_stopping();
    info!("Disconnecting active VPN sessions and restoring network state...");
    let _ = orchestrator.disconnect().await;
    info!("VPNHub Daemon stopped cleanly. Goodbye!");

    Ok(())
}

/// Configures tracing subscriber with optional JSON formatting and level filtering.
fn init_logging(config: &DaemonConfig) {
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(&config.log_level));

    if config.json_logs {
        tracing_subscriber::registry()
            .with(filter)
            .with(tracing_subscriber::fmt::layer().json())
            .init();
    } else {
        tracing_subscriber::registry()
            .with(filter)
            .with(
                tracing_subscriber::fmt::layer()
                    .with_target(false)
                    .compact(),
            )
            .init();
    }
}

/// Listens for OS termination signals (Ctrl+C, SIGTERM, SIGHUP).
async fn wait_for_shutdown_signal() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{signal, SignalKind};

        let mut sigterm =
            signal(SignalKind::terminate()).expect("failed to install SIGTERM handler");
        let mut sigint = signal(SignalKind::interrupt()).expect("failed to install SIGINT handler");

        tokio::select! {
            _ = sigterm.recv() => {
                info!("Received SIGTERM signal");
            }
            _ = sigint.recv() => {
                info!("Received SIGINT signal");
            }
            _ = tokio::signal::ctrl_c() => {
                info!("Received Ctrl+C signal");
            }
        }
    }

    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
        info!("Received Ctrl+C signal on Windows");
    }
}
