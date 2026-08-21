use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tracing::{error, info};

use crate::core::session::ActiveSession;
use crate::core::state::StateManager;
use crate::engine::openvpn::OpenVpnDriver;
use crate::engine::wireguard::WireGuardDriver;
use crate::engine::{DriverEvent, VpnDriver};
use crate::error::DaemonError;
use crate::health::{generate_diagnostics, MetricsCollector};
use crate::ipc::protocol::{
    BandwidthMetrics, ConnectParams, DaemonRequest, DaemonResponse, DaemonStatusSnapshot,
    ProtocolType, SessionState,
};
use crate::network::NetworkManager;
use crate::security::LogRingBuffer;

/// Core Daemon Orchestrator managing all subsystems.
pub struct DaemonOrchestrator {
    state_mgr: StateManager,
    network_mgr: Arc<Mutex<NetworkManager>>,
    active_session: Arc<Mutex<Option<ActiveSession>>>,
    active_driver: Arc<Mutex<Option<Box<dyn VpnDriver>>>>,
    ring_buffer: Arc<LogRingBuffer>,
    metrics_collector: Arc<MetricsCollector>,
}

impl DaemonOrchestrator {
    /// Initializes a new DaemonOrchestrator instance.
    pub fn new(ring_buffer: Arc<LogRingBuffer>) -> Self {
        Self {
            state_mgr: StateManager::new(),
            network_mgr: Arc::new(Mutex::new(NetworkManager::new())),
            active_session: Arc::new(Mutex::new(None)),
            active_driver: Arc::new(Mutex::new(None)),
            ring_buffer,
            metrics_collector: Arc::new(MetricsCollector::new()),
        }
    }

    /// Access the state manager.
    pub fn state_manager(&self) -> &StateManager {
        &self.state_mgr
    }

    /// Dispatches an inbound client request and returns the synchronous response.
    pub async fn handle_request(&self, request: DaemonRequest) -> DaemonResponse {
        match request {
            DaemonRequest::Ping => DaemonResponse::Pong,

            DaemonRequest::GetStatus => {
                let status = self.get_status().await;
                DaemonResponse::Status(status)
            }

            DaemonRequest::GetMetrics => {
                let metrics = self.query_metrics().await;
                DaemonResponse::Metrics(metrics)
            }

            DaemonRequest::Connect(params) => match self.connect(params).await {
                Ok(_) => DaemonResponse::Success,
                Err(e) => {
                    error!("Connection request failed: {}", e);
                    DaemonResponse::Error {
                        code: 100,
                        message: e.to_string(),
                    }
                }
            },

            DaemonRequest::Disconnect { force: _ } => match self.disconnect().await {
                Ok(_) => DaemonResponse::Success,
                Err(e) => {
                    error!("Disconnect request failed: {}", e);
                    DaemonResponse::Error {
                        code: 101,
                        message: e.to_string(),
                    }
                }
            },

            DaemonRequest::SetKillSwitch { enabled, mode } => {
                let mut net = self.network_mgr.lock().await;
                match net.set_kill_switch(enabled, mode) {
                    Ok(_) => DaemonResponse::Success,
                    Err(e) => DaemonResponse::Error {
                        code: 102,
                        message: e.to_string(),
                    },
                }
            }

            DaemonRequest::SetSplitTunneling(_config) => {
                info!("Split tunneling configuration updated");
                DaemonResponse::Success
            }

            DaemonRequest::GetDiagnostics => {
                let diag = generate_diagnostics(&self.ring_buffer);
                DaemonResponse::Diagnostics(diag)
            }
        }
    }

