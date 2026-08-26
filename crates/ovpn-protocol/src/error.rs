//! Error types for OpenVPN protocol state machine and packet framing.

use thiserror::Error;

/// Error types occurring during OpenVPN protocol execution.
#[derive(Debug, Error)]
pub enum ProtocolError {
    #[error("Packet too short for header: length {0} bytes")]
    PacketTooShort(usize),

    #[error("Unknown or unsupported opcode: {0}")]
    UnknownOpcode(u8),

    #[error("Session ID mismatch: expected {expected:#018x}, got {actual:#018x}")]
    SessionIdMismatch { expected: u64, actual: u64 },

    #[error("Invalid framing or corrupted packet: {0}")]
    InvalidFraming(String),

    #[error("Crypto error in data or control channel: {0}")]
    Crypto(#[from] ovpn_crypto::CryptoError),

    #[error("Config error: {0}")]
    Config(#[from] ovpn_config::ConfigError),

    #[error("TLS error in control channel: {0}")]
    Tls(#[from] rustls::Error),

    #[error("I/O error in TLS transport: {0}")]
    Io(#[from] std::io::Error),

    #[error("Reliable window buffer overflow or out of sequence packets")]
    ReliableWindowOverflow,

    #[error("Handshake timed out after {0:?}")]
    HandshakeTimeout(std::time::Duration),

    #[error("Session authentication rejected by server: {0}")]
    AuthenticationFailed(String),

    #[error("Invalid state transition in engine: currently in state '{state}', received event '{event}'")]
    InvalidStateTransition { state: String, event: String },

    #[error("Server requested disconnection: {0}")]
    ServerExit(String),
}
