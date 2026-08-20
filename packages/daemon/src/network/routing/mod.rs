//! # Routing Subsystem

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "linux")]
pub use linux::LinuxRouteManager as PlatformRouteManager;

#[cfg(target_os = "windows")]
pub use windows::WindowsRouteManager as PlatformRouteManager;

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
#[derive(Default)]
pub struct MockRouteManager;

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
impl MockRouteManager {
    pub fn new() -> Self {
        Self
    }
    pub fn setup_vpn_routing(
        &mut self,
        _server_ip: &str,
        _tunnel_iface: &str,
        _assigned_ip: Option<&str>,
        _intranet_only: bool,
        _pushed_routes: &[String],
        _custom_subnets: &[String],
        _lan_bypass: bool,
    ) -> Result<(), crate::error::NetworkError> {
        Ok(())
    }
    pub fn teardown_vpn_routing(
        &mut self,
        _server_ip: &str,
        _tunnel_iface: &str,
    ) -> Result<(), crate::error::NetworkError> {
        Ok(())
    }
    pub fn local_lan_subnet(&self) -> Option<&str> {
        None
    }
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
pub use MockRouteManager as PlatformRouteManager;
