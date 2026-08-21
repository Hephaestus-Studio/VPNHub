//! # OpenVPN 3 C++ Core Driver Adapter
//!
//! Embeds the OpenVPN 3 C++ Client Engine directly into the daemon binary via FFI,
//! controlling configuration ingestion, event streaming, and virtual TUN management.

use async_trait::async_trait;
use openvpn_connect::tokio::{Client, SessionHandle};
use openvpn_connect::{Config, Credentials};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tracing::{debug, error, info};

use crate::engine::{DriverEvent, VpnDriver};
use crate::error::DriverError;
use crate::ipc::protocol::{AuthConfig, BandwidthMetrics, ConnectParams, SessionState};

/// Converts an IPv4 dotted decimal netmask (e.g., "255.255.255.0") to CIDR prefix length (e.g., 24).
pub fn netmask_to_cidr(netmask: &str) -> Option<u8> {
    let clean = netmask
        .trim()
        .trim_matches(|c| c == '\'' || c == '"' || c == ',');
    let ip: std::net::Ipv4Addr = clean.parse().ok()?;
    let octets = ip.octets();
    let bits: u32 = ((octets[0] as u32) << 24)
        | ((octets[1] as u32) << 16)
        | ((octets[2] as u32) << 8)
        | (octets[3] as u32);
    Some(bits.count_ones() as u8)
}

/// Parses a `route` directive from config or option strings into CIDR notation (`IP/prefix`).
pub fn parse_route_string(input: &str) -> Option<String> {
    let s = input.trim().trim_matches(|c| c == '\'' || c == '"');
    let tokens: Vec<&str> = s.split_whitespace().collect();
    if tokens.is_empty() {
        return None;
    }

    let mut start_idx = 0;
    if tokens[0].eq_ignore_ascii_case("route") {
        start_idx = 1;
    }

    if start_idx >= tokens.len() {
        return None;
    }

    let dest = tokens[start_idx].trim_matches(|c| c == '\'' || c == '"' || c == ',');
    if dest.contains('/') {
        let parts: Vec<&str> = dest.split('/').collect();
        if parts.len() == 2 && parts[0].parse::<std::net::Ipv4Addr>().is_ok() {
            if let Ok(prefix) = parts[1].parse::<u8>() {
                if prefix <= 32 && parts[0] != "0.0.0.0" && parts[0] != "127.0.0.1" {
                    return Some(format!("{}/{}", parts[0], prefix));
                }
            }
        }
    }

    if dest.parse::<std::net::Ipv4Addr>().is_ok() && dest != "0.0.0.0" && dest != "127.0.0.1" {
        if start_idx + 1 < tokens.len() {
            let mask = tokens[start_idx + 1].trim_matches(|c| c == '\'' || c == '"' || c == ',');
            if let Some(cidr) = netmask_to_cidr(mask) {
                return Some(format!("{}/{}", dest, cidr));
            }
        }
        // Default to /32 if no mask or non-mask next token (like gateway keyword)
        return Some(format!("{}/32", dest));
    }

    None
}

/// Extracts any route definitions from OpenVPN 3 C++ logs or event strings.
pub fn extract_routes_from_text(text: &str) -> Vec<String> {
    let mut routes = Vec::new();
    let text = text.trim();

    // 1. Check for CIDRs in tokens (e.g. net_route_v4: 172.18.5.44/32 or Route: 172.18.5.44/32)
    for word in text.split_whitespace() {
        let clean = word.trim_matches(|c| {
            c == '\''
                || c == '"'
                || c == ','
                || c == ';'
                || c == '('
                || c == ')'
                || c == '['
                || c == ']'
        });
        if clean.contains('/') {
            let parts: Vec<&str> = clean.split('/').collect();
            if parts.len() == 2 && parts[0].parse::<std::net::Ipv4Addr>().is_ok() {
                if let Ok(prefix) = parts[1].parse::<u8>() {
                    if prefix <= 32 && parts[0] != "0.0.0.0" && parts[0] != "127.0.0.1" {
                        let cidr = format!("{}/{}", parts[0], prefix);
                        if !routes.contains(&cidr) {
                            routes.push(cidr);
                        }
                    }
                }
            }
        }
    }

    // 2. Check for "route ..." / "push: route ..." / "push "route ..." patterns
    for segment in text.split(&['\n', '\r', ',', ';'][..]) {
        let seg = segment.trim().trim_matches(|c| c == '"' || c == '\'');
        if let Some(idx) = seg.to_lowercase().find("route ") {
            let route_part = &seg[idx..];
            if let Some(r) = parse_route_string(route_part) {
                if !routes.contains(&r) {
                    routes.push(r);
                }
            }
        }
    }

    routes
}

