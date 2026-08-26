//! Transport error definitions.

use thiserror::Error;

/// Error types occurring during network transport operations.
#[derive(Debug, Error)]
pub enum TransportError {
    #[error("I/O error during transport: {0}")]
    Io(#[from] std::io::Error),

    #[error("TCP framing error: {0}")]
    Framing(String),

    #[error("Proxy handshake failed ({proxy_type}): {reason}")]
    ProxyHandshakeFailed {
        proxy_type: &'static str,
        reason: String,
    },

    #[error("Remote DNS resolution failed for {0}")]
    DnsResolutionFailed(String),

    #[error("Connection closed by peer")]
    ConnectionClosed,
}
