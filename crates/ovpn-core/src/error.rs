//! Client session orchestrator error definitions.

use thiserror::Error;

/// Error types occurring during client orchestration and pipeline execution.
#[derive(Debug, Error)]
pub enum CoreError {
    #[error("Configuration error: {0}")]
    Config(#[from] ovpn_config::ConfigError),

    #[error("Protocol engine error: {0}")]
    Protocol(#[from] ovpn_protocol::ProtocolError),

    #[error("Transport error: {0}")]
    Transport(#[from] ovpn_transport::TransportError),

    #[error("TUN device error: {0}")]
    Tun(#[from] ovpn_tun::TunError),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Failed to connect to all configured remote endpoints")]
    AllRemotesFailed,

    #[error("Client session was closed: {0}")]
    SessionClosed(String),
}