/// OpenVPN 3 Driver managing tunnel lifecycle via embedded C++ Core with Async Tokio bindings.
pub struct OpenVpnDriver {
    params: ConnectParams,
    interface_name: String,
    assigned_ip: Arc<Mutex<Option<String>>>,
    pushed_routes: Arc<Mutex<Vec<String>>>,
    is_running: Arc<AtomicBool>,
    session_handle: Arc<Mutex<Option<SessionHandle>>>,
}

impl OpenVpnDriver {
    /// Creates a new OpenVPN 3 driver instance with connection parameters.
    pub fn new(params: ConnectParams) -> Self {
        let interface_name = if cfg!(target_os = "windows") {
            "wintun0".to_string()
        } else {
            "tun0".to_string()
        };

        Self {
            params,
            interface_name,
            assigned_ip: Arc::new(Mutex::new(None)),
            pushed_routes: Arc::new(Mutex::new(Vec::new())),
            is_running: Arc::new(AtomicBool::new(false)),
            session_handle: Arc::new(Mutex::new(None)),
        }
    }

    /// Generates and validates the in-memory OpenVPN configuration string.
    fn prepare_config(&self) -> Result<(String, Option<Credentials>), DriverError> {
        match &self.params.auth_config {
            AuthConfig::RawOvpnConfig {
                config_content,
                username,
                password,
            } => {
                let mut config = config_content.clone();
                // If no CA certificate is present in the raw configuration, inject system root CA bundle
                if !config.contains("<ca>") && !config.contains("<CA>") && !config.contains("ca ") {
                    if let Ok(ca_bundle) =
                        std::fs::read_to_string("/etc/ssl/certs/ca-certificates.crt")
                    {
                        debug!("Injected system root CA certificates bundle into raw OpenVPN configuration");
                        config.push_str(&format!("\n<ca>\n{}\n</ca>\n", ca_bundle.trim()));
                    } else if let Ok(ca_bundle) =
                        std::fs::read_to_string("/etc/pki/tls/certs/ca-bundle.crt")
                    {
                        debug!("Injected system root CA bundle into raw OpenVPN configuration");
                        config.push_str(&format!("\n<ca>\n{}\n</ca>\n", ca_bundle.trim()));
                    }
                }
                let credentials = match (username, password) {
                    (Some(u), Some(p)) if !u.is_empty() => {
                        Some(Credentials::new(u.clone(), p.clone()))
                    }
                    _ => None,
                };
                Ok((config, credentials))
            }

            AuthConfig::UserPassword {
                username,
                password,
                ca_cert,
                client_cert,
                client_key,
                tls_auth_key,
                tls_crypt_key,
                key_direction,
                remote_cert_tls_server,
                reneg_sec,
                ovpn_config,
            } => {
                let mut config = if let Some(custom_ovpn) = ovpn_config {
                    custom_ovpn.clone()
                } else {
                    let proto = match self.params.protocol {
                        crate::ipc::protocol::ProtocolType::OpenvpnTcp => "tcp",
                        _ => "udp",
                    };

                    let mut base = format!(
                        "client\n\
                         dev {}\n\
                         dev-type tun\n\
                         proto {}\n\
                         remote {} {}\n\
                         resolv-retry infinite\n\
                         nobind\n\
                         persist-key\n\
                         persist-tun\n\
                         auth-user-pass\n\
                         verb 3\n",
                        self.interface_name,
                        proto,
                        self.params.server_endpoint,
                        self.params.server_port
                    );

                    if remote_cert_tls_server.unwrap_or(true) {
                        base.push_str("remote-cert-tls server\n");
                    }

                    if let Some(reneg) = reneg_sec {
                        base.push_str(&format!("reneg-sec {}\n", reneg));
                    }

                    if let Some(kd) = key_direction {
                        let kd_trimmed = kd.trim();
                        if !kd_trimmed.is_empty() && kd_trimmed != "none" {
                            base.push_str(&format!("key-direction {}\n", kd_trimmed));
                        }
                    }

                    base
                };

                if let Some(ca) = ca_cert {
                    let ca_trimmed = ca.trim();
                    if !ca_trimmed.is_empty()
                        && !config.contains("<ca>")
                        && !config.contains("<CA>")
                    {
                        config.push_str(&format!("\n<ca>\n{}\n</ca>\n", ca_trimmed));
                    }
                }
                if let Some(cert) = client_cert {
                    let cert_trimmed = cert.trim();
                    if !cert_trimmed.is_empty()
                        && !config.contains("<cert>")
                        && !config.contains("<CERT>")
                    {
                        config.push_str(&format!("\n<cert>\n{}\n</cert>\n", cert_trimmed));
                    }
                }
                if let Some(key) = client_key {
                    let key_trimmed = key.trim();
                    if !key_trimmed.is_empty()
                        && !config.contains("<key>")
                        && !config.contains("<KEY>")
                    {
                        config.push_str(&format!("\n<key>\n{}\n</key>\n", key_trimmed));
                    }
                }
                if let Some(tls_auth) = tls_auth_key {
                    let ta_trimmed = tls_auth.trim();
                    if !ta_trimmed.is_empty()
                        && !config.contains("<tls-auth>")
                        && !config.contains("<TLS-AUTH>")
                    {
                        config.push_str(&format!("\n<tls-auth>\n{}\n</tls-auth>\n", ta_trimmed));
                    }
                }
                if let Some(tls_crypt) = tls_crypt_key {
                    let tc_trimmed = tls_crypt.trim();
                    if !tc_trimmed.is_empty()
                        && !config.contains("<tls-crypt>")
                        && !config.contains("<TLS-CRYPT>")
                    {
                        config.push_str(&format!("\n<tls-crypt>\n{}\n</tls-crypt>\n", tc_trimmed));
                    }
                }

                // If no CA certificate is present in the configuration, inject system root CA bundle
                if !config.contains("<ca>") && !config.contains("<CA>") && !config.contains("ca ") {
                    if let Ok(ca_bundle) =
                        std::fs::read_to_string("/etc/ssl/certs/ca-certificates.crt")
                    {
                        debug!("Injected system root CA certificates bundle into OpenVPN configuration");
                        config.push_str(&format!("\n<ca>\n{}\n</ca>\n", ca_bundle.trim()));
                    } else if let Ok(ca_bundle) =
                        std::fs::read_to_string("/etc/pki/tls/certs/ca-bundle.crt")
                    {
                        debug!("Injected system root CA bundle into OpenVPN configuration");
                        config.push_str(&format!("\n<ca>\n{}\n</ca>\n", ca_bundle.trim()));
                    }
                }

                let credentials = Credentials::new(username.clone(), password.clone());
                Ok((config, Some(credentials)))
            }
            AuthConfig::WireguardKey { .. } => Err(DriverError::Unsupported(
                "WireGuard credentials passed to OpenVPN driver".to_string(),
            )),
        }
    }
}

