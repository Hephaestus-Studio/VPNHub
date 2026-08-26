//! # ovpn-core
//!
//! High-level Client pipeline orchestrator, event broadcasting, and lifecycle management for `openvpn3-rs`.

#![deny(unsafe_code)]

pub mod error;
pub mod events;
pub mod handle;
pub mod session;

pub use error::CoreError;
pub use events::{SessionEvent, SessionStats};
pub use handle::{ClientCommand, ClientHandle};
pub use session::ClientSession;
