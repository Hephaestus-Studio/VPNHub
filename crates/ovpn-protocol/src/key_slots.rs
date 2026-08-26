//! Dual-slot data channel key management and hitless rollover machine.

use crate::error::ProtocolError;
use ovpn_crypto::{audit, AntiReplayWindow, CipherSuite, SessionKeySet, SymmCipher};
use std::time::Instant;

/// Individual cryptographic key slot for Data Channel encryption / decryption.
pub struct KeySlot {
    pub key_id: u8,
    pub tx_cipher: Box<dyn SymmCipher>,
    pub rx_cipher: Box<dyn SymmCipher>,
    pub tx_implicit_iv: [u8; 8],
    pub rx_implicit_iv: [u8; 8],
    pub anti_replay: AntiReplayWindow,
    pub tx_packet_id: u32,
    pub created_at: Instant,
    pub bytes_sent: u64,
    pub bytes_received: u64,
}

impl KeySlot {
    pub fn new(
        session_keys: &SessionKeySet,
        cipher_suite: CipherSuite,
        now: Instant,
    ) -> Result<Self, ProtocolError> {
        let tx_cipher = cipher_suite
            .create_cipher(&session_keys.tx_key.cipher_key)
            .map_err(ProtocolError::Crypto)?;
        let rx_cipher = cipher_suite
            .create_cipher(&session_keys.rx_key.cipher_key)
            .map_err(ProtocolError::Crypto)?;

        let mut tx_implicit_iv = [0u8; 8];
        let mut rx_implicit_iv = [0u8; 8];
        if session_keys.tx_key.hmac_key.len() >= 8 {
            tx_implicit_iv.copy_from_slice(&session_keys.tx_key.hmac_key[..8]);
        }
        if session_keys.rx_key.hmac_key.len() >= 8 {
            rx_implicit_iv.copy_from_slice(&session_keys.rx_key.hmac_key[..8]);
        }

        Ok(Self {
            key_id: session_keys.key_id,
            tx_cipher,
            rx_cipher,
            tx_implicit_iv,
            rx_implicit_iv,
            anti_replay: AntiReplayWindow::new(),
            tx_packet_id: 1,
            created_at: now,
            bytes_sent: 0,
            bytes_received: 0,
        })
    }

    /// Allocates the next 32-bit packet sequence number for transmission.
    pub fn next_tx_packet_id(&mut self) -> u32 {
        let id = self.tx_packet_id;
        self.tx_packet_id = self.tx_packet_id.wrapping_add(1);
        id
    }
}

/// Dual-slot key manager coordinating hitless key rollover during TLS renegotiations.
pub struct KeySlotManager {
    cipher_suite: CipherSuite,
    pub primary: Option<KeySlot>,
    pub secondary: Option<KeySlot>,
}

impl KeySlotManager {
    pub fn new(cipher_suite: CipherSuite) -> Self {
        Self {
            cipher_suite,
            primary: None,
            secondary: None,
        }
    }

    /// Installs a newly negotiated key set, shifting the active primary into the secondary slot.
    pub fn install_new_key(
        &mut self,
        session_keys: &SessionKeySet,
        now: Instant,
    ) -> Result<(), ProtocolError> {
        let new_slot = KeySlot::new(session_keys, self.cipher_suite, now)?;
        let new_id = new_slot.key_id;

        if let Some(old_primary) = self.primary.take() {
            let old_id = old_primary.key_id;
            audit::log_key_rotation(old_id, new_id, "TLS session rekeying");
            self.secondary = Some(old_primary);
        }

        self.primary = Some(new_slot);
        Ok(())
    }

    /// Returns the primary key slot for encrypting outgoing TUN packets.
    pub fn get_tx_slot(&mut self) -> Option<&mut KeySlot> {
        self.primary.as_mut()
    }

    /// Returns the matching key slot (primary or secondary) to decrypt an incoming packet with `key_id`.
    pub fn get_rx_slot(&mut self, key_id: u8) -> Option<&mut KeySlot> {
        if let Some(ref mut prim) = self.primary {
            if prim.key_id == key_id {
                return Some(prim);
            }
        }

        if let Some(ref mut sec) = self.secondary {
            if sec.key_id == key_id {
                return Some(sec);
            }
        }

        None
    }

    /// Retires and wipes the secondary key slot once renegotiation is complete.
    pub fn retire_secondary(&mut self) {
        if let Some(sec) = self.secondary.take() {
            audit::log_crypto_event(
                "retire_key_slot",
                Some(sec.key_id),
                "Secondary key slot retired",
            );
        }
    }

    /// Whether any active key slot is installed.
    pub fn has_active_keys(&self) -> bool {
        self.primary.is_some()
    }
}
