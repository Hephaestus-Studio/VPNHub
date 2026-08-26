//! Post-Quantum Hybrid Key Encapsulation Mechanism (ML-KEM-768 + X25519).
//!
//! Implements a quantum-resistant hybrid KEM combining the NIST FIPS 203 standard
//! (ML-KEM-768 / Kyber768) with classical Curve25519 (X25519) Diffie-Hellman.
//! An attacker would need to break both ML-KEM-768 and classical discrete logarithms
//! to compromise the shared session key.

use crate::error::CryptoError;
use crate::kdf::hkdf_sha256;
use ml_kem::kem::{Decapsulate, Encapsulate};
use ml_kem::ml_kem_768::{DecapsulationKey as MlDecapKey, EncapsulationKey as MlEncapKey};
use ml_kem::{KeyExport, KeyInit, TryKeyInit};
use rand::RngCore;
use x25519_dalek::{PublicKey as X25519PublicKey, StaticSecret as X25519StaticSecret};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Post-Quantum Hybrid Public Key (X25519 public key + ML-KEM-768 encapsulation key).
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct HybridKemPublicKey {
    /// 32-byte X25519 classical public key.
    pub x25519_public: [u8; 32],
    /// 1184-byte ML-KEM-768 encapsulation key bytes.
    pub ml_kem_public: Vec<u8>,
}

impl HybridKemPublicKey {
    /// Serializes the hybrid public key into contiguous bytes.
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(32 + self.ml_kem_public.len());
        bytes.extend_from_slice(&self.x25519_public);
        bytes.extend_from_slice(&self.ml_kem_public);
        bytes
    }

    /// Deserializes a hybrid public key from contiguous bytes.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CryptoError> {
        if bytes.len() < 32 {
            return Err(CryptoError::InvalidSerialization(
                "Hybrid public key too short".to_string(),
            ));
        }
        let mut x25519_public = [0u8; 32];
        x25519_public.copy_from_slice(&bytes[..32]);
        let ml_kem_public = bytes[32..].to_vec();
        Ok(Self {
            x25519_public,
            ml_kem_public,
        })
    }
}

/// Post-Quantum Hybrid Private Key (X25519 static secret + ML-KEM-768 decapsulation key seed).
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct HybridKemPrivateKey {
    /// 32-byte X25519 private key.
    pub x25519_private: [u8; 32],
    /// 64-byte ML-KEM-768 seed bytes.
    pub ml_kem_seed: Vec<u8>,
}

impl std::fmt::Debug for HybridKemPrivateKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[REDACTED HYBRID KEM PRIVATE KEY]")
    }
}

/// Post-Quantum Hybrid Ciphertext sent over the wire (X25519 ephemeral public key + ML-KEM-768 ciphertext).
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct HybridKemCiphertext {
    /// 32-byte ephemeral X25519 public key.
    pub x25519_ephemeral_public: [u8; 32],
    /// 1088-byte ML-KEM-768 ciphertext.
    pub ml_kem_ciphertext: Vec<u8>,
}

impl HybridKemCiphertext {
    /// Serializes the hybrid ciphertext to bytes.
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(32 + self.ml_kem_ciphertext.len());
        bytes.extend_from_slice(&self.x25519_ephemeral_public);
        bytes.extend_from_slice(&self.ml_kem_ciphertext);
        bytes
    }

    /// Deserializes a hybrid ciphertext from bytes.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CryptoError> {
        if bytes.len() < 32 {
            return Err(CryptoError::InvalidSerialization(
                "Hybrid ciphertext too short".to_string(),
            ));
        }
        let mut x25519_ephemeral_public = [0u8; 32];
        x25519_ephemeral_public.copy_from_slice(&bytes[..32]);
        let ml_kem_ciphertext = bytes[32..].to_vec();
        Ok(Self {
            x25519_ephemeral_public,
            ml_kem_ciphertext,
        })
    }
}

/// Keypair holder for Hybrid Post-Quantum Key Exchange.
pub struct HybridKemKeyPair {
    pub public_key: HybridKemPublicKey,
    pub private_key: HybridKemPrivateKey,
}

impl HybridKemKeyPair {
    /// Generates a fresh hybrid keypair using random seeds.
    pub fn generate() -> Result<Self, CryptoError> {
        let mut rng = rand::thread_rng();
        let mut x25519_sk_bytes = [0u8; 32];
        rng.fill_bytes(&mut x25519_sk_bytes);
        let mut ml_kem_seed = [0u8; 64];
        rng.fill_bytes(&mut ml_kem_seed);

        Self::from_seeds(&x25519_sk_bytes, &ml_kem_seed)
    }

