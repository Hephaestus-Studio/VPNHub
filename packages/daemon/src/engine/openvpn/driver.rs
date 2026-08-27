//! # OpenVPN Engine Driver
//!
//! Implements [`VpnDriver`] directly embedding `openvpn3-rs` (`ovpn-core`).

use async_trait::async_trait;
use ovpn_config::{
    parse_ovpn_config, AuthUserPassConfig, OpenVpnConfig, RemoteEntry, SecretString,
};
use ovpn_core::{ClientHandle, ClientSession, SessionEvent};
use ovpn_protocol::EngineState;
use ovpn_tun::{MockTunDevice, VirtualTunDevice};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use tracing::{debug, error, info, warn};

use crate::engine::{DriverEvent, VpnDriver};
use crate::error::DriverError;
use crate::ipc::protocol::{
    AuthConfig, BandwidthMetrics, ConnectParams, ProtocolType, SessionState,
};

/// OpenVPN driver embedding `openvpn3-rs`.
pub struct OpenVpnDriver {
    params: ConnectParams,
    client_handle: Arc<Mutex<Option<ClientHandle>>>,
    assigned_ip: Arc<RwLock<Option<String>>>,
    tunnel_gateway: Arc<RwLock<Option<String>>>,
    pushed_routes: Arc<RwLock<Vec<String>>>,
    search_domains: Arc<RwLock<Vec<String>>>,
    dns_servers: Arc<RwLock<Vec<String>>>,
    is_redirect_gateway: Arc<RwLock<bool>>,
    interface_name: String,
}

impl OpenVpnDriver {
    pub fn new(params: ConnectParams) -> Self {
        Self {
            params,
            client_handle: Arc::new(Mutex::new(None)),
            assigned_ip: Arc::new(RwLock::new(None)),
            tunnel_gateway: Arc::new(RwLock::new(None)),
            pushed_routes: Arc::new(RwLock::new(Vec::new())),
            search_domains: Arc::new(RwLock::new(Vec::new())),
            dns_servers: Arc::new(RwLock::new(Vec::new())),
            is_redirect_gateway: Arc::new(RwLock::new(false)),
            interface_name: "tun0".to_string(),
        }
    }
}

