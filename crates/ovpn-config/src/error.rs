//! Error types for OpenVPN configuration parsing and validation.

use thiserror::Error;

/// Error types occurring during `.ovpn` configuration parsing or validation.
#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("I/O error while reading configuration: {0}")]
    Io(#[from] std::io::Error),

    #[error("Nom parsing error at line {line}: {message}")]
    NomParse { line: usize, message: String },

    #[error("Syntax error at line {line}: {message}")]
    SyntaxError { line: usize, message: String },

    #[error("Unclosed inline tag '<{tag}>' starting at line {line}")]
    UnclosedInlineTag { tag: String, line: usize },

    #[error("Invalid IP address: '{value}'")]
    InvalidIpAddress { value: String },

    #[error("Invalid integer for directive '{directive}': '{value}'")]
    InvalidInteger { directive: String, value: String },

    #[error("Invalid PKCS#12 data or password: {0}")]
    Pkcs12Error(String),

    #[error("Base64 decoding error for inline block: {0}")]
    Base64Error(#[from] base64::DecodeError),

    #[error("Missing required configuration: {0}")]
    MissingRequiredConfig(String),

    #[error("Conflicting configuration directives: {0}")]
    Conflict(String),

    #[error("Unsupported directive or option: '{directive}' - {reason}")]
    Unsupported { directive: String, reason: String },

    #[error("Invalid PUSH_REPLY payload: {0}")]
    InvalidPushReply(String),
}
