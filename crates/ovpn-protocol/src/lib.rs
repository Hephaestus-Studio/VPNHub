//! # ovpn-protocol
//!
//! Pure No-I/O deterministic state machine protocol engine for `openvpn3-rs`.

#![deny(unsafe_code)]

pub mod auth;
pub mod engine;
pub mod error;
pub mod frame;
pub mod key_slots;
pub mod mssfix;
pub mod opcode;
pub mod reliable;
pub mod tls;

pub use auth::{AuthChallenge, AuthHandler};
pub use engine::{EngineState, OutputAction, ProtocolEngine};
pub use error::ProtocolError;
pub use frame::{ControlPacket, DataPacket};
pub use key_slots::{KeySlot, KeySlotManager};
pub use mssfix::clamp_tcp_mss;
pub use opcode::{encode_header_byte, parse_header_byte, Opcode};
pub use reliable::{ReliablePacket, ReliableRecvQueue, ReliableSendQueue};
pub use tls::TlsStreamAdapter;
