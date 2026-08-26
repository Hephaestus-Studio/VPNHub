//! # Firewall & Kill Switch Subsystem

#[cfg(target_os = "linux")]
pub mod linux_nft;
#[cfg(target_os = "windows")]
pub mod windows_wfp;

#[cfg(target_os = "linux")]
pub use linux_nft::LinuxFirewallManager as PlatformFirewallManager;

#[cfg(target_os = "windows")]
pub use windows_wfp::WindowsFirewallManager as PlatformFirewallManager;

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
#[derive(Default)]
pub struct MockFirewallManager {
    is_active: bool,
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
impl MockFirewallManager {
    pub fn new() -> Self {
        Self { is_active: false }
    }
    pub fn enable_kill_switch(
        &mut self,
        _server_endpoint_ips: &[String],
        _server_port: u16,
        _tunnel_iface: &str,
        _intranet_only: bool,
        _vpn_subnets: &[String],
        _webrtc_protection: bool,
        _local_lan_subnet: Option<&str>,
    ) -> Result<(), crate::error::FirewallError> {
        self.is_active = true;
        Ok(())
    }

    pub fn disable_kill_switch(&mut self) -> Result<(), crate::error::FirewallError> {
        self.is_active = false;
        Ok(())
    }
    pub fn is_active(&self) -> bool {
        self.is_active
    }
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
pub use MockFirewallManager as PlatformFirewallManager;
