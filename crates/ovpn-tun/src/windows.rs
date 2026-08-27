//! Windows Wintun Virtual Network Interface driver.

#![cfg(target_os = "windows")]

use crate::device::VirtualTunDevice;
use crate::error::TunError;
use async_trait::async_trait;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tracing::{debug, error, info, warn};

const WINTUN_DLL_BYTES: &[u8] = include_bytes!("../wintun.dll");

/// Helper function to locate or extract embedded `wintun.dll`.
fn ensure_wintun_dll() -> PathBuf {
    // 1. Check current directory
    if std::path::Path::new("wintun.dll").exists() {
        return PathBuf::from("wintun.dll");
    }

    // 2. Check directory of current executable
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let candidate = exe_dir.join("wintun.dll");
            if candidate.exists() {
                return candidate;
            }
            if std::fs::write(&candidate, WINTUN_DLL_BYTES).is_ok() {
                return candidate;
            }
        }
    }

    // 3. Fallback to System Temp directory
    let temp_dll = std::env::temp_dir().join("wintun.dll");
    let _ = std::fs::write(&temp_dll, WINTUN_DLL_BYTES);
    temp_dll
}

/// Windows Wintun virtual network adapter driver.
pub struct WindowsTunDevice {
    name: String,
    mtu: usize,
    session: Arc<wintun::Session>,
    _adapter: Arc<wintun::Adapter>,
    rx_channel: Arc<Mutex<mpsc::Receiver<Vec<u8>>>>,
    is_running: Arc<AtomicBool>,
}

impl WindowsTunDevice {
    /// Opens or creates a Wintun adapter on Windows.
    pub fn create(desired_name: Option<&str>, mtu: usize) -> Result<Self, TunError> {
        let name = desired_name.unwrap_or("wintun").to_string();
        let dll_path = ensure_wintun_dll();

        info!(
            target: "ovpn::tun",
            "Loading Wintun driver from '{}'",
            dll_path.display()
        );

        let wintun = unsafe { wintun::load_from_path(&dll_path) }.map_err(|e| {
            TunError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to load wintun.dll: {}", e),
            ))
        })?;

        // Try to open existing adapter or create a new one
        let adapter = match wintun::Adapter::open(&wintun, &name) {
            Ok(a) => {
                info!(target: "ovpn::tun", "Opened existing Wintun adapter '{}'", name);
                a
            }
            Err(_) => {
                info!(target: "ovpn::tun", "Creating new Wintun adapter '{}'", name);
                wintun::Adapter::create(&wintun, &name, "VPNHub Tunnel", None).map_err(|e| {
                    TunError::Io(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        format!("Failed to create Wintun adapter: {}", e),
                    ))
                })?
            }
        };

        let session = adapter
            .start_session(wintun::MAX_RING_CAPACITY)
            .map_err(|e| {
                TunError::Io(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to start Wintun session: {}", e),
                ))
            })?;
        let session = Arc::new(session);

        let (tx, rx) = mpsc::channel::<Vec<u8>>(2048);
        let is_running = Arc::new(AtomicBool::new(true));

        // Spawn background worker thread for non-blocking receive from Wintun ring buffer
        let session_recv = session.clone();
        let running_flag = is_running.clone();

        std::thread::Builder::new()
            .name("wintun-rx-worker".to_string())
            .spawn(move || {
                debug!(target: "ovpn::tun", "Wintun RX worker loop started");
                while running_flag.load(Ordering::Relaxed) {
                    match session_recv.receive_blocking() {
                        Ok(packet) => {
                            let bytes = packet.bytes().to_vec();
                            if tx.blocking_send(bytes).is_err() {
                                break;
                            }
                        }
                        Err(e) => {
                            if !running_flag.load(Ordering::Relaxed) {
                                break;
                            }
                            warn!(target: "ovpn::tun", "Wintun receive error: {}", e);
                            std::thread::sleep(std::time::Duration::from_millis(50));
                        }
                    }
                }
                debug!(target: "ovpn::tun", "Wintun RX worker loop terminated");
            })
            .map_err(|e| TunError::Io(e))?;

        Ok(Self {
            name,
            mtu,
            session,
            _adapter: adapter,
            rx_channel: Arc::new(Mutex::new(rx)),
            is_running,
        })
    }
}

impl Drop for WindowsTunDevice {
    fn drop(&mut self) {
        self.is_running.store(false, Ordering::Relaxed);
        let _ = self.session.shutdown();
        info!(target: "ovpn::tun", "Wintun session shut down cleanly");
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

    async fn read(&mut self, buf: &mut [u8]) -> Result<usize, TunError> {
        let mut rx = self.rx_channel.lock().await;
        match rx.recv().await {
            Some(pkt) => {
                let copy_len = pkt.len().min(buf.len());
                buf[..copy_len].copy_from_slice(&pkt[..copy_len]);
                Ok(copy_len)
            }
            None => Err(TunError::Io(std::io::Error::new(
                std::io::ErrorKind::UnexpectedEof,
                "Wintun RX channel closed",
            ))),
        }
    }

    async fn write(&mut self, buf: &[u8]) -> Result<usize, TunError> {
        match self.session.allocate_send_packet(buf.len() as u16) {
            Ok(mut packet) => {
                packet.bytes_mut().copy_from_slice(buf);
                self.session.send_packet(packet);
                Ok(buf.len())
            }
            Err(e) => {
                error!(target: "ovpn::tun", "Failed to allocate send packet in Wintun ring buffer: {}", e);
                Err(TunError::Io(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Wintun send allocation failed: {}", e),
                )))
            }
        }
    }
}
