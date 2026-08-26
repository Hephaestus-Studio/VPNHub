//! # ovpn-tun
//!
//! Cross-platform zero-copy Virtual TUN interface drivers (Linux, macOS, Windows)
//! and Linux Kernel Data Channel Offload (`ovpn-dco`) subsystem for `openvpn3-rs`.

#![deny(unsafe_code)]

pub mod dco;
pub mod device;
pub mod error;

#[cfg(target_os = "linux")]
#[allow(unsafe_code)]
pub mod linux;

#[cfg(target_os = "macos")]
#[allow(unsafe_code)]
pub mod macos;

#[cfg(target_os = "windows")]
pub mod windows;

pub use dco::{DcoDriver, DcoPeerKeyConfig, LinuxDcoDriver};
pub use device::{MockTunDevice, VirtualTunDevice};
pub use error::TunError;

#[cfg(target_os = "linux")]
pub use linux::LinuxTunDevice;

#[cfg(target_os = "macos")]
pub use macos::MacOsTunDevice;

#[cfg(target_os = "windows")]
pub use windows::WindowsTunDevice;
