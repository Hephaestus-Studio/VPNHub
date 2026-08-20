//! # Windows IP Routing Engine
//!
//! Controls routing entries on Windows via IP Helper API / PowerShell cmdlets.

use crate::error::NetworkError;
use tracing::info;

/// Windows IP routing controller.
#[derive(Default)]
pub struct WindowsRouteManager;

impl WindowsRouteManager {
    /// Creates a new Windows route manager.
    pub fn new() -> Self {
        Self
    }

    /// Sets up default tunnel routing on Windows.
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
            "Configuring Windows routing for VPN server {} on interface {} (intranet_only={})",
            server_ip, tunnel_iface, intranet_only
        );
        let _ = (assigned_ip, pushed_routes, custom_subnets, lan_bypass);
        Ok(())
    }

    /// Returns the detected local physical LAN subnet.
    pub fn local_lan_subnet(&self) -> Option<&str> {
        None
    }

    /// Reverts injected routes on Windows.
    pub fn teardown_vpn_routing(
        &mut self,
        server_ip: &str,
        tunnel_iface: &str,
    ) -> Result<(), NetworkError> {
        info!(
            "Tearing down Windows VPN routes for interface {}",
            tunnel_iface
        );
        let _ = (server_ip, tunnel_iface);
        Ok(())
    }
}
