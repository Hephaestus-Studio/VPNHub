//! Key Derivation Functions (RFC 5869 HKDF, OpenVPN EKOP PRF, tls-crypt / tls-crypt-v2 PRF).

use crate::error::CryptoError;
use crate::zeroize_secret::{DirectionalKey, SessionKeySet};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use sha2::{Sha256, Sha512};
use zeroize::Zeroize;

type HmacSha256 = Hmac<Sha256>;

/// RFC 5869 HKDF-Extract using SHA-256.
pub fn hkdf_extract_sha256(salt: Option<&[u8]>, ikm: &[u8]) -> [u8; 32] {
    let (prk, _) = Hkdf::<Sha256>::extract(salt, ikm);
    let mut out = [0u8; 32];
    out.copy_from_slice(&prk);
    out
}

/// RFC 5869 HKDF-Expand using SHA-256.
pub fn hkdf_expand_sha256(prk: &[u8], info: &[u8], okm: &mut [u8]) -> Result<(), CryptoError> {
    let hkdf = Hkdf::<Sha256>::from_prk(prk).map_err(|e| CryptoError::KdfError(e.to_string()))?;
    hkdf.expand(info, okm)
        .map_err(|e| CryptoError::KdfError(e.to_string()))?;
    Ok(())
}

/// RFC 5869 HKDF Extract-and-Expand in a single pass using SHA-256.
pub fn hkdf_sha256(
    salt: Option<&[u8]>,
    ikm: &[u8],
    info: &[u8],
    okm: &mut [u8],
) -> Result<(), CryptoError> {
    let hkdf = Hkdf::<Sha256>::new(salt, ikm);
    hkdf.expand(info, okm)
        .map_err(|e| CryptoError::KdfError(e.to_string()))?;
    Ok(())
}

/// RFC 5869 HKDF Extract-and-Expand in a single pass using SHA-512.
pub fn hkdf_sha512(
    salt: Option<&[u8]>,
    ikm: &[u8],
    info: &[u8],
    okm: &mut [u8],
) -> Result<(), CryptoError> {
    let hkdf = Hkdf::<Sha512>::new(salt, ikm);
    hkdf.expand(info, okm)
        .map_err(|e| CryptoError::KdfError(e.to_string()))?;
    Ok(())
}

/// OpenVPN TLS-PRF (P_SHA256) key expansion.
/// Expands `secret` with `label` and `seed` into `output`.
pub fn openvpn_prf_sha256(
    secret: &[u8],
    label: &[u8],
    seed: &[u8],
    output: &mut [u8],
) -> Result<(), CryptoError> {
    let mut seed_combined = Vec::with_capacity(label.len() + seed.len());
    seed_combined.extend_from_slice(label);
    seed_combined.extend_from_slice(seed);

    let mut a_prev = seed_combined.clone();
    let mut offset = 0;

    while offset < output.len() {
        // A(i) = HMAC(secret, A(i-1))
        let mut hmac_a =
            HmacSha256::new_from_slice(secret).map_err(|e| CryptoError::KdfError(e.to_string()))?;
        hmac_a.update(&a_prev);
        let a_curr = hmac_a.finalize().into_bytes();

        // Output block = HMAC(secret, A(i) + seed)
        let mut hmac_out =
            HmacSha256::new_from_slice(secret).map_err(|e| CryptoError::KdfError(e.to_string()))?;
        hmac_out.update(&a_curr);
        hmac_out.update(&seed_combined);
        let out_block = hmac_out.finalize().into_bytes();

        let to_copy = (output.len() - offset).min(out_block.len());
        output[offset..offset + to_copy].copy_from_slice(&out_block[..to_copy]);
        offset += to_copy;

        a_prev = a_curr.to_vec();
    }

    Ok(())
}

