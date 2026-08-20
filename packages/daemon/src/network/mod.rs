//! # Network Management & Rollback Orchestrator
//!
//! Provides a unified interface combining virtual device MTU clamping, IP routing,
//! fail-closed firewall enforcement, DNS leak prevention, IPv6 blackhole shields,
//! and RAII rollback safety.

pub mod dns;
pub mod firewall;
pub mod interface;
pub mod ipv6;
pub mod routing;

use tracing::{error, info, warn};

use crate::error::DaemonError;
use crate::ipc::protocol::{KillSwitchMode, RoutingPolicy, SecurityPolicy};
use crate::network::dns::PlatformDnsManager;
use crate::network::firewall::PlatformFirewallManager;
use crate::network::interface::{InterfaceManager, DEFAULT_VPN_MTU};
use crate::network::ipv6::PlatformIpv6Manager;
use crate::network::routing::PlatformRouteManager;

/// Unified coordinator managing all OS-level network state.
pub struct NetworkManager {
    router: PlatformRouteManager,
    firewall: PlatformFirewallManager,
    dns: PlatformDnsManager,
    ipv6: PlatformIpv6Manager,
    active_tunnel: Option<TunnelContext>,
}

struct TunnelContext {
    server_ip: String,
    server_port: u16,
    iface: String,
    intranet_only: bool,
    vpn_subnets: Vec<String>,
    security_policy: SecurityPolicy,
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
            ipv6: PlatformIpv6Manager::new(),
            active_tunnel: None,
        }
    }

    /// Sets up network protections, routes, DNS, and firewalls for a connected VPN session.
    pub fn setup_vpn_network(
        &mut self,
        server_ip: &str,
        server_port: u16,
        iface: &str,
        assigned_ip: Option<&str>,
        dns_servers: &[String],
        pushed_routes: &[String],
        security_policy: &SecurityPolicy,
        routing_policy: &RoutingPolicy,
    ) -> Result<(), DaemonError> {
        info!(
            "Applying network configuration for tunnel interface '{}' (intranet_only={}, killswitch={:?}, ipv6={}, webrtc={})",
            iface, routing_policy.intranet_only, security_policy.kill_switch_mode, security_policy.ipv6_leak_protection, security_policy.webrtc_protection
        );

        // 1. Configure interface MTU and assign virtual IP
        InterfaceManager::configure_interface(iface, DEFAULT_VPN_MTU, assigned_ip)?;

        // 2. Configure routing (Full-Tunnel vs Intranet-Only, Pushed subnets, Custom subnets, Smart LAN)
        self.router.setup_vpn_routing(
            server_ip,
            iface,
            assigned_ip,
            routing_policy.intranet_only,
            pushed_routes,
            &routing_policy.custom_subnets,
            security_policy.lan_bypass,
        )?;

        // Collect all VPN subnets for firewall leak protection
        let mut vpn_subnets = Vec::new();
        if let Some(ip_cidr) = assigned_ip {
            vpn_subnets.push(ip_cidr.to_string());
        }
        vpn_subnets.extend_from_slice(pushed_routes);
        vpn_subnets.extend_from_slice(&routing_policy.custom_subnets);

        // 3. Configure DNS (Priority: VPN Server pushed DNS -> Secure DNS Resolver from Shield)
        let mut final_dns = Vec::new();
        if !dns_servers.is_empty() {
            final_dns.extend_from_slice(dns_servers);
        } else if security_policy.dns_protection {
            match security_policy.custom_dns_provider.to_lowercase().as_str() {
                "cloudflare" => {
                    final_dns.push("1.1.1.1".to_string());
                    final_dns.push("1.0.0.1".to_string());
                }
                "google" => {
                    final_dns.push("8.8.8.8".to_string());
                    final_dns.push("8.8.4.4".to_string());
                }
                "quad9" => {
                    final_dns.push("9.9.9.9".to_string());
                    final_dns.push("149.112.112.112".to_string());
                }
                "custom" => {
                    if !security_policy.custom_dns_servers.is_empty() {
                        final_dns.extend_from_slice(&security_policy.custom_dns_servers);
                    } else {
                        final_dns.push("1.1.1.1".to_string());
                    }
                }
                _ => {
                    final_dns.push("1.1.1.1".to_string());
                    final_dns.push("1.0.0.1".to_string());
                }
            }
        }

        if !final_dns.is_empty() {
            if let Err(e) = self.dns.configure_dns(iface, &final_dns) {
                warn!("Non-fatal DNS configuration warning: {}", e);
            }
        }

        // 4. Configure IPv6 Blackhole Leak Shield if enabled
        if security_policy.ipv6_leak_protection {
            if let Err(e) = self.ipv6.enable_ipv6_protection() {
                warn!("Non-fatal IPv6 leak shield warning: {}", e);
            }
        }

        // 5. Configure Kill Switch & WebRTC Shield
        if security_policy.kill_switch_mode != KillSwitchMode::Off {
            let local_lan = if security_policy.lan_bypass {
                self.router.local_lan_subnet()
            } else {
                None
            };

            if let Err(e) = self.firewall.enable_kill_switch(
                server_ip,
                server_port,
                iface,
                routing_policy.intranet_only,
                &vpn_subnets,
                security_policy.webrtc_protection,
                local_lan,
            ) {
                error!("Failed to engage Kill Switch / Firewall rules: {}", e);
            }
        }

        self.active_tunnel = Some(TunnelContext {
            server_ip: server_ip.to_string(),
            server_port,
            iface: iface.to_string(),
            intranet_only: routing_policy.intranet_only,
            vpn_subnets,
            security_policy: security_policy.clone(),
        });

        Ok(())
    }

    /// Tears down network protections and reverts original routes upon disconnection.
    pub fn teardown_vpn_network(&mut self) -> Result<(), DaemonError> {
        info!("Reverting all VPN network modifications and leak shields");

        // 1. Disable Kill Switch
        if self.firewall.is_active() {
            let _ = self.firewall.disable_kill_switch();
        }

        // 2. Restore IPv6 Blackhole
        if self.ipv6.is_active() {
            let _ = self.ipv6.disable_ipv6_protection();
        }

        // 3. Restore DNS
        let _ = self.dns.restore_dns();

        // 4. Teardown routing & interface
        if let Some(ctx) = self.active_tunnel.take() {
            let _ = self.router.teardown_vpn_routing(&ctx.server_ip, &ctx.iface);
            let _ = InterfaceManager::teardown_interface(&ctx.iface);
        }

        Ok(())
    }

    /// Dynamically toggles Kill Switch state.
    pub fn set_kill_switch(
        &mut self,
        enabled: bool,
        mode: Option<KillSwitchMode>,
    ) -> Result<(), DaemonError> {
        if let Some(ref mut ctx) = self.active_tunnel {
            if enabled {
                let m = mode.unwrap_or(KillSwitchMode::Strict);
                ctx.security_policy.kill_switch_mode = m;
                let local_lan = if ctx.security_policy.lan_bypass {
                    self.router.local_lan_subnet()
                } else {
                    None
                };
                self.firewall.enable_kill_switch(
                    &ctx.server_ip,
                    ctx.server_port,
                    &ctx.iface,
                    ctx.intranet_only,
                    &ctx.vpn_subnets,
                    ctx.security_policy.webrtc_protection,
                    local_lan,
                )?;
            } else {
                ctx.security_policy.kill_switch_mode = KillSwitchMode::Off;
                self.firewall.disable_kill_switch()?;
            }
        }
        Ok(())
    }

    /// Checks if Kill Switch is active.
    pub fn is_kill_switch_active(&self) -> bool {
        self.firewall.is_active()
    }

    /// Checks if IPv6 protection is active.
    pub fn is_ipv6_protected(&self) -> bool {
        self.ipv6.is_active()
    }

    /// Checks if active session is in Intranet-Only mode.
    pub fn is_intranet_only(&self) -> bool {
        self.active_tunnel
            .as_ref()
            .map(|t| t.intranet_only)
            .unwrap_or(false)
    }
}

impl Drop for NetworkManager {
    fn drop(&mut self) {
        if self.active_tunnel.is_some() || self.firewall.is_active() || self.ipv6.is_active() {
            warn!(
                "NetworkManager dropped with active state; executing automatic emergency cleanup"
            );
            let _ = self.teardown_vpn_network();
        }
    }
}
