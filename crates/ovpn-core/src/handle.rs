//! Control handle for interacting with a running ClientSession.

use crate::events::SessionStats;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

/// Commands sent from the control handle to the running pipeline task.
pub enum ClientCommand {
    SubmitCredentials { username: String, password: String },
    SubmitChallengeResponse { state_id: String, response: String },
    Disconnect { reason: String },
}

/// Thread-safe handle for controlling an active OpenVPN client session.
#[derive(Clone)]
pub struct ClientHandle {
    command_tx: mpsc::Sender<ClientCommand>,
    stats: Arc<RwLock<SessionStats>>,
    is_running: Arc<AtomicBool>,
}

impl ClientHandle {
    pub(crate) fn new(
        command_tx: mpsc::Sender<ClientCommand>,
        stats: Arc<RwLock<SessionStats>>,
        is_running: Arc<AtomicBool>,
    ) -> Self {
        Self {
            command_tx,
            stats,
            is_running,
        }
    }

    /// Whether the client session task is currently running.
    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::Relaxed)
    }

    /// Submits username and password credentials to the active session.
    pub async fn submit_credentials(&self, username: &str, password: &str) -> Result<(), ()> {
        self.command_tx
            .send(ClientCommand::SubmitCredentials {
                username: username.to_string(),
                password: password.to_string(),
            })
            .await
            .map_err(|_| ())
    }

    /// Submits a dynamic challenge response token (e.g. OTP) to the server.
    pub async fn submit_challenge_response(
        &self,
        state_id: &str,
        response: &str,
    ) -> Result<(), ()> {
        self.command_tx
            .send(ClientCommand::SubmitChallengeResponse {
                state_id: state_id.to_string(),
                response: response.to_string(),
            })
            .await
            .map_err(|_| ())
    }

    /// Retrieves a snapshot of the current session statistics.
    pub async fn get_stats(&self) -> SessionStats {
        *self.stats.read().await
    }

    /// Signals the active session to disconnect and terminate.
    pub async fn disconnect(&self, reason: &str) -> Result<(), ()> {
        self.command_tx
            .send(ClientCommand::Disconnect {
                reason: reason.to_string(),
            })
            .await
            .map_err(|_| ())
    }
}
