//! # Active VPN Session Context
//!
//! Stores active connection profile details, assigned virtual interface identifiers,
//! tunnel IP addresses, and DNS server configuration.

use crate::ipc::protocol::{ConnectParams, ProtocolType};

/// In-memory context for an active VPN session.
#[derive(Debug, Clone)]
pub struct ActiveSession {
    /// Identifier of the active profile.
    pub profile_id: String,
    /// Protocol type.
    pub protocol: ProtocolType,
    /// Remote server endpoint.
    pub server_endpoint: String,
    /// Remote server port.
    pub server_port: u16,
    /// Allocated virtual interface name (e.g. `tun0`, `wintun0`).
    pub interface_name: String,
    /// Assigned IPv4 address inside tunnel.
    pub assigned_ip: Option<String>,
    /// Active DNS server IPs.
    pub dns_servers: Vec<String>,
    /// Whether Kill Switch fail-closed rules are enabled for this session.
    pub kill_switch_enabled: bool,
    /// Connection timestamp (Unix epoch seconds).
    pub connected_at_epoch_secs: u64,
}

impl ActiveSession {
    /// Creates a new active session from connection parameters and interface details.
    pub fn new(
        params: &ConnectParams,
        interface_name: String,
        assigned_ip: Option<String>,
    ) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Self {
            profile_id: params.profile_id.clone(),
            protocol: params.protocol,
            server_endpoint: params.server_endpoint.clone(),
            server_port: params.server_port,
            interface_name,
            assigned_ip,
            dns_servers: Vec::new(),
            kill_switch_enabled: params.enable_kill_switch,

            connected_at_epoch_secs: now,
        }
    }
}
