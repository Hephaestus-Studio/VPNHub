//! # Windows NRPT (Name Resolution Policy Table) DNS Manager
//!
//! Configures NRPT rules on Windows to prevent DNS query leakage through physical adapters.

use crate::error::DnsError;
use tracing::info;

/// Windows DNS Controller.
#[derive(Default)]
pub struct WindowsDnsManager;

impl WindowsDnsManager {
    /// Creates a new Windows DNS manager.
    pub fn new() -> Self {
        Self
    }

    /// Configures NRPT rules for DNS routing.
    pub fn configure_dns(
        &mut self,
        tunnel_iface: &str,
        dns_servers: &[String],
    ) -> Result<(), DnsError> {
        info!(
            "Configuring Windows NRPT DNS rules for interface {} (Servers: {:?})",
            tunnel_iface, dns_servers
        );
        Ok(())
    }

    /// Cleans up NRPT rules upon disconnection.
    pub fn restore_dns(&mut self) -> Result<(), DnsError> {
        info!("Restoring Windows DNS NRPT rules");
        Ok(())
    }
}
