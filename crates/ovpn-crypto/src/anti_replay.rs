//! Anti-replay sliding window protection for OpenVPN data and control channels.

use crate::error::CryptoError;

/// 128-bit sliding window anti-replay filter.
///
/// Prevents packet replay attacks while allowing out-of-order packet arrival
/// within a window of up to 128 packets.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AntiReplayWindow {
    /// Highest packet sequence number received so far.
    max_seq: u64,
    /// Bitmask of received packets within `[max_seq - 127 .. max_seq]`.
    /// `bitmap[0]` covers offsets 0..63, `bitmap[1]` covers offsets 64..127.
    bitmap: [u64; 2],
    /// Total valid packets accepted through this window.
    accepted_count: u64,
    /// Total replay / duplicate attempts rejected.
    rejected_count: u64,
    /// Whether any packet has been received yet.
    initialized: bool,
}

impl Default for AntiReplayWindow {
    fn default() -> Self {
        Self::new()
    }
}

impl AntiReplayWindow {
    /// Window capacity in number of packets.
    pub const WINDOW_SIZE: u64 = 128;

    /// Creates a new, empty anti-replay window.
    pub fn new() -> Self {
        Self {
            max_seq: 0,
            bitmap: [0; 2],
            accepted_count: 0,
            rejected_count: 0,
            initialized: false,
        }
    }

    /// Resets the anti-replay window state (e.g. upon key renegotiation).
    pub fn reset(&mut self) {
        self.max_seq = 0;
        self.bitmap = [0; 2];
        self.accepted_count = 0;
        self.rejected_count = 0;
        self.initialized = false;
    }

    /// Highest sequence number accepted so far.
    pub fn max_seq(&self) -> u64 {
        self.max_seq
    }

    /// Total accepted packets.
    pub fn accepted_count(&self) -> u64 {
        self.accepted_count
    }

    /// Total rejected duplicate / expired packets.
    pub fn rejected_count(&self) -> u64 {
        self.rejected_count
    }

    /// Checks if a packet sequence number is valid without mutating the window state.
    pub fn check_only(&self, seq: u64) -> Result<(), CryptoError> {
        if !self.initialized {
            return Ok(());
        }

        if seq > self.max_seq {
            // Newer than max_seq, valid
            return Ok(());
        }

        let diff = self.max_seq - seq;
        if diff >= Self::WINDOW_SIZE {
            // Older than window size, rejected
            return Err(CryptoError::AntiReplayRejection {
                packet_id: seq,
                window_base: self.max_seq.saturating_sub(Self::WINDOW_SIZE - 1),
            });
        }

        // Check if already seen in bitmap
        let word = (diff / 64) as usize;
        let bit = diff % 64;
        if (self.bitmap[word] & (1u64 << bit)) != 0 {
            return Err(CryptoError::AntiReplayRejection {
                packet_id: seq,
                window_base: self.max_seq.saturating_sub(Self::WINDOW_SIZE - 1),
            });
        }

        Ok(())
    }

    /// Checks and updates the anti-replay window state with the given packet sequence number.
    pub fn check_and_update(&mut self, seq: u64) -> Result<(), CryptoError> {
        if !self.initialized {
            self.max_seq = seq;
            self.bitmap[0] = 1;
            self.bitmap[1] = 0;
            self.initialized = true;
            self.accepted_count += 1;
            return Ok(());
        }

        if seq > self.max_seq {
            let diff = seq - self.max_seq;
            if diff >= Self::WINDOW_SIZE {
                // Large gap forward: wipe out entire previous window
                self.bitmap[0] = 1;
                self.bitmap[1] = 0;
            } else if diff >= 64 {
                // Shift by 64+ bits
                let shift_rem = diff - 64;
                self.bitmap[1] = self.bitmap[0] << shift_rem;
                self.bitmap[0] = 1;
            } else {
                // Shift by diff (< 64 bits)
                let carry = self.bitmap[0] >> (64 - diff);
                self.bitmap[1] = (self.bitmap[1] << diff) | carry;
                self.bitmap[0] = (self.bitmap[0] << diff) | 1;
            }
            self.max_seq = seq;
            self.accepted_count += 1;
            Ok(())
        } else {
            let diff = self.max_seq - seq;
            if diff >= Self::WINDOW_SIZE {
                self.rejected_count += 1;
                return Err(CryptoError::AntiReplayRejection {
                    packet_id: seq,
                    window_base: self.max_seq.saturating_sub(Self::WINDOW_SIZE - 1),
                });
            }

            let word = (diff / 64) as usize;
            let bit = diff % 64;
            let mask = 1u64 << bit;

            if (self.bitmap[word] & mask) != 0 {
                // Duplicate packet!
                self.rejected_count += 1;
                return Err(CryptoError::AntiReplayRejection {
                    packet_id: seq,
                    window_base: self.max_seq.saturating_sub(Self::WINDOW_SIZE - 1),
                });
            }

            // Mark packet as received
            self.bitmap[word] |= mask;
            self.accepted_count += 1;
            Ok(())
        }
    }
}
