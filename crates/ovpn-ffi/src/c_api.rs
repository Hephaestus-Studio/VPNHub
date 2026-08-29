//! C-ABI Foreign Function Interface entrypoints for `openvpn3-rs`.

use crate::types::*;
use libc::{c_char, c_void};
use ovpn_config::parse_ovpn_config;
use ovpn_core::{ClientSession, SessionEvent};
use ovpn_tun::{MockTunDevice, VirtualTunDevice};
use std::ffi::{CStr, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::Arc;

/// Static library version string.
static VERSION_STR: &[u8] = b"openvpn3-rs 0.1.2\0";

#[no_mangle]
pub extern "C" fn ovpn_version() -> *const c_char {
    VERSION_STR.as_ptr() as *const c_char
}

/// Parses raw `.ovpn` configuration text into an opaque `ovpn_config_t` object.
#[no_mangle]
pub unsafe extern "C" fn ovpn_config_parse(
    ovpn_text: *const c_char,
    out_config: *mut *mut ovpn_config_t,
) -> i32 {
    let result = catch_unwind(AssertUnwindSafe(|| {
        if ovpn_text.is_null() || out_config.is_null() {
            return OVPN_ERR_NULL_PTR;
        }

        let c_str = match CStr::from_ptr(ovpn_text).to_str() {
            Ok(s) => s,
            Err(_) => return OVPN_ERR_INVALID_UTF8,
        };

        match parse_ovpn_config(c_str) {
            Ok(config) => {
                let boxed = Box::new(ovpn_config_t { inner: config });
                *out_config = Box::into_raw(boxed);
                OVPN_SUCCESS
            }
            Err(_) => OVPN_ERR_INVALID_CONFIG,
        }
    }));

    result.unwrap_or(OVPN_ERR_PANIC)
}

/// Frees an `ovpn_config_t` object allocated by `ovpn_config_parse`.
#[no_mangle]
pub unsafe extern "C" fn ovpn_config_free(config: *mut ovpn_config_t) {
    if !config.is_null() {
        let _ = catch_unwind(AssertUnwindSafe(|| {
            drop(Box::from_raw(config));
        }));
    }
}

/// Creates a new OpenVPN client session instance with optional event callback.
#[no_mangle]
pub unsafe extern "C" fn ovpn_session_create(
    config: *mut ovpn_config_t,
    callback: ovpn_event_callback_t,
    user_data: *mut c_void,
    out_session: *mut *mut ovpn_session_t,
) -> i32 {
    let result = catch_unwind(AssertUnwindSafe(|| {
        if config.is_null() || out_session.is_null() {
            return OVPN_ERR_NULL_PTR;
        }

        let cfg = &(*config).inner;
        let runtime = match tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
        {
            Ok(rt) => Arc::new(rt),
            Err(_) => return OVPN_ERR_SESSION_FAILED,
        };

        let session_ctx = SessionContext {
            config: cfg.clone(),
            callback,
            user_data,
            runtime,
            handle: None,
        };

        let boxed_session = Box::new(ovpn_session_t {
            context: session_ctx,
        });

        *out_session = Box::into_raw(boxed_session);
        OVPN_SUCCESS
    }));

    result.unwrap_or(OVPN_ERR_PANIC)
}

/// Starts the asynchronous connection pipeline for the session.
#[no_mangle]
pub unsafe extern "C" fn ovpn_session_start(session: *mut ovpn_session_t) -> i32 {
    let result = catch_unwind(AssertUnwindSafe(|| {
        if session.is_null() {
            return OVPN_ERR_NULL_PTR;
        }

        let sess = &mut *session;
        let _guard = sess.context.runtime.enter();
        let config = sess.context.config.clone();

        let callback = sess.context.callback;
        let user_data_addr = sess.context.user_data as usize;

        // Instantiate Virtual TUN device (native or mock)
        #[cfg(target_os = "linux")]
        let tun_device: Box<dyn VirtualTunDevice> =
            match ovpn_tun::LinuxTunDevice::create(None, 1500, false) {
                Ok(dev) => Box::new(dev),
                Err(_) => {
                    let (mock, _) = MockTunDevice::new("tun0", 1500);
                    Box::new(mock)
                }
            };

        #[cfg(target_os = "macos")]
        let tun_device: Box<dyn VirtualTunDevice> =
            match ovpn_tun::MacOsTunDevice::create(None, 1500) {
                Ok(dev) => Box::new(dev),
                Err(_) => {
                    let (mock, _) = MockTunDevice::new("utun0", 1500);
                    Box::new(mock)
                }
            };

        #[cfg(not(any(target_os = "linux", target_os = "macos")))]
        let tun_device: Box<dyn VirtualTunDevice> = {
            let (mock, _) = MockTunDevice::new("tun0", 1500);
            Box::new(mock)
        };

        let (handle, mut event_rx) = ClientSession::spawn(config, tun_device);
        sess.context.handle = Some(handle);

        // Spawn callback dispatching task
        sess.context.runtime.spawn(async move {
            while let Ok(event) = event_rx.recv().await {
                if let Some(cb) = callback {
                    let (event_type, payload_json) = match event {
                        SessionEvent::StateChanged(state) => (
                            OVPN_EVENT_STATE_CHANGED,
                            format!(r#"{{"state":"{state:?}"}}"#),
                        ),
                        SessionEvent::NetworkConfigured(prov) => {
                            let ip = prov.ipv4_address.map(|i| i.to_string()).unwrap_or_default();
                            (
                                OVPN_EVENT_NETWORK_CONFIGURED,
                                format!(r#"{{"ip":"{ip}","mtu":{}}}"#, prov.mtu),
                            )
                        }
                        SessionEvent::AuthChallenge(ch) => (
                            OVPN_EVENT_AUTH_CHALLENGE,
                            format!(r#"{{"challenge":{:?}}}"#, ch),
                        ),
                        SessionEvent::StatsUpdated(stats) => (
                            OVPN_EVENT_STATS_UPDATED,
                            format!(
                                r#"{{"bytes_in":{},"bytes_out":{}}}"#,
                                stats.bytes_in, stats.bytes_out
                            ),
                        ),
                        SessionEvent::Disconnected { reason } => (
                            OVPN_EVENT_DISCONNECTED,
                            format!(r#"{{"reason":"{reason}"}}"#),
                        ),
                        SessionEvent::Error { message } => {
                            (OVPN_EVENT_ERROR, format!(r#"{{"error":"{message}"}}"#))
                        }
                    };

                    if let Ok(c_json) = CString::new(payload_json) {
                        let user_data = user_data_addr as *mut c_void;
                        cb(event_type, c_json.as_ptr(), user_data);
                    }
                }
            }
        });

        OVPN_SUCCESS
    }));

    result.unwrap_or(OVPN_ERR_PANIC)
}

/// Signals the active session to disconnect and terminate.
#[no_mangle]
pub unsafe extern "C" fn ovpn_session_stop(session: *mut ovpn_session_t) -> i32 {
    let result = catch_unwind(AssertUnwindSafe(|| {
        if session.is_null() {
            return OVPN_ERR_NULL_PTR;
        }

        let sess = &mut *session;
        if let Some(ref handle) = sess.context.handle {
            let handle_clone = handle.clone();
            sess.context.runtime.block_on(async move {
                let _ = handle_clone.disconnect("FFI requested stop").await;
            });
        }

        OVPN_SUCCESS
    }));

    result.unwrap_or(OVPN_ERR_PANIC)
}

/// Submits dynamic challenge response token (e.g. OTP) to the session.
#[no_mangle]
pub unsafe extern "C" fn ovpn_session_submit_challenge(
    session: *mut ovpn_session_t,
    state_id: *const c_char,
    response: *const c_char,
) -> i32 {
    let result = catch_unwind(AssertUnwindSafe(|| {
        if session.is_null() || state_id.is_null() || response.is_null() {
            return OVPN_ERR_NULL_PTR;
        }

        let sid = match CStr::from_ptr(state_id).to_str() {
            Ok(s) => s,
            Err(_) => return OVPN_ERR_INVALID_UTF8,
        };

        let resp = match CStr::from_ptr(response).to_str() {
            Ok(s) => s,
            Err(_) => return OVPN_ERR_INVALID_UTF8,
        };

        let sess = &mut *session;
        if let Some(ref handle) = sess.context.handle {
            let handle_clone = handle.clone();
            let sid_owned = sid.to_string();
            let resp_owned = resp.to_string();
            sess.context.runtime.block_on(async move {
                let _ = handle_clone
                    .submit_challenge_response(&sid_owned, &resp_owned)
                    .await;
            });
            OVPN_SUCCESS
        } else {
            OVPN_ERR_SESSION_FAILED
        }
    }));

    result.unwrap_or(OVPN_ERR_PANIC)
}

/// Queries real-time session statistics.
#[no_mangle]
pub unsafe extern "C" fn ovpn_session_get_stats(
    session: *mut ovpn_session_t,
    out_stats: *mut ovpn_stats_t,
) -> i32 {
    let result = catch_unwind(AssertUnwindSafe(|| {
        if session.is_null() || out_stats.is_null() {
            return OVPN_ERR_NULL_PTR;
        }

        let sess = &*session;
        if let Some(ref handle) = sess.context.handle {
            let handle_clone = handle.clone();
            let stats = sess
                .context
                .runtime
                .block_on(async move { handle_clone.get_stats().await });

            *out_stats = ovpn_stats_t {
                bytes_in: stats.bytes_in,
                bytes_out: stats.bytes_out,
                packets_in: stats.packets_in,
                packets_out: stats.packets_out,
                uptime_seconds: stats.uptime_secs,
            };

            OVPN_SUCCESS
        } else {
            *out_stats = ovpn_stats_t::default();
            OVPN_SUCCESS
        }
    }));

    result.unwrap_or(OVPN_ERR_PANIC)
}

/// Frees an `ovpn_session_t` object and all allocated resources.
#[no_mangle]
pub unsafe extern "C" fn ovpn_session_free(session: *mut ovpn_session_t) {
    if !session.is_null() {
        let _ = catch_unwind(AssertUnwindSafe(|| {
            let boxed = Box::from_raw(session);
            if let Some(ref handle) = boxed.context.handle {
                let handle_clone = handle.clone();
                boxed.context.runtime.block_on(async move {
                    let _ = handle_clone.disconnect("Session freed").await;
                });
            }
        }));
    }
}
