//! # IPC Subsystem for Tauri Backend

pub mod client;
pub mod worker;

pub use client::DaemonClient;
pub use worker::start_ipc_monitor_worker;
