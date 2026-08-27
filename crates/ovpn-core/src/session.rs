//! Full asynchronous client session pipeline loop and remote endpoint failover.

use crate::error::CoreError;
use crate::events::{SessionEvent, SessionStats};
use crate::handle::{ClientCommand, ClientHandle};
use ovpn_config::{OpenVpnConfig, Protocol as ConfigProtocol};
use ovpn_protocol::{EngineState, OutputAction, ProtocolEngine};
use ovpn_transport::{HttpConnectClient, Socks5Client, TcpTransport, UdpTransport};
use ovpn_tun::VirtualTunDevice;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{broadcast, mpsc, RwLock};

enum ConnectedTransport {
    Udp(UdpTransport),
    Tcp(TcpTransport),
}

impl ConnectedTransport {
    async fn send_packet(&mut self, packet: &[u8]) -> Result<(), CoreError> {
        match self {
            ConnectedTransport::Udp(u) => u.send_packet(packet).await.map_err(CoreError::Transport),
            ConnectedTransport::Tcp(t) => t.send_packet(packet).await.map_err(CoreError::Transport),
        }
    }

    async fn recv_packet(&mut self, buf: &mut [u8]) -> Result<usize, CoreError> {
        match self {
            ConnectedTransport::Udp(u) => u.recv_packet(buf).await.map_err(CoreError::Transport),
            ConnectedTransport::Tcp(t) => t.recv_packet(buf).await.map_err(CoreError::Transport),
        }
    }
}

/// High-level client session orchestrator.
pub struct ClientSession;

impl ClientSession {
    /// Spawns the client session pipeline task in the background.
    pub fn spawn(
        config: OpenVpnConfig,
        tun_device: Box<dyn VirtualTunDevice>,
    ) -> (ClientHandle, broadcast::Receiver<SessionEvent>) {
        let (event_tx, event_rx) = broadcast::channel(128);
        let (command_tx, command_rx) = mpsc::channel(32);
        let stats = Arc::new(RwLock::new(SessionStats::default()));
        let is_running = Arc::new(AtomicBool::new(true));

        let handle = ClientHandle::new(command_tx, stats.clone(), is_running.clone());

        tokio::spawn(async move {
            let res = Self::run_orchestration_loop(
                config,
                tun_device,
                event_tx.clone(),
                command_rx,
                stats,
            )
            .await;
            is_running.store(false, Ordering::Relaxed);
            if let Err(e) = res {
                let _ = event_tx.send(SessionEvent::Error {
                    message: e.to_string(),
                });
            }
        });

        (handle, event_rx)
    }

