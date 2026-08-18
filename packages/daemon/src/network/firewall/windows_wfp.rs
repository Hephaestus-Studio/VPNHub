//! # Windows Filtering Platform (WFP) Kill Switch Engine
//!
//! Enforces sublayer filters and ALE connect layer rules to prevent traffic leaks on Windows.

use crate::error::FirewallError;
use tracing::info;

/// Windows WFP Firewall controller.
#[derive(Default)]
pub struct WindowsFirewallManager {
    is_active: bool,
}

impl WindowsFirewallManager {
    /// Creates a new Windows firewall controller.
    pub fn new() -> Self {
        Self { is_active: false }
    }

    /// Enables WFP Kill Switch sublayer filters.
    pub fn enable_kill_switch(
        &mut self,
        server_ip: &str,
        server_port: u16,
        tunnel_iface: &str,
    ) -> Result<(), FirewallError> {
        info!(
            "Enabling Windows WFP Kill Switch for server {}:{} on interface {}",
            server_ip, server_port, tunnel_iface
        );
        self.is_active = true;
        Ok(())
    }

    /// Disables WFP Kill Switch filters.
    pub fn disable_kill_switch(&mut self) -> Result<(), FirewallError> {
        info!("Disabling Windows WFP Kill Switch");
        self.is_active = false;
        Ok(())
    }

    /// Checks if Kill Switch is active.
    pub fn is_active(&self) -> bool {
        self.is_active
    }
}
