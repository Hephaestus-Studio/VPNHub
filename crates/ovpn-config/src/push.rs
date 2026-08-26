//! Dynamic `PUSH_REPLY` text stream parser and negotiation model.

use crate::error::ConfigError;
use crate::model::{OpenVpnConfig, SecretString};
use crate::network_config::{
    Ipv4Route, Ipv6Route, NetworkProvisioningConfig, NetworkTopology, RedirectGatewayFlags,
};
use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::time::Duration;

/// Parsed dynamic options received from the OpenVPN server via `PUSH_REPLY`.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct PushOptions {
    /// Tunnel IP topology (`subnet`, `net30`, `p2p`).
    pub topology: Option<NetworkTopology>,

    /// Assigned client IPv4 and remote/netmask (`ifconfig <local> <remote_or_mask>`).
    pub ifconfig_v4: Option<(Ipv4Addr, Ipv4Addr)>,

    /// Assigned client IPv6 address, prefix, and gateway (`ifconfig-ipv6 <local/prefix> <remote>`).
    pub ifconfig_v6: Option<(Ipv6Addr, u8, Option<Ipv6Addr>)>,

    /// Default gateway address pushed via `route-gateway <ip>`.
    pub route_gateway: Option<Ipv4Addr>,

    /// Default route metric pushed via `route-metric <n>`.
    pub route_metric: Option<u32>,

    /// IPv4 routes pushed by server.
    pub routes_v4: Vec<Ipv4Route>,

    /// IPv6 routes pushed by server.
    pub routes_v6: Vec<Ipv6Route>,

    /// Default gateway redirect flags (`redirect-gateway`).
    pub redirect_gateway: Option<RedirectGatewayFlags>,

    /// DNS nameservers pushed via `dhcp-option DNS <ip>`.
    pub dns_servers: Vec<IpAddr>,

    /// DNS search domains pushed via `dhcp-option DOMAIN* <domain>`.
    pub search_domains: Vec<String>,

    /// WINS servers pushed via `dhcp-option WINS <ip>`.
    pub wins_servers: Vec<Ipv4Addr>,

    /// NTP servers pushed via `dhcp-option NTP <ip>`.
    pub ntp_servers: Vec<IpAddr>,

    /// Block outside DNS leak protection.
    pub block_outside_dns: bool,

    /// Keepalive ping interval.
    pub ping_interval: Option<Duration>,

    /// Keepalive ping restart timeout.
    pub ping_restart: Option<Duration>,

    /// Assigned peer ID for data channel multi-client routing.
    pub peer_id: Option<u32>,

    /// MSS clamping value (`mssfix`).
    pub mss_fix: Option<u16>,

    /// TUN device MTU.
    pub tun_mtu: Option<u32>,

    /// Explicit exit notify count.
    pub explicit_exit_notify: Option<u8>,

    /// Dynamic auth token for seamless reconnections (`auth-token <token>`).
    pub auth_token: Option<SecretString>,

    /// Symmetric cipher selected by server (`cipher <name>`).
    pub cipher: Option<String>,

    /// Custom echo or unparsed key-value directives.
    pub custom_options: HashMap<String, String>,
}

