//! # AES-256-GCM Encrypted Secrets Vault

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tracing::{debug, info, warn};

use crate::error::AppError;
use crate::storage::models::StoredProfileSecret;

const VAULT_SALT: &[u8] = b"VPNHUB_SECURE_LOCAL_VAULT_SALT_v1";

pub struct EncryptedVault {
    vault_path: PathBuf,
    cipher: Aes256Gcm,
    cache: Mutex<HashMap<String, StoredProfileSecret>>,
}

impl EncryptedVault {
    /// Initializes or loads an encrypted vault at the given path.
    pub fn new(vault_path: PathBuf) -> Result<Self, AppError> {
        // Derive master key from machine ID / user context
        let key_bytes = Self::derive_encryption_key();
        let cipher = Aes256Gcm::new_from_slice(&key_bytes).map_err(|e| {
            AppError::Ipc(format!("Failed to initialize AES-256-GCM cipher: {}", e))
        })?;

        let vault = Self {
            vault_path,
            cipher,
            cache: Mutex::new(HashMap::new()),
        };

        // Load existing vault if file exists
        if vault.vault_path.exists() {
            if let Err(e) = vault.load_from_disk() {
                warn!(
                    "Could not decrypt existing vault.enc (will start fresh): {}",
                    e
                );
            }
        }

        Ok(vault)
    }

    /// Derives a consistent 256-bit encryption key for this user & host machine.
    fn derive_encryption_key() -> [u8; 32] {
        let mut hasher = Sha256::new();
        hasher.update(VAULT_SALT);

        // Incorporate machine hostname or user name
        #[cfg(unix)]
        {
            if let Ok(hostname) = std::env::var("HOSTNAME") {
                hasher.update(hostname.as_bytes());
            }
            if let Ok(user) = std::env::var("USER") {
                hasher.update(user.as_bytes());
            }
            // Add machine-id if available
            if let Ok(machine_id) = fs::read_to_string("/etc/machine-id") {
                hasher.update(machine_id.trim().as_bytes());
            }
        }

        #[cfg(not(unix))]
        {
            if let Ok(user) = std::env::var("USERNAME") {
                hasher.update(user.as_bytes());
            }
            if let Ok(comp) = std::env::var("COMPUTERNAME") {
                hasher.update(comp.as_bytes());
            }
        }

        let result = hasher.finalize();
        let mut key = [0u8; 32];
        key.copy_from_slice(&result);
        key
    }

