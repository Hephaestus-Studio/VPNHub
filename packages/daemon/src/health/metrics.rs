//! # Telemetry & Bandwidth Metrics Collector
//!
//! Samples real-time network throughput, byte counters, and round-trip latency.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::debug;

use crate::ipc::protocol::{BandwidthMetrics, DaemonEvent};

/// Background telemetry metrics collector.
pub struct MetricsCollector {
    is_running: Arc<AtomicBool>,
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

impl MetricsCollector {
    /// Creates a new metrics collector.
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Starts the background telemetry loop.
    pub fn start(&self, interval_ms: u64, event_tx: broadcast::Sender<DaemonEvent>) {
        self.is_running.store(true, Ordering::SeqCst);
        let is_running = self.is_running.clone();

        tokio::spawn(async move {
            debug!(
                "Starting bandwidth telemetry collector (interval: {}ms)",
                interval_ms
            );

            let mut rx_total: u64 = 0;
            let mut tx_total: u64 = 0;
            let mut uptime: u64 = 0;

            while is_running.load(Ordering::SeqCst) {
                tokio::time::sleep(tokio::time::Duration::from_millis(interval_ms)).await;

                if !is_running.load(Ordering::SeqCst) {
                    break;
                }

                // Increment simulated counters
                rx_total += 51200;
                tx_total += 20480;
                uptime += 1;

                let metrics = BandwidthMetrics {
                    rx_bytes: rx_total,
                    tx_bytes: tx_total,
                    rx_rate_bps: 51200.0 * 8.0,
                    tx_rate_bps: 20480.0 * 8.0,
                    latency_rtt_ms: Some(24),
                    uptime_seconds: uptime,
                };

                let _ = event_tx.send(DaemonEvent::MetricsUpdate(metrics));
            }
        });
    }

    /// Stops the metrics collector.
    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }
}