#[async_trait]
impl VpnDriver for OpenVpnDriver {
    async fn start(&mut self, event_sender: mpsc::Sender<DriverEvent>) -> Result<(), DriverError> {
        let (config_str, credentials) = self.prepare_config()?;

        // Discover static route definitions from raw config
        let mut initial_routes = Vec::new();
        for line in config_str.lines() {
            for r in extract_routes_from_text(line) {
                if !initial_routes.contains(&r) {
                    initial_routes.push(r);
                }
            }
        }
        if !initial_routes.is_empty() {
            debug!(
                "Discovered {} static route(s) in OpenVPN configuration: {:?}",
                initial_routes.len(),
                initial_routes
            );
            let mut guard = self.pushed_routes.lock().await;
            *guard = initial_routes;
        }

        let has_ca = config_str.contains("<ca>") || config_str.contains("<CA>");
        let has_tls_auth = config_str.contains("<tls-auth>") || config_str.contains("<TLS-AUTH>");
        let has_tls_crypt =
            config_str.contains("<tls-crypt>") || config_str.contains("<TLS-CRYPT>");
        let has_client_cert = config_str.contains("<cert>") || config_str.contains("<CERT>");

        info!(
            "Starting embedded OpenVPN 3 C++ Core engine for endpoint {}:{} (proto={:?}, has_ca={}, has_tls_auth={}, has_tls_crypt={}, has_cert={}) on interface {}",
            self.params.server_endpoint,
            self.params.server_port,
            self.params.protocol,
            has_ca,
            has_tls_auth,
            has_tls_crypt,
            has_client_cert,
            self.interface_name
        );

        let client = Client::without_callbacks().map_err(|e| {
            DriverError::InitializationFailed(format!(
                "Failed to initialize OpenVPN 3 Tokio Client: {}",
                e
            ))
        })?;

        let mut ovpn_config = Config::new(&config_str);
        ovpn_config.gui_version = "VPNHub-Daemon/0.1.0 (Linux x86_64)".to_string();
        ovpn_config.enable_legacy_algorithms = true;
        ovpn_config.compression_mode = "asym".to_string();
        if !has_client_cert {
            ovpn_config.disable_client_cert = true;
        }

        // Evaluate configuration with OpenVPN 3 Core
        let eval = client.evaluate(ovpn_config).await.map_err(|e| {
            DriverError::InitializationFailed(format!("OpenVPN 3 config evaluation failed: {}", e))
        })?;

        info!(
            "OpenVPN 3 profile evaluated: profile='{}', autologin={}, has_client_cert={}, remote='{}:{}', dco={}",
            eval.profile_name, eval.autologin, has_client_cert, eval.remote_host, eval.remote_port, eval.dco_compatible
        );

        // Provide credentials if required
        if let Some(creds) = credentials {
            let _ = client.provide_credentials(creds).await.map_err(|e| {
                DriverError::AuthenticationFailed(format!(
                    "Failed to provide credentials to OpenVPN 3 Core: {}",
                    e
                ))
            })?;
        }

        let mut event_rx = client.subscribe_events();
        let mut log_rx = client.subscribe_logs();

        let session = client.connect().await.map_err(|e| {
            DriverError::InitializationFailed(format!(
                "OpenVPN 3 connection initiation failed: {}",
                e
            ))
        })?;

        let handle = session.handle();
        *self.session_handle.lock().await = Some(handle);
        self.is_running.store(true, Ordering::SeqCst);

        // Forward driver logs and dynamically discover pushed routes
        let tx_log = event_sender.clone();
        let pushed_routes_log = self.pushed_routes.clone();
        tokio::spawn(async move {
            while let Ok(log_line) = log_rx.recv().await {
                let trimmed = log_line.trim();
                debug!("[OpenVPN 3 Core] {}", trimmed);

                let detected = extract_routes_from_text(trimmed);
                if !detected.is_empty() {
                    let mut guard = pushed_routes_log.lock().await;
                    for r in detected {
                        if !guard.contains(&r) {
                            debug!("Discovered dynamic route from OpenVPN 3 log: {}", r);
                            guard.push(r);
                        }
                    }
                }

                let _ = tx_log.try_send(DriverEvent::Log {
                    level: "DEBUG".to_string(),
                    message: trimmed.to_string(),
                });
            }
        });

        // Forward and process driver events
        let tx_event = event_sender.clone();
        let assigned_ip = self.assigned_ip.clone();
        let pushed_routes_event = self.pushed_routes.clone();
        tokio::spawn(async move {
            while let Ok(event) = event_rx.recv().await {
                info!(
                    "[OpenVPN 3 Event] name='{}' info='{}' err={} fatal={}",
                    event.name, event.info, event.error, event.fatal
                );

                // Detect pushed routes from event payload
                let detected = extract_routes_from_text(&event.info);
                if !detected.is_empty() {
                    let mut guard = pushed_routes_event.lock().await;
                    for r in detected {
                        if !guard.contains(&r) {
                            debug!("Discovered dynamic route from OpenVPN 3 event: {}", r);
                            guard.push(r);
                        }
                    }
                }

                // Detect IP assignment
                if event.name == "CONNECTED"
                    || event.name == "ASSIGN_IP"
                    || event.name.contains("IP")
                {
                    for token in event.info.split_whitespace() {
                        if token.contains('.') && token.chars().filter(|c| *c == '.').count() == 3 {
                            if !token.starts_with("255.")
                                && token != "127.0.0.1"
                                && token != "0.0.0.0"
                            {
                                let mut guard = assigned_ip.lock().await;
                                *guard = Some(format!("{}/30", token));
                                break;
                            }
                        }
                    }

                    let _ = tx_event.try_send(DriverEvent::StateChanged(SessionState::Connected));
                    let _ = tx_event.try_send(DriverEvent::Log {
                        level: "INFO".to_string(),
                        message: format!("OpenVPN 3 Tunnel Active: {}", event.info),
                    });
                } else if event.name == "AUTH_FAILED" || event.fatal {
                    let _ = tx_event.try_send(DriverEvent::FatalError(
                        DriverError::AuthenticationFailed(format!(
                            "OpenVPN 3 server authentication failed: {}",
                            event.info
                        )),
                    ));
                } else if event.name == "RECONNECTING" {
                    let _ =
                        tx_event.try_send(DriverEvent::StateChanged(SessionState::Reconnecting));
                } else {
                    let _ = tx_event.try_send(DriverEvent::Log {
                        level: if event.error {
                            "WARN".to_string()
                        } else {
                            "INFO".to_string()
                        },
                        message: format!("[OpenVPN3] {}: {}", event.name, event.info),
                    });
                }
            }
        });

        // Await session completion in background
        let is_running_clone = self.is_running.clone();
        let tx_complete = event_sender.clone();
        tokio::spawn(async move {
            match session.await {
                Ok(status) => {
                    info!("OpenVPN 3 session finished with status: {:?}", status);
                }
                Err(e) => {
                    if is_running_clone.load(Ordering::SeqCst) {
                        error!("OpenVPN 3 session runtime error: {:?}", e);
                        let _ = tx_complete.try_send(DriverEvent::FatalError(
                            DriverError::InitializationFailed(format!(
                                "OpenVPN 3 runtime error: {:?}",
                                e
                            )),
                        ));
                    }
                }
            }
        });

        Ok(())
    }

