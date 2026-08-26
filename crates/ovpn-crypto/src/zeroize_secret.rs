//! Zeroization containers and structured audit logging for security-sensitive data.

use std::fmt;
use std::ops::{Deref, DerefMut};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Structured audit logging helper functions.
pub mod audit {
    /// Emits a structured security audit event for cryptographic operations.
    pub fn log_crypto_event(action: &str, key_id: Option<u8>, details: &str) {
        tracing::info!(
            target: "ovpn::audit::crypto",
            action = action,
            key_id = key_id,
            details = details,
            "AUDIT [CRYPTO]: {} (key_id: {:?}) - {}",
            action,
            key_id,
            details
        );
    }

    /// Emits a structured security audit event for authentication actions.
    pub fn log_auth_event(action: &str, user: Option<&str>, success: bool, reason: Option<&str>) {
        tracing::info!(
            target: "ovpn::audit::auth",
            action = action,
            user = user,
            success = success,
            reason = reason,
            "AUDIT [AUTH]: {} (user: {:?}, success: {}) - reason: {:?}",
            action,
            user,
            success,
            reason
        );
    }

    /// Emits a structured security audit event for key rollover / retirement.
    pub fn log_key_rotation(old_key_id: u8, new_key_id: u8, reason: &str) {
        tracing::info!(
            target: "ovpn::audit::crypto",
            action = "key_rotation",
            old_key_id = old_key_id,
            new_key_id = new_key_id,
            reason = reason,
            "AUDIT [KEY_ROTATION]: Slot transition key_id {} -> {} ({})",
            old_key_id,
            new_key_id,
            reason
        );
    }
}

/// Generic secure container holding secret data that is guaranteed to be zeroized when dropped.
#[derive(Clone, PartialEq, Eq, Zeroize, ZeroizeOnDrop)]
pub struct SecretBox<T: Zeroize> {
    inner: T,
}

impl<T: Zeroize> SecretBox<T> {
    pub fn new(inner: T) -> Self {
        Self { inner }
    }

    pub fn expose_secret(&self) -> &T {
        &self.inner
    }

    pub fn expose_secret_mut(&mut self) -> &mut T {
        &mut self.inner
    }
}

impl<T: Zeroize> Deref for SecretBox<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl<T: Zeroize> DerefMut for SecretBox<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.inner
    }
}

impl<T: Zeroize> fmt::Debug for SecretBox<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[REDACTED SECRET]")
    }
}

/// Fixed-size cryptographic key wrapper with drop zeroization.
#[derive(Clone, PartialEq, Eq, Zeroize, ZeroizeOnDrop)]
pub struct Key<const N: usize> {
    bytes: [u8; N],
}

impl<const N: usize> Key<N> {
    pub fn new(bytes: [u8; N]) -> Self {
        Self { bytes }
    }

    pub fn from_slice(slice: &[u8]) -> Result<Self, crate::error::CryptoError> {
        if slice.len() != N {
            return Err(crate::error::CryptoError::InvalidKeySize {
                expected: N,
                actual: slice.len(),
            });
        }
        let mut bytes = [0u8; N];
        bytes.copy_from_slice(slice);
        Ok(Self { bytes })
    }

    pub fn as_bytes(&self) -> &[u8; N] {
        &self.bytes
    }

    pub fn as_slice(&self) -> &[u8] {
        &self.bytes
    }
}

impl<const N: usize> fmt::Debug for Key<N> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[REDACTED KEY {} BYTES]", N)
    }
}

/// Data channel symmetric key bundle for one direction (encrypt or decrypt).
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct DirectionalKey {
    /// Cipher key (e.g. 32 bytes for AES-256-GCM / ChaCha20-Poly1305, 16 bytes for AES-128-GCM).
    pub cipher_key: Vec<u8>,
    /// HMAC authentication key (for TLS-Auth or legacy data channel).
    pub hmac_key: Vec<u8>,
}

impl fmt::Debug for DirectionalKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("DirectionalKey")
            .field("cipher_key_len", &self.cipher_key.len())
            .field("hmac_key_len", &self.hmac_key.len())
            .finish()
    }
}

/// Complete dual-direction data channel session keys (TX and RX).
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct SessionKeySet {
    /// Key ID (0 to 7 in OpenVPN protocol).
    pub key_id: u8,
    /// Transmit key (Client -> Server).
    pub tx_key: DirectionalKey,
    /// Receive key (Server -> Client).
    pub rx_key: DirectionalKey,
}

impl fmt::Debug for SessionKeySet {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SessionKeySet")
            .field("key_id", &self.key_id)
            .field("tx_key", &self.tx_key)
            .field("rx_key", &self.rx_key)
            .finish()
    }
}
