//! # Error Handling Subsystem
//!
//! Provides strongly-typed error enumerations across all daemon components using `thiserror`.
//! Every domain module has its own specialized error type, rolled up into [`DaemonError`].

use thiserror::Error;

/// Root error type representing any fatal or non-fatal failure within the VPNHub Daemon.
#[derive(Debug, Error)]
pub enum DaemonError {
    /// An error occurred within the Inter-Process Communication subsystem.
    #[error("IPC error: {0}")]
    Ipc(#[from] IpcError),

    /// An error occurred within a VPN driver adapter (OpenVPN / WireGuard).
    #[error("VPN driver error: {0}")]
    Driver(#[from] DriverError),

    /// An error occurred during network, routing, or interface manipulation.
    #[error("Network error: {0}")]
    Network(#[from] NetworkError),

    /// An error occurred during firewall or Kill Switch configuration.
    #[error("Firewall error: {0}")]
    Firewall(#[from] FirewallError),

    /// An error occurred during DNS server configuration or leak protection.
    #[error("DNS error: {0}")]
    Dns(#[from] DnsError),

    /// An error occurred during health probing, DPD, or telemetry collection.
    #[error("Health check error: {0}")]
    Health(#[from] HealthError),

    /// An error occurred within the OS service lifecycle or platform subsystem.
    #[error("Platform service error: {0}")]
    Platform(#[from] PlatformError),

    /// General I/O failure.
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    /// Serialization or deserialization failure.
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// An operation was attempted in an invalid state.
    #[error("Invalid state transition: {0}")]
    InvalidState(String),

    /// General internal error with message.
    #[error("Internal daemon error: {0}")]
    Internal(String),
}

/// Errors originating from the IPC transport, codec, or authentication layers.
#[derive(Debug, Error)]
pub enum IpcError {
    /// Failed to bind or listen on the IPC endpoint (Unix socket / Named pipe).
    #[error("Failed to bind IPC endpoint '{endpoint}': {source}")]
    BindFailed {
        endpoint: String,
        #[source]
        source: std::io::Error,
    },

    /// Caller failed authentication or does not possess the required privileges.
    #[error("Peer authorization rejected: {0}")]
    Unauthorized(String),

    /// Failed to query peer credentials from socket (SO_PEERCRED / pipe token).
    #[error("Failed to obtain peer credentials: {0}")]
    AuthInspectionFailed(String),

    /// Received frame exceeded the maximum allowable size (anti-DoS guard).
    #[error("Frame size {size} exceeds maximum allowable limit of {max_size} bytes")]
    FrameTooLarge { size: usize, max_size: usize },

    /// Codec decoding error (malformed frame or invalid length prefix).
    #[error("Codec protocol decoding failure: {0}")]
    ProtocolCodec(String),

    /// Client connection unexpectedly closed or broken pipe.
    #[error("Client IPC connection closed: {0}")]
    ConnectionClosed(String),

    /// Underlying I/O error during IPC communication.
    #[error("IPC I/O error: {0}")]
    Io(#[from] std::io::Error),
}

/// Errors originating from VPN Protocol Drivers (OpenVPN / WireGuard).
#[derive(Debug, Error)]
pub enum DriverError {
    /// Failed to initialize or start the VPN driver.
    #[error("Failed to start VPN driver: {0}")]
    InitializationFailed(String),

    /// Handshake or connection timeout.
    #[error("VPN connection timed out after {timeout_secs}s")]
    ConnectionTimeout { timeout_secs: u64 },

    /// Authentication rejected by the remote VPN server.
    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),

    /// Virtual interface configuration failed inside driver.
    #[error("Interface configuration error: {0}")]
    InterfaceError(String),

    /// Driver process terminated unexpectedly or crashed.
    #[error("VPN driver process crashed or exited unexpectedly: {0}")]
    ProcessTerminated(String),

    /// Driver does not support the requested profile or protocol.
    #[error("Unsupported driver operation: {0}")]
    Unsupported(String),
}

/// Errors originating from virtual interface allocation, MTU discovery, or IP routing.
#[derive(Debug, Error)]
pub enum NetworkError {
    /// Failed to create, allocate, or open the virtual TUN/Wintun device.
    #[error("Failed to allocate virtual interface '{name}': {source}")]
    InterfaceAllocationFailed {
        name: String,
        #[source]
        source: std::io::Error,
    },

    /// Failed to configure IP address or netmask on virtual device.
    #[error("Failed to set IP address '{ip}' on interface '{iface}': {details}")]
    IpConfigurationFailed {
        iface: String,
        ip: String,
        details: String,
    },

    /// Route table manipulation failed (e.g. Netlink / IPHLPAPI).
    #[error("Failed to manipulate routing table: {0}")]
    RoutingFailed(String),

    /// Failed to query or preserve the original default gateway.
    #[error("Failed to detect original default gateway: {0}")]
    GatewayDiscoveryFailed(String),

    /// Device MTU discovery or configuration failed.
    #[error("Failed to configure MTU ({mtu}) on '{iface}': {details}")]
    MtuConfigurationFailed {
        iface: String,
        mtu: u32,
        details: String,
    },
}

/// Errors originating from the Firewall / Kill Switch engine.
#[derive(Debug, Error)]
pub enum FirewallError {
    /// nftables rule creation or transaction failed on Linux.
    #[error("nftables execution failed: {0}")]
    NftablesFailed(String),

    /// iptables legacy fallback rule creation failed.
    #[error("iptables execution failed: {0}")]
    IptablesFailed(String),

    /// Windows Filtering Platform (WFP) API error.
    #[error("WFP sublayer/filter error: {0}")]
    WfpFailed(String),

    /// Failed to clean up or rollback firewall rules.
    #[error("Firewall rollback cleanup failed: {0}")]
    RollbackFailed(String),
}

/// Errors originating from DNS configuration and leak protection.
#[derive(Debug, Error)]
pub enum DnsError {
    /// systemd-resolved D-Bus call failed.
    #[error("systemd-resolved D-Bus call failed: {0}")]
    SystemdResolvedFailed(String),

    /// NetworkManager D-Bus call failed.
    #[error("NetworkManager DNS configuration failed: {0}")]
    NetworkManagerFailed(String),

    /// Failed to atomically update or restore /etc/resolv.conf.
    #[error("resolv.conf file manipulation failed: {0}")]
    ResolvConfFailed(String),

    /// Windows Name Resolution Policy Table (NRPT) rule injection failed.
    #[error("Windows NRPT rule configuration failed: {0}")]
    NrptFailed(String),
}

/// Errors originating from health checks, probes, and telemetry.
#[derive(Debug, Error)]
pub enum HealthError {
    /// DPD (Dead Peer Detection) probe failed consecutively.
    #[error("Dead Peer Detection (DPD) probe failed: gateway unresponsive ({failures} consecutive misses)")]
    DpdFailure { failures: u32 },

    /// Failed to query network device byte counters.
    #[error("Failed to query telemetry counters: {0}")]
    MetricsQueryFailed(String),
}

/// Errors originating from platform-specific daemon/service integration.
#[derive(Debug, Error)]
pub enum PlatformError {
    /// systemd notification failed.
    #[error("systemd sd_notify error: {0}")]
    SystemdNotifyFailed(String),

    /// Windows SCM service control error.
    #[error("Windows Service Control Manager error: {0}")]
    WindowsServiceFailed(String),

    /// Insufficient OS capabilities or privileges.
    #[error("Insufficient privileges: {0}")]
    PrivilegeCheckFailed(String),
}