    async fn run_orchestration_loop(
        config: OpenVpnConfig,
        mut tun: Box<dyn VirtualTunDevice>,
        event_tx: broadcast::Sender<SessionEvent>,
        mut command_rx: mpsc::Receiver<ClientCommand>,
        stats: Arc<RwLock<SessionStats>>,
    ) -> Result<(), CoreError> {
        let remotes = if !config.remotes.is_empty() {
            config.remotes.clone()
        } else {
            return Err(CoreError::AllRemotesFailed);
        };

        // Try connecting across remote entries with failover
        for remote in &remotes {
            let proto = remote.proto.unwrap_or(config.proto);
            let addr_str = format!("{}:{}", remote.host, remote.port);

            let resolved_addrs: Vec<SocketAddr> = match tokio::net::lookup_host(&addr_str).await {
                Ok(iter) => iter.collect(),
                Err(e) => {
                    tracing::warn!(target: "ovpn::core", host = %addr_str, error = %e, "DNS resolution failed");
                    continue;
                }
            };

            for &socket_addr in &resolved_addrs {
                tracing::info!(target: "ovpn::core", endpoint = %socket_addr, proto = ?proto, "Attempting connection");

                let transport = match proto {
                    ConfigProtocol::Udp | ConfigProtocol::Udp4 | ConfigProtocol::Udp6 => {
                        match UdpTransport::connect(socket_addr).await {
                            Ok(u) => ConnectedTransport::Udp(u),
                            Err(e) => {
                                tracing::warn!(target: "ovpn::core", error = %e, "UDP connect failed");
                                continue;
                            }
                        }
                    }
                    ConfigProtocol::Tcp
                    | ConfigProtocol::Tcp4
                    | ConfigProtocol::Tcp6
                    | ConfigProtocol::TcpClient
                    | ConfigProtocol::TcpServer => {
                        // Check if proxy is configured
                        if let Some(ref proxy) = config.proxy {
                            match proxy {
                                ovpn_config::ProxyConfig::Socks { host, port, .. } => {
                                    let proxy_addr: SocketAddr =
                                        format!("{host}:{port}").parse().map_err(|e| {
                                            CoreError::Transport(
                                                ovpn_transport::TransportError::DnsResolutionFailed(
                                                    format!("{e}"),
                                                ),
                                            )
                                        })?;
                                    match Socks5Client::connect(
                                        proxy_addr,
                                        &remote.host,
                                        remote.port,
                                        None,
                                    )
                                    .await
                                    {
                                        Ok(s) => match TcpTransport::from_connected_stream(
                                            s,
                                            socket_addr,
                                        ) {
                                            Ok(t) => ConnectedTransport::Tcp(t),
                                            Err(_) => continue,
                                        },
                                        Err(_) => continue,
                                    }
                                }
                                ovpn_config::ProxyConfig::Http { host, port, .. } => {
                                    let proxy_addr: SocketAddr =
                                        format!("{host}:{port}").parse().map_err(|e| {
                                            CoreError::Transport(
                                                ovpn_transport::TransportError::DnsResolutionFailed(
                                                    format!("{e}"),
                                                ),
                                            )
                                        })?;
                                    match HttpConnectClient::connect(
                                        proxy_addr,
                                        &remote.host,
                                        remote.port,
                                        None,
                                    )
                                    .await
                                    {
                                        Ok(s) => match TcpTransport::from_connected_stream(
                                            s,
                                            socket_addr,
                                        ) {
                                            Ok(t) => ConnectedTransport::Tcp(t),
                                            Err(_) => continue,
                                        },
                                        Err(_) => continue,
                                    }
                                }
                            }
                        } else {
                            match TcpTransport::connect(socket_addr).await {
                                Ok(t) => ConnectedTransport::Tcp(t),
                                Err(e) => {
                                    tracing::warn!(target: "ovpn::core", error = %e, "TCP connect failed");
                                    continue;
                                }
                            }
                        }
                    }
                };

                // Run active session event loop
                let res = Self::run_pipeline_loop(
                    &config,
                    transport,
                    tun.as_mut(),
                    &event_tx,
                    &mut command_rx,
                    &stats,
                )
                .await;

                match res {
                    Ok(()) => return Ok(()),
                    Err(e) => {
                        tracing::warn!(target: "ovpn::core", error = %e, "Session pipeline disconnected, attempting next remote");
                    }
                }
            }
        }

        Err(CoreError::AllRemotesFailed)
    }

