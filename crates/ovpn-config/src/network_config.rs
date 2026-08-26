//! Network provisioning DTO contract for VPNHub daemon integration.
//!
//! This module defines the stable data transfer object [`NetworkProvisioningConfig`]
//! dispatched by the OpenVPN protocol engine upon successful connection and dynamic
//! option negotiation (`PUSH_REPLY`). The privileged host daemon (`vpnhub-daemon`)
//! consumes this configuration to provision network adapters, IP addresses,
//! routes, and DNS uniformly across VPN protocols.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::time::Duration;

/// An IPv4 routing entry to be configured on the host system.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Ipv4Route {
    /// Destination network or host address.
    pub destination: Ipv4Addr,
    /// Subnet mask (e.g. `255.255.255.0` or `255.255.255.255`).
    pub netmask: Ipv4Addr,
    /// Next-hop gateway IP (if any). If `None`, routed via the VPN interface.
    pub gateway: Option<Ipv4Addr>,
    /// Route metric / priority.
    pub metric: Option<u32>,
}

impl Ipv4Route {
    /// Creates a new IPv4 route.
    pub fn new(
        destination: Ipv4Addr,
        netmask: Ipv4Addr,
        gateway: Option<Ipv4Addr>,
        metric: Option<u32>,
    ) -> Self {
        Self {
            destination,
            netmask,
            gateway,
            metric,
        }
    }

    /// Prefix length computed from the subnet mask (e.g. 24 for 255.255.255.0).
    pub fn prefix_len(&self) -> u8 {
        u32::from(self.netmask).count_ones() as u8
    }
}

/// An IPv6 routing entry to be configured on the host system.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Ipv6Route {
    /// Destination IPv6 network address.
    pub destination: Ipv6Addr,
    /// CIDR prefix length (e.g. 64 or 128).
    pub prefix_len: u8,
    /// Next-hop gateway IPv6 address (if any).
    pub gateway: Option<Ipv6Addr>,
    /// Route metric / priority.
    pub metric: Option<u32>,
}

impl Ipv6Route {
    /// Creates a new IPv6 route.
    pub fn new(
        destination: Ipv6Addr,
        prefix_len: u8,
        gateway: Option<Ipv6Addr>,
        metric: Option<u32>,
    ) -> Self {
        Self {
            destination,
            prefix_len,
            gateway,
            metric,
        }
    }
}

/// Flags controlling how default gateway redirection (`redirect-gateway`) is handled.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct RedirectGatewayFlags {
    /// Use two /1 routes (0.0.0.0/1 and 128.0.0.0/1) instead of replacing 0.0.0.0/0 (`def1`).
    pub def1: bool,
    /// Automatically determine if the gateway is local (`local` or `autolocal`).
    pub local: bool,
    /// Also redirect IPv6 traffic (`ipv6`).
    pub ipv6: bool,
    /// Block local gateway (`block-local`).
    pub block_local: bool,
    /// Bypass default gateway for DHCP (`bypass-dhcp`).
    pub bypass_dhcp: bool,
    /// Bypass default gateway for DNS (`bypass-dns`).
    pub bypass_dns: bool,
    /// Whether default gateway redirection is enabled at all.
    pub enabled: bool,
}

impl RedirectGatewayFlags {
    /// Parse flags from OpenVPN `redirect-gateway` arguments.
    pub fn from_args(args: &[&str]) -> Self {
        let mut flags = Self {
            enabled: true,
            def1: false,
            local: false,
            ipv6: false,
            block_local: false,
            bypass_dhcp: false,
            bypass_dns: false,
        };

        for arg in args {
            match *arg {
                "def1" => flags.def1 = true,
                "local" | "autolocal" => flags.local = true,
                "ipv6" => flags.ipv6 = true,
                "block-local" => flags.block_local = true,
                "bypass-dhcp" => flags.bypass_dhcp = true,
                "bypass-dns" => flags.bypass_dns = true,
                _ => {}
            }
        }

        flags
    }
}

/// VPN Network Topology mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum NetworkTopology {
    /// Point-to-point with /30 subnets per client (`net30`).
    #[default]
    Net30,
    /// Single IP subnet with direct point-to-point or broadcast semantics (`subnet`).
    Subnet,
    /// Pure point-to-point mode (`p2p`).
    P2p,
}

