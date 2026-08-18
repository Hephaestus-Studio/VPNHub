//! # IPC Protocol Data Transfer Objects (DTOs)
//!
//! Defines strongly typed Request, Response, and real-time Server-Push Event schemas
//! serialized via length-prefixed JSON frames across Unix sockets and Windows named pipes.

use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// VPN connection lifecycle state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum SessionState {
    /// No VPN session active; network interfaces in native state.
    #[default]
    Disconnected,
    /// Establishing tunnel, verifying certificates/keys, configuring virtual NIC.
    Connecting,
    /// Tunnel fully established; routing and DNS protections active.
    Connected,
    /// Transient network interruption; auto-reconnection in progress.
    Reconnecting,
    /// Teardown in progress; releasing IP routes, DNS and firewall rules.
    Disconnecting,
    /// Unrecoverable failure occurred during connection or teardown.
    Error,
}

/// Supported VPN tunneling protocols.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProtocolType {
    /// WireGuard (Kernel on Linux, Wintun/BoringTun on Windows).
    Wireguard,
    /// OpenVPN 3 C++ Core over UDP transport.
    OpenvpnUdp,
    /// OpenVPN 3 C++ Core over TCP transport.
    OpenvpnTcp,
}

/// Authentication credentials and cryptographic keys for initiating a VPN session.
#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(tag = "auth_type", rename_all = "snake_case")]
pub enum AuthConfig {
    /// WireGuard public/private keypair.
    WireguardKey {
        /// Base64-encoded WireGuard private key.
        private_key: String,
        /// Optional pre-shared symmetric key for post-quantum resistance.
        preshared_key: Option<String>,
    },
    /// OpenVPN Username / Password credentials with optional certificates and base .ovpn content.
    UserPassword {
        username: String,
        password: String,
        ca_cert: Option<String>,
        client_cert: Option<String>,
        client_key: Option<String>,
        ovpn_config: Option<String>,
    },
    /// Raw `.ovpn` configuration text content with optional credentials.
    RawOvpnConfig {
        config_content: String,
        username: Option<String>,
        password: Option<String>,
    },
}

/// Client parameters supplied when requesting a new connection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectParams {
    /// Human-readable profile or server identifier.
    pub profile_id: String,
    /// Tunnel protocol to establish.
    pub protocol: ProtocolType,
    /// Remote VPN server hostname or IPv4/IPv6 address.
    pub server_endpoint: String,
    /// Remote VPN server listening port.
    pub server_port: u16,
    /// Secret authentication payload.
    pub auth_config: AuthConfig,
    /// Whether to enable fail-closed Kill Switch firewall protection.
    pub enable_kill_switch: bool,
    /// Custom DNS server IPs (e.g. `["1.1.1.1", "1.0.0.1"]`) to enforce in tunnel.
    pub custom_dns: Option<Vec<String>>,
}

/// Split tunneling configuration options.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitTunnelConfig {
    /// Include only or exclude specified routes/apps.
    pub mode: SplitTunnelMode,
    /// Subnets/IP addresses (CIDR notation).
    pub ip_subnets: Vec<String>,
    /// Application paths or binary identifiers.
    pub app_paths: Vec<String>,
}

/// Split tunneling operational mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SplitTunnelMode {
    /// Route ONLY specified subnets/apps via VPN; all else direct to physical interface.
    IncludeOnly,
    /// Route ALL traffic via VPN EXCEPT specified subnets/apps.
    Exclude,
}

/// Inbound requests from client applications (GUI / CLI) to the Daemon.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", content = "params", rename_all = "snake_case")]
pub enum DaemonRequest {
    /// Connect to a VPN server profile.
    Connect(ConnectParams),
    /// Disconnect active VPN session.
    Disconnect { force: bool },
    /// Retrieve current daemon snapshot.
    GetStatus,
    /// Retrieve latest bandwidth telemetry and RTT counters.
    GetMetrics,
    /// Dynamically toggle Kill Switch firewall state.
    SetKillSwitch { enabled: bool },
    /// Apply split tunneling policy.
    SetSplitTunneling(SplitTunnelConfig),
    /// Export system network diagnostics (routes, DNS, firewall, recent logs).
    GetDiagnostics,
    /// Ping the daemon to verify IPC connectivity.
    Ping,
}

/// Outbound synchronous responses from Daemon back to the caller.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", content = "result", rename_all = "snake_case")]
pub enum DaemonResponse {
    /// Action succeeded with no additional return payload.
    Success,
    /// Pong response for IPC keepalive.
    Pong,
    /// Current daemon status snapshot.
    Status(DaemonStatusSnapshot),
    /// Latest real-time network metrics.
    Metrics(BandwidthMetrics),
    /// System diagnostic report for troubleshooting.
    Diagnostics(DiagnosticReport),
    /// Request failed with an error code and descriptive message.
    Error { code: u32, message: String },
}

/// Real-time asynchronous push events streamed to all connected clients.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data", rename_all = "snake_case")]
pub enum DaemonEvent {
    /// Session state transition.
    StateChanged {
        previous: SessionState,
        current: SessionState,
        reason: Option<String>,
    },
    /// Periodic traffic counters and throughput rates.
    MetricsUpdate(BandwidthMetrics),
    /// Real-time sanitized log message.
    LogLine {
        level: String,
        target: String,
        message: String,
        timestamp_ms: i64,
    },
    /// Health alert or warning notification.
    Alert {
        severity: AlertSeverity,
        code: u32,
        message: String,
    },
}

/// Comprehensive status snapshot of the background daemon.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DaemonStatusSnapshot {
    /// Current connection state.
    pub state: SessionState,
    /// Active profile identifier if connected.
    pub active_profile: Option<String>,
    /// Assigned tunnel IP address (e.g. `10.8.0.2`).
    pub assigned_ip: Option<String>,
    /// Virtual network interface device name (e.g. `tun0`, `wintun0`).
    pub virtual_interface: Option<String>,
    /// Whether Kill Switch fail-closed rules are actively blocking leaks.
    pub kill_switch_active: bool,
    /// Active DNS servers assigned to the tunnel.
    pub dns_servers: Vec<String>,
    /// Uptime in seconds of the current active session.
    pub session_duration_secs: u64,
}

/// Real-time throughput and byte counter telemetry.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BandwidthMetrics {
    /// Cumulative bytes received on tunnel interface.
    pub rx_bytes: u64,
    /// Cumulative bytes transmitted on tunnel interface.
    pub tx_bytes: u64,
    /// Current download rate in bytes per second.
    pub rx_rate_bps: f64,
    /// Current upload rate in bytes per second.
    pub tx_rate_bps: f64,
    /// Round-trip latency to VPN gateway in milliseconds.
    pub latency_rtt_ms: Option<u32>,
    /// Uptime in seconds.
    pub uptime_seconds: u64,
}

/// Alert severity level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AlertSeverity {
    Info,
    Warning,
    Critical,
}

/// System diagnostic report exported for technical support.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DiagnosticReport {
    /// Current OS IP routing table dump.
    pub routing_table: String,
    /// Current OS DNS resolver configuration.
    pub dns_configuration: String,
    /// Current firewall rules (nftables / WFP).
    pub firewall_rules: String,
    /// Recent sanitized daemon logs from circular buffer.
    pub recent_logs: Vec<String>,
}
