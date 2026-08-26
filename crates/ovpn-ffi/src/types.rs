#![allow(non_camel_case_types)]

use libc::{c_char, c_void};

use ovpn_config::OpenVpnConfig;
use ovpn_core::ClientHandle;
use std::sync::Arc;

pub const OVPN_SUCCESS: i32 = 0;
pub const OVPN_ERR_NULL_PTR: i32 = -1;
pub const OVPN_ERR_INVALID_CONFIG: i32 = -2;
pub const OVPN_ERR_SESSION_FAILED: i32 = -3;
pub const OVPN_ERR_PANIC: i32 = -4;
pub const OVPN_ERR_INVALID_UTF8: i32 = -5;

pub const OVPN_EVENT_STATE_CHANGED: i32 = 1;
pub const OVPN_EVENT_NETWORK_CONFIGURED: i32 = 2;
pub const OVPN_EVENT_AUTH_CHALLENGE: i32 = 3;
pub const OVPN_EVENT_STATS_UPDATED: i32 = 4;
pub const OVPN_EVENT_DISCONNECTED: i32 = 5;
pub const OVPN_EVENT_ERROR: i32 = 6;

/// C-ABI callback function pointer for event notifications.
pub type ovpn_event_callback_t = Option<
    unsafe extern "C" fn(event_type: i32, json_payload: *const c_char, user_data: *mut c_void),
>;

/// C-compatible snapshot of session throughput and runtime metrics.
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct ovpn_stats_t {
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub packets_in: u64,
    pub packets_out: u64,
    pub uptime_seconds: u64,
}

/// Opaque wrapper for parsed `OpenVpnConfig`.
pub struct ovpn_config_t {
    pub inner: OpenVpnConfig,
}

/// Internal session context for FFI handle.
pub struct SessionContext {
    pub config: OpenVpnConfig,
    pub callback: ovpn_event_callback_t,
    pub user_data: *mut c_void,
    pub runtime: Arc<tokio::runtime::Runtime>,
    pub handle: Option<ClientHandle>,
}

unsafe impl Send for SessionContext {}
unsafe impl Sync for SessionContext {}

/// Opaque wrapper for active OpenVPN client session.
pub struct ovpn_session_t {
    pub context: SessionContext,
}
