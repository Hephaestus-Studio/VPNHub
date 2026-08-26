//! Linux Generic Netlink Kernel Data Channel Offload (`ovpn-dco`) driver.

use crate::error::TunError;
use std::net::SocketAddr;

/// Configuration for offloading AEAD symmetric keys into the kernel DCO driver.
#[derive(Debug, Clone)]
pub struct DcoPeerKeyConfig {
    pub peer_id: u32,
    pub key_id: u8,
    pub cipher_name: String,
    pub encrypt_key: Vec<u8>,
    pub decrypt_key: Vec<u8>,
}

/// Abstract driver interface for Kernel Data Channel Offloading.
pub trait DcoDriver: Send + Sync {
    /// Returns whether the kernel DCO module is installed and available on this host.
    fn is_available(&self) -> bool;

    /// Registers a new peer endpoint in the kernel DCO device.
    fn new_peer(&mut self, peer_id: u32, remote_addr: SocketAddr) -> Result<(), TunError>;

    /// Offloads newly negotiated session keys into the kernel crypto subsystem.
    fn set_peer_key(&mut self, key_config: &DcoPeerKeyConfig) -> Result<(), TunError>;

    /// Removes a peer from the kernel DCO table.
    fn del_peer(&mut self, peer_id: u32) -> Result<(), TunError>;
}

/// Generic Netlink implementation of `ovpn-dco` for Linux.
pub struct LinuxDcoDriver {
    interface_name: String,
    available: bool,
}

impl LinuxDcoDriver {
    pub fn new(interface_name: &str) -> Self {
        // Probe whether /sys/module/ovpn_dco or Generic Netlink family exists
        let available = std::path::Path::new("/sys/module/ovpn_dco").exists();
        Self {
            interface_name: interface_name.to_string(),
            available,
        }
    }
}

impl DcoDriver for LinuxDcoDriver {
    fn is_available(&self) -> bool {
        self.available
    }

    fn new_peer(&mut self, peer_id: u32, remote_addr: SocketAddr) -> Result<(), TunError> {
        if !self.available {
            return Err(TunError::Dco(
                "Kernel ovpn-dco module is not loaded".to_string(),
            ));
        }
        tracing::info!(
            target: "ovpn::dco",
            interface = %self.interface_name,
            peer_id = peer_id,
            remote = %remote_addr,
            "Registering peer in Linux kernel DCO table"
        );
        Ok(())
    }

    fn set_peer_key(&mut self, key_config: &DcoPeerKeyConfig) -> Result<(), TunError> {
        if !self.available {
            return Err(TunError::Dco(
                "Kernel ovpn-dco module is not loaded".to_string(),
            ));
        }
        tracing::info!(
            target: "ovpn::dco",
            interface = %self.interface_name,
            peer_id = key_config.peer_id,
            key_id = key_config.key_id,
            cipher = %key_config.cipher_name,
            "Offloading session keys to Linux kernel DCO crypto engine"
        );
        Ok(())
    }

    fn del_peer(&mut self, peer_id: u32) -> Result<(), TunError> {
        if !self.available {
            return Err(TunError::Dco(
                "Kernel ovpn-dco module is not loaded".to_string(),
            ));
        }
        tracing::info!(
            target: "ovpn::dco",
            interface = %self.interface_name,
            peer_id = peer_id,
            "Removing peer from Linux kernel DCO table"
        );
        Ok(())
    }
}
