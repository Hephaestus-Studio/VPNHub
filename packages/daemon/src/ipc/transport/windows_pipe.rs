//! # Windows Named Pipe Transport Layer
//!
//! Provides Named Pipe listening mechanisms on Windows with Discretionary Access Control Lists (DACL).

#[cfg(windows)]
use std::ffi::OsStr;
#[cfg(windows)]
use std::io;
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
#[cfg(windows)]
use windows_sys::Win32::Foundation::LocalFree;
#[cfg(windows)]
use windows_sys::Win32::Security::Authorization::{
    ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
};
#[cfg(windows)]
use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;

/// Default SDDL string for VPNHub Daemon Named Pipe:
/// Grants GENERIC_ALL to SYSTEM (SY) & Builtin Admins (BA), Read/Write to Authenticated Users (AU),
/// and Low Mandatory Integrity Label (S:(ML;;NW;;;LW)) to allow non-elevated user UI clients to connect.
pub const DEFAULT_PIPE_SDDL: &str =
    "D:(A;;GA;;;SY)(A;;GA;;;BA)(A;;GRGW;;;AU)(A;;GRGW;;;WD)S:(ML;;NW;;;LW)";

#[cfg(windows)]
/// Wrapper holding allocated Win32 SECURITY_ATTRIBUTES.
pub struct PipeSecurityAttributes {
    sa: SECURITY_ATTRIBUTES,
    sec_desc: *mut std::ffi::c_void,
}

#[cfg(windows)]
impl PipeSecurityAttributes {
    /// Creates a new PipeSecurityAttributes instance from an SDDL string.
    pub fn from_sddl(sddl: &str) -> io::Result<Self> {
        let wide: Vec<u16> = OsStr::new(sddl)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let mut sec_desc: *mut std::ffi::c_void = std::ptr::null_mut();

        let res = unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                wide.as_ptr(),
                SDDL_REVISION_1,
                &mut sec_desc,
                std::ptr::null_mut(),
            )
        };

        if res == 0 {
            return Err(io::Error::last_os_error());
        }

        let sa = SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: sec_desc,
            bInheritHandle: 0,
        };

        Ok(Self { sa, sec_desc })
    }

    /// Returns a raw mutable pointer to the Win32 SECURITY_ATTRIBUTES struct.
    pub fn as_mut_ptr(&mut self) -> *mut std::ffi::c_void {
        &mut self.sa as *mut _ as *mut std::ffi::c_void
    }
}

#[cfg(windows)]
impl Drop for PipeSecurityAttributes {
    fn drop(&mut self) {
        if !self.sec_desc.is_null() {
            unsafe {
                LocalFree(self.sec_desc as _);
            }
        }
    }
}
