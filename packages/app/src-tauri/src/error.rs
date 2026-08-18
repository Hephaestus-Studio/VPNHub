//! # Client IPC & Application Errors

use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Daemon is offline or unreachable at socket {0}")]
    DaemonOffline(String),

    #[error("Daemon IPC error: {0}")]
    Ipc(String),

    #[error("Daemon returned error (code {code}): {message}")]
    DaemonError { code: u32, message: String },

    #[error("Invalid response received from daemon")]
    InvalidResponse,

    #[error("Tauri error: {0}")]
    Tauri(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
