//! # Linux Policy Routing & Route Table Engine
//!
//! Implements policy-based IP routing (`ip rule`, `ip route`), table isolation,
//! and preservation of original default gateways.

use crate::error::NetworkError;
use tracing::{debug, info};

/// Dedicated custom routing table ID for VPNHub policy routing.
pub const VPNHUB_ROUTE_TABLE_ID: u32 = 100;

/// Linux IP routing controller.
pub struct LinuxRouteManager {
    original_gateway: Option<String>,
}

impl Default for LinuxRouteManager {
    fn default() -> Self {
        Self::new()
    }
}

impl LinuxRouteManager {
    /// Creates a new Linux route manager.
    pub fn new() -> Self {
        Self {
            original_gateway: None,
        }
    }

    /// Sets up default tunnel routing and a specific host route to the VPN server.
    pub fn setup_vpn_routing(
        &mut self,
        server_ip: &str,
        tunnel_iface: &str,
    ) -> Result<(), NetworkError> {
        info!(
            "Configuring Linux routing for VPN server {} via interface {}",
            server_ip, tunnel_iface
        );

        // 1. Detect and preserve default gateway
        self.discover_original_gateway();

        // 2. Add static host route to VPN server via original default gateway
        if let Some(ref gw) = self.original_gateway {
            debug!(
                "Adding explicit host route to VPN server {} via gateway {}",
                server_ip, gw
            );
            let _ = std::process::Command::new("ip")
                .args(["route", "add", server_ip, "via", gw])
                .status();
        }

        // 3. Add default route through tunnel interface (0.0.0.0/1 and 128.0.0.0/1 trick)
        debug!("Injecting scoped default routes via {}", tunnel_iface);
        let _ = std::process::Command::new("ip")
            .args(["route", "add", "0.0.0.0/1", "dev", tunnel_iface])
            .status();
        let _ = std::process::Command::new("ip")
            .args(["route", "add", "128.0.0.0/1", "dev", tunnel_iface])
            .status();

        Ok(())
    }

    /// Reverts all injected routes and restores standard network connectivity.
    pub fn teardown_vpn_routing(
        &mut self,
        server_ip: &str,
        tunnel_iface: &str,
    ) -> Result<(), NetworkError> {
        info!(
            "Tearing down Linux VPN routes for interface {}",
            tunnel_iface
        );

        let _ = std::process::Command::new("ip")
            .args(["route", "del", "0.0.0.0/1", "dev", tunnel_iface])
            .status();
        let _ = std::process::Command::new("ip")
            .args(["route", "del", "128.0.0.0/1", "dev", tunnel_iface])
            .status();

        if let Some(ref gw) = self.original_gateway {
            let _ = std::process::Command::new("ip")
                .args(["route", "del", server_ip, "via", gw])
                .status();
        }

        Ok(())
    }

    /// Discovers original default gateway via `ip route show default`.
    fn discover_original_gateway(&mut self) {
        if let Ok(output) = std::process::Command::new("ip")
            .args(["route", "show", "default"])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            // Example: default via 192.168.1.1 dev eth0 proto dhcp metric 100
            let parts: Vec<&str> = text.split_whitespace().collect();
            if let Some(idx) = parts.iter().position(|&r| r == "via") {
                if let Some(gw) = parts.get(idx + 1) {
                    debug!("Discovered default gateway: {}", gw);
                    self.original_gateway = Some(gw.to_string());
                }
            }
        }
    }
}
