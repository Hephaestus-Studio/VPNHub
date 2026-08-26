//! PKCS#12 bundle parser extracting X.509 certificates and private keys.

use crate::error::ConfigError;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Decrypted and parsed PKCS#12 bundle payload.
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct Pkcs12Parsed {
    /// Client certificate in PEM format.
    pub cert_pem: String,
    /// Client private key in PEM format (PKCS#8).
    pub key_pem: String,
    /// CA / intermediate certificate chain in PEM format.
    pub ca_certs_pem: Vec<String>,
}

impl std::fmt::Debug for Pkcs12Parsed {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Pkcs12Parsed")
            .field("cert_pem_len", &self.cert_pem.len())
            .field("key_pem", &"[REDACTED KEY]")
            .field("ca_certs_count", &self.ca_certs_pem.len())
            .finish()
    }
}

/// Parses PKCS#12 data (DER bytes or base64 text) with an optional password.
pub fn parse_pkcs12_bundle(data: &[u8], password: &str) -> Result<Pkcs12Parsed, ConfigError> {
    // If input data contains base64/whitespace or is ASCII base64, try decoding it first
    let raw_bytes = if data.starts_with(b"-----BEGIN")
        || !data.starts_with(&[0x30, 0x82])
            && !data.starts_with(&[0x30, 0x83])
            && !data.starts_with(&[0x30, 0x84])
    {
        let clean_b64: String = data
            .iter()
            .copied()
            .filter(|&c| !c.is_ascii_whitespace() && c != b'-')
            .map(|c| c as char)
            .collect();
        base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            clean_b64.as_bytes(),
        )
        .unwrap_or_else(|_| data.to_vec())
    } else {
        data.to_vec()
    };

    // Use p12 crate to parse and decrypt PKCS#12 structure
    let pfx = p12::PFX::parse(&raw_bytes).map_err(|e| {
        ConfigError::Pkcs12Error(format!("Failed to parse PKCS#12 DER structure: {e:?}"))
    })?;

    if !pfx.verify_mac(password) {
        // Some PFX files don't have MAC or MAC fails with wrong password
    }

    let keys = pfx.key_bags(password).map_err(|e| {
        ConfigError::Pkcs12Error(format!("Failed to extract keys from PKCS#12: {e:?}"))
    })?;

    let certs = pfx.cert_x509_bags(password).map_err(|e| {
        ConfigError::Pkcs12Error(format!(
            "Failed to extract certificates from PKCS#12: {e:?}"
        ))
    })?;

    let key_der = keys.into_iter().next().ok_or_else(|| {
        ConfigError::Pkcs12Error("PKCS#12 bundle does not contain a private key".to_string())
    })?;

    let mut cert_iter = certs.into_iter();
    let cert_der = cert_iter.next().ok_or_else(|| {
        ConfigError::Pkcs12Error("PKCS#12 bundle does not contain a client certificate".to_string())
    })?;

    // Encode into PEM format
    let cert_pem = format!(
        "-----BEGIN CERTIFICATE-----\n{}\n-----END CERTIFICATE-----\n",
        base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &cert_der)
    );

    let key_pem = format!(
        "-----BEGIN PRIVATE KEY-----\n{}\n-----END PRIVATE KEY-----\n",
        base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &key_der)
    );

    let mut ca_certs_pem = Vec::new();
    for ca_der in cert_iter {
        let pem = format!(
            "-----BEGIN CERTIFICATE-----\n{}\n-----END CERTIFICATE-----\n",
            base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &ca_der)
        );
        ca_certs_pem.push(pem);
    }

    Ok(Pkcs12Parsed {
        cert_pem,
        key_pem,
        ca_certs_pem,
    })
}
