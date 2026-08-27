//! # Windows DNS Manager
//!
//! Configures DNS servers on the Windows VPN tunnel interface.

use crate::error::DnsError;
use tracing::info;

/// Windows DNS Controller.
#[derive(Default)]
pub struct WindowsDnsManager {
    configured_iface: Option<String>,
}

impl WindowsDnsManager {
    /// Creates a new Windows DNS manager.
    pub fn new() -> Self {
        Self::default()
    }

    /// Configures DNS servers on the VPN tunnel interface.
    pub fn configure_dns(
        &mut self,
        tunnel_iface: &str,
        dns_servers: &[String],
    ) -> Result<(), DnsError> {
        info!(
            "Configuring Windows DNS for interface '{}' (Servers: {:?})",
            tunnel_iface, dns_servers
        );

        #[cfg(windows)]
        {
            if let Some(primary) = dns_servers.first() {
                let _ = std::process::Command::new("netsh")
                    .args([
                        "interface",
                        "ipv4",
                        "set",
                        "dns",
                        &format!("name={}", tunnel_iface),
                        "static",
                        primary,
                        "validate=no",
                    ])
                    .status();

                for sec in dns_servers.iter().skip(1) {
                    let _ = std::process::Command::new("netsh")
                        .args([
                            "interface",
                            "ipv4",
                            "add",
                            "dns",
                            &format!("name={}", tunnel_iface),
                            sec,
                            "validate=no",
                        ])
                        .status();
                }

                self.configured_iface = Some(tunnel_iface.to_string());
            }
        }

        Ok(())
    }

    /// Cleans up DNS rules upon disconnection.
    pub fn restore_dns(&mut self) -> Result<(), DnsError> {
        info!("Restoring Windows DNS configuration");

        #[cfg(windows)]
        {
            if let Some(iface) = self.configured_iface.take() {
                let _ = std::process::Command::new("netsh")
                    .args([
                        "interface",
                        "ipv4",
                        "set",
                        "dns",
                        &format!("name={}", iface),
                        "dhcp",
                    ])
                    .status();
            }
        }

        Ok(())
    }
}
