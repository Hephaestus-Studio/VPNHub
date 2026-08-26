//! AEAD symmetric ciphers supporting in-place encryption/decryption.

use crate::error::CryptoError;
use aead::{AeadInPlace, KeyInit, Tag};
use aes_gcm::{Aes128Gcm, Aes256Gcm, Nonce as AesNonce};
use bytes::BytesMut;
use chacha20poly1305::{ChaCha20Poly1305, Nonce as ChaChaNonce};
use std::fmt;

/// Symmetric AEAD cipher trait for OpenVPN data channel.
pub trait SymmCipher: Send + Sync {
    /// In-place encryption. Encrypts `buffer` in-place using `nonce` and authenticated additional data `aad`,
    /// returning the 16-byte authentication tag.
    fn encrypt_in_place(
        &self,
        nonce: &[u8],
        aad: &[u8],
        buffer: &mut [u8],
    ) -> Result<[u8; 16], CryptoError>;

    /// In-place decryption. Decrypts `buffer` in-place and validates `tag` with `nonce` and `aad`.
    fn decrypt_in_place(
        &self,
        nonce: &[u8],
        aad: &[u8],
        buffer: &mut [u8],
        tag: &[u8; 16],
    ) -> Result<(), CryptoError>;

    /// Key length in bytes.
    fn key_size(&self) -> usize;

    /// Nonce length in bytes (standard 12 bytes for OpenVPN GCM/ChaCha20).
    fn nonce_size(&self) -> usize {
        12
    }

    /// Authentication tag length in bytes (standard 16 bytes).
    fn tag_size(&self) -> usize {
        16
    }

    /// Cipher name identifier.
    fn name(&self) -> &'static str;
}

/// AES-256-GCM AEAD cipher implementation.
pub struct Aes256GcmCipher {
    cipher: Aes256Gcm,
}

impl Aes256GcmCipher {
    pub fn new(key: &[u8]) -> Result<Self, CryptoError> {
        if key.len() != 32 {
            return Err(CryptoError::InvalidKeySize {
                expected: 32,
                actual: key.len(),
            });
        }
        let cipher = Aes256Gcm::new_from_slice(key)
            .map_err(|e| CryptoError::AeadEncryption(e.to_string()))?;
        Ok(Self { cipher })
    }
}

impl SymmCipher for Aes256GcmCipher {
    fn encrypt_in_place(
        &self,
        nonce: &[u8],
        aad: &[u8],
        buffer: &mut [u8],
    ) -> Result<[u8; 16], CryptoError> {
        if nonce.len() != 12 {
            return Err(CryptoError::InvalidNonceSize {
                expected: 12,
                actual: nonce.len(),
            });
        }
        let nonce = AesNonce::from_slice(nonce);
        let tag = self
            .cipher
            .encrypt_in_place_detached(nonce, aad, buffer)
            .map_err(|e| CryptoError::AeadEncryption(e.to_string()))?;
        let mut out_tag = [0u8; 16];
        out_tag.copy_from_slice(tag.as_slice());
        Ok(out_tag)
    }

    fn decrypt_in_place(
        &self,
        nonce: &[u8],
        aad: &[u8],
        buffer: &mut [u8],
        tag: &[u8; 16],
    ) -> Result<(), CryptoError> {
        if nonce.len() != 12 {
            return Err(CryptoError::InvalidNonceSize {
                expected: 12,
                actual: nonce.len(),
            });
        }
        let nonce = AesNonce::from_slice(nonce);
        let tag_obj = Tag::<Aes256Gcm>::from_slice(tag);
        self.cipher
            .decrypt_in_place_detached(nonce, aad, buffer, tag_obj)
            .map_err(|_| CryptoError::AeadAuthenticationFailed)
    }

    fn key_size(&self) -> usize {
        32
    }

    fn name(&self) -> &'static str {
        "AES-256-GCM"
    }
}

/// AES-128-GCM AEAD cipher implementation.
pub struct Aes128GcmCipher {
    cipher: Aes128Gcm,
}

impl Aes128GcmCipher {
    pub fn new(key: &[u8]) -> Result<Self, CryptoError> {
        if key.len() != 16 {
            return Err(CryptoError::InvalidKeySize {
                expected: 16,
                actual: key.len(),
            });
        }
        let cipher = Aes128Gcm::new_from_slice(key)
            .map_err(|e| CryptoError::AeadEncryption(e.to_string()))?;
        Ok(Self { cipher })
    }
}

impl SymmCipher for Aes128GcmCipher {
    fn encrypt_in_place(
        &self,
        nonce: &[u8],
        aad: &[u8],
        buffer: &mut [u8],
    ) -> Result<[u8; 16], CryptoError> {
        if nonce.len() != 12 {
            return Err(CryptoError::InvalidNonceSize {
                expected: 12,
                actual: nonce.len(),
            });
        }
        let nonce = AesNonce::from_slice(nonce);
        let tag = self
            .cipher
            .encrypt_in_place_detached(nonce, aad, buffer)
            .map_err(|e| CryptoError::AeadEncryption(e.to_string()))?;
        let mut out_tag = [0u8; 16];
        out_tag.copy_from_slice(tag.as_slice());
        Ok(out_tag)
    }

    fn decrypt_in_place(
        &self,
        nonce: &[u8],
        aad: &[u8],
        buffer: &mut [u8],
        tag: &[u8; 16],
    ) -> Result<(), CryptoError> {
        if nonce.len() != 12 {
            return Err(CryptoError::InvalidNonceSize {
                expected: 12,
                actual: nonce.len(),
            });
        }
        let nonce = AesNonce::from_slice(nonce);
        let tag_obj = Tag::<Aes128Gcm>::from_slice(tag);
        self.cipher
            .decrypt_in_place_detached(nonce, aad, buffer, tag_obj)
            .map_err(|_| CryptoError::AeadAuthenticationFailed)
    }