/// Complete network provisioning configuration dispatched from `openvpn3-rs`
/// to the host privileged daemon (`vpnhub-daemon`).
///
/// Marked `#[non_exhaustive]` to allow backward-compatible additions in future protocol versions.
#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NetworkProvisioningConfig {
    /// Preferred interface name (e.g. `tun0`, `utun4`, `wintun`).
    pub interface_name: Option<String>,

    /// Tunnel device MTU.
    pub mtu: u32,

    /// Tunnel device IP topology.
    pub topology: NetworkTopology,

    /// Assigned client IPv4 address.
    pub ipv4_address: Option<Ipv4Addr>,

    /// IPv4 subnet mask or peer address (in net30/p2p mode).
    pub ipv4_netmask: Option<Ipv4Addr>,

    /// IPv4 default gateway / remote peer address.
    pub ipv4_gateway: Option<Ipv4Addr>,

    /// Assigned client IPv6 address.
    pub ipv6_address: Option<Ipv6Addr>,

    /// Assigned client IPv6 prefix length.
    pub ipv6_prefix_len: Option<u8>,

    /// IPv6 default gateway / remote peer address.
    pub ipv6_gateway: Option<Ipv6Addr>,

    /// Configured DNS nameservers (IPv4 and IPv6).
    pub dns_servers: Vec<IpAddr>,

    /// DNS search domains.
    pub search_domains: Vec<String>,

    /// WINS (Windows Internet Name Service) servers.
    pub wins_servers: Vec<Ipv4Addr>,

    /// NTP time servers pushed by VPN server.
    pub ntp_servers: Vec<IpAddr>,

    /// IPv4 routes to install through the tunnel.
    pub routes_v4: Vec<Ipv4Route>,

    /// IPv6 routes to install through the tunnel.
    pub routes_v6: Vec<Ipv6Route>,

    /// IPv4 routes explicitly excluded from the tunnel (split tunneling bypass).
    pub excluded_routes_v4: Vec<Ipv4Route>,

    /// IPv6 routes explicitly excluded from the tunnel.
    pub excluded_routes_v6: Vec<Ipv6Route>,

    /// Default gateway redirection parameters.
    pub redirect_gateway: RedirectGatewayFlags,

    /// Flag to enforce DNS leak protection (Windows WFP / Linux resolved block).
    pub block_outside_dns: bool,

    /// Maximum Segment Size (MSS) clamp value for TCP frames (`--mssfix`).
    pub mss_fix: Option<u16>,

    /// Dynamic OpenVPN peer ID assigned by server (for multi-client data channel multiplexing).
    pub peer_id: Option<u32>,

    /// Keepalive ping interval.
    pub ping_interval: Option<Duration>,

    /// Keepalive ping restart timeout.
    pub ping_restart: Option<Duration>,

    /// Custom key-value metadata parameters negotiated or configured.
    pub custom_options: HashMap<String, String>,
}

impl Default for NetworkProvisioningConfig {
    fn default() -> Self {
        Self {
            interface_name: None,
            mtu: 1500,
            topology: NetworkTopology::Subnet,
            ipv4_address: None,
            ipv4_netmask: None,
            ipv4_gateway: None,
            ipv6_address: None,
            ipv6_prefix_len: None,
            ipv6_gateway: None,
            dns_servers: Vec::new(),
            search_domains: Vec::new(),
            wins_servers: Vec::new(),
            ntp_servers: Vec::new(),
            routes_v4: Vec::new(),
            routes_v6: Vec::new(),
            excluded_routes_v4: Vec::new(),
            excluded_routes_v6: Vec::new(),
            redirect_gateway: RedirectGatewayFlags::default(),
            block_outside_dns: false,
            mss_fix: None,
            peer_id: None,
            ping_interval: None,
            ping_restart: None,
            custom_options: HashMap::new(),
        }
    }
}

impl NetworkProvisioningConfig {
    /// Creates a new builder for [`NetworkProvisioningConfig`].
    pub fn builder() -> NetworkProvisioningConfigBuilder {
        NetworkProvisioningConfigBuilder::default()
    }
}

/// Builder for constructing [`NetworkProvisioningConfig`] instances cleanly.
#[derive(Debug, Default)]
pub struct NetworkProvisioningConfigBuilder {
    config: NetworkProvisioningConfig,
}

impl NetworkProvisioningConfigBuilder {
    pub fn interface_name(mut self, name: impl Into<String>) -> Self {
        self.config.interface_name = Some(name.into());
        self
    }

    pub fn mtu(mut self, mtu: u32) -> Self {
        self.config.mtu = mtu;
        self
    }

    pub fn topology(mut self, topology: NetworkTopology) -> Self {
        self.config.topology = topology;
        self
    }

    pub fn ipv4(mut self, address: Ipv4Addr, netmask: Ipv4Addr, gateway: Option<Ipv4Addr>) -> Self {
        self.config.ipv4_address = Some(address);
        self.config.ipv4_netmask = Some(netmask);
        self.config.ipv4_gateway = gateway;
        self
    }

    pub fn ipv6(mut self, address: Ipv6Addr, prefix_len: u8, gateway: Option<Ipv6Addr>) -> Self {
        self.config.ipv6_address = Some(address);
        self.config.ipv6_prefix_len = Some(prefix_len);
        self.config.ipv6_gateway = gateway;
        self
    }

    pub fn add_dns_server(mut self, server: IpAddr) -> Self {
        if !self.config.dns_servers.contains(&server) {
            self.config.dns_servers.push(server);
        }
        self
    }

    pub fn add_search_domain(mut self, domain: impl Into<String>) -> Self {
        self.config.search_domains.push(domain.into());
        self
    }

    pub fn add_route_v4(mut self, route: Ipv4Route) -> Self {
        self.config.routes_v4.push(route);
        self
    }

    pub fn add_route_v6(mut self, route: Ipv6Route) -> Self {
        self.config.routes_v6.push(route);
        self
    }

    pub fn redirect_gateway(mut self, flags: RedirectGatewayFlags) -> Self {
        self.config.redirect_gateway = flags;
        self
    }

    pub fn block_outside_dns(mut self, block: bool) -> Self {
        self.config.block_outside_dns = block;
        self
    }

    pub fn mss_fix(mut self, mss: u16) -> Self {
        self.config.mss_fix = Some(mss);
        self
    }

    pub fn peer_id(mut self, id: u32) -> Self {
        self.config.peer_id = Some(id);
        self
    }

    pub fn ping(mut self, interval: Duration, restart: Duration) -> Self {
        self.config.ping_interval = Some(interval);
        self.config.ping_restart = Some(restart);
        self
    }

    pub fn add_custom_option(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.config.custom_options.insert(key.into(), value.into());
        self
    }

    pub fn build(self) -> NetworkProvisioningConfig {
        self.config
    }
}
