//! Strongly-typed OpenVPN configuration models and directives AST.

use crate::network_config::{Ipv4Route, Ipv6Route, NetworkTopology, RedirectGatewayFlags};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::time::Duration;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Transport protocol used for OpenVPN connection.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum Protocol {
    #[default]
    Udp,
    Tcp,
    Udp4,
    Udp6,
    Tcp4,
    Tcp6,
    TcpClient,
    TcpServer,
}

impl Protocol {
    pub fn is_tcp(&self) -> bool {
        matches!(
            self,
            Protocol::Tcp
                | Protocol::Tcp4
                | Protocol::Tcp6
                | Protocol::TcpClient
                | Protocol::TcpServer
        )
    }

    pub fn is_udp(&self) -> bool {
        matches!(self, Protocol::Udp | Protocol::Udp4 | Protocol::Udp6)
    }

    pub fn is_ipv6(&self) -> bool {
        matches!(self, Protocol::Udp6 | Protocol::Tcp6)
    }
}

impl std::str::FromStr for Protocol {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_ascii_lowercase().as_str() {
            "udp" => Ok(Protocol::Udp),
            "tcp" => Ok(Protocol::Tcp),
            "udp4" => Ok(Protocol::Udp4),
            "udp6" => Ok(Protocol::Udp6),
            "tcp4" => Ok(Protocol::Tcp4),
            "tcp6" => Ok(Protocol::Tcp6),
            "tcp-client" => Ok(Protocol::TcpClient),
            "tcp-server" => Ok(Protocol::TcpServer),
            _ => Err(()),
        }
    }
}

impl fmt::Display for Protocol {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Protocol::Udp => write!(f, "udp"),
            Protocol::Tcp => write!(f, "tcp"),
            Protocol::Udp4 => write!(f, "udp4"),
            Protocol::Udp6 => write!(f, "udp6"),
            Protocol::Tcp4 => write!(f, "tcp4"),
            Protocol::Tcp6 => write!(f, "tcp6"),
            Protocol::TcpClient => write!(f, "tcp-client"),
            Protocol::TcpServer => write!(f, "tcp-server"),
        }
    }
}

/// Virtual network device type (`tun` vs `tap`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum DeviceType {
    #[default]
    Tun,
    Tap,
}

impl std::str::FromStr for DeviceType {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let lower = s.to_ascii_lowercase();
        if lower.starts_with("tun") {
            Ok(DeviceType::Tun)
        } else if lower.starts_with("tap") {
            Ok(DeviceType::Tap)
        } else {
            Err(())
        }
    }
}

/// A remote server endpoint definition.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RemoteEntry {
    /// Hostname or IP address of the remote OpenVPN server.
    pub host: String,
    /// Remote port (typically 1194).
    pub port: u16,
    /// Protocol override for this specific remote (if any).
    pub proto: Option<Protocol>,
}

impl RemoteEntry {
    pub fn new(host: impl Into<String>, port: u16, proto: Option<Protocol>) -> Self {
        Self {
            host: host.into(),
            port,
            proto,
        }
    }
}

/// TLS Key direction configuration for `tls-auth` / `secret`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum KeyDirection {
    /// Direction 0 (Server TX / Client RX).
    Server = 0,
    /// Direction 1 (Client TX / Server RX).
    Client = 1,
    /// Bidirectional (no direction parameter).
    Bidirectional,
}

impl std::str::FromStr for KeyDirection {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "0" => Ok(KeyDirection::Server),
            "1" => Ok(KeyDirection::Client),
            "bidirectional" => Ok(KeyDirection::Bidirectional),
            _ => Err(()),
        }
    }
}

/// Sensitive secret string zeroized on drop.
#[derive(Clone, Default, PartialEq, Eq, Zeroize, ZeroizeOnDrop, Serialize, Deserialize)]
pub struct SecretString(pub String);

impl SecretString {
    pub fn new(s: impl Into<String>) -> Self {
        Self(s.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for SecretString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[REDACTED SECRET]")
    }
}

/// Sensitive secret bytes zeroized on drop.
#[derive(Clone, Default, PartialEq, Eq, Zeroize, ZeroizeOnDrop, Serialize, Deserialize)]
pub struct SecretBytes(pub Vec<u8>);

impl SecretBytes {
    pub fn new(b: impl Into<Vec<u8>>) -> Self {
        Self(b.into())
    }

