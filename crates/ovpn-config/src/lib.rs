//! # ovpn-config
//!
//! High-performance, zero-copy `.ovpn` configuration, dynamic `PUSH_REPLY`,
//! and PKCS#12 bundle parser for `openvpn3-rs`.

#![deny(unsafe_code)]

pub mod error;
pub mod model;
pub mod network_config;
pub mod parser;
pub mod pkcs12;
pub mod push;

pub use error::ConfigError;
pub use model::{
    AuthUserPassConfig, DeviceType, KeyDirection, OpenVpnConfig, Pkcs12Config, Protocol,
    ProxyConfig, RemoteEntry, SecretBytes, SecretString, TlsAuthConfig, VerifyX509Name,
    VerifyX509Type,
};

pub use network_config::{
    Ipv4Route, Ipv6Route, NetworkProvisioningConfig, NetworkTopology, RedirectGatewayFlags,
};
pub use parser::{parse_ovpn_ast, parse_ovpn_config, ParsedOvpnFile};
pub use pkcs12::{parse_pkcs12_bundle, Pkcs12Parsed};
pub use push::{parse_push_reply, split_push_reply_items, PushOptions};

impl std::str::FromStr for OpenVpnConfig {
    type Err = ConfigError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        parse_ovpn_config(s)
    }
}