    async fn run_pipeline_loop(
        config: &OpenVpnConfig,
        mut transport: ConnectedTransport,
        tun: &mut dyn VirtualTunDevice,
        event_tx: &broadcast::Sender<SessionEvent>,
        command_rx: &mut mpsc::Receiver<ClientCommand>,
        stats: &Arc<RwLock<SessionStats>>,
    ) -> Result<(), CoreError> {
        let now = Instant::now();
        let mut engine = ProtocolEngine::new(config.clone(), now)?;
        engine.start_connect(now)?;

        Self::drain_engine_actions(&mut engine, &mut transport, tun, event_tx).await?;

        let mut net_buf = vec![0u8; 65536];
        let mut tun_buf = vec![0u8; 65536];
        let mut ticker = tokio::time::interval(Duration::from_millis(50));
        let start_time = Instant::now();

        loop {
            tokio::select! {
                // 1. Inbound network packet from socket
                net_res = transport.recv_packet(&mut net_buf) => {
                    let n = net_res?;
                    tracing::debug!(target: "ovpn::core", "Received {} bytes from network socket", n);
                    let now = Instant::now();
                    engine.process_network_packet(now, &net_buf[..n])?;

                    {
                        let mut st = stats.write().await;
                        st.bytes_in += n as u64;
                        st.packets_in += 1;
                        st.uptime_secs = start_time.elapsed().as_secs();
                    }

                    Self::drain_engine_actions(&mut engine, &mut transport, tun, event_tx).await?;
                }

                // 2. Inbound IP packet from TUN interface
                tun_res = tun.read(&mut tun_buf) => {
                    let n = tun_res?;
                    if n > 0 {
                        tracing::trace!(target: "ovpn::core", "Read {} bytes from TUN device", n);
                        let now = Instant::now();
                        engine.process_tun_packet(now, &tun_buf[..n])?;

                        {
                            let mut st = stats.write().await;
                            st.bytes_out += n as u64;
                            st.packets_out += 1;
                            st.uptime_secs = start_time.elapsed().as_secs();
                        }

                        Self::drain_engine_actions(&mut engine, &mut transport, tun, event_tx).await?;
                    }
                }

                // 3. User commands from control handle
                cmd_opt = command_rx.recv() => {
                    match cmd_opt {
                        Some(ClientCommand::SubmitCredentials { username, password }) => {
                            tracing::info!(target: "ovpn::core", "Received SubmitCredentials command for user '{}'", username);
                            let _now = Instant::now();
                            let creds = ovpn_protocol::AuthHandler::encode_credentials(&username, &password);
                            let _ = creds;
                            Self::drain_engine_actions(&mut engine, &mut transport, tun, event_tx).await?;
                        }

                        Some(ClientCommand::SubmitChallengeResponse { state_id, response }) => {
                            tracing::info!(target: "ovpn::core", "Received SubmitChallengeResponse command for state_id '{}'", state_id);
                            let now = Instant::now();
                            engine.submit_challenge_response(now, &state_id, &response)?;
                            Self::drain_engine_actions(&mut engine, &mut transport, tun, event_tx).await?;
                        }
                        Some(ClientCommand::Disconnect { reason }) => {
                            tracing::info!(target: "ovpn::core", "Received Disconnect command (reason: {:?})", reason);
                            let _ = event_tx.send(SessionEvent::Disconnected { reason });
                            return Ok(());
                        }
                        None => {
                            // Control handle dropped
                            tracing::debug!(target: "ovpn::core", "Control handle dropped");
                            return Ok(());
                        }
                    }
                }

                // 4. Periodic ticker for protocol timeouts and keepalive pings
                _ = ticker.tick() => {
                    let now = Instant::now();
                    engine.handle_timeout(now)?;
                    Self::drain_engine_actions(&mut engine, &mut transport, tun, event_tx).await?;

                    // Periodically broadcast stats update
                    let current_stats = *stats.read().await;
                    let _ = event_tx.send(SessionEvent::StatsUpdated(current_stats));

                    if engine.state() == EngineState::Error {
                        tracing::error!(target: "ovpn::core", "Protocol engine entered Error state, closing pipeline");
                        return Err(CoreError::SessionClosed("Protocol engine entered Error state".to_string()));
                    }
                }
            }
        }
    }

    async fn drain_engine_actions(
        engine: &mut ProtocolEngine,
        transport: &mut ConnectedTransport,
        tun: &mut dyn VirtualTunDevice,
        event_tx: &broadcast::Sender<SessionEvent>,
    ) -> Result<(), CoreError> {
        while let Some(action) = engine.poll_output_action() {
            match action {
                OutputAction::SendToNetwork(pkt) => {
                    tracing::debug!(target: "ovpn::core", "Action: Sending {} bytes to network socket", pkt.len());
                    transport.send_packet(&pkt).await?;
                }
                OutputAction::SendToTun(pkt) => {
                    tracing::trace!(target: "ovpn::core", "Action: Sending {} bytes to TUN device", pkt.len());
                    tun.write(&pkt).await?;
                }
                OutputAction::ConfigureNetwork(config) => {
                    tracing::info!(target: "ovpn::core", "Action: Emitting NetworkConfigured event");
                    let _ = event_tx.send(SessionEvent::NetworkConfigured(config));
                }
                OutputAction::RequestAuthChallenge(challenge) => {
                    tracing::info!(target: "ovpn::core", "Action: Emitting AuthChallenge event");
                    let _ = event_tx.send(SessionEvent::AuthChallenge(challenge));
                }
                OutputAction::StateChange(state) => {
                    tracing::info!(target: "ovpn::core", "Action: Emitting StateChanged({:?})", state);
                    let _ = event_tx.send(SessionEvent::StateChanged(state));
                }
                OutputAction::CloseSession(reason) => {
                    tracing::warn!(target: "ovpn::core", "Action: CloseSession with reason '{}'", reason);
                    let _ = event_tx.send(SessionEvent::Disconnected {
                        reason: reason.clone(),
                    });
                    return Err(CoreError::SessionClosed(reason));
                }
            }
        }
        Ok(())
    }
}
