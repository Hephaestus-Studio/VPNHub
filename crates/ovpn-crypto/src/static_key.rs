//! OpenVPN 2048-bit Static Key parser and `tls-auth` packet wrapping / unwrapping.

use crate::error::CryptoError;
use bytes::{BufMut, BytesMut};
use hmac::{Hmac, Mac};
use sha1::Sha1;
use sha2::Sha256;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use zeroize::{Zeroize, ZeroizeOnDrop};

type HmacSha1 = Hmac<Sha1>;
type HmacSha256 = Hmac<Sha256>;

/// Parsed 2048-bit OpenVPN Static Key (256 bytes).
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct StaticKey {
    pub cipher_key_1: [u8; 64],
    pub cipher_key_2: [u8; 64],
    pub hmac_key_1: [u8; 64],
    pub hmac_key_2: [u8; 64],
}

impl StaticKey {
    /// Parses OpenVPN static key from string (hex text or file content).
    pub fn parse(text: &str) -> Result<Self, CryptoError> {
        let mut hex_digits = String::with_capacity(512);

        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty()
                || trimmed.starts_with('#')
                || trimmed.starts_with(';')
                || trimmed.starts_with("-----")
            {
                continue;
            }
            hex_digits.push_str(trimmed);
        }

        let raw_bytes = hex::decode(&hex_digits)
            .map_err(|e| CryptoError::InvalidKey(format!("Failed to parse static key hex: {e}")))?;

        if raw_bytes.len() < 256 {
            return Err(CryptoError::InvalidKey(format!(
                "Static key must be at least 256 bytes (found {})",
                raw_bytes.len()
            )));
        }

        let mut cipher_key_1 = [0u8; 64];
        let mut cipher_key_2 = [0u8; 64];
        let mut hmac_key_1 = [0u8; 64];
        let mut hmac_key_2 = [0u8; 64];

        cipher_key_1.copy_from_slice(&raw_bytes[0..64]);
        hmac_key_1.copy_from_slice(&raw_bytes[64..128]);
        cipher_key_2.copy_from_slice(&raw_bytes[128..192]);
        hmac_key_2.copy_from_slice(&raw_bytes[192..256]);

        Ok(Self {
            cipher_key_1,
            cipher_key_2,
            hmac_key_1,
            hmac_key_2,
        })
    }
}

/// Authentication HMAC algorithm for `tls-auth`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum AuthDigest {
    #[default]
    Sha1,
    Sha256,
}

impl AuthDigest {
    pub fn tag_len(&self) -> usize {
        match self {
            AuthDigest::Sha1 => 20,
            AuthDigest::Sha256 => 32,
        }
    }
}

/// Context for wrapping and unwrapping control packets with `tls-auth` HMAC signature.
pub struct TlsAuthContext {
    send_hmac_key: [u8; 64],
    recv_hmac_key: [u8; 64],
    send_packet_id: AtomicU32,
    digest: AuthDigest,
}

impl TlsAuthContext {
    /// Creates a new `TlsAuthContext` from static key and direction.
    ///
    /// - Client mode (`direction = 1`): sends using key 2, receives using key 1.
    /// - Server mode (`direction = 0`): sends using key 1, receives using key 2.
    /// - Bidirectional (`direction = None`): uses key 1 for both.
    pub fn new(
        static_key: &StaticKey,
        is_client: bool,
        bidirectional: bool,
        digest: AuthDigest,
    ) -> Self {
        let (send_hmac_key, recv_hmac_key) = if bidirectional {
            (static_key.hmac_key_1, static_key.hmac_key_1)
        } else if is_client {
            (static_key.hmac_key_2, static_key.hmac_key_1)
        } else {
            (static_key.hmac_key_1, static_key.hmac_key_2)
        };

        Self {
            send_hmac_key,
            recv_hmac_key,
            send_packet_id: AtomicU32::new(1),
            digest,
        }
    }

    /// Wraps a control packet with `tls-auth` HMAC signature, packet ID, and timestamp.
    ///
    /// Wire format:
    /// `[ 1B Opcode/Key_ID ] [ 8B Session_ID ] [ HMAC ] [ 4B Packet_ID ] [ 4B Timestamp ] [ Payload ]`
    pub fn wrap_packet(&self, opcode_key_id: u8, session_id: u64, payload: &[u8]) -> BytesMut {
        let packet_id = self.send_packet_id.fetch_add(1, Ordering::SeqCst);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs() as u32)
            .unwrap_or(0);