    /// Stores a secret for a profile and persists the encrypted vault to disk.
    pub fn store_secret(
        &self,
        profile_id: String,
        secret: StoredProfileSecret,
    ) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            cache.insert(profile_id, secret);
        }
        self.save_to_disk()
    }

    /// Retrieves a secret for a profile.
    pub fn get_secret(&self, profile_id: &str) -> Option<StoredProfileSecret> {
        let cache = self.cache.lock().unwrap();
        cache.get(profile_id).cloned()
    }

    /// Retrieves all decrypted secrets currently loaded in memory.
    pub fn get_all_secrets(&self) -> HashMap<String, StoredProfileSecret> {
        let cache = self.cache.lock().unwrap();
        cache.clone()
    }

    /// Removes a secret from the vault.
    pub fn remove_secret(&self, profile_id: &str) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            cache.remove(profile_id);
        }
        self.save_to_disk()
    }

    /// Encrypts and writes cache to `vault.enc`.
    fn save_to_disk(&self) -> Result<(), AppError> {
        let cache = self.cache.lock().unwrap();
        let serialized = serde_json::to_vec(&*cache)
            .map_err(|e| AppError::Ipc(format!("Vault serialization failed: {}", e)))?;

        // 1. Generate a random 96-bit (12-byte) Nonce
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // 2. Encrypt with AES-256-GCM (Ciphertext + 128-bit Authentication Tag)
        let ciphertext = self
            .cipher
            .encrypt(nonce, serialized.as_ref())
            .map_err(|e| AppError::Ipc(format!("AES-GCM encryption failed: {}", e)))?;

        // 3. File format: [12-byte Nonce] + [Ciphertext + Tag]
        let mut file_payload = Vec::with_capacity(12 + ciphertext.len());
        file_payload.extend_from_slice(&nonce_bytes);
        file_payload.extend_from_slice(&ciphertext);

        // 4. Atomic write
        fs::write(&self.vault_path, file_payload)?;
        debug!("Encrypted vault saved ({} entries)", cache.len());
        Ok(())
    }

    /// Reads and decrypts `vault.enc` from disk.
    fn load_from_disk(&self) -> Result<(), AppError> {
        let file_payload = fs::read(&self.vault_path)?;
        if file_payload.len() < 12 {
            return Err(AppError::Ipc(
                "Vault file corrupted (too small)".to_string(),
            ));
        }

        let nonce_bytes = &file_payload[..12];
        let ciphertext = &file_payload[12..];

        let nonce = Nonce::from_slice(nonce_bytes);
        let plaintext = self.cipher.decrypt(nonce, ciphertext).map_err(|e| {
            AppError::Ipc(format!("Vault decryption / authentication failed: {}", e))
        })?;

        let loaded_cache: HashMap<String, StoredProfileSecret> = serde_json::from_slice(&plaintext)
            .map_err(|e| AppError::Ipc(format!("Vault JSON parse failed: {}", e)))?;

        let mut cache = self.cache.lock().unwrap();
        *cache = loaded_cache;
        info!(
            "Encrypted vault loaded successfully ({} secrets)",
            cache.len()
        );
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vault_encrypt_decrypt_persistence() {
        let temp_dir =
            std::env::temp_dir().join(format!("vpnhub_test_vault_{}", rand::random::<u32>()));
        let _ = fs::create_dir_all(&temp_dir);
        let vault_file = temp_dir.join("vault.enc");

        // 1. Initialize vault and write secret
        let vault = EncryptedVault::new(vault_file.clone()).expect("Vault creation failed");
        let secret = StoredProfileSecret::Wireguard {
            private_key: "test_secret_private_key_123".to_string(),
            preshared_key: Some("test_psk_456".to_string()),
        };

        vault
            .store_secret("prof-test-1".to_string(), secret.clone())
            .expect("Store secret failed");

        // 2. Read back from a fresh vault instance
        let loaded_vault = EncryptedVault::new(vault_file.clone()).expect("Load vault failed");
        let retrieved = loaded_vault.get_secret("prof-test-1");
        assert!(retrieved.is_some());

        if let Some(StoredProfileSecret::Wireguard {
            private_key,
            preshared_key,
        }) = retrieved
        {
            assert_eq!(private_key, "test_secret_private_key_123");
            assert_eq!(preshared_key, Some("test_psk_456".to_string()));
        } else {
            panic!("Unexpected secret variant retrieved");
        }

        // 3. Clean up
        let _ = fs::remove_file(vault_file);
        let _ = fs::remove_dir(temp_dir);
    }

    #[test]
    fn test_vault_tamper_rejection() {
        let temp_dir =
            std::env::temp_dir().join(format!("vpnhub_test_tamper_{}", rand::random::<u32>()));
        let _ = fs::create_dir_all(&temp_dir);
        let vault_file = temp_dir.join("vault.enc");

        let vault = EncryptedVault::new(vault_file.clone()).expect("Vault creation failed");
        vault
            .store_secret(
                "prof-1".to_string(),
                StoredProfileSecret::Wireguard {
                    private_key: "secret".to_string(),
                    preshared_key: None,
                },
            )
            .expect("Store failed");

        // Tamper with bytes in ciphertext
        let mut raw = fs::read(&vault_file).unwrap();
        if let Some(last) = raw.last_mut() {
            *last ^= 0xFF; // Flip bits
        }
        fs::write(&vault_file, raw).unwrap();

        // Loading tampered vault must reject decryption
        let tampered_vault = EncryptedVault::new(vault_file.clone()).expect("Vault instance");
        assert!(tampered_vault.get_secret("prof-1").is_none());

        let _ = fs::remove_file(vault_file);
        let _ = fs::remove_dir(temp_dir);
    }
}