    /// Constructs a hybrid keypair deterministically from raw seeds (for testing / reproducible exchange).
    pub fn from_seeds(x25519_seed: &[u8; 32], ml_kem_seed: &[u8; 64]) -> Result<Self, CryptoError> {
        let x25519_secret = X25519StaticSecret::from(*x25519_seed);
        let x25519_public = X25519PublicKey::from(&x25519_secret);

        let ml_decap = MlDecapKey::new_from_slice(ml_kem_seed)
            .map_err(|e| CryptoError::PostQuantumKemError(format!("Invalid ML-KEM seed: {e:?}")))?;
        let ml_encap = ml_decap.encapsulation_key();

        let public_key = HybridKemPublicKey {
            x25519_public: *x25519_public.as_bytes(),
            ml_kem_public: ml_encap.to_bytes().as_slice().to_vec(),
        };

        let private_key = HybridKemPrivateKey {
            x25519_private: *x25519_seed,
            ml_kem_seed: ml_kem_seed.to_vec(),
        };

        Ok(Self {
            public_key,
            private_key,
        })
    }

    /// Decapsulates an incoming hybrid ciphertext and derives the 32-byte shared secret.
    pub fn decapsulate(&self, ciphertext: &HybridKemCiphertext) -> Result<[u8; 32], CryptoError> {
        // 1. Classical X25519 DH shared secret
        let x25519_secret = X25519StaticSecret::from(self.private_key.x25519_private);
        let peer_ephemeral_pk = X25519PublicKey::from(ciphertext.x25519_ephemeral_public);
        let x25519_ss = x25519_secret.diffie_hellman(&peer_ephemeral_pk);

        // 2. ML-KEM-768 decapsulation from seed
        let decap_key = MlDecapKey::new_from_slice(&self.private_key.ml_kem_seed)
            .map_err(|e| CryptoError::PostQuantumKemError(format!("Invalid ML-KEM seed: {e:?}")))?;

        let ml_ss = decap_key
            .decapsulate_slice(&ciphertext.ml_kem_ciphertext)
            .map_err(|e| {
                CryptoError::PostQuantumKemError(format!("ML-KEM decapsulation failed: {e:?}"))
            })?;

        // 3. Combine both shared secrets with HKDF-SHA256:
        // IKM = x25519_shared_secret || ml_kem_shared_secret
        let mut ikm = Vec::with_capacity(32 + ml_ss.as_slice().len());
        ikm.extend_from_slice(x25519_ss.as_bytes());
        ikm.extend_from_slice(ml_ss.as_slice());

        let mut final_shared_secret = [0u8; 32];
        hkdf_sha256(
            None,
            &ikm,
            b"openvpn3-rs hybrid post-quantum key exchange",
            &mut final_shared_secret,
        )?;

        ikm.zeroize();
        Ok(final_shared_secret)
    }
}

/// Encapsulates a shared secret to a recipient's hybrid public key.
/// Returns the resulting [`HybridKemCiphertext`] and the derived 32-byte shared secret.
pub fn hybrid_encapsulate(
    peer_public: &HybridKemPublicKey,
) -> Result<(HybridKemCiphertext, [u8; 32]), CryptoError> {
    let mut rng = rand::thread_rng();
    let mut ephemeral_bytes = [0u8; 32];
    rng.fill_bytes(&mut ephemeral_bytes);

    let ephemeral_secret = X25519StaticSecret::from(ephemeral_bytes);
    let ephemeral_public = X25519PublicKey::from(&ephemeral_secret);
    let peer_x25519_pk = X25519PublicKey::from(peer_public.x25519_public);
    let x25519_ss = ephemeral_secret.diffie_hellman(&peer_x25519_pk);

    // 2. ML-KEM-768 encapsulation
    let encap_key = MlEncapKey::new_from_slice(&peer_public.ml_kem_public).map_err(|e| {
        CryptoError::PostQuantumKemError(format!("Invalid ML-KEM public key: {e:?}"))
    })?;

    let (ml_ct, ml_ss) = encap_key.encapsulate();

    // 3. Combine both shared secrets via HKDF-SHA256
    let mut ikm = Vec::with_capacity(32 + ml_ss.as_slice().len());
    ikm.extend_from_slice(x25519_ss.as_bytes());
    ikm.extend_from_slice(ml_ss.as_slice());

    let mut final_shared_secret = [0u8; 32];
    hkdf_sha256(
        None,
        &ikm,
        b"openvpn3-rs hybrid post-quantum key exchange",
        &mut final_shared_secret,
    )?;

    ikm.zeroize();

    let ciphertext = HybridKemCiphertext {
        x25519_ephemeral_public: *ephemeral_public.as_bytes(),
        ml_kem_ciphertext: ml_ct.as_slice().to_vec(),
    };

    Ok((ciphertext, final_shared_secret))
}
