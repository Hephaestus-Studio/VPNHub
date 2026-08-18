//! # Network Management & Rollback Orchestrator
//!
//! Provides a unified interface combining virtual device MTU clamping, IP routing,
//! fail-closed firewall enforcement, and DNS leak prevention with RAII rollback safety.

pub mod dns;
pub mod firewall;
pub mod interface;
pub mod routing;

use tracing::{error, info, warn};

use crate::error::DaemonError;
use crate::network::dns::PlatformDnsManager;
use crate::network::firewall::PlatformFirewallManager;
use crate::network::interface::{InterfaceManager, DEFAULT_VPN_MTU};
use crate::network::routing::PlatformRouteManager;

/// Unified coordinator managing all OS-level network state.
pub struct NetworkManager {
    router: PlatformRouteManager,
    firewall: PlatformFirewallManager,
    dns: PlatformDnsManager,
    active_tunnel: Option<TunnelContext>,
}

struct TunnelContext {
    server_ip: String,
    server_port: u16,
    iface: String,
}

impl Default for NetworkManager {
    fn default() -> Self {
        Self::new()
    }
}

impl NetworkManager {
    /// Creates a new NetworkManager instance.
    pub fn new() -> Self {
        Self {
            router: PlatformRouteManager::new(),
            firewall: PlatformFirewallManager::new(),
            dns: PlatformDnsManager::new(),
            active_tunnel: None,
        }
    }

    /// Sets up network protections and routes for a newly connected VPN session.
    pub fn setup_vpn_network(
        &mut self,
        server_ip: &str,
        server_port: u16,
        iface: &str,
        assigned_ip: Option<&str>,
        enable_kill_switch: bool,
        dns_servers: &[String],
    ) -> Result<(), DaemonError> {
        info!(
            "Applying network configuration for tunnel interface '{}'",
            iface
        );

        // 1. Configure interface MTU and assign virtual IP
        InterfaceManager::configure_interface(iface, DEFAULT_VPN_MTU, assigned_ip)?;

        // 2. Configure routing
        self.router.setup_vpn_routing(server_ip, iface)?;

        // 3. Configure DNS
        if !dns_servers.is_empty() {
            if let Err(e) = self.dns.configure_dns(iface, dns_servers) {
                warn!("Non-fatal DNS configuration error: {}", e);
            }
        }

        // 4. Configure Kill Switch if requested
        if enable_kill_switch {
            if let Err(e) = self
                .firewall
                .enable_kill_switch(server_ip, server_port, iface)
            {
                error!("Failed to engage Kill Switch: {}", e);
            }
        }

        self.active_tunnel = Some(TunnelContext {
            server_ip: server_ip.to_string(),
            server_port,
            iface: iface.to_string(),
        });

        Ok(())
    }

    /// Tears down network protections and reverts original routes upon disconnection.
    pub fn teardown_vpn_network(&mut self) -> Result<(), DaemonError> {
        info!("Reverting all VPN network modifications");

        // 1. Disable Kill Switch
        if self.firewall.is_active() {
            let _ = self.firewall.disable_kill_switch();
        }

        // 2. Restore DNS
        let _ = self.dns.restore_dns();

        // 3. Teardown routing
        if let Some(ctx) = self.active_tunnel.take() {
            let _ = self.router.teardown_vpn_routing(&ctx.server_ip, &ctx.iface);
            // 4. Teardown virtual interface
            let _ = InterfaceManager::teardown_interface(&ctx.iface);
        }

        Ok(())
    }

    /// Dynamically toggles Kill Switch state.
    pub fn set_kill_switch(&mut self, enabled: bool) -> Result<(), DaemonError> {
        if let Some(ref ctx) = self.active_tunnel {
            if enabled {
                self.firewall
                    .enable_kill_switch(&ctx.server_ip, ctx.server_port, &ctx.iface)?;
            } else {
                self.firewall.disable_kill_switch()?;
            }
        }
        Ok(())
    }

    /// Checks if Kill Switch is active.
    pub fn is_kill_switch_active(&self) -> bool {
        self.firewall.is_active()
    }
}

impl Drop for NetworkManager {
    fn drop(&mut self) {
        if self.active_tunnel.is_some() || self.firewall.is_active() {
            warn!(
                "NetworkManager dropped with active state; executing automatic emergency cleanup"
            );
            let _ = self.teardown_vpn_network();
        }
    }
}
