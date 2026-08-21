//! # Multi-Protocol VPN Engine Subsystem
//!
//! Exposes the [`VpnDriver`] abstraction for uniform lifecycle control
//! over OpenVPN 3 C++ Core and WireGuard tunnel engines.

pub mod openvpn;
pub mod wireguard;

use async_trait::async_trait;
use tokio::sync::mpsc;

use crate::error::DriverError;
use crate::ipc::protocol::{BandwidthMetrics, SessionState};

/// Event stream emitted by low-level drivers during operation.
#[derive(Debug)]
pub enum DriverEvent {
    /// Driver transitioned its state.
    StateChanged(SessionState),
    /// Real-time traffic metrics updated.
    Metrics(BandwidthMetrics),
    /// Driver emitted a log message.
    Log { level: String, message: String },
    /// Driver encountered an unrecoverable failure.
    FatalError(DriverError),
}

/// Abstract contract implemented by all VPN protocol backends.
#[async_trait]
pub trait VpnDriver: Send + Sync {
    /// Starts the VPN driver, establishes tunnel, and streams runtime events.
    async fn start(&mut self, event_sender: mpsc::Sender<DriverEvent>) -> Result<(), DriverError>;

    /// Gracefully stops the VPN driver and tears down the tunnel.
    async fn stop(&mut self) -> Result<(), DriverError>;

    /// Queries real-time bandwidth metrics directly from the driver/interface.
    async fn query_metrics(&self) -> Result<BandwidthMetrics, DriverError>;

    /// Returns the virtual network interface name (e.g. `tun0`, `wintun0`).
    fn interface_name(&self) -> &str;

    /// Returns the assigned IPv4 tunnel address if known.
    fn assigned_ip(&self) -> Option<String>;

    /// Returns any intranet / host routes pushed by server or discovered in configuration.
    fn pushed_routes(&self) -> Vec<String> {
        Vec::new()
    }
}
