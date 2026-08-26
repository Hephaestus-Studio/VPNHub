//! Error types for cryptographic operations in openvpn3-rs.

use thiserror::Error;

/// Error types occurring during crypto operations (AEAD, KDF, Replay protection, ML-KEM).
#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("AEAD encryption error: {0}")]
    AeadEncryption(String),

    #[error("AEAD decryption or authentication tag verification failed")]
    AeadAuthenticationFailed,

    #[error("Anti-replay rejection: packet ID {packet_id} is a duplicate or too old (window base: {window_base})")]
    AntiReplayRejection { packet_id: u64, window_base: u64 },

    #[error("Invalid key size: expected {expected} bytes, got {actual} bytes")]
    InvalidKeySize { expected: usize, actual: usize },

    #[error("Invalid nonce size: expected {expected} bytes, got {actual} bytes")]
    InvalidNonceSize { expected: usize, actual: usize },

    #[error("Invalid tag size: expected {expected} bytes, got {actual} bytes")]
    InvalidTagSize { expected: usize, actual: usize },

    #[error("Key derivation error (HKDF/PRF): {0}")]
    KdfError(String),

    #[error("Post-Quantum KEM error: {0}")]
    PostQuantumKemError(String),

    #[error("Hardware token (PKCS#11) error: {0}")]
    Pkcs11Error(String),

    #[error("OS Keystore error: {0}")]
    KeyringError(String),

    #[error("Invalid key: {0}")]
    InvalidKey(String),

    #[error("Decryption or HMAC verification failed: {0}")]
    DecryptionFailed(String),

    #[error("Invalid ciphertext or serialization: {0}")]
    InvalidSerialization(String),
}
