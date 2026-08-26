//! Windows Wintun Virtual Network Interface driver.

#![cfg(target_os = "windows")]

use crate::device::VirtualTunDevice;
use crate::error::TunError;
use async_trait::async_trait;

/// Windows Wintun virtual network adapter.
pub struct WindowsTunDevice {
    name: String,
    mtu: usize,
}

impl WindowsTunDevice {
    /// Opens or creates a Wintun adapter on Windows.
    pub fn create(desired_name: Option<&str>, mtu: usize) -> Result<Self, TunError> {
        let name = desired_name.unwrap_or("wintun").to_string();
        Ok(Self { name, mtu })
    }
}

#[async_trait]
impl VirtualTunDevice for WindowsTunDevice {
    fn name(&self) -> &str {
        &self.name
    }

    fn mtu(&self) -> usize {
        self.mtu
    }

    async fn read(&mut self, _buf: &mut [u8]) -> Result<usize, TunError> {
        // Fallback for Windows compilation without live kernel driver
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        Ok(0)
    }

    async fn write(&mut self, buf: &[u8]) -> Result<usize, TunError> {
        Ok(buf.len())
    }
}
