//! # Platform Service Lifecycle Subsystem

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "linux")]
pub use linux::LinuxPlatform as PlatformService;

#[cfg(target_os = "windows")]
pub use windows::WindowsPlatform as PlatformService;

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
pub struct MockPlatform;

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
impl MockPlatform {
    pub fn notify_ready() -> Result<(), crate::error::PlatformError> {
        Ok(())
    }
    pub fn notify_stopping() -> Result<(), crate::error::PlatformError> {
        Ok(())
    }
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
pub use MockPlatform as PlatformService;