    fn key_size(&self) -> usize {
        16
    }

    fn name(&self) -> &'static str {
        "AES-128-GCM"
    }
}

/// ChaCha20-Poly1305 AEAD cipher implementation.
pub struct ChaCha20Poly1305Cipher {
    cipher: ChaCha20Poly1305,
}

impl ChaCha20Poly1305Cipher {
    pub fn new(key: &[u8]) -> Result<Self, CryptoError> {
        if key.len() != 32 {
            return Err(CryptoError::InvalidKeySize {
                expected: 32,
                actual: key.len(),
            });
        }
        let cipher = ChaCha20Poly1305::new_from_slice(key)
            .map_err(|e| CryptoError::AeadEncryption(e.to_string()))?;
        Ok(Self { cipher })
    }
}

impl SymmCipher for ChaCha20Poly1305Cipher {
    fn encrypt_in_place(
        &self,
        nonce: &[u8],
        aad: &[u8],
        buffer: &mut [u8],
    ) -> Result<[u8; 16], CryptoError> {
        if nonce.len() != 12 {
            return Err(CryptoError::InvalidNonceSize {
                expected: 12,
                actual: nonce.len(),
            });
        }
        let nonce = ChaChaNonce::from_slice(nonce);
        let tag = self
            .cipher
            .encrypt_in_place_detached(nonce, aad, buffer)
            .map_err(|e| CryptoError::AeadEncryption(e.to_string()))?;
        let mut out_tag = [0u8; 16];
        out_tag.copy_from_slice(tag.as_slice());
        Ok(out_tag)
    }

    fn decrypt_in_place(
        &self,
        nonce: &[u8],
        aad: &[u8],
        buffer: &mut [u8],
        tag: &[u8; 16],
    ) -> Result<(), CryptoError> {
        if nonce.len() != 12 {
            return Err(CryptoError::InvalidNonceSize {
                expected: 12,
                actual: nonce.len(),
            });
        }
        let nonce = ChaChaNonce::from_slice(nonce);
        let tag_obj = Tag::<ChaCha20Poly1305>::from_slice(tag);
        self.cipher
            .decrypt_in_place_detached(nonce, aad, buffer, tag_obj)
            .map_err(|_| CryptoError::AeadAuthenticationFailed)
    }

    fn key_size(&self) -> usize {
        32
    }

    fn name(&self) -> &'static str {
        "CHACHA20-POLY1305"
    }
}

/// Supported symmetric cipher suites in OpenVPN 3.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum CipherSuite {
    #[default]
    Aes256Gcm,
    Aes128Gcm,
    ChaCha20Poly1305,
}

impl CipherSuite {
    /// Resolves a cipher suite from a configuration string.
    pub fn from_name(name: &str) -> Option<Self> {
        let upper = name.to_ascii_uppercase().replace(['-', '_'], "");
        match upper.as_str() {
            "AES256GCM" => Some(CipherSuite::Aes256Gcm),
            "AES128GCM" => Some(CipherSuite::Aes128Gcm),
            "CHACHA20POLY1305" => Some(CipherSuite::ChaCha20Poly1305),
            _ => None,
        }
    }

    /// Instantiates the appropriate `SymmCipher` instance for this suite.
    pub fn create_cipher(&self, key: &[u8]) -> Result<Box<dyn SymmCipher>, CryptoError> {
        match self {
            CipherSuite::Aes256Gcm => Ok(Box::new(Aes256GcmCipher::new(key)?)),
            CipherSuite::Aes128Gcm => Ok(Box::new(Aes128GcmCipher::new(key)?)),
            CipherSuite::ChaCha20Poly1305 => Ok(Box::new(ChaCha20Poly1305Cipher::new(key)?)),
        }
    }

    pub fn key_size(&self) -> usize {
        match self {
            CipherSuite::Aes256Gcm => 32,
            CipherSuite::Aes128Gcm => 16,
            CipherSuite::ChaCha20Poly1305 => 32,
        }
    }
}

impl fmt::Display for CipherSuite {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CipherSuite::Aes256Gcm => write!(f, "AES-256-GCM"),
            CipherSuite::Aes128Gcm => write!(f, "AES-128-GCM"),
            CipherSuite::ChaCha20Poly1305 => write!(f, "CHACHA20-POLY1305"),
        }
    }
}

/// Helper for encrypting a packet buffer zero-copy and appending the 16-byte authentication tag.
pub fn encrypt_packet_with_tag(
    cipher: &dyn SymmCipher,
    nonce: &[u8],
    aad: &[u8],
    packet: &mut BytesMut,
) -> Result<(), CryptoError> {
    let tag = cipher.encrypt_in_place(nonce, aad, packet.as_mut())?;
    packet.extend_from_slice(&tag);
    Ok(())
}

/// Helper for decrypting a packet buffer zero-copy with trailing 16-byte authentication tag.
pub fn decrypt_packet_with_tag(
    cipher: &dyn SymmCipher,
    nonce: &[u8],
    aad: &[u8],
    packet: &mut BytesMut,
) -> Result<(), CryptoError> {
    if packet.len() < 16 {
        return Err(CryptoError::AeadAuthenticationFailed);
    }
    let tag_pos = packet.len() - 16;
    let mut tag = [0u8; 16];
    tag.copy_from_slice(&packet[tag_pos..]);
    packet.truncate(tag_pos);
    cipher.decrypt_in_place(nonce, aad, packet.as_mut(), &tag)
}
