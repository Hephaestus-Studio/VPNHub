//! # Health & Observability Subsystem

pub mod metrics;
pub mod probe;

pub use metrics::MetricsCollector;
pub use probe::DpdProbe;