    pub fn as_slice(&self) -> &[u8] {
        &self.0
    }
}

impl fmt::Debug for SecretBytes {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[REDACTED {} BYTES]", self.0.len())
    }
}

/// TLS-Auth HMAC key configuration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TlsAuthConfig {
    /// Raw key data or filename.
    pub key: SecretString,
    /// Optional key direction (0 or 1).
    pub direction: Option<KeyDirection>,
}

/// PKCS#12 bundle configuration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Pkcs12Config {
    /// Raw PKCS#12 DER/base64 bytes or file path.
    pub data: SecretBytes,
    /// Password for unlocking PKCS#12 bundle.
    pub password: Option<SecretString>,
}

/// Username / password authentication configuration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuthUserPassConfig {
    /// Username.
    pub username: Option<String>,
    /// Password.
    pub password: Option<SecretString>,
    /// Credentials file path if specified via `auth-user-pass <file>`.
    pub path: Option<String>,
}

/// X.509 verification criteria.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VerifyX509Name {
    pub name: String,
    pub name_type: VerifyX509Type,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum VerifyX509Type {
    #[default]
    Subject,
    NamePrefix,
    SubjectAltName,
}

/// SOCKS or HTTP proxy definition.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProxyConfig {
    Http {
        host: String,
        port: u16,
        auth_file: Option<String>,
    },
    Socks {
        host: String,
        port: u16,
        auth_file: Option<String>,
    },
}

/// Single parsed directive line from an `.ovpn` configuration file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Directive {
    /// Directive verb name (normalized to lower-case).
    pub name: String,
    /// Positional arguments.
    pub args: Vec<String>,
    /// Original line number in source `.ovpn` file.
    pub line_number: usize,
}

/// Parsed XML-style inline configuration block (e.g. `<ca>...</ca>`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InlineBlock {
    /// Tag name (e.g. `ca`, `cert`, `key`, `tls-auth`, `tls-crypt`, `pkcs12`).
    pub tag: String,
    /// Text or base64 contents within the tag.
    pub content: String,
    /// Optional attributes or secondary args on opening tag (e.g. `<tls-auth 1>`).
    pub attribute: Option<String>,
    /// Starting line number.
    pub line_number: usize,
}