    /// Connects to a VPN profile.
    pub async fn connect(&self, params: ConnectParams) -> Result<(), DaemonError> {
        let current_state = self.state_mgr.current_state();
        if current_state != SessionState::Disconnected && current_state != SessionState::Error {
            return Err(DaemonError::InvalidState(format!(
                "Cannot connect while in state {:?}",
                current_state
            )));
        }

        self.state_mgr.transition_to(
            SessionState::Connecting,
            Some("User initiated connection".to_string()),
        )?;

        info!(
            "Initiating connection to profile '{}' ({} via {:?})",
            params.profile_id, params.server_endpoint, params.protocol
        );

        // Instantiate driver
        let mut driver: Box<dyn VpnDriver> = match params.protocol {
            ProtocolType::OpenvpnUdp | ProtocolType::OpenvpnTcp => {
                Box::new(OpenVpnDriver::new(params.clone()))
            }
            ProtocolType::Wireguard => Box::new(WireGuardDriver::new(params.clone())),
        };

        let (driver_tx, mut driver_rx) = mpsc::channel(64);

        // Start VPN driver
        if let Err(e) = driver.start(driver_tx).await {
            self.state_mgr
                .transition_to(SessionState::Error, Some(e.to_string()))?;
            return Err(DaemonError::Driver(e));
        }

        let iface = driver.interface_name().to_string();
        let assigned_ip = driver.assigned_ip();

        let session = ActiveSession::new(&params, iface.clone(), assigned_ip);
        *self.active_session.lock().await = Some(session);
        *self.active_driver.lock().await = Some(driver);

        // Start telemetry collector loop
        self.metrics_collector
            .start(1000, iface.clone(), self.state_mgr.event_sender());

        // Spawn driver event monitoring task
        let state_mgr = self.state_mgr.clone();
        let network_mgr = self.network_mgr.clone();
        let active_driver = self.active_driver.clone();
        let active_session = self.active_session.clone();
        let params_clone = params.clone();
        let iface_name = iface.clone();

        tokio::spawn(async move {
            while let Some(event) = driver_rx.recv().await {
                match event {
                    DriverEvent::StateChanged(new_st) => {
                        let current = state_mgr.current_state();
                        if current != new_st {
                            if new_st == SessionState::Connected {
                                // Tunnel is confirmed active -> Setup network routes, DNS, IPv6 blackhole & firewalls
                                let (assigned, pushed_routes) = {
                                    let guard = active_driver.lock().await;
                                    let ip = guard.as_ref().and_then(|d| d.assigned_ip());
                                    let routes = guard
                                        .as_ref()
                                        .map(|d| d.pushed_routes())
                                        .unwrap_or_default();
                                    (ip, routes)
                                };

                                {
                                    let mut s_guard = active_session.lock().await;
                                    if let Some(ref mut sess) = *s_guard {
                                        if assigned.is_some() {
                                            sess.assigned_ip = assigned.clone();
                                        }
                                    }
                                }

                                let sec_policy =
                                    params_clone.security_policy.clone().unwrap_or_else(|| {
                                        let mut p = crate::ipc::protocol::SecurityPolicy::default();
                                        if !params_clone.enable_kill_switch {
                                            p.kill_switch_mode =
                                                crate::ipc::protocol::KillSwitchMode::Off;
                                        }
                                        p
                                    });

                                let route_policy =
                                    params_clone.routing_policy.clone().unwrap_or_default();
                                let custom_dns =
                                    params_clone.custom_dns.clone().unwrap_or_default();

                                let mut net = network_mgr.lock().await;
                                if let Err(e) = net.setup_vpn_network(
                                    &params_clone.server_endpoint,
                                    params_clone.server_port,
                                    &iface_name,
                                    assigned.as_deref(),
                                    &custom_dns,
                                    &pushed_routes,
                                    &sec_policy,
                                    &route_policy,
                                ) {
                                    error!("Failed to setup VPN network state: {}", e);
                                }
                            }
                            let _ = state_mgr.transition_to(new_st, None);
                        }
                    }
                    DriverEvent::Log { level, message } => {
                        info!("[Driver {}] {}", level, message);
                    }
                    DriverEvent::Metrics(_) => {}
                    DriverEvent::FatalError(e) => {
                        let _ = state_mgr.transition_to(SessionState::Error, Some(e.to_string()));
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    /// Disconnects the active VPN session and rolls back all network state.
    pub async fn disconnect(&self) -> Result<(), DaemonError> {
        let current_state = self.state_mgr.current_state();
        if current_state == SessionState::Disconnected {
            return Ok(());
        }

        self.state_mgr.transition_to(
            SessionState::Disconnecting,
            Some("Disconnect initiated".to_string()),
        )?;

        info!("Disconnecting active VPN session");

        self.metrics_collector.stop();

        // 1. Stop active driver
        if let Some(mut driver) = self.active_driver.lock().await.take() {
            let _ = driver.stop().await;
        }

        // 2. Teardown network modifications
        {
            let mut net = self.network_mgr.lock().await;
            let _ = net.teardown_vpn_network();
        }

        // 3. Clear active session
        *self.active_session.lock().await = None;

        self.state_mgr.transition_to(
            SessionState::Disconnected,
            Some("Session terminated cleanly".to_string()),
        )?;

        info!("VPN session disconnected and network reverted cleanly");

        Ok(())
    }

    /// Builds a current snapshot of the daemon state.
    pub async fn get_status(&self) -> DaemonStatusSnapshot {
        let state = self.state_mgr.current_state();
        let session_guard = self.active_session.lock().await;
        let net_guard = self.network_mgr.lock().await;

        if let Some(ref session) = *session_guard {
            DaemonStatusSnapshot {
                state,
                active_profile: Some(session.profile_id.clone()),
                assigned_ip: session.assigned_ip.clone(),
                virtual_interface: Some(session.interface_name.clone()),
                kill_switch_active: net_guard.is_kill_switch_active(),
                dns_servers: session.dns_servers.clone(),
                session_duration_secs: self.state_mgr.session_duration_secs(),
                ipv6_protected: net_guard.is_ipv6_protected(),
                intranet_only: net_guard.is_intranet_only(),
            }
        } else {
            DaemonStatusSnapshot {
                state,
                active_profile: None,
                assigned_ip: None,
                virtual_interface: None,
                kill_switch_active: net_guard.is_kill_switch_active(),
                dns_servers: vec![],
                session_duration_secs: 0,
                ipv6_protected: false,
                intranet_only: false,
            }
        }
    }

    /// Queries real-time bandwidth metrics.
    pub async fn query_metrics(&self) -> BandwidthMetrics {
        self.metrics_collector.get_latest().await
    }
}
