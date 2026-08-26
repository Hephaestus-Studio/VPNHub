//! # ovpn-transport
//!
//! Tokio-based zero-copy async UDP/TCP transports, OpenVPN length-prefixed framing,
//! and SOCKS5 / HTTP CONNECT proxy clients for `openvpn3-rs`.

#![deny(unsafe_code)]

pub mod error;
pub mod proxy;
pub mod tcp;
pub mod udp;

pub use error::TransportError;
pub use proxy::{HttpConnectClient, Socks5Client};
pub use tcp::{OpenVpnTcpCodec, TcpTransport};
pub use udp::UdpTransport;
