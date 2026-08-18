//! # IPC Transport Abstractions
//!
//! Pluggable transport layers supporting Unix Domain Sockets on Linux/macOS
//! and Named Pipes on Windows.

#[cfg(unix)]
pub mod unix;
#[cfg(windows)]
pub mod windows_pipe;

#[cfg(unix)]
pub use unix::UnixTransportListener;
