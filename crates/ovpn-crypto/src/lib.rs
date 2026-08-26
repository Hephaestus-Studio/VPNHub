//! # ovpn-crypto
//!
//! Cryptographic primitives, AEAD ciphers, KDF/PRF, Post-Quantum ML-KEM-768,
//! 128-bit sliding window anti-replay protection, and memory zeroization for `openvpn3-rs`.

#![deny(unsafe_code)]

pub mod aead;
pub mod anti_replay;
pub mod error;
pub mod hardware;
pub mod kdf;
pub mod pq_kem;
pub mod static_key;
pub mod zeroize_secret;

pub use aead::{
    decrypt_packet_with_tag, encrypt_packet_with_tag, Aes128GcmCipher, Aes256GcmCipher,
    ChaCha20Poly1305Cipher, CipherSuite, SymmCipher,
};
pub use anti_replay::AntiReplayWindow;
pub use error::CryptoError;
pub use hardware::{HardwareSigner, OsKeyring, Pkcs11TokenConfig};
pub use kdf::{
    derive_data_channel_keys, derive_tls_crypt_keys, derive_tls_crypt_v2_keys, hkdf_sha256,
    hkdf_sha512, openvpn_prf_sha256,
};
pub use pq_kem::{
    hybrid_encapsulate, HybridKemCiphertext, HybridKemKeyPair, HybridKemPrivateKey,
    HybridKemPublicKey,
};
pub use static_key::{AuthDigest, StaticKey, TlsAuthContext};

pub use zeroize_secret::{audit, DirectionalKey, Key, SecretBox, SessionKeySet};
