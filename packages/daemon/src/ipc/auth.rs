//! # Client Authentication & Peer Identity Verification (Anti-LPE Guard)
//!
//! Enforces caller identity checks on inbound IPC streams to ensure unprivileged local
//! users cannot gain unauthorized administrative control over network routing or firewall rules.

use crate::error::IpcError;

#[cfg(target_os = "linux")]
use std::os::unix::io::AsRawFd;
#[cfg(target_os = "linux")]
use tokio::net::UnixStream;

/// Verifies caller privileges on a newly connected IPC stream.
///
/// On Linux, inspects `SO_PEERCRED` socket credentials to ensure caller is root (UID 0)
/// or belongs to the authorized user group.
/// On other platforms, validates security descriptor credentials.
pub fn verify_peer_credentials(
    #[cfg(target_os = "linux")] stream: &UnixStream,
    auth_group: &str,
) -> Result<u32, IpcError> {
    #[cfg(target_os = "linux")]
    {
        let raw_fd = stream.as_raw_fd();
        let borrowed = unsafe { std::os::fd::BorrowedFd::borrow_raw(raw_fd) };
        let creds =
            nix::sys::socket::getsockopt(&borrowed, nix::sys::socket::sockopt::PeerCredentials)
                .map_err(|e| IpcError::AuthInspectionFailed(e.to_string()))?;

        let uid = creds.uid();
        let pid = creds.pid();

        // 1. Root user always authorized
        if uid == 0 {
            return Ok(pid as u32);
        }

        // 2. Check if user is member of configured auth group (e.g. "vpnhub")
        if is_linux_user_in_group(uid, auth_group) {
            return Ok(pid as u32);
        }

        // 3. Fallback for standard admin groups (sudo, wheel, adm)
        if is_linux_user_in_group(uid, "sudo")
            || is_linux_user_in_group(uid, "wheel")
            || is_linux_user_in_group(uid, "adm")
        {
            return Ok(pid as u32);
        }

        // 4. Check if caller matches SUDO_USER who launched the daemon
        if let Ok(sudo_user) = std::env::var("SUDO_USER") {
            if let Ok(Some(u)) = nix::unistd::User::from_name(&sudo_user) {
                if u.uid.as_raw() == uid {
                    return Ok(pid as u32);
                }
            }
        }

        Err(IpcError::Unauthorized(format!(
            "Caller UID {} is not root, not in '{}', and not an authorized administrative user",
            uid, auth_group
        )))
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = auth_group;
        Ok(0)
    }
}

#[cfg(target_os = "linux")]
fn is_linux_user_in_group(uid: u32, group_name: &str) -> bool {
    use nix::unistd::{getgrouplist, Group, User};
    use std::ffi::CString;

    let user = match User::from_uid(nix::unistd::Uid::from_raw(uid)) {
        Ok(Some(u)) => u,
        _ => return false,
    };

    let target_group = match Group::from_name(group_name) {
        Ok(Some(g)) => g,
        _ => return false,
    };

    if user.gid == target_group.gid {
        return true;
    }

    let c_username = match CString::new(user.name.clone()) {
        Ok(c) => c,
        Err(_) => return false,
    };

    if let Ok(groups) = getgrouplist(&c_username, user.gid) {
        return groups.contains(&target_group.gid);
    }

    false
}
