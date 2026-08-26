use libc::{c_char, c_void};
use ovpn_ffi::*;
use std::ffi::{CStr, CString};
use std::ptr;
use std::sync::atomic::{AtomicI32, Ordering};

static EVENT_RECEIVED: AtomicI32 = AtomicI32::new(0);

unsafe extern "C" fn test_callback(
    event_type: i32,
    _json_payload: *const c_char,
    _user_data: *mut c_void,
) {
    EVENT_RECEIVED.store(event_type, Ordering::SeqCst);
}

#[test]
fn test_ovpn_version() {
    let ver_ptr = ovpn_version();
    assert!(!ver_ptr.is_null());
    let ver_str = unsafe { CStr::from_ptr(ver_ptr).to_str().unwrap() };
    assert!(ver_str.starts_with("openvpn3-rs"));
}

#[test]
fn test_ovpn_config_parse_and_free() {
    let ovpn_text = CString::new("client\ndev tun\nremote 127.0.0.1 1194 udp\n").unwrap();
    let mut config_ptr: *mut ovpn_config_t = ptr::null_mut();

    let res = unsafe { ovpn_config_parse(ovpn_text.as_ptr(), &mut config_ptr) };
    assert_eq!(res, OVPN_SUCCESS);
    assert!(!config_ptr.is_null());

    unsafe {
        assert_eq!((*config_ptr).inner.remotes.len(), 1);
        ovpn_config_free(config_ptr);
    }

    // Null pointer error checking
    let null_res = unsafe { ovpn_config_parse(ptr::null(), &mut config_ptr) };
    assert_eq!(null_res, OVPN_ERR_NULL_PTR);
}

#[test]
fn test_ovpn_session_lifecycle_ffi() {
    let ovpn_text = CString::new("client\ndev tun\nremote 127.0.0.1 1194 udp\n").unwrap();
    let mut config_ptr: *mut ovpn_config_t = ptr::null_mut();

    unsafe {
        let res = ovpn_config_parse(ovpn_text.as_ptr(), &mut config_ptr);
        assert_eq!(res, OVPN_SUCCESS);

        let mut session_ptr: *mut ovpn_session_t = ptr::null_mut();
        let sess_res = ovpn_session_create(
            config_ptr,
            Some(test_callback),
            ptr::null_mut(),
            &mut session_ptr,
        );
        assert_eq!(sess_res, OVPN_SUCCESS);
        assert!(!session_ptr.is_null());

        // Start session
        let start_res = ovpn_session_start(session_ptr);
        assert_eq!(start_res, OVPN_SUCCESS);

        // Query stats
        let mut stats = ovpn_stats_t::default();
        let stats_res = ovpn_session_get_stats(session_ptr, &mut stats);
        assert_eq!(stats_res, OVPN_SUCCESS);

        // Stop session
        let stop_res = ovpn_session_stop(session_ptr);
        assert_eq!(stop_res, OVPN_SUCCESS);

        // Free session and config
        ovpn_session_free(session_ptr);
        ovpn_config_free(config_ptr);
    }
}
