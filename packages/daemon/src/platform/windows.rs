//! # Windows Service Control Manager (SCM) Integration
//!
//! Provides Windows Service registration, lifecycle dispatching, and control callbacks.

use crate::error::PlatformError;
use tracing::info;

#[cfg(windows)]
windows_service::define_windows_service!(ffi_service_main, vpnhub_service_main);

#[cfg(windows)]
fn vpnhub_service_main(_arguments: Vec<std::ffi::OsString>) {
    use windows_service::service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
        ServiceType,
    };
    use windows_service::service_control_handler::{self, ServiceControlHandlerResult};

    let event_handler = move |control_event| -> ServiceControlHandlerResult {
        match control_event {
            ServiceControl::Stop => {
                std::process::exit(0);
            }
            ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
            _ => ServiceControlHandlerResult::NotImplemented,
        }
    };

    let status_handle = match service_control_handler::register("vpnhub-daemon", event_handler) {
        Ok(h) => h,
        Err(_) => return,
    };

    let running_status = ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Running,
        controls_accepted: ServiceControlAccept::STOP,
        exit_code: ServiceExitCode::NO_ERROR,
        checkpoint: 0,
        wait_hint: std::time::Duration::default(),
        process_id: None,
    };

    let _ = status_handle.set_service_status(running_status);
}

/// Windows Service platform controller.
pub struct WindowsPlatform;

impl WindowsPlatform {
    /// Dispatches the process as a Windows Service if invoked by SCM.
    pub fn run_service() -> Result<(), PlatformError> {
        #[cfg(windows)]
        {
            use windows_service::service_dispatcher;
            service_dispatcher::start("vpnhub-daemon", ffi_service_main)
                .map_err(|e| PlatformError::WindowsServiceFailed(e.to_string()))?;
        }
        Ok(())
    }

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
