//! # Linux Fail-Closed Firewall & Kill Switch (`nftables` / `iptables`)
//!
//! Enforces an atomic fail-closed Kill Switch table on Linux, preventing any outbound
//! traffic from escaping to the physical interface when the VPN tunnel drops.

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

    /// Activates fail-closed Kill Switch rules.
    pub fn enable_kill_switch(
        &mut self,
        server_ip: &str,
        server_port: u16,
        tunnel_iface: &str,
    ) -> Result<(), FirewallError> {
        info!(
            "Enabling fail-closed Kill Switch on Linux (Server: {}:{}, Interface: {})",
            server_ip, server_port, tunnel_iface
        );

        // Define atomic nftables ruleset
        let ruleset = format!(
            "table inet {} {{\n\
                chain output {{\n\
                    type filter hook output priority 0; policy drop;\n\
                    oif \"lo\" accept\n\
                    oif \"{}\" accept\n\
                    ip daddr {} th dport {} accept\n\
                    ct state established,related accept\n\
                }}\n\
            }}",
            NFT_TABLE_NAME, tunnel_iface, server_ip, server_port
        );

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
        self.apply_iptables_fallback(server_ip, server_port, tunnel_iface)?;
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
            .status();
        let _ = std::process::Command::new("iptables")
            .args(["-X", "VPNHUB_OUTPUT"])
            .status();
    }
}
