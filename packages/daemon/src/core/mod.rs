//! # Core Orchestration & State Machine Subsystem

pub mod orchestrator;
pub mod session;
pub mod state;

pub use orchestrator::DaemonOrchestrator;
pub use session::ActiveSession;
pub use state::StateManager;
