//! # Secret Memory Protection & Zeroization
//!
//! Wrappers and helpers to guarantee that cryptographic keys, tokens,
//! and passwords are securely wiped from heap and stack memory upon drop.

use std::fmt;
use std::ops::{Deref, DerefMut};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// A memory-sanitized string wrapper that wipes its internal buffer upon destruction.
#[derive(Clone, Default, PartialEq, Eq, Zeroize, ZeroizeOnDrop)]
pub struct SecretString(String);

impl SecretString {
    /// Creates a new secret string from a raw string slice.
    pub fn new(val: impl Into<String>) -> Self {
        Self(val.into())
    }

    /// Exposes the inner string reference for sensitive operations.
    pub fn expose_secret(&self) -> &str {
        &self.0
    }
}

impl From<String> for SecretString {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl From<&str> for SecretString {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

impl Deref for SecretString {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl fmt::Debug for SecretString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "SecretString([REDACTED])")
    }
}

impl fmt::Display for SecretString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[REDACTED]")
    }
}

/// A memory-sanitized byte buffer that zeroes its contents upon destruction.
#[derive(Clone, Default, PartialEq, Eq, Zeroize, ZeroizeOnDrop)]
pub struct SecretBytes(Vec<u8>);

impl SecretBytes {
    /// Creates a new secret byte vector.
    pub fn new(val: Vec<u8>) -> Self {
        Self(val)
    }

    /// Exposes the inner byte slice for cryptographic operations.
    pub fn expose_secret(&self) -> &[u8] {
        &self.0
    }
}

impl From<Vec<u8>> for SecretBytes {
    fn from(v: Vec<u8>) -> Self {
        Self(v)
    }
}

impl Deref for SecretBytes {
    type Target = [u8];

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for SecretBytes {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl fmt::Debug for SecretBytes {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "SecretBytes([{} bytes REDACTED])", self.0.len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secret_string_redaction() {
        let secret = SecretString::new("super_secret_password_123");
        assert_eq!(format!("{:?}", secret), "SecretString([REDACTED])");
        assert_eq!(format!("{}", secret), "[REDACTED]");
        assert_eq!(secret.expose_secret(), "super_secret_password_123");
    }

    #[test]
    fn test_secret_bytes_redaction() {
        let secret = SecretBytes::new(vec![1, 2, 3, 4, 5]);
        assert_eq!(format!("{:?}", secret), "SecretBytes([5 bytes REDACTED])");
        assert_eq!(secret.expose_secret(), &[1, 2, 3, 4, 5]);
    }
}
