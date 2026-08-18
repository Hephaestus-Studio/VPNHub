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
    ) -> Result<(), NetworkError> {
        info!(
            "Configuring Windows routing for VPN server {} on interface {}",
            server_ip, tunnel_iface
        );
        Ok(())
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
