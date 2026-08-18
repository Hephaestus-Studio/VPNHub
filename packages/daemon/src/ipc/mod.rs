//! # Inter-Process Communication (IPC) Subsystem
//!
//! Provides length-delimited JSON framing, caller authentication, Unix Domain Socket / Named Pipe
//! listeners, and request/response/event dispatcher services.

pub mod auth;
pub mod codec;
pub mod protocol;
pub mod server;
pub mod transport;

pub use codec::JsonLengthDelimitedCodec;
pub use protocol::{
    AuthConfig, BandwidthMetrics, ConnectParams, DaemonEvent, DaemonRequest, DaemonResponse,
    DaemonStatusSnapshot, DiagnosticReport, ProtocolType, SessionState, SplitTunnelConfig,
};
pub use server::IpcServer;
