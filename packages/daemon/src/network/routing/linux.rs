//! # Linux Policy Routing & Route Table Engine
//!
//! Implements policy-based IP routing (`ip rule`, `ip route`), table isolation,
//! preservation of original default gateways, Intranet-Only routing, and Smart LAN bypass.

use crate::error::NetworkError;
use tracing::{debug, info};

/// Dedicated custom routing table ID for VPNHub policy routing.
pub const VPNHUB_ROUTE_TABLE_ID: u32 = 100;

/// Linux IP routing controller.
pub struct LinuxRouteManager {
    original_gateway: Option<String>,
    physical_interface: Option<String>,
    local_lan_subnet: Option<String>,
    injected_routes: Vec<String>,
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
            physical_interface: None,
            local_lan_subnet: None,
            injected_routes: Vec::new(),
        }
    }

    /// Sets up VPN routing (Full Tunnel or Intranet-Only) and preserves native LAN connectivity.
    pub fn setup_vpn_routing(
        &mut self,
        server_ip: &str,
        tunnel_iface: &str,
        assigned_ip: Option<&str>,
        intranet_only: bool,
        pushed_routes: &[String],
        custom_subnets: &[String],
        lan_bypass: bool,
    ) -> Result<(), NetworkError> {
        info!(
            "Configuring Linux routing for VPN server {} via interface {} (intranet_only={})",
            server_ip, tunnel_iface, intranet_only
        );

        // 1. Detect and preserve default gateway & physical LAN interface
        self.discover_original_gateway();

        // 2. Add static host route to VPN server via original default gateway so tunnel packets don't loop
        if let Some(ref gw) = self.original_gateway {
            debug!(
                "Adding explicit host route to VPN server {} via gateway {}",
                server_ip, gw
            );
            let res = std::process::Command::new("ip")
                .args(["route", "add", server_ip, "via", gw])
                .status();
            if let Ok(st) = res {
                if st.success() {
                    self.injected_routes
                        .push(format!("{} via {}", server_ip, gw));
                }
            }
        }

        // 3. Smart LAN Bypass: detect local physical LAN subnet and preserve direct connectivity
        if lan_bypass {
            self.detect_local_lan_subnet();
            if let Some(ref subnet) = self.local_lan_subnet {
                info!(
                    "Smart LAN Bypass active for local physical subnet: {}",
                    subnet
                );
            }
        }

        // 4. Configure routes based on Intranet-Only vs Full-Tunnel
        if intranet_only {
            info!("Intranet-Only routing active: Default gateway stays on physical interface");

            // Add route for assigned VPN interface subnet if available
            if let Some(ip_cidr) = assigned_ip {
                debug!(
                    "Adding direct route for assigned VPN IP subnet: {} on {}",
                    ip_cidr, tunnel_iface
                );
                let _ = std::process::Command::new("ip")
                    .args(["route", "add", ip_cidr, "dev", tunnel_iface])
                    .status();
                self.injected_routes
                    .push(format!("{} dev {}", ip_cidr, tunnel_iface));
            }

            // Automatically route standard corporate enterprise private subnets (RFC 1918: 10.0.0.0/8, 172.16.0.0/12)
            // This guarantees instant access to corporate gateways, staging, and databases even if the server
            // push options were fragmented or dropped by parser quirks.
            let standard_intranet_subnets = ["10.0.0.0/8", "172.16.0.0/12"];
            for subnet in &standard_intranet_subnets {
                debug!(
                    "Injecting standard enterprise intranet subnet: {} dev {}",
                    subnet, tunnel_iface
                );
                let status = std::process::Command::new("ip")
                    .args(["route", "add", subnet, "dev", tunnel_iface])
                    .status();
                if let Ok(st) = status {
                    if st.success() {
                        self.injected_routes
                            .push(format!("{} dev {}", subnet, tunnel_iface));
                    }
                }
            }

            // Inject all pushed routes from VPN server
            for route in pushed_routes {
                debug!(
                    "Injecting server-pushed intranet route: {} via {}",
                    route, tunnel_iface
                );
                let status = std::process::Command::new("ip")
                    .args(["route", "add", route, "dev", tunnel_iface])
                    .status();
                if let Ok(st) = status {
                    if st.success() {
                        self.injected_routes
                            .push(format!("{} dev {}", route, tunnel_iface));
                    }
                }
            }

            // Inject custom user-defined corporate subnets (e.g. 10.0.0.0/8, 192.168.10.0/24)
            for subnet in custom_subnets {
                debug!(
                    "Injecting user custom corporate subnet: {} via {}",
                    subnet, tunnel_iface
                );
                let status = std::process::Command::new("ip")
                    .args(["route", "add", subnet, "dev", tunnel_iface])
                    .status();
                if let Ok(st) = status {
                    if st.success() {
                        self.injected_routes
                            .push(format!("{} dev {}", subnet, tunnel_iface));
                    }
                }
            }
        } else {
            // Full Tunnel mode: Inject 0.0.0.0/1 and 128.0.0.0/1 scoped default routes
            debug!(
                "Injecting Full-Tunnel scoped default routes via {}",
                tunnel_iface
            );
            let _ = std::process::Command::new("ip")
                .args(["route", "add", "0.0.0.0/1", "dev", tunnel_iface])
                .status();
            let _ = std::process::Command::new("ip")
                .args(["route", "add", "128.0.0.0/1", "dev", tunnel_iface])
                .status();
            self.injected_routes
                .push(format!("0.0.0.0/1 dev {}", tunnel_iface));
            self.injected_routes
                .push(format!("128.0.0.0/1 dev {}", tunnel_iface));

            // Also inject any specific pushed and custom routes for explicit precision
            for route in pushed_routes.iter().chain(custom_subnets.iter()) {
                let _ = std::process::Command::new("ip")
                    .args(["route", "add", route, "dev", tunnel_iface])
                    .status();
                self.injected_routes
                    .push(format!("{} dev {}", route, tunnel_iface));
            }
        }

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

        // Delete all tracked injected routes
        for entry in self.injected_routes.drain(..) {
            let parts: Vec<&str> = entry.split_whitespace().collect();
            if parts.len() >= 3 {
                let _ = std::process::Command::new("ip")
                    .args(["route", "del", parts[0], parts[1], parts[2]])
                    .status();
            }
        }

        // Fallback cleanup of standard routes
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

        self.local_lan_subnet = None;
        self.original_gateway = None;
        self.physical_interface = None;

        Ok(())
    }

    /// Returns the detected local physical LAN subnet (e.g. `192.168.1.0/24`).
    pub fn local_lan_subnet(&self) -> Option<&str> {
        self.local_lan_subnet.as_deref()
    }

    /// Discovers original default gateway and outgoing interface via `ip route show default`.
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
            if let Some(idx) = parts.iter().position(|&r| r == "dev") {
                if let Some(dev) = parts.get(idx + 1) {
                    debug!("Discovered physical gateway interface: {}", dev);
                    self.physical_interface = Some(dev.to_string());
                }
            }
        }
    }

    /// Detects the subnet of the physical interface currently connected to the local network.
    fn detect_local_lan_subnet(&mut self) {
        if let Some(ref dev) = self.physical_interface {
            // Check direct kernel subnet route: e.g. "192.168.1.0/24 dev wlan0 proto kernel scope link"
            if let Ok(output) = std::process::Command::new("ip")
                .args(["route", "show", "dev", dev, "proto", "kernel"])
                .output()
            {
                let text = String::from_utf8_lossy(&output.stdout);
                for line in text.lines() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if let Some(subnet) = parts.first() {
                        if subnet.contains('/') && !subnet.starts_with("169.254.") {
                            debug!("Detected local physical LAN subnet: {}", subnet);
                            self.local_lan_subnet = Some(subnet.to_string());
                            return;
                        }
                    }
                }
            }

            // Fallback: ip -o -4 addr show <dev>
            if let Ok(output) = std::process::Command::new("ip")
                .args(["-o", "-4", "addr", "show", "dev", dev])
                .output()
            {
                let text = String::from_utf8_lossy(&output.stdout);
                // line format: 2: wlan0    inet 192.168.1.50/24 brd ...
                for line in text.lines() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if let Some(idx) = parts.iter().position(|&r| r == "inet") {
                        if let Some(cidr) = parts.get(idx + 1) {
                            if let Some((ip_str, mask_str)) = cidr.split_once('/') {
                                if let (Ok(ip), Ok(mask)) =
                                    (ip_str.parse::<std::net::Ipv4Addr>(), mask_str.parse::<u8>())
                                {
                                    let ip_u32 = u32::from(ip);
                                    let mask_u32 = if mask == 0 { 0 } else { !0u32 << (32 - mask) };
                                    let net_u32 = ip_u32 & mask_u32;
                                    let net_ip = std::net::Ipv4Addr::from(net_u32);
                                    let calculated_subnet = format!("{}/{}", net_ip, mask);
                                    debug!("Calculated local LAN subnet: {}", calculated_subnet);
                                    self.local_lan_subnet = Some(calculated_subnet);
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
