//! SOCKS5 and HTTP CONNECT proxy clients for OpenVPN connections.

use crate::error::TransportError;
use std::net::SocketAddr;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

/// SOCKS5 Proxy Client.
pub struct Socks5Client;

impl Socks5Client {
    /// Establishes a TCP tunnel through a SOCKS5 proxy server.
    pub async fn connect(
        proxy_addr: SocketAddr,
        target_host: &str,
        target_port: u16,
        auth: Option<(&str, &str)>,
    ) -> Result<TcpStream, TransportError> {
        let mut stream = TcpStream::connect(proxy_addr).await?;
        stream.set_nodelay(true)?;

        // 1. Initial Greeting / Method Negotiation
        if let Some((u, p)) = auth {
            // Support No Auth (0x00) and Username/Password (0x02)
            stream.write_all(&[0x05, 0x02, 0x00, 0x02]).await?;
            let mut resp = [0u8; 2];
            stream.read_exact(&mut resp).await?;

            if resp[0] != 0x05 {
                return Err(TransportError::ProxyHandshakeFailed {
                    proxy_type: "SOCKS5",
                    reason: format!("Unsupported SOCKS version: {}", resp[0]),
                });
            }

            if resp[1] == 0x02 {
                // Username/Password authentication sub-negotiation
                let mut auth_req = Vec::with_capacity(3 + u.len() + p.len());
                auth_req.push(0x01); // Auth subnegotiation version
                auth_req.push(u.len() as u8);
                auth_req.extend_from_slice(u.as_bytes());
                auth_req.push(p.len() as u8);
                auth_req.extend_from_slice(p.as_bytes());

                stream.write_all(&auth_req).await?;
                let mut auth_resp = [0u8; 2];
                stream.read_exact(&mut auth_resp).await?;

                if auth_resp[1] != 0x00 {
                    return Err(TransportError::ProxyHandshakeFailed {
                        proxy_type: "SOCKS5",
                        reason: "Authentication failed".to_string(),
                    });
                }
            } else if resp[1] != 0x00 {
                return Err(TransportError::ProxyHandshakeFailed {
                    proxy_type: "SOCKS5",
                    reason: format!("No acceptable authentication method: {}", resp[1]),
                });
            }
        } else {
            // No Auth only
            stream.write_all(&[0x05, 0x01, 0x00]).await?;
            let mut resp = [0u8; 2];
            stream.read_exact(&mut resp).await?;
            if resp[0] != 0x05 || resp[1] != 0x00 {
                return Err(TransportError::ProxyHandshakeFailed {
                    proxy_type: "SOCKS5",
                    reason: format!("SOCKS5 greeting failed: {:?}", resp),
                });
            }
        }

        // 2. Connect Request (Command: 0x01 = CONNECT, Address Type: Domain Name = 0x03)
        let mut conn_req = Vec::with_capacity(7 + target_host.len());
        conn_req.push(0x05); // SOCKS version
        conn_req.push(0x01); // CMD: CONNECT
        conn_req.push(0x00); // Reserved
        conn_req.push(0x03); // ATYP: Domain Name
        conn_req.push(target_host.len() as u8);
        conn_req.extend_from_slice(target_host.as_bytes());
        conn_req.extend_from_slice(&target_port.to_be_bytes());

        stream.write_all(&conn_req).await?;

        // 3. Read Connect Response
        let mut header = [0u8; 4];
        stream.read_exact(&mut header).await?;
        if header[0] != 0x05 || header[1] != 0x00 {
            return Err(TransportError::ProxyHandshakeFailed {
                proxy_type: "SOCKS5",
                reason: format!("CONNECT command failed with status {:#04x}", header[1]),
            });
        }

        // Skip bound address & port in response
        match header[3] {
            0x01 => {
                let mut bnd = [0u8; 4 + 2]; // IPv4 (4) + Port (2)
                stream.read_exact(&mut bnd).await?;
            }
            0x03 => {
                let mut len_buf = [0u8; 1];
                stream.read_exact(&mut len_buf).await?;
                let mut bnd = vec![0u8; len_buf[0] as usize + 2];
                stream.read_exact(&mut bnd).await?;
            }
            0x04 => {
                let mut bnd = [0u8; 16 + 2]; // IPv6 (16) + Port (2)
                stream.read_exact(&mut bnd).await?;
            }
            other => {
                return Err(TransportError::ProxyHandshakeFailed {
                    proxy_type: "SOCKS5",
                    reason: format!("Unknown address type {other} in response"),
                });
            }
        }

        Ok(stream)
    }
}

/// HTTP CONNECT Proxy Client.
pub struct HttpConnectClient;

impl HttpConnectClient {
    /// Establishes a TCP tunnel through an HTTP CONNECT proxy server.
    pub async fn connect(
        proxy_addr: SocketAddr,
        target_host: &str,
        target_port: u16,
        auth: Option<(&str, &str)>,
    ) -> Result<TcpStream, TransportError> {
        let mut stream = TcpStream::connect(proxy_addr).await?;
        stream.set_nodelay(true)?;

        let mut req = format!(
            "CONNECT {}:{} HTTP/1.1\r\nHost: {}:{}\r\nProxy-Connection: Keep-Alive\r\n",
            target_host, target_port, target_host, target_port
        );

        if let Some((u, p)) = auth {
            let creds = format!("{u}:{p}");
            let b64 = {
                let mut out = String::new();
                const B64_CHARS: &[u8; 64] =
                    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                let bytes = creds.as_bytes();
                for chunk in bytes.chunks(3) {
                    let b0 = chunk[0];
                    let b1 = chunk.get(1).copied().unwrap_or(0);
                    let b2 = chunk.get(2).copied().unwrap_or(0);
                    out.push(B64_CHARS[(b0 >> 2) as usize] as char);
                    out.push(B64_CHARS[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
                    if chunk.len() > 1 {
                        out.push(B64_CHARS[(((b1 & 0x0F) << 2) | (b2 >> 6)) as usize] as char);
                    } else {
                        out.push('=');
                    }
                    if chunk.len() > 2 {
                        out.push(B64_CHARS[(b2 & 0x3F) as usize] as char);
                    } else {
                        out.push('=');
                    }
                }
                out
            };
            req.push_str(&format!("Proxy-Authorization: Basic {b64}\r\n"));
        }

        req.push_str("\r\n");
        stream.write_all(req.as_bytes()).await?;

        // Read response header until \r\n\r\n
        let mut resp_buf = Vec::with_capacity(1024);
        let mut byte_buf = [0u8; 1];
        while !resp_buf.ends_with(b"\r\n\r\n") && resp_buf.len() < 4096 {
            let n = stream.read(&mut byte_buf).await?;
            if n == 0 {
                return Err(TransportError::ConnectionClosed);
            }
            resp_buf.push(byte_buf[0]);
        }

        let resp_str = String::from_utf8_lossy(&resp_buf);
        if !resp_str.starts_with("HTTP/1.1 200") && !resp_str.starts_with("HTTP/1.0 200") {
            let status_line = resp_str.lines().next().unwrap_or("Unknown response");
            return Err(TransportError::ProxyHandshakeFailed {
                proxy_type: "HTTP CONNECT",
                reason: status_line.to_string(),
            });
        }

        Ok(stream)
    }
}
