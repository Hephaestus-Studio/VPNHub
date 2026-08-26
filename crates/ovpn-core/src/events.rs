//! Event broadcast definitions and statistics tracking for client sessions.

use ovpn_config::network_config::NetworkProvisioningConfig;
use ovpn_protocol::{AuthChallenge, EngineState};
use serde::{Deserialize, Serialize};

/// Real-time statistics for the active OpenVPN session.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct SessionStats {
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub packets_in: u64,
    pub packets_out: u64,
    pub uptime_secs: u64,
}

/// Asynchronous events emitted by the OpenVPN client pipeline.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SessionEvent {
    /// Protocol state transitioned.
    StateChanged(EngineState),

    /// Host network configuration (IPs, routes, DNS) parsed from PUSH_REPLY.
    NetworkConfigured(NetworkProvisioningConfig),

    /// Server requested dynamic authentication (OTP, Web SSO).
    AuthChallenge(AuthChallenge),

    /// Periodic throughput / traffic telemetry statistics.
    StatsUpdated(SessionStats),

    /// Session gracefully disconnected.
    Disconnected { reason: String },

    /// Unrecoverable error encountered during connection.
    Error { message: String },
}
