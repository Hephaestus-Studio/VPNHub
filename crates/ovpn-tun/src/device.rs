//! Virtual TUN device abstraction interface.

use crate::error::TunError;
use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Common abstraction for reading and writing raw IP packets to a virtual TUN interface.
#[async_trait]
pub trait VirtualTunDevice: Send + Sync {
    /// Returns the assigned interface name (e.g. `tun0`, `utun3`, `wintun`).
    fn name(&self) -> &str;

    /// Returns the MTU (Maximum Transmission Unit) of the interface.
    fn mtu(&self) -> usize;

    /// Reads a raw IP packet from the TUN device into the provided buffer.
    async fn read(&mut self, buf: &mut [u8]) -> Result<usize, TunError>;

    /// Writes a raw IP packet to the TUN device.
    async fn write(&mut self, buf: &[u8]) -> Result<usize, TunError>;
}

/// In-memory Mock TUN device for testing and protocol integration without root/privileged sockets.
#[derive(Clone)]
pub struct MockTunDevice {
    name: String,
    mtu: usize,
    rx_queue: Arc<Mutex<tokio::sync::mpsc::Receiver<Vec<u8>>>>,
    tx_sender: tokio::sync::mpsc::Sender<Vec<u8>>,
    tx_collector: Arc<Mutex<Vec<Vec<u8>>>>,
    _inbound_tx: tokio::sync::mpsc::Sender<Vec<u8>>,
}

impl MockTunDevice {
    /// Creates a pair of linked mock TUN devices.
    pub fn new(name: &str, mtu: usize) -> (Self, tokio::sync::mpsc::Sender<Vec<u8>>) {
        let (inbound_tx, inbound_rx) = tokio::sync::mpsc::channel(128);
        let (outbound_tx, mut outbound_rx) = tokio::sync::mpsc::channel::<Vec<u8>>(128);
        let collector = Arc::new(Mutex::new(Vec::new()));
        let col_clone = collector.clone();

        tokio::spawn(async move {
            while let Some(pkt) = outbound_rx.recv().await {
                col_clone.lock().await.push(pkt);
            }
        });

        let dev = Self {
            name: name.to_string(),
            mtu,
            rx_queue: Arc::new(Mutex::new(inbound_rx)),
            tx_sender: outbound_tx,
            tx_collector: collector,
            _inbound_tx: inbound_tx.clone(),
        };

        (dev, inbound_tx)
    }

    /// Gets all packets written to this TUN device.
    pub async fn get_written_packets(&self) -> Vec<Vec<u8>> {
        self.tx_collector.lock().await.clone()
    }
}

#[async_trait]
impl VirtualTunDevice for MockTunDevice {
    fn name(&self) -> &str {
        &self.name
    }

    fn mtu(&self) -> usize {
        self.mtu
    }

    async fn read(&mut self, buf: &mut [u8]) -> Result<usize, TunError> {
        let mut rx = self.rx_queue.lock().await;
        match rx.recv().await {
            Some(pkt) => {
                let copy_len = pkt.len().min(buf.len());
                buf[..copy_len].copy_from_slice(&pkt[..copy_len]);
                Ok(copy_len)
            }
            None => {
                tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
                Ok(0)
            }
        }
    }

    async fn write(&mut self, buf: &[u8]) -> Result<usize, TunError> {
        self.tx_sender.send(buf.to_vec()).await.map_err(|_| {
            TunError::Io(std::io::Error::new(
                std::io::ErrorKind::BrokenPipe,
                "Mock TUN receiver closed",
            ))
        })?;
        Ok(buf.len())
    }
}
