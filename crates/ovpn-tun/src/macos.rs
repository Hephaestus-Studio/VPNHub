//! macOS `utun` Virtual Network Interface driver.

#![cfg(target_os = "macos")]

use crate::device::VirtualTunDevice;
use crate::error::TunError;
use async_trait::async_trait;
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
use tokio::io::unix::AsyncFd;

/// macOS `utun` network interface.
pub struct MacOsTunDevice {
    name: String,
    mtu: usize,
    async_fd: AsyncFd<OwnedFd>,
}

impl MacOsTunDevice {
    /// Creates a new `utun` device on macOS.
    pub fn create(desired_unit: Option<u32>, mtu: usize) -> Result<Self, TunError> {
        let fd = unsafe { libc::socket(libc::PF_SYSTEM, libc::SOCK_DGRAM, libc::SYSPROTO_CONTROL) };
        if fd < 0 {
            return Err(TunError::DeviceCreationFailed(
                std::io::Error::last_os_error().to_string(),
            ));
        }

        // Set non-blocking
        unsafe {
            let flags = libc::fcntl(fd, libc::F_GETFL, 0);
            libc::fcntl(fd, libc::F_SETFL, flags | libc::O_NONBLOCK);
        }

        let unit_num = desired_unit.unwrap_or(0);
        let actual_name = format!("utun{unit_num}");

        let owned_fd = unsafe { OwnedFd::from_raw_fd(fd) };
        let async_fd =
            AsyncFd::new(owned_fd).map_err(|e| TunError::DeviceCreationFailed(e.to_string()))?;

        Ok(Self {
            name: actual_name,
            mtu,
            async_fd,
        })
    }
}

#[async_trait]
impl VirtualTunDevice for MacOsTunDevice {
    fn name(&self) -> &str {
        &self.name
    }

    fn mtu(&self) -> usize {
        self.mtu
    }

    async fn read(&mut self, buf: &mut [u8]) -> Result<usize, TunError> {
        // macOS utun prepends a 4-byte protocol family (AF_INET/AF_INET6)
        let mut raw_buf = vec![0u8; buf.len() + 4];
        loop {
            let mut guard = self.async_fd.readable().await?;
            let raw_fd = guard.get_inner().as_raw_fd();
            let ret = unsafe {
                libc::read(
                    raw_fd,
                    raw_buf.as_mut_ptr() as *mut libc::c_void,
                    raw_buf.len(),
                )
            };

            if ret < 0 {
                let err = std::io::Error::last_os_error();
                if err.kind() == std::io::ErrorKind::WouldBlock {
                    guard.clear_ready();
                    continue;
                }
                return Err(TunError::Io(err));
            }

            if ret <= 4 {
                continue;
            }

            let payload_len = (ret as usize) - 4;
            buf[..payload_len].copy_from_slice(&raw_buf[4..ret as usize]);
            return Ok(payload_len);
        }
    }

    async fn write(&mut self, buf: &[u8]) -> Result<usize, TunError> {
        if buf.is_empty() {
            return Ok(0);
        }

        let ip_ver = buf[0] >> 4;
        let af: u32 = if ip_ver == 6 {
            libc::AF_INET6 as u32
        } else {
            libc::AF_INET as u32
        };
        let af_bytes = af.to_be_bytes();

        let mut raw_buf = Vec::with_capacity(4 + buf.len());
        raw_buf.extend_from_slice(&af_bytes);
        raw_buf.extend_from_slice(buf);

        loop {
            let mut guard = self.async_fd.writable().await?;
            let raw_fd = guard.get_inner().as_raw_fd();
            let ret = unsafe {
                libc::write(
                    raw_fd,
                    raw_buf.as_ptr() as *const libc::c_void,
                    raw_buf.len(),
                )
            };

            if ret < 0 {
                let err = std::io::Error::last_os_error();
                if err.kind() == std::io::ErrorKind::WouldBlock {
                    guard.clear_ready();
                    continue;
                }
                return Err(TunError::Io(err));
            }

            return Ok(buf.len());
        }
    }
}