/// Derives OpenVPN Data Channel session keys from TLS Master Secret and Randoms.
///
/// In OpenVPN 2/3 TLS mode, data channel keys are derived from:
/// `PRF(master_secret, "OpenVPN master secret", client_random || server_random)`
pub fn derive_data_channel_keys(
    key_id: u8,
    master_secret: &[u8],
    client_random: &[u8],
    server_random: &[u8],
    cipher_key_len: usize,
    hmac_key_len: usize,
) -> Result<SessionKeySet, CryptoError> {
    let mut seed = Vec::with_capacity(client_random.len() + server_random.len());
    seed.extend_from_slice(client_random);
    seed.extend_from_slice(server_random);

    // Total key material needed = 2 * (cipher_key_len + hmac_key_len)
    let total_len = 2 * (cipher_key_len + hmac_key_len);
    let mut key_material = vec![0u8; total_len];

    openvpn_prf_sha256(
        master_secret,
        b"OpenVPN master secret",
        &seed,
        &mut key_material,
    )?;

    // OpenVPN key layout:
    // [0 .. cipher_key_len]: Client Cipher Key (TX for client)
    // [.. hmac_key_len]: Client HMAC Key (TX for client)
    // [.. cipher_key_len]: Server Cipher Key (RX for client)
    // [.. hmac_key_len]: Server HMAC Key (RX for client)
    let mut offset = 0;

    let client_cipher = key_material[offset..offset + cipher_key_len].to_vec();
    offset += cipher_key_len;

    let client_hmac = key_material[offset..offset + hmac_key_len].to_vec();
    offset += hmac_key_len;

    let server_cipher = key_material[offset..offset + cipher_key_len].to_vec();
    offset += cipher_key_len;

    let server_hmac = key_material[offset..offset + hmac_key_len].to_vec();

    // Zeroize temporary buffer
    key_material.zeroize();

    Ok(SessionKeySet {
        key_id,
        tx_key: DirectionalKey {
            cipher_key: client_cipher,
            hmac_key: client_hmac,
        },
        rx_key: DirectionalKey {
            cipher_key: server_cipher,
            hmac_key: server_hmac,
        },
    })
}

/// Derives ephemeral encryption and HMAC keys for `tls-crypt` control channel wrapping.
///
/// In `tls-crypt`, a static 2048-bit pre-shared key is used to derive per-session keys using:
/// - PRF(psk, "tls-crypt key expansion", session_id || client_random)
pub fn derive_tls_crypt_keys(
    psk: &[u8],
    session_id: &[u8],
    client_random: &[u8],
) -> Result<(DirectionalKey, DirectionalKey), CryptoError> {
    let mut seed = Vec::with_capacity(session_id.len() + client_random.len());
    seed.extend_from_slice(session_id);
    seed.extend_from_slice(client_random);

    // Derive 128 bytes of key material:
    // 32 bytes TX Cipher, 32 bytes TX HMAC, 32 bytes RX Cipher, 32 bytes RX HMAC
    let mut km = vec![0u8; 128];
    openvpn_prf_sha256(psk, b"tls-crypt key expansion", &seed, &mut km)?;

    let tx = DirectionalKey {
        cipher_key: km[0..32].to_vec(),
        hmac_key: km[32..64].to_vec(),
    };
    let rx = DirectionalKey {
        cipher_key: km[64..96].to_vec(),
        hmac_key: km[96..128].to_vec(),
    };

    km.zeroize();
    Ok((tx, rx))
}

/// Derives `tls-crypt-v2` client keys using HKDF-SHA256.
pub fn derive_tls_crypt_v2_keys(
    client_key: &[u8],
    session_id: &[u8],
) -> Result<(DirectionalKey, DirectionalKey), CryptoError> {
    let mut km = vec![0u8; 128];
    hkdf_sha256(
        Some(session_id),
        client_key,
        b"tls-crypt-v2 control channel keys",
        &mut km,
    )?;

    let tx = DirectionalKey {
        cipher_key: km[0..32].to_vec(),
        hmac_key: km[32..64].to_vec(),
    };
    let rx = DirectionalKey {
        cipher_key: km[64..96].to_vec(),
        hmac_key: km[96..128].to_vec(),
    };

    km.zeroize();
    Ok((tx, rx))
}
