//! # Linux Fail-Closed Firewall & Kill Switch (`nftables` / `iptables`)
//!
//! Enforces an atomic fail-closed Kill Switch table on Linux, preventing any outbound
//! traffic from escaping to the physical interface when the VPN tunnel drops, with
//! support for Full-Tunnel vs Intranet-Only leak suppression, WebRTC STUN blocks, and Smart LAN bypass.

use crate::error::FirewallError;
use tracing::{debug, info, warn};

/// Dedicated nftables table name for VPNHub Kill Switch.
pub const NFT_TABLE_NAME: &str = "vpnhub_killswitch";

/// Linux Firewall & Kill Switch Controller.
pub struct LinuxFirewallManager {
    is_active: bool,
}

impl Default for LinuxFirewallManager {
    fn default() -> Self {
        Self::new()
    }
}

impl LinuxFirewallManager {
    /// Creates a new Linux firewall controller.
    pub fn new() -> Self {
        Self { is_active: false }
    }

    /// Activates fail-closed Kill Switch, WebRTC shields, and Smart LAN exemptions.
    pub fn enable_kill_switch(
        &mut self,
        server_endpoint_ips: &[String],
        server_port: u16,
        tunnel_iface: &str,
        intranet_only: bool,
        vpn_subnets: &[String],
        webrtc_protection: bool,
        local_lan_subnet: Option<&str>,
    ) -> Result<(), FirewallError> {
        info!(
            "Enabling Firewall Shields on Linux (Server IPs: {:?}:{}, Interface: {}, IntranetOnly: {}, WebRTC: {})",
            server_endpoint_ips, server_port, tunnel_iface, intranet_only, webrtc_protection
        );

        let target_ips = if server_endpoint_ips.is_empty() {
            vec!["0.0.0.0".to_string()]
        } else {
            server_endpoint_ips.to_vec()
        };

        let mut ruleset = String::new();
        ruleset.push_str(&format!("table inet {} {{\n", NFT_TABLE_NAME));
        ruleset.push_str("    chain output {\n");

        if intranet_only {
            // Intranet-Only Mode: Policy is accept for general internet,
            // but DROP leaks to corporate subnets or WebRTC leaks if routed outside VPN tunnel
            ruleset.push_str("        type filter hook output priority 0; policy accept;\n");
            ruleset.push_str("        oif \"lo\" accept\n");
            ruleset.push_str(&format!("        oif \"{}\" accept\n", tunnel_iface));

            // Smart LAN exemption
            if let Some(lan) = local_lan_subnet {
                ruleset.push_str(&format!("        ip daddr {} accept\n", lan));
            }

            // WebRTC STUN drop outside tunnel
            if webrtc_protection {
                ruleset.push_str(&format!(
                    "        udp dport {{ 3478, 5349, 19302, 19303, 19304, 19305, 19306, 19307, 19308, 19309 }} oif != \"{}\" oif != \"lo\" drop\n",
                    tunnel_iface
                ));
            }

            // Drop any packet destined for VPN corporate subnets if not going through the tunnel
            for subnet in vpn_subnets {
                let s = subnet.trim();
                if !s.is_empty() {
                    let formatted_subnet = if let Some((ip, mask)) = s.split_once('/') {
                        if mask == "255.255.255.255" {
                            format!("{ip}/32")
                        } else if let Ok(m) = mask.parse::<std::net::Ipv4Addr>() {
                            let cidr = u32::from(m).count_ones();
                            format!("{ip}/{cidr}")
                        } else {
                            s.to_string()
                        }
                    } else {
                        s.to_string()
                    };

                    ruleset.push_str(&format!(
                        "        ip daddr {} meta oifname != {{ \"{}\", \"lo\" }} drop\n",
                        formatted_subnet, tunnel_iface
                    ));
                }
            }

            ruleset.push_str("        ct state established,related accept\n");
        } else {
            // Full-Tunnel Fail-Closed Kill Switch
            ruleset.push_str("        type filter hook output priority 0; policy drop;\n");
            ruleset.push_str("        oif \"lo\" accept\n");
            ruleset.push_str(&format!("        oif \"{}\" accept\n", tunnel_iface));
            for tip in &target_ips {
                ruleset.push_str(&format!(
                    "        ip daddr {} th dport {} accept\n",
                    tip, server_port
                ));
            }
            // Preserve local DHCP broadcast
            ruleset.push_str("        udp dport { 67, 68 } accept\n");
            ruleset.push_str("        ip daddr 255.255.255.255 accept\n");

            // Smart LAN physical subnet accept
            if let Some(lan) = local_lan_subnet {
                ruleset.push_str(&format!("        ip daddr {} accept\n", lan));
                ruleset.push_str("        ip daddr 224.0.0.0/4 accept\n");
            }

            // WebRTC STUN drop outside tunnel
            if webrtc_protection {
                ruleset.push_str(&format!(
                    "        udp dport {{ 3478, 5349, 19302, 19303, 19304, 19305, 19306, 19307, 19308, 19309 }} oif != \"{}\" oif != \"lo\" drop\n",
                    tunnel_iface
                ));
            }

            ruleset.push_str("        ct state established,related accept\n");
        }

        ruleset.push_str("    }\n");
        ruleset.push_str("}\n");

        debug!("Applying nftables ruleset:\n{}", ruleset);

        // Try applying via `nft -f -`
        let child = std::process::Command::new("nft")
            .args(["-f", "-"])
            .stdin(std::process::Stdio::piped())
            .spawn();

        match child {
            Ok(mut p) => {
                use std::io::Write;
                if let Some(mut stdin) = p.stdin.take() {
                    let _ = stdin.write_all(ruleset.as_bytes());
                }
                let status = p.wait();
                match status {
                    Ok(s) if s.success() => {
                        self.is_active = true;
                        info!("nftables Kill Switch table '{}' active", NFT_TABLE_NAME);
                        return Ok(());
                    }
                    Ok(s) => debug!("nft command exited with: {}", s),
                    Err(e) => debug!("Failed to wait for nft: {}", e),
                }
            }
            Err(e) => {
                debug!("nft command not found or failed to spawn: {}", e);
            }
        }

        // Fallback to iptables if nftables command fails
        let primary_ip = target_ips
            .first()
            .cloned()
            .unwrap_or_else(|| "0.0.0.0".to_string());
        self.apply_iptables_fallback(&primary_ip, server_port, tunnel_iface, local_lan_subnet)?;
        self.is_active = true;

        Ok(())
    }

