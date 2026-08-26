//! High-performance asynchronous UDP transport for OpenVPN data/control channels.

use crate::error::TransportError;
use socket2::{Domain, Protocol, Socket, Type};
use std::net::SocketAddr;
use tokio::net::UdpSocket;

/// High-throughput asynchronous UDP transport socket.
pub struct UdpTransport {
    socket: UdpSocket,
    peer_addr: SocketAddr,
}

impl UdpTransport {
    /// Binds and connects a UDP socket to the specified remote address with optimized kernel buffers.
    pub async fn connect(remote_addr: SocketAddr) -> Result<Self, TransportError> {
        let domain = match remote_addr {
            SocketAddr::V4(_) => Domain::IPV4,
            SocketAddr::V6(_) => Domain::IPV6,
        };

        let sys_socket = Socket::new(domain, Type::DGRAM, Some(Protocol::UDP))?;
        sys_socket.set_nonblocking(true)?;

        // Optimize OS kernel socket buffers (2 MB buffers to prevent packet drops under heavy load)
        let _ = sys_socket.set_recv_buffer_size(2 * 1024 * 1024);
        let _ = sys_socket.set_send_buffer_size(2 * 1024 * 1024);

        // Bind to any local port
        let local_addr: SocketAddr = match remote_addr {
            SocketAddr::V4(_) => "0.0.0.0:0".parse().unwrap(),
            SocketAddr::V6(_) => "[::]:0".parse().unwrap(),
        };
        sys_socket.bind(&local_addr.into())?;

        let std_socket: std::net::UdpSocket = sys_socket.into();
        std_socket.connect(remote_addr)?;

        let socket = UdpSocket::from_std(std_socket)?;

        Ok(Self {
            socket,
            peer_addr: remote_addr,
        })
    }

    pub fn peer_addr(&self) -> SocketAddr {
        self.peer_addr
    }

    /// Sends a datagram to the connected remote peer.
    pub async fn send_packet(&self, packet: &[u8]) -> Result<(), TransportError> {
        self.socket.send(packet).await?;
        Ok(())
    }

    /// Receives a datagram into the provided buffer.
    pub async fn recv_packet(&self, buf: &mut [u8]) -> Result<usize, TransportError> {
        let n = self.socket.recv(buf).await?;
        Ok(n)
    }
}