impl PushOptions {
    /// Merges these dynamic push options with a base [`OpenVpnConfig`] to produce
    /// a complete [`NetworkProvisioningConfig`] for `vpnhub-daemon`.
    pub fn build_provisioning_config(&self, base: &OpenVpnConfig) -> NetworkProvisioningConfig {
        let topology = self
            .topology
            .or(base.topology)
            .unwrap_or(NetworkTopology::Subnet);

        let mtu = self.tun_mtu.or(base.tun_mtu).unwrap_or(1500);

        // IPv4 configuration resolution
        let (ipv4_addr, ipv4_netmask, ipv4_gw) =
            if let Some((local, remote_or_mask)) = self.ifconfig_v4 {
                match topology {
                    NetworkTopology::Subnet => {
                        // In subnet topology, remote_or_mask is subnet mask
                        let gw = self.route_gateway.or_else(|| {
                            // In subnet topology, default gateway often default to first IP or route-gateway
                            None
                        });
                        (Some(local), Some(remote_or_mask), gw)
                    }
                    NetworkTopology::Net30 | NetworkTopology::P2p => {
                        // In net30/p2p topology, remote_or_mask is peer IP
                        let netmask = Ipv4Addr::new(255, 255, 255, 252);
                        (Some(local), Some(netmask), Some(remote_or_mask))
                    }
                }
            } else if let Some((local, remote_or_mask)) = base.ifconfig_v4 {
                (Some(local), Some(remote_or_mask), None)
            } else {
                (None, None, None)
            };

        // IPv6 configuration resolution
        let (ipv6_addr, ipv6_prefix, ipv6_gw) = if let Some((local, prefix, gw)) = self.ifconfig_v6
        {
            (Some(local), Some(prefix), gw)
        } else if let Some((local, remote)) = base.ifconfig_v6 {
            (Some(local), Some(64), Some(remote))
        } else {
            (None, None, None)
        };

        // Combine DNS servers (pushed takes precedence, static base appended if not present)
        let mut dns_servers = self.dns_servers.clone();
        for dns in &base.dns_servers {
            if !dns_servers.contains(dns) {
                dns_servers.push(*dns);
            }
        }

        // Combine search domains
        let mut search_domains = self.search_domains.clone();
        for dom in &base.search_domains {
            if !search_domains.contains(dom) {
                search_domains.push(dom.clone());
            }
        }

        // Combine routes
        let mut routes_v4 = self.routes_v4.clone();
        for r in &base.routes_v4 {
            if !routes_v4.contains(r) {
                routes_v4.push(r.clone());
            }
        }

        let mut routes_v6 = self.routes_v6.clone();
        for r in &base.routes_v6 {
            if !routes_v6.contains(r) {
                routes_v6.push(r.clone());
            }
        }

        // Gateway redirection
        let redirect_gateway = self.redirect_gateway.unwrap_or(base.redirect_gateway);

        // Block outside DNS
        let block_outside_dns = self.block_outside_dns || base.block_outside_dns;

        // MSS Fix
        let mss_fix = self.mss_fix.or(base.mss_fix);

        // Ping / Keepalive
        let ping_interval = self.ping_interval.or(base.ping_interval);
        let ping_restart = self.ping_restart.or(base.ping_restart);

        NetworkProvisioningConfig {
            interface_name: Some(base.dev.clone()),
            mtu,
            topology,
            ipv4_address: ipv4_addr,
            ipv4_netmask,
            ipv4_gateway: ipv4_gw,
            ipv6_address: ipv6_addr,
            ipv6_prefix_len: ipv6_prefix,
            ipv6_gateway: ipv6_gw,
            dns_servers,
            search_domains,
            wins_servers: self.wins_servers.clone(),
            ntp_servers: self.ntp_servers.clone(),
            routes_v4,
            routes_v6,
            excluded_routes_v4: Vec::new(),
            excluded_routes_v6: Vec::new(),
            redirect_gateway,
            block_outside_dns,
            mss_fix,
            peer_id: self.peer_id,
            ping_interval,
            ping_restart,
            custom_options: self.custom_options.clone(),
        }
    }
}

/// Splits a raw PUSH_REPLY payload into individual option strings.
/// Supports both comma-separated and newline-separated entries, respecting quoted strings.
pub fn split_push_reply_items(payload: &str) -> Vec<String> {
    let mut clean = payload.trim();
    if let Some(stripped) = clean.strip_prefix("PUSH_REPLY") {
        clean = stripped.trim_start_matches([',', ' ', '\t', '\n', '\r']);
    }

    let mut items = Vec::new();
    let mut current = String::new();
    let mut in_double_quote = false;
    let mut in_single_quote = false;
    let mut chars = clean.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            '\\' => {
                if let Some(next_c) = chars.next() {
                    current.push(next_c);
                }
            }
            '"' if !in_single_quote => {
                in_double_quote = !in_double_quote;
            }
            '\'' if !in_double_quote => {
                in_single_quote = !in_single_quote;
            }
            ',' | '\n' | '\r' if !in_double_quote && !in_single_quote => {
                let trimmed = current.trim();
                if !trimmed.is_empty() {
                    items.push(trimmed.to_string());
                }
                current.clear();
            }
            _ => {
                current.push(c);
            }
        }
    }

    let trimmed = current.trim();
    if !trimmed.is_empty() {
        items.push(trimmed.to_string());
    }

    items
}

