//! OpenVPN TCP Framing Codec and Async TCP Transport.

use crate::error::TransportError;
use bytes::{Buf, BufMut, Bytes, BytesMut};
use std::net::SocketAddr;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_util::codec::{Decoder, Encoder};

/// Codec for 16-bit big-endian length-prefixed OpenVPN TCP frames.
#[derive(Debug, Default, Clone)]
pub struct OpenVpnTcpCodec;

impl Decoder for OpenVpnTcpCodec {
    type Item = BytesMut;
    type Error = TransportError;

    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
        if src.len() < 2 {
            return Ok(None);
        }

        let length = u16::from_be_bytes([src[0], src[1]]) as usize;
        if src.len() < 2 + length {
            src.reserve(2 + length - src.len());
            return Ok(None);
        }

        src.advance(2);
        let frame = src.split_to(length);
        Ok(Some(frame))
    }
}

impl Encoder<Bytes> for OpenVpnTcpCodec {
    type Error = TransportError;

    fn encode(&mut self, item: Bytes, dst: &mut BytesMut) -> Result<(), Self::Error> {
        let len = item.len();
        if len > u16::MAX as usize {
            return Err(TransportError::Framing(format!(
                "Packet length {len} exceeds u16::MAX for OpenVPN TCP framing"
            )));
        }

        dst.reserve(2 + len);
        dst.put_u16(len as u16);
        dst.extend_from_slice(&item);
        Ok(())
    }
}

impl Encoder<&[u8]> for OpenVpnTcpCodec {
    type Error = TransportError;

    fn encode(&mut self, item: &[u8], dst: &mut BytesMut) -> Result<(), Self::Error> {
        let len = item.len();
        if len > u16::MAX as usize {
            return Err(TransportError::Framing(format!(
                "Packet length {len} exceeds u16::MAX for OpenVPN TCP framing"
            )));
        }

        dst.reserve(2 + len);
        dst.put_u16(len as u16);
        dst.extend_from_slice(item);
        Ok(())
    }
}

/// Asynchronous TCP Transport implementing length-prefixed OpenVPN framing.
pub struct TcpTransport {
    stream: TcpStream,
    peer_addr: SocketAddr,
    read_buffer: BytesMut,
}

impl TcpTransport {
    /// Connects to a remote OpenVPN TCP server.
    pub async fn connect(remote_addr: SocketAddr) -> Result<Self, TransportError> {
        let stream = TcpStream::connect(remote_addr).await?;
        stream.set_nodelay(true)?;

        Ok(Self {
            stream,
            peer_addr: remote_addr,
            read_buffer: BytesMut::with_capacity(65536),
        })
    }

    /// Creates a TCP transport from an existing connected `TcpStream` (e.g. after proxy negotiation).
    pub fn from_connected_stream(
        stream: TcpStream,
        peer_addr: SocketAddr,
    ) -> Result<Self, TransportError> {
        stream.set_nodelay(true)?;
        Ok(Self {
            stream,
            peer_addr,
            read_buffer: BytesMut::with_capacity(65536),
        })
    }

    pub fn peer_addr(&self) -> SocketAddr {
        self.peer_addr
    }

    /// Sends a length-prefixed packet over TCP.
    pub async fn send_packet(&mut self, packet: &[u8]) -> Result<(), TransportError> {
        let len = packet.len();
        if len > u16::MAX as usize {
            return Err(TransportError::Framing(format!(
                "Packet length {len} exceeds u16::MAX"
            )));
        }

        let len_bytes = (len as u16).to_be_bytes();
        self.stream.write_all(&len_bytes).await?;
        self.stream.write_all(packet).await?;
        self.stream.flush().await?;
        Ok(())
    }

    /// Reads the next length-prefixed packet from TCP.
    pub async fn recv_packet(&mut self, buf: &mut [u8]) -> Result<usize, TransportError> {
        loop {
            // Check if full frame is already in buffer
            if self.read_buffer.len() >= 2 {
                let frame_len =
                    u16::from_be_bytes([self.read_buffer[0], self.read_buffer[1]]) as usize;
                if self.read_buffer.len() >= 2 + frame_len {
                    self.read_buffer.advance(2);
                    let frame = self.read_buffer.split_to(frame_len);
                    let copy_len = frame_len.min(buf.len());
                    buf[..copy_len].copy_from_slice(&frame[..copy_len]);
                    return Ok(copy_len);
                }
            }

            // Read more data from socket
            let n = self.stream.read_buf(&mut self.read_buffer).await?;
            if n == 0 {
                return Err(TransportError::ConnectionClosed);
            }
        }
    }
}
