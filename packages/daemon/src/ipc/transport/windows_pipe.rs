//! # Windows Named Pipe Transport Layer
//!
//! Provides Named Pipe listening mechanisms on Windows with Discretionary Access Control Lists (DACL).

/// Default SDDL string for VPNHub Daemon Named Pipe:
/// Grants GENERIC_ALL to SYSTEM (SY) & Builtin Admins (BA), and Read/Write to Authenticated Users (AU).
pub const DEFAULT_PIPE_SDDL: &str = "D:(A;;GA;;;SY)(A;;GA;;;BA)(A;;GRGW;;;AU)";