#[async_trait]
impl VpnDriver for OpenVpnDriver {
    async fn start(&mut self, event_sender: mpsc::Sender<DriverEvent>) -> Result<(), DriverError> {
        info!(target: "daemon::engine::ovpn", "Starting OpenVPN driver");

        // 1. Build or parse OpenVpnConfig from ConnectParams
        let mut config = match &self.params.auth_config {
            AuthConfig::RawOvpnConfig {
                config_content,
                username,
                password,
            } => {
                let mut cfg = parse_ovpn_config(config_content).map_err(|e| {
                    DriverError::InitializationFailed(format!("Failed to parse OVPN profile: {e}"))
                })?;
                if let (Some(u), Some(p)) = (username, password) {
                    cfg.auth_user_pass = Some(AuthUserPassConfig {
                        path: None,
                        username: Some(u.clone()),
                        password: Some(SecretString::new(p.clone())),
                    });
                }
                cfg
            }
            AuthConfig::UserPassword {
                username,
                password,
                ovpn_config,
                ca_cert,
                client_cert,
                client_key,
                tls_auth_key,
                tls_crypt_key,
                key_direction,
                ..
            } => {
                if let Some(ref text) = ovpn_config {
                    info!(target: "daemon::engine::ovpn", "Parsing ovpn_config content (len={}):\n{}", text.len(), text);
                }
                let mut cfg = if let Some(ref text) = ovpn_config {
                    parse_ovpn_config(text).map_err(|e| {
                        DriverError::InitializationFailed(format!(
                            "Failed to parse OVPN config: {e}"
                        ))
                    })?
                } else {
                    let mut default_cfg = OpenVpnConfig::default();
                    default_cfg.remotes.push(RemoteEntry::new(
                        &self.params.server_endpoint,
                        self.params.server_port,
                        None,
                    ));
                    default_cfg
                };

                cfg.auth_user_pass = Some(AuthUserPassConfig {
                    path: None,
                    username: Some(username.clone()),
                    password: Some(SecretString::new(password.clone())),
                });

                if let Some(ref ca) = ca_cert {
                    cfg.ca = Some(ca.clone());
                }
                if let Some(ref cert) = client_cert {
                    cfg.cert = Some(cert.clone());
                }
                if let Some(ref key) = client_key {
                    cfg.key = Some(SecretString::new(key.clone()));
                }
                if let Some(ref ta) = tls_auth_key {
                    let dir = key_direction
                        .as_ref()
                        .and_then(|d| d.parse::<ovpn_config::KeyDirection>().ok());
                    cfg.tls_auth = Some(ovpn_config::TlsAuthConfig {
                        key: SecretString::new(ta.clone()),
                        direction: dir,
                    });
                }
                if let Some(ref tc) = tls_crypt_key {
                    cfg.tls_crypt = Some(SecretString::new(tc.clone()));
                }
                if let Some(ref kd) = key_direction {
                    if let Ok(dir) = kd.parse::<ovpn_config::KeyDirection>() {
                        cfg.key_direction = Some(dir);
                    }
                }

                cfg
            }

            _ => {
                return Err(DriverError::InitializationFailed(
                    "Unsupported auth configuration for OpenVPN engine".to_string(),
                ));
            }
        };

        // Determine protocol from ConnectParams
        let param_proto = match self.params.protocol {
            ProtocolType::OpenvpnTcp => ovpn_config::Protocol::TcpClient,
            ProtocolType::OpenvpnUdp => ovpn_config::Protocol::Udp,
            _ => ovpn_config::Protocol::Udp,
        };

        // Override or set default config protocol from ConnectParams
        config.proto = param_proto;

        // If remotes is empty, use server_endpoint from params
        if config.remotes.is_empty() {
            config.remotes.push(RemoteEntry::new(
                &self.params.server_endpoint,
                self.params.server_port,
                Some(param_proto),
            ));
        } else {
            for r in &mut config.remotes {
                if r.proto.is_none() {
                    r.proto = Some(param_proto);
                }
            }
        }

        info!(
            target: "daemon::engine::ovpn",
            "Configured OpenVPN engine: remotes={:?}, proto={:?}, has_ca={}, has_cert={}, has_key={}, has_tls_auth={}, has_tls_crypt={}",
            config.remotes.iter().map(|r| format!("{}:{}/{:?}", r.host, r.port, r.proto)).collect::<Vec<_>>(),
            config.proto,
            config.ca.is_some(),
            config.cert.is_some(),
            config.key.is_some(),
            config.tls_auth.is_some(),
            config.tls_crypt.is_some(),
        );

        // 2. Instantiate Virtual TUN interface (use platform-native or mock)
        #[cfg(target_os = "linux")]
        let tun_device: Box<dyn VirtualTunDevice> = match ovpn_tun::LinuxTunDevice::create(
            None, 1500, false,
        ) {
            Ok(dev) => {
                info!(target: "daemon::engine::ovpn", "Created Linux TUN interface '{}'", dev.name());
                Box::new(dev)
            }
            Err(e) => {
                warn!(target: "daemon::engine::ovpn", error = %e, "Failed to create Linux TUN device, falling back to mock");
                let (mock, _) = MockTunDevice::new("tun0", 1500);
                Box::new(mock)
            }
        };

        #[cfg(target_os = "macos")]
        let tun_device: Box<dyn VirtualTunDevice> = match ovpn_tun::MacOsTunDevice::create(
            None, 1500,
        ) {
            Ok(dev) => {
                info!(target: "daemon::engine::ovpn", "Created macOS utun interface '{}'", dev.name());
                Box::new(dev)
            }
            Err(e) => {
                warn!(target: "daemon::engine::ovpn", error = %e, "Failed to create macOS utun device, falling back to mock");
                let (mock, _) = MockTunDevice::new("utun0", 1500);
                Box::new(mock)
            }
        };

        #[cfg(target_os = "windows")]
        let tun_device: Box<dyn VirtualTunDevice> = match ovpn_tun::WindowsTunDevice::create(
            Some("wintun"),
            1500,
        ) {
            Ok(dev) => {
                info!(target: "daemon::engine::ovpn", "Created Windows TUN interface '{}'", dev.name());
                Box::new(dev)
            }
            Err(e) => {
                warn!(target: "daemon::engine::ovpn", error = %e, "Failed to create Windows TUN device, falling back to mock");
                let (mock, _) = MockTunDevice::new("wintun", 1500);
                Box::new(mock)
            }
        };

        #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
        let tun_device: Box<dyn VirtualTunDevice> = {
            let (mock, _) = MockTunDevice::new("tun0", 1500);
            Box::new(mock)
        };

        self.interface_name = tun_device.name().to_string();

        // 3. Spawn ClientSession orchestrator
        info!(target: "daemon::engine::ovpn", "Spawning ClientSession pipeline");
        let (handle, mut event_rx) = ClientSession::spawn(config, tun_device);
        *self.client_handle.lock().await = Some(handle);

        let assigned_ip_clone = self.assigned_ip.clone();
        let tunnel_gateway_clone = self.tunnel_gateway.clone();
        let pushed_routes_clone = self.pushed_routes.clone();
        let search_domains_clone = self.search_domains.clone();
        let dns_servers_clone = self.dns_servers.clone();
        let is_redirect_gateway_clone = self.is_redirect_gateway.clone();

        // 4. Spawn event bridging task
        tokio::spawn(async move {
            let _ = event_sender
                .send(DriverEvent::StateChanged(SessionState::Connecting))
                .await;

            while let Ok(event) = event_rx.recv().await {
                debug!(target: "daemon::engine::ovpn", "Bridge event received: {:?}", event);
                match event {
                    SessionEvent::StateChanged(state) => {
                        let daemon_state = match state {
                            EngineState::Connecting
                            | EngineState::TlsHandshake
                            | EngineState::Authenticating
                            | EngineState::PullingConfig => SessionState::Connecting,
                            EngineState::Connected | EngineState::Rekeying => {
                                SessionState::Connected
                            }
                            EngineState::Disconnecting => SessionState::Disconnecting,
                            EngineState::Disconnected => SessionState::Disconnected,
                            EngineState::Error => SessionState::Disconnected,
                        };
                        info!(target: "daemon::engine::ovpn", "Forwarding session state to daemon: {:?}", daemon_state);
                        let _ = event_sender
                            .send(DriverEvent::StateChanged(daemon_state))
                            .await;
                    }
                    SessionEvent::NetworkConfigured(prov) => {
                        info!(target: "daemon::engine::ovpn", "Received network provisioning: ip={:?}, gw={:?}, dns={:?}, redirect_gw={:?}, routes={}", prov.ipv4_address, prov.ipv4_gateway, prov.dns_servers, prov.redirect_gateway, prov.routes_v4.len());
                        if let Some(ip) = prov.ipv4_address {
                            *assigned_ip_clone.write().await = Some(ip.to_string());
                        }
                        if let Some(gw) = prov.ipv4_gateway {
                            *tunnel_gateway_clone.write().await = Some(gw.to_string());
                        }
                        *is_redirect_gateway_clone.write().await = prov.redirect_gateway.enabled;

                        *search_domains_clone.write().await = prov.search_domains.clone();
                        *dns_servers_clone.write().await =
                            prov.dns_servers.iter().map(|ip| ip.to_string()).collect();

                        let mut routes = Vec::new();
                        for r in &prov.routes_v4 {
                            let cidr = u32::from(r.netmask).count_ones();
                            routes.push(format!("{}/{}", r.destination, cidr));
                        }
                        *pushed_routes_clone.write().await = routes;
                    }

                    SessionEvent::StatsUpdated(stats) => {
                        let _ = event_sender
                            .send(DriverEvent::Metrics(BandwidthMetrics {
                                rx_bytes: stats.bytes_in,
                                tx_bytes: stats.bytes_out,
                                rx_rate_bps: 0.0,
                                tx_rate_bps: 0.0,
                                latency_rtt_ms: None,
                                uptime_seconds: stats.uptime_secs,
                            }))
                            .await;
                    }
                    SessionEvent::Disconnected { reason } => {
                        warn!(target: "daemon::engine::ovpn", "Session disconnected: reason={:?}", reason);
                        let _ = event_sender
                            .send(DriverEvent::StateChanged(SessionState::Disconnected))
                            .await;
                        break;
                    }
                    SessionEvent::Error { message } => {
                        error!(target: "daemon::engine::ovpn", "Session encountered fatal error: {}", message);
                        let _ = event_sender
                            .send(DriverEvent::FatalError(DriverError::InitializationFailed(
                                message,
                            )))
                            .await;
                        break;
                    }
                    _ => {}
                }
            }
        });

        Ok(())
    }