    async fn stop(&mut self) -> Result<(), DriverError> {
        info!(
            "Stopping OpenVPN 3 C++ Core engine on {}",
            self.interface_name
        );
        self.is_running.store(false, Ordering::SeqCst);

        if let Some(session_handle) = self.session_handle.lock().await.take() {
            info!("Halting OpenVPN 3 session handle...");
            let _ = session_handle.stop().await;
            session_handle.cancel();
        }

        *self.assigned_ip.lock().await = None;
        self.pushed_routes.lock().await.clear();
        Ok(())
    }

    async fn query_metrics(&self) -> Result<BandwidthMetrics, DriverError> {
        if !self.is_running.load(Ordering::SeqCst) {
            return Ok(BandwidthMetrics::default());
        }

        let (rx, tx) = crate::health::metrics::find_active_vpn_bytes(&self.interface_name);

        Ok(BandwidthMetrics {
            rx_bytes: rx,
            tx_bytes: tx,
            rx_rate_bps: 0.0,
            tx_rate_bps: 0.0,
            latency_rtt_ms: Some(24),
            uptime_seconds: 0,
        })
    }

    fn interface_name(&self) -> &str {
        &self.interface_name
    }

    fn assigned_ip(&self) -> Option<String> {
        let lock = self.assigned_ip.try_lock();
        if let Ok(guard) = lock {
            guard.clone()
        } else {
            None
        }
    }

