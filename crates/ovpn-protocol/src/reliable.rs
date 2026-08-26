//! Reliable Control Channel sliding window protocol engine (CCv1 & CCv2).

use crate::error::ProtocolError;
use crate::frame::ControlPacket;
use crate::opcode::Opcode;
use bytes::Bytes;
use std::collections::{BTreeMap, VecDeque};
use std::time::{Duration, Instant};

/// A reliable packet queued for transmission / retransmission.
#[derive(Debug, Clone)]
pub struct ReliablePacket {
    pub packet_id: u32,
    pub opcode: Opcode,
    pub key_id: u8,
    pub payload: Bytes,
    pub first_sent_at: Instant,
    pub last_sent_at: Instant,
    pub retransmit_count: u32,
    pub current_rto: Duration,
}

/// Outgoing reliable transmission window.
#[derive(Debug)]
pub struct ReliableSendQueue {
    pub session_id: u64,
    pub remote_session_id: Option<u64>,
    pub next_packet_id: u32,
    pub window_size: usize,
    pub initial_rto: Duration,
    pub max_rto: Duration,
    pub max_retransmits: u32,
    pub unacked: VecDeque<ReliablePacket>,
}

impl ReliableSendQueue {
    pub fn new(session_id: u64, window_size: usize) -> Self {
        Self {
            session_id,
            remote_session_id: None,
            next_packet_id: 0,
            window_size,
            initial_rto: Duration::from_millis(1500),
            max_rto: Duration::from_secs(10),
            max_retransmits: 10,
            unacked: VecDeque::new(),
        }
    }

    /// Queues a new payload for reliable transmission and returns its assigned sequence ID.
    pub fn enqueue(
        &mut self,
        opcode: Opcode,
        key_id: u8,
        payload: Bytes,
        now: Instant,
    ) -> Result<u32, ProtocolError> {
        if self.unacked.len() >= self.window_size {
            return Err(ProtocolError::ReliableWindowOverflow);
        }

        let packet_id = self.next_packet_id;
        self.next_packet_id += 1;

        let packet = ReliablePacket {
            packet_id,
            opcode,
            key_id,
            payload,
            first_sent_at: now,
            last_sent_at: now,
            retransmit_count: 0,
            current_rto: self.initial_rto,
        };

        self.unacked.push_back(packet);
        Ok(packet_id)
    }

    /// Processes an array of ACKs received from the peer, removing acknowledged packets.
    pub fn process_acks(&mut self, acks: &[u32]) -> usize {
        let initial_len = self.unacked.len();
        self.unacked.retain(|pkt| !acks.contains(&pkt.packet_id));
        initial_len - self.unacked.len()
    }

    /// Checks for expired retransmission timers and builds retransmission control packets.
    pub fn poll_retransmissions(
        &mut self,
        now: Instant,
    ) -> Result<Vec<ControlPacket>, ProtocolError> {
        let mut to_resend = Vec::new();

        for pkt in self.unacked.iter_mut() {
            if now.duration_since(pkt.last_sent_at) >= pkt.current_rto {
                pkt.retransmit_count += 1;
                if pkt.retransmit_count > self.max_retransmits {
                    return Err(ProtocolError::HandshakeTimeout(
                        now.duration_since(pkt.first_sent_at),
                    ));
                }

                // Exponential backoff
                pkt.current_rto = (pkt.current_rto * 2).min(self.max_rto);
                pkt.last_sent_at = now;

                to_resend.push(ControlPacket {
                    opcode: pkt.opcode,
                    key_id: pkt.key_id,
                    session_id: self.session_id,
                    ack_array: Vec::new(),
                    remote_session_id: self.remote_session_id,
                    packet_id: Some(pkt.packet_id),
                    payload: pkt.payload.clone(),
                });
            }
        }

        Ok(to_resend)
    }

    /// Calculates the nearest future timestamp when a retransmission timer will fire.
    pub fn nearest_deadline(&self) -> Option<Instant> {
        self.unacked
            .iter()
            .map(|pkt| pkt.last_sent_at + pkt.current_rto)
            .min()
    }

    /// Returns whether all queued reliable packets have been acknowledged.
    pub fn is_empty(&self) -> bool {
        self.unacked.is_empty()
    }
}

/// Incoming reliable reception window that reorders packets and generates ACKs.
#[derive(Debug)]
pub struct ReliableRecvQueue {
    pub next_expected_id: u32,
    pub pending_acks: Vec<u32>,
    pub out_of_order: BTreeMap<u32, Bytes>,
    pub ready_stream: Vec<Bytes>,
}

impl Default for ReliableRecvQueue {
    fn default() -> Self {
        Self::new()
    }
}

impl ReliableRecvQueue {
    pub fn new() -> Self {
        Self {
            next_expected_id: 0,
            pending_acks: Vec::new(),
            out_of_order: BTreeMap::new(),
            ready_stream: Vec::new(),
        }
    }

    /// Processes an incoming reliable packet with the given sequence ID.
    pub fn process_packet(&mut self, packet_id: u32, payload: Bytes) -> Result<(), ProtocolError> {
        // Record ACK immediately so peer knows we received it
        if !self.pending_acks.contains(&packet_id) {
            self.pending_acks.push(packet_id);
        }

        if packet_id < self.next_expected_id {
            // Duplicate of already processed packet: ACK recorded, ignore payload
            return Ok(());
        }

        if packet_id == self.next_expected_id {
            // Exactly the packet we were waiting for
            self.ready_stream.push(payload);
            self.next_expected_id += 1;

            // Drain any contiguous buffered out-of-order packets
            while let Some(buffered_payload) = self.out_of_order.remove(&self.next_expected_id) {
                self.ready_stream.push(buffered_payload);
                self.next_expected_id += 1;
            }
        } else {
            // Out of order future packet: store in buffer if not too far ahead
            if self.out_of_order.len() > 64 {
                return Err(ProtocolError::ReliableWindowOverflow);
            }
            self.out_of_order.insert(packet_id, payload);
        }

        Ok(())
    }

    /// Drains all contiguous in-order payload chunks ready for higher layers (TLS).
    pub fn drain_ready(&mut self) -> Vec<Bytes> {
        std::mem::take(&mut self.ready_stream)
    }

    /// Drains pending ACKs to be transmitted back to the peer.
    pub fn drain_acks(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.pending_acks)
    }
}
