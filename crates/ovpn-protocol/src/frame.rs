//! Framing encoders and decoders for OpenVPN control and data channel packets.

use crate::error::ProtocolError;
use crate::opcode::{encode_header_byte, parse_header_byte, Opcode};
use bytes::{Buf, BufMut, Bytes, BytesMut};

/// Structured representation of a Control Channel packet.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ControlPacket {
    pub opcode: Opcode,
    pub key_id: u8,
    pub session_id: u64,
    pub ack_array: Vec<u32>,
    pub remote_session_id: Option<u64>,
    pub packet_id: Option<u32>,
    pub payload: Bytes,
}

impl ControlPacket {
    /// Encodes this control packet into a contiguous byte buffer.
    pub fn encode(&self, buf: &mut BytesMut) {
        let header = encode_header_byte(self.opcode, self.key_id);
        buf.put_u8(header);
        buf.put_u64(self.session_id);
        self.encode_body(buf);
    }

    /// Encodes the control packet body (ACKs, remote session ID, packet ID, payload).
    pub fn encode_body(&self, buf: &mut BytesMut) {
        let ack_len = self.ack_array.len() as u8;
        buf.put_u8(ack_len);

        for &ack_id in &self.ack_array {
            buf.put_u32(ack_id);
        }

        if ack_len > 0 {
            let remote_sid = self.remote_session_id.unwrap_or(0);
            buf.put_u64(remote_sid);
        }

        if let Some(pid) = self.packet_id {
            buf.put_u32(pid);
        }

        buf.extend_from_slice(&self.payload);
    }

    /// Decodes a raw network packet into a [`ControlPacket`].
    pub fn decode(mut src: &[u8]) -> Result<Self, ProtocolError> {
        if src.len() < 9 {
            return Err(ProtocolError::PacketTooShort(src.len()));
        }

        let header_byte = src.get_u8();
        let (opcode, key_id) = parse_header_byte(header_byte)?;
        let session_id = src.get_u64();

        Self::decode_body(opcode, key_id, session_id, src)
    }

    /// Decodes a [`ControlPacket`] given already parsed opcode, key_id, session_id, and body slice.
    pub fn decode_body(
        opcode: Opcode,
        key_id: u8,
        session_id: u64,
        mut src: &[u8],
    ) -> Result<Self, ProtocolError> {
        if src.is_empty() {
            return Err(ProtocolError::PacketTooShort(9));
        }

        let ack_len = src.get_u8() as usize;
        let mut ack_array = Vec::with_capacity(ack_len);

        if src.len() < ack_len * 4 {
            return Err(ProtocolError::InvalidFraming(
                "Not enough bytes for ACK array".to_string(),
            ));
        }

        for _ in 0..ack_len {
            ack_array.push(src.get_u32());
        }

        let remote_session_id = if ack_len > 0 {
            if src.len() < 8 {
                return Err(ProtocolError::InvalidFraming(
                    "Missing remote session ID in ACK".to_string(),
                ));
            }
            Some(src.get_u64())
        } else {
            None
        };

        let packet_id = if opcode.is_reliable() {
            if src.len() < 4 {
                return Err(ProtocolError::InvalidFraming(
                    "Missing packet ID in reliable packet".to_string(),
                ));
            }
            Some(src.get_u32())
        } else {
            None
        };

        let payload = Bytes::copy_from_slice(src);

        Ok(ControlPacket {
            opcode,
            key_id,
            session_id,
            ack_array,
            remote_session_id,
            packet_id,
            payload,
        })
    }
}

/// Structured representation of a Data Channel packet (P_DATA_V2 or P_DATA_V1).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DataPacket {
    pub key_id: u8,
    pub peer_id: Option<u32>,
    pub packet_id: u32,
    pub payload: BytesMut,
}

impl DataPacket {
    /// Encodes a data channel packet header into a buffer.
    pub fn encode_header(
        opcode: Opcode,
        key_id: u8,
        peer_id: Option<u32>,
        packet_id: u32,
        buf: &mut BytesMut,
    ) {
        let header = encode_header_byte(opcode, key_id);
        buf.put_u8(header);

        if opcode == Opcode::DataV2 {
            let pid = peer_id.unwrap_or(0);
            buf.put_u8(((pid >> 16) & 0xFF) as u8);
            buf.put_u8(((pid >> 8) & 0xFF) as u8);
            buf.put_u8((pid & 0xFF) as u8);
        }

        buf.put_u32(packet_id);
    }

    /// Decodes a data channel packet header and extracts payload bytes.
    pub fn decode(mut src: &[u8]) -> Result<(Opcode, u8, Option<u32>, u32, &[u8]), ProtocolError> {
        if src.is_empty() {
            return Err(ProtocolError::PacketTooShort(0));
        }

        let header_byte = src.get_u8();
        let (opcode, key_id) = parse_header_byte(header_byte)?;

        match opcode {
            Opcode::DataV2 => {
                if src.len() < 7 {
                    return Err(ProtocolError::PacketTooShort(src.len() + 1));
                }
                let p0 = src.get_u8() as u32;
                let p1 = src.get_u8() as u32;
                let p2 = src.get_u8() as u32;
                let peer_id = (p0 << 16) | (p1 << 8) | p2;
                let packet_id = src.get_u32();
                Ok((opcode, key_id, Some(peer_id), packet_id, src))
            }
            Opcode::DataV1 => {
                if src.len() < 4 {
                    return Err(ProtocolError::PacketTooShort(src.len() + 1));
                }
                let packet_id = src.get_u32();
                Ok((opcode, key_id, None, packet_id, src))
            }
            _ => Err(ProtocolError::InvalidFraming(format!(
                "Expected data opcode, got {opcode}"
            ))),
        }
    }
}