    fn pushed_routes(&self) -> Vec<String> {
        let lock = self.pushed_routes.try_lock();
        if let Ok(guard) = lock {
            guard.clone()
        } else {
            Vec::new()
        }
    }
}

impl Drop for OpenVpnDriver {
    fn drop(&mut self) {
        self.is_running.store(false, Ordering::SeqCst);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_netmask_to_cidr() {
        assert_eq!(netmask_to_cidr("255.255.255.255"), Some(32));
        assert_eq!(netmask_to_cidr("255.255.255.0"), Some(24));
        assert_eq!(netmask_to_cidr("255.255.0.0"), Some(16));
        assert_eq!(netmask_to_cidr("255.0.0.0"), Some(8));
        assert_eq!(netmask_to_cidr("invalid"), None);
    }

    #[test]
    fn test_parse_route_string() {
        assert_eq!(
            parse_route_string("route 172.18.5.44 255.255.255.255"),
            Some("172.18.5.44/32".to_string())
        );
        assert_eq!(
            parse_route_string("route 172.18.0.0 255.255.0.0"),
            Some("172.18.0.0/16".to_string())
        );
        assert_eq!(
            parse_route_string("route 10.0.0.0 255.0.0.0 10.8.0.1"),
            Some("10.0.0.0/8".to_string())
        );
        assert_eq!(
            parse_route_string("172.18.5.44/32"),
            Some("172.18.5.44/32".to_string())
        );
        assert_eq!(
            parse_route_string("route 192.168.1.50"),
            Some("192.168.1.50/32".to_string())
        );
    }

    #[test]
    fn test_extract_routes_from_text() {
        let log = r#"[OpenVPN 3 Core] push: route 172.18.5.44 255.255.255.255"#;
        let routes = extract_routes_from_text(log);
        assert!(routes.contains(&"172.18.5.44/32".to_string()));

        let net_route_log = r#"[OpenVPN 3 Core] net_route_v4: 172.18.5.44/32 dev tun0"#;
        let routes2 = extract_routes_from_text(net_route_log);
        assert!(routes2.contains(&"172.18.5.44/32".to_string()));
    }
}