    async fn stop(&mut self) -> Result<(), DriverError> {
        info!(target: "daemon::engine::ovpn", "Stopping OpenVPN driver");
        if let Some(ref handle) = *self.client_handle.lock().await {
            let _ = handle.disconnect("Daemon requested stop").await;
        }
        Ok(())
    }

    async fn query_metrics(&self) -> Result<BandwidthMetrics, DriverError> {
        if let Some(ref handle) = *self.client_handle.lock().await {
            let stats = handle.get_stats().await;
            Ok(BandwidthMetrics {
                rx_bytes: stats.bytes_in,
                tx_bytes: stats.bytes_out,
                rx_rate_bps: 0.0,
                tx_rate_bps: 0.0,
                latency_rtt_ms: None,
                uptime_seconds: stats.uptime_secs,
            })
        } else {
            Ok(BandwidthMetrics::default())
        }
    }

    fn interface_name(&self) -> &str {
        &self.interface_name
    }

    fn assigned_ip(&self) -> Option<String> {
        self.assigned_ip
            .try_read()
            .ok()
            .and_then(|guard| guard.clone())
    }

    fn pushed_routes(&self) -> Vec<String> {
        self.pushed_routes
            .try_read()
            .ok()
            .map(|guard| guard.clone())
            .unwrap_or_default()
    }

    fn is_redirect_gateway(&self) -> bool {
        self.is_redirect_gateway
            .try_read()
            .ok()
            .map(|guard| *guard)
            .unwrap_or(false)
    }

    fn tunnel_gateway(&self) -> Option<String> {
        self.tunnel_gateway
            .try_read()
            .ok()
            .and_then(|guard| guard.clone())
    }

    fn search_domains(&self) -> Vec<String> {
        self.search_domains
            .try_read()
            .ok()
            .map(|guard| guard.clone())
            .unwrap_or_default()
    }

    fn dns_servers(&self) -> Vec<String> {
        self.dns_servers
            .try_read()
            .ok()
            .map(|guard| guard.clone())
            .unwrap_or_default()
    }
}
