//! # IPC Frame Length-Delimited Codec
//!
//! Handles encoding and decoding of length-prefixed JSON frames across asynchronous streams.
//! Every frame starts with a 4-byte Big-Endian unsigned integer denoting payload size.

use bytes::{Buf, BufMut, BytesMut};
use serde::{de::DeserializeOwned, Serialize};
use std::marker::PhantomData;
use tokio_util::codec::{Decoder, Encoder};

use crate::config::MAX_IPC_FRAME_SIZE;
use crate::error::IpcError;

/// Length-delimited frame codec parameterized over request/response types.
#[derive(Debug, Clone)]
pub struct JsonLengthDelimitedCodec<In, Out> {
    max_frame_size: usize,
    _phantom: PhantomData<(In, Out)>,
}

impl<In, Out> Default for JsonLengthDelimitedCodec<In, Out> {
    fn default() -> Self {
        Self::new(MAX_IPC_FRAME_SIZE)
    }
}

impl<In, Out> JsonLengthDelimitedCodec<In, Out> {
    /// Creates a new codec with an explicit maximum frame size guard.
    pub fn new(max_frame_size: usize) -> Self {
        Self {
            max_frame_size,
            _phantom: PhantomData,
        }
    }
}

impl<In: DeserializeOwned, Out> Decoder for JsonLengthDelimitedCodec<In, Out> {
    type Item = In;
    type Error = IpcError;

    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
        // Need at least 4 bytes to read the length header
        if src.len() < 4 {
            return Ok(None);
        }

        // Read 4-byte big-endian length prefix without consuming buffer yet
        let length = u32::from_be_bytes([src[0], src[1], src[2], src[3]]) as usize;

        if length > self.max_frame_size {
            return Err(IpcError::FrameTooLarge {
                size: length,
                max_size: self.max_frame_size,
            });
        }

        // Check if the full frame body has arrived
        if src.len() < 4 + length {
            src.reserve(4 + length - src.len());
            return Ok(None);
        }

        // Advance past the 4-byte header
        src.advance(4);

        // Split off the exact frame bytes
        let frame_bytes = src.split_to(length);

        // Parse JSON payload
        let item: In = serde_json::from_slice(&frame_bytes).map_err(|e| {
            IpcError::ProtocolCodec(format!(
                "Failed to deserialize JSON frame ({} bytes): {}",
                length, e
            ))
        })?;

        Ok(Some(item))
    }
}

impl<In, Out: Serialize> Encoder<Out> for JsonLengthDelimitedCodec<In, Out> {
    type Error = IpcError;

    fn encode(&mut self, item: Out, dst: &mut BytesMut) -> Result<(), Self::Error> {
        let serialized = serde_json::to_vec(&item).map_err(|e| {
            IpcError::ProtocolCodec(format!("Failed to serialize outbound JSON item: {}", e))
        })?;

        if serialized.len() > self.max_frame_size {
            return Err(IpcError::FrameTooLarge {
                size: serialized.len(),
                max_size: self.max_frame_size,
            });
        }

        let length = serialized.len() as u32;

        dst.reserve(4 + serialized.len());
        dst.put_u32(length);
        dst.put_slice(&serialized);

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, PartialEq, Serialize, Deserialize)]
    struct SampleMessage {
        id: u32,
        content: String,
    }

    #[test]
    fn test_codec_encode_decode_roundtrip() {
        let mut codec = JsonLengthDelimitedCodec::<SampleMessage, SampleMessage>::default();
        let mut buffer = BytesMut::new();

        let msg = SampleMessage {
            id: 42,
            content: "Hello VPNHub Daemon".to_string(),
        };

        codec.encode(msg, &mut buffer).unwrap();
        assert!(buffer.len() > 4);

        let decoded = codec
            .decode(&mut buffer)
            .unwrap()
            .expect("should decode frame");
        assert_eq!(decoded.id, 42);
        assert_eq!(decoded.content, "Hello VPNHub Daemon");
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_codec_partial_frame_buffering() {
        let mut codec = JsonLengthDelimitedCodec::<SampleMessage, SampleMessage>::default();
        let mut buffer = BytesMut::new();

        let msg = SampleMessage {
            id: 100,
            content: "Streaming frame chunk test".to_string(),
        };

        codec.encode(msg, &mut buffer).unwrap();

        // Feed bytes chunk by chunk
        let mut incoming = BytesMut::new();
        incoming.extend_from_slice(&buffer[..2]);
        assert_eq!(codec.decode(&mut incoming).unwrap(), None);

        incoming.extend_from_slice(&buffer[2..6]);
        assert_eq!(codec.decode(&mut incoming).unwrap(), None);

        incoming.extend_from_slice(&buffer[6..]);
        let decoded = codec
            .decode(&mut incoming)
            .unwrap()
            .expect("full frame received");
        assert_eq!(decoded.id, 100);
    }
}
