//! # Security Subsystem
//!
//! Exposes secret zeroization primitives and sanitized in-memory circular logging.

pub mod ring_buffer;
pub mod zeroize;

pub use ring_buffer::LogRingBuffer;
pub use zeroize::{SecretBytes, SecretString};
