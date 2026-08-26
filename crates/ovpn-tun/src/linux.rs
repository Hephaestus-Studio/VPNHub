//! Linux `/dev/net/tun` Virtual Interface driver.

#![cfg(target_os = "linux")]

use crate::device::VirtualTunDevice;
use crate::error::TunError;
use async_trait::async_trait;
use nix::fcntl::{open, OFlag};
use nix::sys::stat::Mode;
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};

use tokio::io::unix::AsyncFd;

const TUNSETIFF: u64 = 0x400454ca;
const IFF_TUN: i16 = 0x0001;
const IFF_NO_PI: i16 = 0x1000;
const IFF_MULTI_QUEUE: i16 = 0x0100;

#[repr(C)]
struct IfReq {
    ifr_name: [u8; 16],
    ifr_flags: i16,
    _pad: [u8; 22],
}

/// Linux TUN network interface backed by `/dev/net/tun` and Tokio `AsyncFd`.
pub struct LinuxTunDevice {
    name: String,
    mtu: usize,
    async_fd: AsyncFd<OwnedFd>,
}

impl LinuxTunDevice {
    /// Creates a new Linux TUN device with the specified name and MTU.
    pub fn create(
        desired_name: Option<&str>,
        mtu: usize,
        multi_queue: bool,
    ) -> Result<Self, TunError> {
        let fd = open(
            "/dev/net/tun",
            OFlag::O_RDWR | OFlag::O_NONBLOCK,
            Mode::empty(),
        )
        .map_err(|e| TunError::DeviceCreationFailed(format!("Failed to open /dev/net/tun: {e}")))?;

        let mut ifr = IfReq {
            ifr_name: [0u8; 16],
            ifr_flags: IFF_TUN | IFF_NO_PI | if multi_queue { IFF_MULTI_QUEUE } else { 0 },
            _pad: [0u8; 22],
        };

        if let Some(name) = desired_name {
            let bytes = name.as_bytes();
            let len = bytes.len().min(15);
            ifr.ifr_name[..len].copy_from_slice(&bytes[..len]);
        }

        let ret = unsafe { libc::ioctl(fd, TUNSETIFF as _, &mut ifr) };
        if ret < 0 {
            let err = std::io::Error::last_os_error();
            return Err(TunError::DeviceCreationFailed(format!(
                "ioctl TUNSETIFF failed: {err}"
            )));
        }

        let actual_name = {
            let nul_pos = ifr.ifr_name.iter().position(|&b| b == 0).unwrap_or(16);
            String::from_utf8_lossy(&ifr.ifr_name[..nul_pos]).to_string()
        };

        let owned_fd = unsafe { OwnedFd::from_raw_fd(fd) };
        let async_fd = AsyncFd::new(owned_fd).map_err(|e| {
            TunError::DeviceCreationFailed(format!("AsyncFd initialization failed: {e}"))
        })?;

        Ok(Self {
            name: actual_name,
            mtu,
            async_fd,
        })
    }
}

#[async_trait]
impl VirtualTunDevice for LinuxTunDevice {
    fn name(&self) -> &str {
        &self.name
    }

    fn mtu(&self) -> usize {
        self.mtu
    }

    async fn read(&mut self, buf: &mut [u8]) -> Result<usize, TunError> {
        loop {
            let mut guard = self.async_fd.readable().await?;
            let raw_fd = guard.get_inner().as_raw_fd();
            let ret =
                unsafe { libc::read(raw_fd, buf.as_mut_ptr() as *mut libc::c_void, buf.len()) };

            if ret < 0 {
                let err = std::io::Error::last_os_error();
                if err.kind() == std::io::ErrorKind::WouldBlock {
                    guard.clear_ready();
                    continue;
                }
                return Err(TunError::Io(err));
            }

            return Ok(ret as usize);
        }
    }

    async fn write(&mut self, buf: &[u8]) -> Result<usize, TunError> {
        if buf.is_empty() {
            return Ok(0);
        }

        loop {
            let mut guard = self.async_fd.writable().await?;
            let raw_fd = guard.get_inner().as_raw_fd();
            let ret =
                unsafe { libc::write(raw_fd, buf.as_ptr() as *const libc::c_void, buf.len()) };

            if ret < 0 {
                let err = std::io::Error::last_os_error();
                if err.kind() == std::io::ErrorKind::WouldBlock {
                    guard.clear_ready();
                    continue;
                }
                // If kernel rejects a malformed packet with EINVAL, ignore without killing tunnel
                if err.raw_os_error() == Some(libc::EINVAL) {
                    tracing::debug!(target: "ovpn::tun::linux", "Kernel dropped non-IP packet written to TUN (len={})", buf.len());
                    return Ok(buf.len());
                }
                return Err(TunError::Io(err));
            }

            return Ok(ret as usize);
        }
    }
}
