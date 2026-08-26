//! TUN device and Kernel DCO error definitions.

use thiserror::Error;

/// Error types occurring during Virtual TUN interface management.
#[derive(Debug, Error)]
pub enum TunError {
    #[error("I/O error during TUN device operation: {0}")]
    Io(#[from] std::io::Error),

    #[error("TUN device creation failed: {0}")]
    DeviceCreationFailed(String),

    #[error("Kernel DCO (Data Channel Offload) error: {0}")]
    Dco(String),

    #[error("Platform unsupported: {0}")]
    UnsupportedPlatform(String),

    #[error("Buffer too small for packet: required {required} bytes, provided {provided} bytes")]
    BufferTooSmall { required: usize, provided: usize },
}
