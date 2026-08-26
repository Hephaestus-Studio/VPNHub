use crate::error::CryptoError;

/// Configuration for accessing client certificates and private keys on PKCS#11 hardware tokens.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pkcs11TokenConfig {
    /// Path to PKCS#11 driver module (e.g. `/usr/lib/opensc-pkcs11.so` or `opensc-pkcs11.dll`).
    pub module_path: String,
    /// Token label or serial number.
    pub token_label: Option<String>,
    /// Slot ID (if known).
    pub slot_id: Option<u64>,
    /// Key ID / CKA_ID (hex or byte array string).
    pub key_id: Option<String>,
    /// PIN / passphrase for hardware token.
    pub user_pin: Option<String>,
}

/// Abstract signing interface for hardware tokens (Smartcards, YubiKeys).
pub trait HardwareSigner: Send + Sync {
    /// Signs a cryptographic digest using the private key on the hardware token.
    fn sign_digest(&self, digest: &[u8]) -> Result<Vec<u8>, CryptoError>;

    /// Returns the public key / certificate bytes in DER format.
    fn public_certificate_der(&self) -> Result<Vec<u8>, CryptoError>;
}

/// OS Keystore manager for storing and retrieving VPN credentials securely
/// (macOS Keychain, Windows Credential Manager, Linux Secret Service).
pub struct OsKeyring;

impl OsKeyring {
    /// Stores a secret string securely in the OS credential store.
    #[cfg(feature = "os-keyring")]
    pub fn store_password(
        service: &str,
        username: &str,
        password: &str,
    ) -> Result<(), CryptoError> {
        let entry = keyring::Entry::new(service, username)
            .map_err(|e| CryptoError::KeyringError(e.to_string()))?;
        entry
            .set_password(password)
            .map_err(|e| CryptoError::KeyringError(e.to_string()))?;
        Ok(())
    }

    /// Stores a secret string securely in the OS credential store (fallback when feature is disabled).
    #[cfg(not(feature = "os-keyring"))]
    pub fn store_password(
        _service: &str,
        _username: &str,
        _password: &str,
    ) -> Result<(), CryptoError> {
        Err(CryptoError::KeyringError(
            "OS Keyring feature is not enabled in this build".to_string(),
        ))
    }

    /// Retrieves a secret string from the OS credential store.
    #[cfg(feature = "os-keyring")]
    pub fn get_password(service: &str, username: &str) -> Result<String, CryptoError> {
        let entry = keyring::Entry::new(service, username)
            .map_err(|e| CryptoError::KeyringError(e.to_string()))?;
        entry
            .get_password()
            .map_err(|e| CryptoError::KeyringError(e.to_string()))
    }

    /// Retrieves a secret string from the OS credential store (fallback when feature is disabled).
    #[cfg(not(feature = "os-keyring"))]
    pub fn get_password(_service: &str, _username: &str) -> Result<String, CryptoError> {
        Err(CryptoError::KeyringError(
            "OS Keyring feature is not enabled in this build".to_string(),
        ))
    }

    /// Deletes a secret from the OS credential store.
    #[cfg(feature = "os-keyring")]
    pub fn delete_password(service: &str, username: &str) -> Result<(), CryptoError> {
        let entry = keyring::Entry::new(service, username)
            .map_err(|e| CryptoError::KeyringError(e.to_string()))?;
        entry
            .delete_password()
            .map_err(|e| CryptoError::KeyringError(e.to_string()))
    }

    /// Deletes a secret from the OS credential store (fallback when feature is disabled).
    #[cfg(not(feature = "os-keyring"))]
    pub fn delete_password(_service: &str, _username: &str) -> Result<(), CryptoError> {
        Err(CryptoError::KeyringError(
            "OS Keyring feature is not enabled in this build".to_string(),
        ))
    }
}
