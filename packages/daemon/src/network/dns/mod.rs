//! # DNS Leak Protection Subsystem

#[cfg(target_os = "linux")]
pub mod systemd_resolved;
#[cfg(target_os = "windows")]
pub mod windows_nrpt;

#[cfg(target_os = "linux")]
pub use systemd_resolved::LinuxDnsManager as PlatformDnsManager;

#[cfg(target_os = "windows")]
pub use windows_nrpt::WindowsDnsManager as PlatformDnsManager;

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
#[derive(Default)]
pub struct MockDnsManager;

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
impl MockDnsManager {
    pub fn new() -> Self {
        Self
    }
    pub fn configure_dns(
        &mut self,
        _tunnel_iface: &str,
        _dns_servers: &[String],
    ) -> Result<(), crate::error::DnsError> {
        Ok(())
    }
    pub fn restore_dns(&mut self) -> Result<(), crate::error::DnsError> {
        Ok(())
    }
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
pub use MockDnsManager as PlatformDnsManager;
