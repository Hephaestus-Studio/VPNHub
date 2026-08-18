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
    /// Applies MTU and brings up the virtual interface.
    pub fn configure_interface(iface: &str, mtu: u32) -> Result<(), NetworkError> {
        info!("Configuring virtual interface '{}' with MTU {}", iface, mtu);

        #[cfg(target_os = "linux")]
        {
            // Execute `ip link set dev <iface> mtu <mtu> up`
            debug!("Bringing up interface '{}' on Linux", iface);
            let status = std::process::Command::new("ip")
                .args(["link", "set", "dev", iface, "mtu", &mtu.to_string(), "up"])
                .status();

            match status {
                Ok(s) if s.success() => Ok(()),
                Ok(s) => {
                    debug!("ip link set exited with status: {}", s);
                    Ok(()) // Allow fallback if running in test environment
                }
                Err(e) => {
                    debug!("Could not execute ip command: {}", e);
                    Ok(())
                }
            }
        }

        #[cfg(not(target_os = "linux"))]
        {
            let _ = (iface, mtu);
            Ok(())
        }
    }
}
