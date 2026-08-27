//! # Secure IPC Server & Connection Dispatcher
//!
//! Listens for incoming client IPC connections across Unix sockets or Named Pipes,
//! performs caller authentication, decodes framed JSON requests, dispatches them
//! to the orchestrator, and multiplexes asynchronous event streams to connected clients.

use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::io::{AsyncRead, AsyncWrite};
use tokio_util::codec::Framed;
use tracing::{debug, error, info, warn};

use crate::config::DaemonConfig;
use crate::core::DaemonOrchestrator;
use crate::error::IpcError;
use crate::ipc::codec::JsonLengthDelimitedCodec;
use crate::ipc::protocol::{DaemonRequest, DaemonResponse};

#[cfg(unix)]
use crate::ipc::auth::verify_peer_credentials;
#[cfg(unix)]
use crate::ipc::transport::UnixTransportListener;

/// Asynchronous IPC Server instance.
pub struct IpcServer {
    config: DaemonConfig,
    orchestrator: Arc<DaemonOrchestrator>,
}

impl IpcServer {
    /// Creates a new IPC server.
    pub fn new(config: DaemonConfig, orchestrator: Arc<DaemonOrchestrator>) -> Self {
        Self {
            config,
            orchestrator,
        }
    }

    /// Runs the IPC listener loop until cancellation is triggered.
    pub async fn run(&self) -> Result<(), IpcError> {
        #[cfg(unix)]
        {
            let listener =
                UnixTransportListener::bind(&self.config.socket_path, &self.config.auth_group)?;
            info!(
                "IPC Server listening on Unix Domain Socket {:?}",
                self.config.socket_path
            );

            loop {
                match listener.listener().accept().await {
                    Ok((stream, _addr)) => {
                        // Authenticate caller (anti-LPE)
                        match verify_peer_credentials(&stream, &self.config.auth_group) {
                            Ok(pid) => {
                                debug!("Accepted authorized IPC connection from PID {}", pid);
                                let orchestrator = self.orchestrator.clone();
                                tokio::spawn(async move {
                                    if let Err(e) =
                                        Self::handle_client_stream(stream, orchestrator).await
                                    {
                                        debug!("Client connection closed: {}", e);
                                    }
                                });
                            }
                            Err(e) => {
                                warn!("Rejected unauthorized IPC connection: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        error!("IPC accept error: {}", e);
                    }
                }
            }
        }

        #[cfg(windows)]
        {
            use crate::ipc::transport::windows_pipe::{PipeSecurityAttributes, DEFAULT_PIPE_SDDL};
            use tokio::net::windows::named_pipe::ServerOptions;

            let pipe_name = self.config.socket_path.to_string_lossy().to_string();
            info!("IPC Server listening on Windows Named Pipe: {}", pipe_name);

            let mut sec_attrs =
                PipeSecurityAttributes::from_sddl(DEFAULT_PIPE_SDDL).map_err(|e| {
                    IpcError::BindFailed {
                        endpoint: pipe_name.clone(),
                        source: e,
                    }
                })?;

            let mut server = unsafe {
                ServerOptions::new()
                    .first_pipe_instance(true)
                    .create_with_security_attributes_raw(&pipe_name, sec_attrs.as_mut_ptr())
            }
            .map_err(|e| IpcError::BindFailed {
                endpoint: pipe_name.clone(),
                source: e,
            })?;

            loop {
                match server.connect().await {
                    Ok(()) => {
                        let stream = server;
                        server = match unsafe {
                            ServerOptions::new()
                                .first_pipe_instance(false)
                                .create_with_security_attributes_raw(
                                    &pipe_name,
                                    sec_attrs.as_mut_ptr(),
                                )
                        } {
                            Ok(s) => s,
                            Err(e) => {
                                error!("Failed to create subsequent Named Pipe instance: {}", e);
                                break;
                            }
                        };

                        info!("Accepted Windows Named Pipe client connection");
                        let orchestrator = self.orchestrator.clone();
                        tokio::spawn(async move {
                            if let Err(e) = Self::handle_client_stream(stream, orchestrator).await {
                                debug!("Windows Named Pipe client connection closed: {}", e);
                            }
                        });
                    }
                    Err(e) => {
                        warn!("Windows Named Pipe connect error: {}", e);
                        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
                    }
                }
            }
            Ok(())
        }

        #[cfg(not(any(unix, windows)))]
        {
            info!("IPC Server unsupported on current platform");
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
            }
        }
    }

    /// Handles an individual connected client session with bidirectional streaming.
    async fn handle_client_stream<S>(
        stream: S,
        orchestrator: Arc<DaemonOrchestrator>,
    ) -> Result<(), IpcError>
    where
        S: AsyncRead + AsyncWrite + Unpin + Send + 'static,
    {
        let codec = JsonLengthDelimitedCodec::<DaemonRequest, DaemonResponse>::default();
        let mut framed = Framed::new(stream, codec);

        let mut event_rx = orchestrator.state_manager().subscribe_events();

        loop {
            tokio::select! {
                // Inbound request from client
                maybe_req = framed.next() => {
                    match maybe_req {
                        Some(Ok(request)) => {
                            let response = orchestrator.handle_request(request).await;
                            framed.send(response).await?;
                        }
                        Some(Err(e)) => {
                            warn!("Malformed frame received from client: {}", e);
                            return Err(e);
                        }
                        None => {
                            // Client disconnected
                            break;
                        }
                    }
                }

                // Outbound server push event
                Ok(event) = event_rx.recv() => {
                    debug!("Streaming push event to client: {:?}", event);
                }
            }
        }

        Ok(())
    }
}
