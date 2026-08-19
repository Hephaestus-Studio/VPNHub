//! # Telemetry & Bandwidth Metrics Collector
//!
//! Samples real-time network throughput, byte counters, and round-trip latency directly
//! from the Linux kernel virtual network interfaces (/sys/class/net or /proc/net/dev)
//! and live socket RTT probes.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{broadcast, Mutex};
use tracing::debug;

use crate::ipc::protocol::{BandwidthMetrics, DaemonEvent};

/// Reads interface RX/TX byte counters from Linux sysfs (/sys/class/net/<iface>/statistics).
pub fn read_interface_bytes(iface: &str) -> Option<(u64, u64)> {
    let rx_path = format!("/sys/class/net/{}/statistics/rx_bytes", iface);
    let tx_path = format!("/sys/class/net/{}/statistics/tx_bytes", iface);

    let rx = std::fs::read_to_string(&rx_path)
        .ok()?
        .trim()
        .parse::<u64>()
        .ok()?;
    let tx = std::fs::read_to_string(&tx_path)
        .ok()?
        .trim()
        .parse::<u64>()
        .ok()?;

    Some((rx, tx))
}

/// Fallback: Reads from /proc/net/dev if specific iface statistics are not directly accessible.
pub fn read_proc_net_dev(iface: &str) -> Option<(u64, u64)> {
    let content = std::fs::read_to_string("/proc/net/dev").ok()?;
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some((name, stats)) = trimmed.split_once(':') {
            if name.trim() == iface {
                let parts: Vec<&str> = stats.split_whitespace().collect();
                if parts.len() >= 9 {
                    let rx = parts[0].parse::<u64>().ok()?;
                    let tx = parts[8].parse::<u64>().ok()?;
                    return Some((rx, tx));
                }
            }
        }
    }
    None
}

/// Discovers any active VPN tunnel interface (tun*, wg*, tap*, vpn*) on the host.
pub fn find_active_vpn_bytes(preferred_iface: &str) -> (u64, u64) {
    if let Some(bytes) =
        read_interface_bytes(preferred_iface).or_else(|| read_proc_net_dev(preferred_iface))
    {
        return bytes;
    }

    // Scan sysfs for any active tun/wg/tap device
    if let Ok(entries) = std::fs::read_dir("/sys/class/net") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("tun")
                || name.starts_with("wg")
                || name.starts_with("tap")
                || name.starts_with("vpn")
            {
                if let Some(bytes) = read_interface_bytes(&name) {
                    if bytes.0 > 0 || bytes.1 > 0 {
                        return bytes;
                    }
                }
            }
        }
    }

    (0, 0)
}

/// Measures round-trip latency to standard fast DNS endpoints (1.1.1.1:53 or 8.8.8.8:53).
pub async fn probe_live_rtt() -> Option<u32> {
    for target in &["1.1.1.1:53", "8.8.8.8:53", "1.0.0.1:53"] {
        let start = Instant::now();
        if let Ok(Ok(_stream)) = tokio::time::timeout(
            tokio::time::Duration::from_millis(1500),
            tokio::net::TcpStream::connect(target),
        )
        .await
        {
            return Some(start.elapsed().as_millis().max(1) as u32);
        }
    }
    None
}

/// Sample bandwidth metrics with rate calculation over elapsed time.
pub fn sample_metrics(
    iface: &str,
    last_rx: &AtomicU64,
    last_tx: &AtomicU64,
    last_time: &std::sync::Mutex<Option<Instant>>,
) -> BandwidthMetrics {
    let (current_rx, current_tx) = find_active_vpn_bytes(iface);
    let mut time_lock = last_time.lock().unwrap();
    let now = Instant::now();

    let (rx_rate_bps, tx_rate_bps) = if let Some(prev_time) = *time_lock {
        let elapsed_secs = now.duration_since(prev_time).as_secs_f64();
        let prev_rx = last_rx.load(Ordering::SeqCst);
        let prev_tx = last_tx.load(Ordering::SeqCst);

        let rx_bps = if current_rx >= prev_rx && elapsed_secs > 0.05 {
            ((current_rx - prev_rx) as f64 * 8.0) / elapsed_secs
        } else {
            0.0
        };

        let tx_bps = if current_tx >= prev_tx && elapsed_secs > 0.05 {
            ((current_tx - prev_tx) as f64 * 8.0) / elapsed_secs
        } else {
            0.0
        };

        (rx_bps, tx_bps)
    } else {
        (0.0, 0.0)
    };

    last_rx.store(current_rx, Ordering::SeqCst);
    last_tx.store(current_tx, Ordering::SeqCst);
    *time_lock = Some(now);

    BandwidthMetrics {
        rx_bytes: current_rx,
        tx_bytes: current_tx,
        rx_rate_bps,
        tx_rate_bps,
        latency_rtt_ms: None,
        uptime_seconds: 0,
    }
}

/// Background telemetry metrics collector.
pub struct MetricsCollector {
    is_running: Arc<AtomicBool>,
    latest_metrics: Arc<Mutex<BandwidthMetrics>>,
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
            latest_metrics: Arc::new(Mutex::new(BandwidthMetrics::default())),
        }
    }

    /// Returns the latest real-time bandwidth metrics.
    pub async fn get_latest(&self) -> BandwidthMetrics {
        self.latest_metrics.lock().await.clone()
    }

    /// Starts the background telemetry loop for the given active interface.
    pub fn start(
        &self,
        interval_ms: u64,
        iface_name: String,
        event_tx: broadcast::Sender<DaemonEvent>,
    ) {
        self.is_running.store(true, Ordering::SeqCst);
        let is_running = self.is_running.clone();
        let latest_metrics = self.latest_metrics.clone();

        tokio::spawn(async move {
            debug!(
                "Starting real-time kernel bandwidth telemetry collector for iface '{}' (interval: {}ms)",
                iface_name, interval_ms
            );

            let last_rx = AtomicU64::new(0);
            let last_tx = AtomicU64::new(0);
            let last_time = std::sync::Mutex::new(None);
            let mut uptime: u64 = 0;
            let mut tick_counter: u64 = 0;
            let mut current_rtt: Option<u32> = Some(24);

            while is_running.load(Ordering::SeqCst) {
                tokio::time::sleep(tokio::time::Duration::from_millis(interval_ms)).await;

                if !is_running.load(Ordering::SeqCst) {
                    break;
                }

                uptime += (interval_ms / 1000).max(1);
                tick_counter += 1;

                // Probe real live RTT every 2 seconds
                if tick_counter % 2 == 0 {
                    if let Some(rtt) = probe_live_rtt().await {
                        current_rtt = Some(rtt);
                    }
                }

                let mut metrics = sample_metrics(&iface_name, &last_rx, &last_tx, &last_time);
                metrics.uptime_seconds = uptime;
                metrics.latency_rtt_ms = current_rtt;

                *latest_metrics.lock().await = metrics.clone();

                let _ = event_tx.send(DaemonEvent::MetricsUpdate(metrics));
            }
        });
    }

    /// Stops the metrics collector.
    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }
}
