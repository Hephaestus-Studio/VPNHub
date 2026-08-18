//! # VPNHub Daemon Library (`vpnhub_daemon`)
//!
//! Provides the core data types, IPC protocol codecs, configuration, and interfaces
//! for interacting with the VPNHub system daemon.

pub mod config;
pub mod core;
pub mod engine;
pub mod error;
pub mod health;
pub mod ipc;
pub mod network;
pub mod platform;
pub mod security;