/// Parses a PUSH_REPLY text stream into [`PushOptions`].
pub fn parse_push_reply(payload: &str) -> Result<PushOptions, ConfigError> {
    let mut options = PushOptions::default();
    let items = split_push_reply_items(payload);

    for item in items {
        let parts: Vec<&str> = item.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        let verb = parts[0].to_ascii_lowercase();
        let args = &parts[1..];

        match verb.as_str() {
            "topology" => {
                if let Some(top) = args.first() {
                    options.topology = match top.to_ascii_lowercase().as_str() {
                        "subnet" => Some(NetworkTopology::Subnet),
                        "net30" => Some(NetworkTopology::Net30),
                        "p2p" => Some(NetworkTopology::P2p),
                        _ => None,
                    };
                }
            }
            "ifconfig" => {
                if args.len() >= 2 {
                    if let (Ok(local), Ok(remote)) =
                        (args[0].parse::<Ipv4Addr>(), args[1].parse::<Ipv4Addr>())
                    {
                        options.ifconfig_v4 = Some((local, remote));
                    }
                }
            }
            "ifconfig-ipv6" => {
                if let Some(first) = args.first() {
                    let parts_v6: Vec<&str> = first.split('/').collect();
                    if let Ok(ip) = parts_v6[0].parse::<Ipv6Addr>() {
                        let prefix = parts_v6
                            .get(1)
                            .and_then(|p| p.parse::<u8>().ok())
                            .unwrap_or(64);
                        let gw = args.get(1).and_then(|g| g.parse::<Ipv6Addr>().ok());
                        options.ifconfig_v6 = Some((ip, prefix, gw));
                    }
                }
            }
            "route-gateway" => {
                if let Some(gw_str) = args.first() {
                    if let Ok(gw) = gw_str.parse::<Ipv4Addr>() {
                        options.route_gateway = Some(gw);
                    }
                }
            }
            "route-metric" => {
                if let Some(m_str) = args.first() {
                    if let Ok(m) = m_str.parse::<u32>() {
                        options.route_metric = Some(m);
                    }
                }
            }
            "route" => {
                if let Some(dest_str) = args.first() {
                    if let Ok(dest) = dest_str.parse::<Ipv4Addr>() {
                        let netmask = args
                            .get(1)
                            .and_then(|m| m.parse::<Ipv4Addr>().ok())
                            .unwrap_or(Ipv4Addr::new(255, 255, 255, 255));
                        let gateway = args
                            .get(2)
                            .and_then(|g| g.parse::<Ipv4Addr>().ok())
                            .or(options.route_gateway);
                        let metric = args
                            .get(3)
                            .and_then(|m| m.parse::<u32>().ok())
                            .or(options.route_metric);
                        options
                            .routes_v4
                            .push(Ipv4Route::new(dest, netmask, gateway, metric));
                    }
                }
            }
            "route-ipv6" => {
                if let Some(dest_str) = args.first() {
                    let parts_v6: Vec<&str> = dest_str.split('/').collect();
                    if let Ok(dest) = parts_v6[0].parse::<Ipv6Addr>() {
                        let prefix = parts_v6
                            .get(1)
                            .and_then(|p| p.parse::<u8>().ok())
                            .unwrap_or(128);
                        let gateway = args.get(1).and_then(|g| g.parse::<Ipv6Addr>().ok());
                        let metric = args
                            .get(2)
                            .and_then(|m| m.parse::<u32>().ok())
                            .or(options.route_metric);
                        options
                            .routes_v6
                            .push(Ipv6Route::new(dest, prefix, gateway, metric));
                    }
                }
            }
            "redirect-gateway" | "redirect-private" => {
                options.redirect_gateway = Some(RedirectGatewayFlags::from_args(args));
            }
            "dhcp-option" => {
                if args.len() >= 2 {
                    let opt_type = args[0].to_ascii_uppercase();
                    let opt_val = args[1..].join(" ");
                    match opt_type.as_str() {
                        "DNS" => {
                            if let Ok(ip) = opt_val.parse::<IpAddr>() {
                                if !options.dns_servers.contains(&ip) {
                                    options.dns_servers.push(ip);
                                }
                            }
                        }
                        "DOMAIN" | "DOMAIN-SEARCH" | "ADAPTER_DOMAIN_SUFFIX" => {
                            if !options.search_domains.contains(&opt_val) {
                                options.search_domains.push(opt_val);
                            }
                        }
                        "WINS" => {
                            if let Ok(ip) = opt_val.parse::<Ipv4Addr>() {
                                if !options.wins_servers.contains(&ip) {
                                    options.wins_servers.push(ip);
                                }
                            }
                        }
                        "NTP" => {
                            if let Ok(ip) = opt_val.parse::<IpAddr>() {
                                if !options.ntp_servers.contains(&ip) {
                                    options.ntp_servers.push(ip);
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
            "block-outside-dns" => {
                options.block_outside_dns = true;
            }
            "ping" => {
                if let Some(sec) = args.first().and_then(|s| s.parse::<u64>().ok()) {
                    options.ping_interval = Some(Duration::from_secs(sec));
                }
            }
            "ping-restart" => {
                if let Some(sec) = args.first().and_then(|s| s.parse::<u64>().ok()) {
                    options.ping_restart = Some(Duration::from_secs(sec));
                }
            }
            "peer-id" => {
                if let Some(id) = args.first().and_then(|s| s.parse::<u32>().ok()) {
                    options.peer_id = Some(id);
                }
            }
            "mssfix" => {
                let mss = args
                    .first()
                    .and_then(|s| s.parse::<u16>().ok())
                    .unwrap_or(1450);
                options.mss_fix = Some(mss);
            }
            "tun-mtu" => {
                if let Some(m) = args.first().and_then(|s| s.parse::<u32>().ok()) {
                    options.tun_mtu = Some(m);
                }
            }
            "explicit-exit-notify" => {
                let n = args.first().and_then(|s| s.parse::<u8>().ok()).unwrap_or(1);
                options.explicit_exit_notify = Some(n);
            }
            "auth-token" => {
                if let Some(tok) = args.first() {
                    options.auth_token = Some(SecretString::new(*tok));
                }
            }
            "cipher" => {
                if let Some(c) = args.first() {
                    options.cipher = Some(c.to_string());
                }
            }
            _ => {
                options.custom_options.insert(verb, args.join(" "));
            }
        }
    }

    Ok(options)
}
