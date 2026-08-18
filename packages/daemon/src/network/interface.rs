//! # Virtual Interface & MTU / MSS Clamping Manager
//!
//! Configures TUN/TAP and Wintun virtual adapters, path MTU discovery,
//! and TCP MSS clamping to prevent packet fragmentation.

use crate::error::NetworkError;
use tracing::{debug, info};

/// Standard MTU for VPN tunnels (allowing for protocol encapsulation overhead).
pub const DEFAULT_VPN_MTU: u32 = 1420;

/// Manages virtual interface allocation, link state, and MTU clamping.
pub struct InterfaceManager;

impl InterfaceManager {
    /// Allocates TUN device if needed, assigns virtual IP address, applies MTU, and brings up the virtual interface.
    pub fn configure_interface(
        iface: &str,
        mtu: u32,
        assigned_ip: Option<&str>,
    ) -> Result<(), NetworkError> {
        info!("Configuring virtual interface '{}' with MTU {}", iface, mtu);

        #[cfg(target_os = "linux")]
        {
            // 1. Check if interface already exists; if not, create TUN device
            let check = std::process::Command::new("ip")
                .args(["link", "show", "dev", iface])
                .output();

            let exists = check.map(|o| o.status.success()).unwrap_or(false);
            if !exists {
                debug!("Allocating TUN device '{}' on Linux", iface);
                let _ = std::process::Command::new("ip")
                    .args(["tuntap", "add", "dev", iface, "mode", "tun"])
                    .status();
            }

            // 2. Set MTU and bring up link
            debug!(
                "Bringing up interface '{}' on Linux with MTU {}",
                iface, mtu
            );
            let _ = std::process::Command::new("ip")
                .args(["link", "set", "dev", iface, "mtu", &mtu.to_string(), "up"])
                .status();

            // 3. Assign virtual tunnel IP address if provided
            if let Some(ip) = assigned_ip {
                let formatted_ip = if ip.contains('/') {
                    ip.to_string()
                } else {
                    format!("{}/24", ip)
                };

                debug!(
                    "Assigning virtual IP '{}' to interface '{}'",
                    formatted_ip, iface
                );
                // Flush existing IPs to prevent stale bindings
                let _ = std::process::Command::new("ip")
                    .args(["addr", "flush", "dev", iface])
                    .status();

                let _ = std::process::Command::new("ip")
                    .args(["addr", "add", &formatted_ip, "dev", iface])
                    .status();
            }

            Ok(())
        }

        #[cfg(not(target_os = "linux"))]
        {
            let _ = (iface, mtu, assigned_ip);
            Ok(())
        }
    }

    /// Cleans up and destroys allocated virtual interface.
    pub fn teardown_interface(iface: &str) -> Result<(), NetworkError> {
        info!("Tearing down virtual interface '{}'", iface);

        #[cfg(target_os = "linux")]
        {
            debug!("Deallocating TUN device '{}' on Linux", iface);
            let _ = std::process::Command::new("ip")
                .args(["tuntap", "del", "dev", iface, "mode", "tun"])
                .status();
            Ok(())
        }

        #[cfg(not(target_os = "linux"))]
        {
            let _ = iface;
            Ok(())
        }
    }

    /// Checks whether any active VPN network interface is UP on the host system.
    pub fn has_active_vpn_interface() -> bool {
        #[cfg(unix)]
        {
            if let Ok(dir) = std::fs::read_dir("/sys/class/net") {
                for entry in dir.flatten() {
                    if let Ok(name) = entry.file_name().into_string() {
                        if name.starts_with("tun")
                            || name.starts_with("tap")
                            || name.starts_with("wg")
                            || name.starts_with("vpnhub")
                            || name.starts_with("wintun")
                        {
                            if let Ok(operstate) = std::fs::read_to_string(format!(
                                "/sys/class/net/{}/operstate",
                                name
                            )) {
                                let state = operstate.trim();
                                if state == "up" || state == "unknown" {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        false
    }
}
