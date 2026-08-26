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
    /// OpenVPN over UDP transport.
    OpenvpnUdp,
    /// OpenVPN over TCP transport.
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
        tls_auth_key: Option<String>,
        tls_crypt_key: Option<String>,
        key_direction: Option<String>,
        remote_cert_tls_server: Option<bool>,
        reneg_sec: Option<u32>,
        ovpn_config: Option<String>,
    },
    /// Raw `.ovpn` configuration text content with optional credentials.
    RawOvpnConfig {
        config_content: String,
        username: Option<String>,
        password: Option<String>,
    },
}

/// Kill Switch operational enforcement mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum KillSwitchMode {
    /// Kill Switch disabled.
    #[default]
    Off,
    /// Auto/Standard: Activates blocking only upon unexpected disconnect / reconnecting.
    Standard,
    /// Strict: Blocks all non-VPN internet traffic completely.
    Strict,
}

fn default_true() -> bool {
    true
}

/// Comprehensive Security and Leak Protection Policy.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityPolicy {
    /// Kill switch enforcement mode.
    #[serde(default)]
    pub kill_switch_mode: KillSwitchMode,
    /// Whether IPv6 blackhole leak protection is enabled.
    #[serde(default = "default_true")]
    pub ipv6_leak_protection: bool,
    /// Whether WebRTC STUN/TURN leak protection is enabled.
    #[serde(default = "default_true")]
    pub webrtc_protection: bool,
    /// Whether Smart Local Network (LAN) bypass is enabled.
    #[serde(default = "default_true")]
    pub lan_bypass: bool,
}

impl Default for SecurityPolicy {
    fn default() -> Self {
        Self {
            kill_switch_mode: KillSwitchMode::Strict,
            ipv6_leak_protection: true,
            webrtc_protection: true,
            lan_bypass: true,
        }
    }
}

/// Routing policy determining whether full-tunnel or intranet-only routes are active.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RoutingPolicy {
    /// "Use this connection only for resources on its network" (Intranet-Only).
    /// If true, overrides server redirect-gateway and only routes pushed corporate subnets.
    #[serde(default)]
    pub intranet_only: bool,
    /// Additional custom corporate subnets/CIDRs to route into VPN (e.g. `["10.0.0.0/8", "192.168.10.0/24"]`).
    #[serde(default)]
    pub custom_subnets: Vec<String>,
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
    /// Whether to enable fail-closed Kill Switch firewall protection (backward compat).
    #[serde(default)]
    pub enable_kill_switch: bool,
    /// Comprehensive security policy.
    #[serde(default)]
    pub security_policy: Option<SecurityPolicy>,
    /// Routing policy (Full Tunnel vs Intranet-Only).
    #[serde(default)]
    pub routing_policy: Option<RoutingPolicy>,
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
    SetKillSwitch {
        enabled: bool,
        #[serde(default)]
        mode: Option<KillSwitchMode>,
    },
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
    /// Whether IPv6 blackhole leak protection is currently active.
    #[serde(default)]
    pub ipv6_protected: bool,
    /// Whether intranet-only (split routing) mode is active.
    #[serde(default)]
    pub intranet_only: bool,
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