/// High-level, fully validated OpenVPN configuration ready for execution.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OpenVpnConfig {
    /// Remote server list.
    pub remotes: Vec<RemoteEntry>,
    /// Randomize remote server selection order (`remote-random`).
    pub remote_random: bool,
    /// Connection retry behavior.
    pub resolv_retry_infinite: bool,
    /// Virtual device name or prefix.
    pub dev: String,
    /// Device type (`tun` or `tap`).
    pub dev_type: DeviceType,
    /// Default transport protocol.
    pub proto: Protocol,
    /// Do not bind to a specific local port (`nobind`).
    pub nobind: bool,
    /// Keep key in memory across SIGUSR1 restarts (`persist-key`).
    pub persist_key: bool,
    /// Keep TUN device open across SIGUSR1 restarts (`persist-tun`).
    pub persist_tun: bool,
    /// Running in client mode (`client`).
    pub client: bool,
    /// Pull options from server (`pull`).
    pub pull: bool,

    // Cryptography & TLS
    /// CA certificate (PEM format string or file path).
    pub ca: Option<String>,
    /// Client certificate (PEM format string or file path).
    pub cert: Option<String>,
    /// Client private key (PEM format string or file path).
    pub key: Option<SecretString>,
    /// Extra intermediate certificates (PEM string).
    pub extra_certs: Option<String>,
    /// PKCS#12 bundle if used.
    pub pkcs12: Option<Pkcs12Config>,
    /// TLS-Auth HMAC signature key and direction.
    pub tls_auth: Option<TlsAuthConfig>,
    /// TLS-Crypt v1 pre-shared key.
    pub tls_crypt: Option<SecretString>,
    /// TLS-Crypt v2 client key.
    pub tls_crypt_v2: Option<SecretString>,
    /// Key direction specified globally (`key-direction <0|1>`).
    pub key_direction: Option<KeyDirection>,
    /// Symmetric data channel ciphers supported (in priority order).
    pub data_ciphers: Vec<String>,
    /// Fallback cipher for legacy servers (`data-ciphers-fallback`).
    pub data_ciphers_fallback: Option<String>,
    /// Legacy `cipher` directive if specified.
    pub cipher: Option<String>,
    /// HMAC digest algorithm for TLS-Auth or legacy data channel (`auth`).
    pub auth_digest: Option<String>,
    /// Username / password credentials.
    pub auth_user_pass: Option<AuthUserPassConfig>,
    /// Server certificate requirement (`remote-cert-tls server`).
    pub remote_cert_tls: Option<String>,
    /// Verification rule for server X.509 certificate subject.
    pub verify_x509_name: Option<VerifyX509Name>,
    /// Minimum TLS protocol version (`tls-version-min`).
    pub tls_version_min: Option<String>,
    /// Session renegotiation interval in seconds (`reneg-sec`).
    pub reneg_sec: Option<u32>,
    /// Handshake window in seconds (`hand-window`).
    pub hand_window: Option<u32>,

    // Network & Routing
    /// Static IPv4 address configured locally (`ifconfig <local> <remote/netmask>`).
    pub ifconfig_v4: Option<(Ipv4Addr, Ipv4Addr)>,
    /// Static IPv6 address configured locally (`ifconfig-ipv6 <local> <remote>`).
    pub ifconfig_v6: Option<(Ipv6Addr, Ipv6Addr)>,
    /// Network topology mode.
    pub topology: Option<NetworkTopology>,
    /// Static IPv4 routes.
    pub routes_v4: Vec<Ipv4Route>,
    /// Static IPv6 routes.
    pub routes_v6: Vec<Ipv6Route>,
    /// Default gateway redirection parameters.
    pub redirect_gateway: RedirectGatewayFlags,
    /// Static DNS servers.
    pub dns_servers: Vec<IpAddr>,
    /// Static DNS search domains.
    pub search_domains: Vec<String>,
    /// Block outside DNS leak protection.
    pub block_outside_dns: bool,
    /// TUN device MTU (`tun-mtu`).
    pub tun_mtu: Option<u32>,
    /// Link MTU (`link-mtu`).
    pub link_mtu: Option<u32>,
    /// MSS clamping (`mssfix`).
    pub mss_fix: Option<u16>,

    // Keepalive & Timeout
    /// Keepalive ping interval.
    pub ping_interval: Option<Duration>,
    /// Keepalive ping restart timeout.
    pub ping_restart: Option<Duration>,
    /// Explicit exit notify count (`explicit-exit-notify`).
    pub explicit_exit_notify: Option<u8>,

    // Proxy & Misc
    /// Configured HTTP or SOCKS proxy.
    pub proxy: Option<ProxyConfig>,
    /// Logging verbosity (`verb`).
    pub verb: u8,
    /// Fast I/O optimization flag (`fast-io`).
    pub fast_io: bool,
    /// Compression setting (`compress` or `comp-lzo`).
    pub compression: Option<String>,
}

impl Default for OpenVpnConfig {
    fn default() -> Self {
        Self {
            remotes: Vec::new(),
            remote_random: false,
            resolv_retry_infinite: true,
            dev: "tun".to_string(),
            dev_type: DeviceType::Tun,
            proto: Protocol::Udp,
            nobind: true,
            persist_key: true,
            persist_tun: true,
            client: true,
            pull: true,
            ca: None,
            cert: None,
            key: None,
            extra_certs: None,
            pkcs12: None,
            tls_auth: None,
            tls_crypt: None,
            tls_crypt_v2: None,
            key_direction: None,
            data_ciphers: vec![
                "AES-256-GCM".to_string(),
                "AES-128-GCM".to_string(),
                "CHACHA20-POLY1305".to_string(),
            ],
            data_ciphers_fallback: None,
            cipher: None,
            auth_digest: Some("SHA1".to_string()),
            auth_user_pass: None,

            remote_cert_tls: Some("server".to_string()),
            verify_x509_name: None,
            tls_version_min: Some("1.2".to_string()),
            reneg_sec: Some(3600),
            hand_window: Some(60),
            ifconfig_v4: None,
            ifconfig_v6: None,
            topology: None,
            routes_v4: Vec::new(),
            routes_v6: Vec::new(),
            redirect_gateway: RedirectGatewayFlags::default(),
            dns_servers: Vec::new(),
            search_domains: Vec::new(),
            block_outside_dns: false,
            tun_mtu: Some(1500),
            link_mtu: None,
            mss_fix: None,
            ping_interval: None,
            ping_restart: None,
            explicit_exit_notify: None,
            proxy: None,
            verb: 3,
            fast_io: false,
            compression: None,
        }
    }
}
