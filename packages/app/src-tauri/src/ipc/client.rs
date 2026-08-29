//! # Asynchronous IPC Client for VPNHub Daemon

use futures_util::{SinkExt, StreamExt};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
#[cfg(unix)]
use tokio::net::UnixStream;

#[cfg(windows)]
use tokio::net::windows::named_pipe::{ClientOptions, NamedPipeClient};

use tokio::sync::Mutex;
use tokio_util::codec::Framed;
use tracing::{info, warn};

#[cfg(unix)]
use vpnhub_daemon::config::DEFAULT_LINUX_SOCKET_PATH;
#[cfg(not(unix))]
use vpnhub_daemon::config::DEFAULT_WINDOWS_PIPE_NAME;

use vpnhub_daemon::ipc::codec::JsonLengthDelimitedCodec;
use vpnhub_daemon::ipc::protocol::{DaemonRequest, DaemonResponse};

use crate::error::AppError;

#[cfg(unix)]
type IpcStream = UnixStream;

#[cfg(windows)]
type IpcStream = NamedPipeClient;

type DaemonFramed = Framed<IpcStream, JsonLengthDelimitedCodec<DaemonResponse, DaemonRequest>>;

/// Thread-safe client connection manager to the background daemon.
pub struct DaemonClient {
    socket_path: PathBuf,
    stream: Mutex<Option<DaemonFramed>>,
    is_connected: AtomicBool,
}

impl DaemonClient {
    /// Creates a new DaemonClient with standard socket path.
    pub fn new() -> Self {
        #[cfg(unix)]
        let socket_path = std::env::var("VPNHUB_SOCKET_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(DEFAULT_LINUX_SOCKET_PATH));

        #[cfg(not(unix))]
        let socket_path = std::env::var("VPNHUB_SOCKET_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(DEFAULT_WINDOWS_PIPE_NAME));

        Self {
            socket_path,
            stream: Mutex::new(None),
            is_connected: AtomicBool::new(false),
        }
    }

    /// Access the socket path being used.
    pub fn socket_path(&self) -> &Path {
        &self.socket_path
    }

    /// Whether the client is currently connected.
    pub fn is_connected(&self) -> bool {
        self.is_connected.load(Ordering::Relaxed)
    }

    /// Establishes or re-establishes a connection to the daemon socket.
    pub async fn ensure_connected(&self) -> Result<(), AppError> {
        let mut lock = self.stream.lock().await;
        if lock.is_some() && self.is_connected.load(Ordering::Relaxed) {
            return Ok(());
        }

        #[cfg(unix)]
        {
            match UnixStream::connect(&self.socket_path).await {
                Ok(stream) => {
                    let codec =
                        JsonLengthDelimitedCodec::<DaemonResponse, DaemonRequest>::default();
                    let framed = Framed::new(stream, codec);
                    *lock = Some(framed);
                    self.is_connected.store(true, Ordering::Relaxed);
                    info!("Connected to VPNHub Daemon at {:?}", self.socket_path);
                    Ok(())
                }
                Err(e) => {
                    *lock = None;
                    self.is_connected.store(false, Ordering::Relaxed);
                    Err(AppError::DaemonOffline(format!(
                        "Failed to connect to {:?}: {}",
                        self.socket_path, e
                    )))
                }
            }
        }

        #[cfg(windows)]
        {
            let pipe_name = self.socket_path.to_string_lossy().to_string();
            match ClientOptions::new().open(&pipe_name) {
                Ok(client) => {
                    let codec =
                        JsonLengthDelimitedCodec::<DaemonResponse, DaemonRequest>::default();
                    let framed = Framed::new(client, codec);
                    *lock = Some(framed);
                    self.is_connected.store(true, Ordering::Relaxed);
                    info!("Connected to VPNHub Daemon Named Pipe at {}", pipe_name);
                    Ok(())
                }
                Err(e) => {
                    *lock = None;
                    self.is_connected.store(false, Ordering::Relaxed);
                    warn!(
                        "Failed to connect to Windows Named Pipe '{}': {}",
                        pipe_name, e
                    );
                    Err(AppError::DaemonOffline(format!(
                        "Failed to connect to Named Pipe {}: {}",
                        pipe_name, e
                    )))
                }
            }
        }
    }

    /// Sends a request to the daemon and awaits the synchronous response.
    pub async fn send_request(&self, request: DaemonRequest) -> Result<DaemonResponse, AppError> {
        // Attempt connection with retry
        self.ensure_connected().await?;

        let mut lock = self.stream.lock().await;
        let framed = lock
            .as_mut()
            .ok_or_else(|| AppError::DaemonOffline(self.socket_path.display().to_string()))?;

        // 1. Send request
        if let Err(e) = framed.send(request).await {
            warn!("Failed to send request to daemon: {}", e);
            self.is_connected.store(false, Ordering::Relaxed);
            *lock = None;
            return Err(AppError::Ipc(format!("Socket write error: {}", e)));
        }

        // 2. Await response with timeout
        let maybe_response = tokio::time::timeout(Duration::from_secs(10), framed.next()).await;

        match maybe_response {
            Ok(Some(Ok(response))) => match response {
                DaemonResponse::Error { code, message } => {
                    Err(AppError::DaemonError { code, message })
                }
                other => Ok(other),
            },
            Ok(Some(Err(e))) => {
                warn!("Received corrupted or malformed frame from daemon: {}", e);
                self.is_connected.store(false, Ordering::Relaxed);
                *lock = None;
                Err(AppError::Ipc(format!("Codec decode failure: {}", e)))
            }
            Ok(None) => {
                warn!("Daemon closed connection unexpectedly");
                self.is_connected.store(false, Ordering::Relaxed);
                *lock = None;
                Err(AppError::DaemonOffline(
                    "Daemon closed IPC stream".to_string(),
                ))
            }
            Err(_) => {
                warn!("Daemon request timed out after 10 seconds");
                Err(AppError::Ipc("IPC Request timed out".to_string()))
            }
        }
    }

    /// Performs a lightweight health ping to the daemon.
    pub async fn ping(&self) -> bool {
        match self.send_request(DaemonRequest::Ping).await {
            Ok(DaemonResponse::Pong) => true,
            Ok(other) => {
                warn!("Daemon ping received unexpected response: {:?}", other);
                false
            }
            Err(e) => {
                warn!("Daemon ping failed: {}", e);
                false
            }
        }
    }
}

/// Synchronously sends a force disconnect frame to the daemon on exit without Tokio runtime or stream Mutex contention.
pub fn send_synchronous_disconnect() {
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::net::UnixStream;

        let socket_path = std::env::var("VPNHUB_SOCKET_PATH")
            .unwrap_or_else(|_| DEFAULT_LINUX_SOCKET_PATH.to_string());
        if let Ok(mut stream) = UnixStream::connect(socket_path) {
            let _ = stream.set_write_timeout(Some(std::time::Duration::from_millis(300)));
            let payload = r#"{"action":"disconnect","params":{"force":true}}"#;
            let len_bytes = (payload.len() as u32).to_be_bytes();
            let _ = stream.write_all(&len_bytes);
            let _ = stream.write_all(payload.as_bytes());
            let _ = stream.flush();
        }
    }
}
