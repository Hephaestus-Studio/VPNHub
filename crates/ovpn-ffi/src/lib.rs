//! # ovpn-ffi
//!
//! C-ABI compatible Foreign Function Interface (FFI) bindings for `openvpn3-rs`.

pub mod c_api;
pub mod types;

pub use c_api::*;
pub use types::*;