        let tag_len = self.digest.tag_len();
        let total_len = 1 + 8 + tag_len + 4 + 4 + payload.len();
        let mut out = BytesMut::with_capacity(total_len);

        out.put_u8(opcode_key_id);
        out.put_u64(session_id);

        // Compute HMAC over: [ Packet ID (4B) ] [ Timestamp (4B) ] [ Opcode (1B) ] [ Session ID (8B) ] [ Payload ]
        match self.digest {
            AuthDigest::Sha1 => {
                let mut hmac = HmacSha1::new_from_slice(&self.send_hmac_key[..20])
                    .expect("Valid HMAC-SHA1 key length");
                hmac.update(&packet_id.to_be_bytes());
                hmac.update(&timestamp.to_be_bytes());
                hmac.update(&[opcode_key_id]);
                hmac.update(&session_id.to_be_bytes());
                hmac.update(payload);
                let tag = hmac.finalize().into_bytes();
                out.put_slice(&tag);
            }
            AuthDigest::Sha256 => {
                let mut hmac = HmacSha256::new_from_slice(&self.send_hmac_key[..32])
                    .expect("Valid HMAC-SHA256 key length");
                hmac.update(&packet_id.to_be_bytes());
                hmac.update(&timestamp.to_be_bytes());
                hmac.update(&[opcode_key_id]);
                hmac.update(&session_id.to_be_bytes());
                hmac.update(payload);
                let tag = hmac.finalize().into_bytes();
                out.put_slice(&tag);
            }
        }

        out.put_u32(packet_id);
        out.put_u32(timestamp);
        out.put_slice(payload);

        out
    }

    /// Unwraps and verifies a control packet with `tls-auth`.
    /// Returns `(opcode_key_id, session_id, packet_id, timestamp, payload)`.
    pub fn unwrap_packet<'a>(
        &self,
        packet: &'a [u8],
    ) -> Result<(u8, u64, u32, u32, &'a [u8]), CryptoError> {
        let tag_len = self.digest.tag_len();
        let min_len = 1 + 8 + tag_len + 4 + 4;
        if packet.len() < min_len {
            return Err(CryptoError::DecryptionFailed(
                "tls-auth packet too short".into(),
            ));
        }

        let opcode_key_id = packet[0];
        let session_id = u64::from_be_bytes(packet[1..9].try_into().unwrap());
        let received_tag = &packet[9..9 + tag_len];
        let packet_id = u32::from_be_bytes(packet[9 + tag_len..13 + tag_len].try_into().unwrap());
        let timestamp = u32::from_be_bytes(packet[13 + tag_len..17 + tag_len].try_into().unwrap());
        let payload = &packet[17 + tag_len..];

        // Verify HMAC
        match self.digest {
            AuthDigest::Sha1 => {
                let mut hmac = HmacSha1::new_from_slice(&self.recv_hmac_key[..20])
                    .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))?;
                hmac.update(&packet_id.to_be_bytes());
                hmac.update(&timestamp.to_be_bytes());
                hmac.update(&[opcode_key_id]);
                hmac.update(&session_id.to_be_bytes());
                hmac.update(payload);
                hmac.verify_slice(received_tag).map_err(|_| {
                    CryptoError::DecryptionFailed("tls-auth HMAC verification failed".into())
                })?;
            }
            AuthDigest::Sha256 => {
                let mut hmac = HmacSha256::new_from_slice(&self.recv_hmac_key[..32])
                    .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))?;
                hmac.update(&packet_id.to_be_bytes());
                hmac.update(&timestamp.to_be_bytes());
                hmac.update(&[opcode_key_id]);
                hmac.update(&session_id.to_be_bytes());
                hmac.update(payload);
                hmac.verify_slice(received_tag).map_err(|_| {
                    CryptoError::DecryptionFailed("tls-auth HMAC verification failed".into())
                })?;
            }
        }

        Ok((opcode_key_id, session_id, packet_id, timestamp, payload))
    }
}
