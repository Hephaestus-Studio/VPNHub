//! OpenVPN packet opcodes and header byte encoding/decoding.

use crate::error::ProtocolError;
use std::fmt;

/// OpenVPN protocol opcodes (5-bit value shifted by 3 in packet header).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum Opcode {
    /// Initial client connection request (v1).
    ControlHardResetClientV1 = 1,
    /// Server initial connection response (v1).
    ControlHardResetServerV1 = 2,
    /// Key renegotiation soft reset.
    ControlSoftResetV1 = 3,
    /// Reliable control channel payload data.
    ControlV1 = 4,
    /// Standalone control channel acknowledgment.
    AckV1 = 5,
    /// Legacy Data Channel packet (without peer-id).
    DataV1 = 6,
    /// Initial client connection request (v2 with client-random).
    ControlHardResetClientV2 = 7,
    /// Server initial connection response (v2).
    ControlHardResetServerV2 = 8,
    /// Modern Data Channel packet with 24-bit Peer ID.
    DataV2 = 9,
    /// Modern client connection request (v3 with tls-crypt-v2 support).
    ControlHardResetClientV3 = 10,
    /// Wrapped Key Certificate (WKC) payload for tls-crypt-v2.
    ControlWkcV1 = 11,
}

impl Opcode {
    /// Parses a 5-bit opcode integer.
    pub fn from_u8(val: u8) -> Result<Self, ProtocolError> {
        match val {
            1 => Ok(Opcode::ControlHardResetClientV1),
            2 => Ok(Opcode::ControlHardResetServerV1),
            3 => Ok(Opcode::ControlSoftResetV1),
            4 => Ok(Opcode::ControlV1),
            5 => Ok(Opcode::AckV1),
            6 => Ok(Opcode::DataV1),
            7 => Ok(Opcode::ControlHardResetClientV2),
            8 => Ok(Opcode::ControlHardResetServerV2),
            9 => Ok(Opcode::DataV2),
            10 => Ok(Opcode::ControlHardResetClientV3),
            11 => Ok(Opcode::ControlWkcV1),
            other => Err(ProtocolError::UnknownOpcode(other)),
        }
    }

    /// Whether this opcode represents a Data Channel payload.
    pub fn is_data(&self) -> bool {
        matches!(self, Opcode::DataV1 | Opcode::DataV2)
    }

    /// Whether this opcode represents a Control Channel packet.
    pub fn is_control(&self) -> bool {
        !self.is_data()
    }

    /// Whether this opcode requires reliable transport ACK and packet-ID sequencing.
    pub fn is_reliable(&self) -> bool {
        matches!(
            self,
            Opcode::ControlHardResetClientV1
                | Opcode::ControlHardResetServerV1
                | Opcode::ControlSoftResetV1
                | Opcode::ControlV1
                | Opcode::ControlHardResetClientV2
                | Opcode::ControlHardResetServerV2
                | Opcode::ControlHardResetClientV3
                | Opcode::ControlWkcV1
        )
    }
}

impl fmt::Display for Opcode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Opcode::ControlHardResetClientV1 => write!(f, "P_CONTROL_HARD_RESET_CLIENT_V1"),
            Opcode::ControlHardResetServerV1 => write!(f, "P_CONTROL_HARD_RESET_SERVER_V1"),
            Opcode::ControlSoftResetV1 => write!(f, "P_CONTROL_SOFT_RESET_V1"),
            Opcode::ControlV1 => write!(f, "P_CONTROL_V1"),
            Opcode::AckV1 => write!(f, "P_ACK_V1"),
            Opcode::DataV1 => write!(f, "P_DATA_V1"),
            Opcode::ControlHardResetClientV2 => write!(f, "P_CONTROL_HARD_RESET_CLIENT_V2"),
            Opcode::ControlHardResetServerV2 => write!(f, "P_CONTROL_HARD_RESET_SERVER_V2"),
            Opcode::DataV2 => write!(f, "P_DATA_V2"),
            Opcode::ControlHardResetClientV3 => write!(f, "P_CONTROL_HARD_RESET_CLIENT_V3"),
            Opcode::ControlWkcV1 => write!(f, "P_CONTROL_WKC_V1"),
        }
    }
}

/// Encodes an opcode and key ID into a single OpenVPN header byte `(opcode << 3) | (key_id & 0x07)`.
pub fn encode_header_byte(opcode: Opcode, key_id: u8) -> u8 {
    ((opcode as u8) << 3) | (key_id & 0x07)
}

/// Decodes an OpenVPN header byte into `(Opcode, key_id)`.
pub fn parse_header_byte(byte: u8) -> Result<(Opcode, u8), ProtocolError> {
    let opcode_num = byte >> 3;
    let key_id = byte & 0x07;
    let opcode = Opcode::from_u8(opcode_num)?;
    Ok((opcode, key_id))
}
