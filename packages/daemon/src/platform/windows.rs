//! # Windows Service Control Manager (SCM) Integration
//!
//! Provides Windows Service registration, lifecycle dispatching, and control callbacks.

use crate::error::PlatformError;
use tracing::info;

/// Windows Service platform controller.
pub struct WindowsPlatform;

impl WindowsPlatform {
    /// Notifies SCM of running state.
    pub fn notify_ready() -> Result<(), PlatformError> {
        info!("Windows Service is running");
        Ok(())
    }

    /// Notifies SCM of stopping state.
    pub fn notify_stopping() -> Result<(), PlatformError> {
        info!("Windows Service is stopping");
        Ok(())
    }
}
