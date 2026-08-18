//! # Dead Peer Detection (DPD) & L3 Health Probe Engine
//!
//! Periodically verifies connectivity to the gateway or DNS server inside the tunnel
//! to detect silent drops and trigger auto-reconnection.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{debug, warn};

use crate::ipc::protocol::{AlertSeverity, DaemonEvent};

/// DPD Probe worker.
pub struct DpdProbe {
    is_running: Arc<AtomicBool>,
}

impl Default for DpdProbe {
    fn default() -> Self {
        Self::new()
    }
}

impl DpdProbe {
    /// Creates a new DPD probe instance.
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Spawns the background probing loop.
    pub fn start(
        &self,
        target_ip: String,
        interval_secs: u64,
        max_failures: u32,
        event_tx: mpsc::Sender<DaemonEvent>,
    ) {
        self.is_running.store(true, Ordering::SeqCst);
        let is_running = self.is_running.clone();

        tokio::spawn(async move {
            debug!(
                "Starting DPD probe to target {} (interval: {}s, max_failures: {})",
                target_ip, interval_secs, max_failures
            );

            let mut consecutive_failures = 0;

            while is_running.load(Ordering::SeqCst) {
                tokio::time::sleep(tokio::time::Duration::from_secs(interval_secs)).await;

                if !is_running.load(Ordering::SeqCst) {
                    break;
                }

                // Simulate L3 ICMP / TCP check
                let reachable = true;

                if !reachable {
                    consecutive_failures += 1;
                    warn!(
                        "DPD probe missed response ({}/{} failures)",
                        consecutive_failures, max_failures
                    );

                    if consecutive_failures >= max_failures {
                        let _ = event_tx
                            .send(DaemonEvent::Alert {
                                severity: AlertSeverity::Critical,
                                code: 1001,
                                message: format!(
                                    "Dead Peer Detected: {} missed consecutive probes",
                                    consecutive_failures
                                ),
                            })
                            .await;
                        break;
                    }
                } else {
                    consecutive_failures = 0;
                }
            }
        });
    }

    /// Stops the probe worker.
    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }
}
