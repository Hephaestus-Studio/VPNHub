//! # System Diagnostics & Telemetry Snapshot Exporter
//!
//! Gathers active OS routing tables, DNS configurations, firewall status,
//! and sanitized recent logs for technical support.

use crate::ipc::protocol::DiagnosticReport;
use crate::security::LogRingBuffer;

/// Generates a comprehensive system diagnostic report.
pub fn generate_diagnostics(ring_buffer: &LogRingBuffer) -> DiagnosticReport {
    let mut routing_table = String::new();
    let mut dns_configuration = String::new();
    let mut firewall_rules = String::new();

    // Linux Route Table
    #[cfg(target_os = "linux")]
    {
        if let Ok(out) = std::process::Command::new("ip")
            .args(["route", "show"])
            .output()
        {
            routing_table = String::from_utf8_lossy(&out.stdout).to_string();
        }
        if let Ok(out) = std::process::Command::new("resolvectl")
            .arg("status")
            .output()
        {
            dns_configuration = String::from_utf8_lossy(&out.stdout).to_string();
        } else if let Ok(out) = std::fs::read_to_string("/etc/resolv.conf") {
            dns_configuration = out;
        }
        if let Ok(out) = std::process::Command::new("nft")
            .args(["list", "ruleset"])
            .output()
        {
            firewall_rules = String::from_utf8_lossy(&out.stdout).to_string();
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        routing_table = "Default system routes".to_string();
        dns_configuration = "Default system DNS".to_string();
        firewall_rules = "Default firewall state".to_string();
    }

    DiagnosticReport {
        routing_table,
        dns_configuration,
        firewall_rules,
        recent_logs: ring_buffer.get_snapshot(),
    }
}
