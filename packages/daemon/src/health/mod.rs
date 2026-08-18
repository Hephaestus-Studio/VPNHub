//! # Health, Observability & Diagnostics Subsystem

pub mod diagnostics;
pub mod metrics;
pub mod probe;

pub use diagnostics::generate_diagnostics;
pub use metrics::MetricsCollector;
pub use probe::DpdProbe;