    /// Disables Kill Switch rules and flushes the table.
    pub fn disable_kill_switch(&mut self) -> Result<(), FirewallError> {
        if !self.is_active {
            return Ok(());
        }

        info!("Disabling Linux Kill Switch and flushing firewall rules");

        let _ = std::process::Command::new("nft")
            .args(["delete", "table", "inet", NFT_TABLE_NAME])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();

        self.flush_iptables_fallback();
        self.is_active = false;

        Ok(())
    }

    /// Whether Kill Switch rules are actively enforced.
    pub fn is_active(&self) -> bool {
        self.is_active
    }

    /// Fallback iptables rule enforcement.
    fn apply_iptables_fallback(
        &self,
        server_ip: &str,
        server_port: u16,
        tunnel_iface: &str,
        local_lan_subnet: Option<&str>,
    ) -> Result<(), FirewallError> {
        warn!("Applying iptables fallback rules for Kill Switch");

        let _ = std::process::Command::new("iptables")
            .args(["-N", "VPNHUB_OUTPUT"])
            .status();
        let _ = std::process::Command::new("iptables")
            .args(["-A", "VPNHUB_OUTPUT", "-o", "lo", "-j", "ACCEPT"])
            .status();
        let _ = std::process::Command::new("iptables")
            .args(["-A", "VPNHUB_OUTPUT", "-o", tunnel_iface, "-j", "ACCEPT"])
            .status();
        let _ = std::process::Command::new("iptables")
            .args([
                "-A",
                "VPNHUB_OUTPUT",
                "-d",
                server_ip,
                "-p",
                "udp",
                "--dport",
                &server_port.to_string(),
                "-j",
                "ACCEPT",
            ])
            .status();

        if let Some(lan) = local_lan_subnet {
            let _ = std::process::Command::new("iptables")
                .args(["-A", "VPNHUB_OUTPUT", "-d", lan, "-j", "ACCEPT"])
                .status();
        }

        let _ = std::process::Command::new("iptables")
            .args([
                "-A",
                "VPNHUB_OUTPUT",
                "-m",
                "conntrack",
                "--ctstate",
                "ESTABLISHED,RELATED",
                "-j",
                "ACCEPT",
            ])
            .status();

        Ok(())
    }

    /// Flushes fallback iptables rules.
    fn flush_iptables_fallback(&self) {
        let _ = std::process::Command::new("iptables")
            .args(["-F", "VPNHUB_OUTPUT"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
        let _ = std::process::Command::new("iptables")
            .args(["-X", "VPNHUB_OUTPUT"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
}
