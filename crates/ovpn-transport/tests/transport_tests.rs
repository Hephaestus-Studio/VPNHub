use bytes::{Bytes, BytesMut};
use ovpn_transport::{
    HttpConnectClient, OpenVpnTcpCodec, Socks5Client, TcpTransport, UdpTransport,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use tokio::net::{TcpListener, UdpSocket};
use tokio_util::codec::{Decoder, Encoder};

#[tokio::test]
async fn test_udp_transport_send_recv() {
    let server_sock = UdpSocket::bind("127.0.0.1:0").await.unwrap();
    let server_addr = server_sock.local_addr().unwrap();

    let client_transport = UdpTransport::connect(server_addr).await.unwrap();
    assert_eq!(client_transport.peer_addr(), server_addr);

    let test_packet = b"OpenVPN UDP Wire Packet in Rust";
    client_transport.send_packet(test_packet).await.unwrap();

    let mut recv_buf = [0u8; 1500];
    let (n, client_addr) = server_sock.recv_from(&mut recv_buf).await.unwrap();
    assert_eq!(&recv_buf[..n], test_packet);

    // Reply back to client
    let reply_packet = b"Server Reply Packet";
    server_sock
        .send_to(reply_packet, client_addr)
        .await
        .unwrap();

    let mut client_buf = [0u8; 1500];
    let recvd_len = client_transport.recv_packet(&mut client_buf).await.unwrap();
    assert_eq!(&client_buf[..recvd_len], reply_packet);
}

#[tokio::test]
async fn test_openvpn_tcp_codec_roundtrip() {
    let mut codec = OpenVpnTcpCodec::default();
    let mut buffer = BytesMut::new();

    let packet_data = Bytes::from_static(b"Encrypted OpenVPN TCP Frame with 16-bit length prefix");
    codec.encode(packet_data.clone(), &mut buffer).unwrap();

    // First 2 bytes must be the length in big-endian
    let expected_len = packet_data.len() as u16;
    assert_eq!(&buffer[0..2], &expected_len.to_be_bytes());

    // Decode from buffer
    let decoded = codec
        .decode(&mut buffer)
        .unwrap()
        .expect("Failed to decode frame");
    assert_eq!(&decoded[..], &packet_data[..]);
    assert!(buffer.is_empty());
}

#[tokio::test]
async fn test_tcp_transport_framed_communication() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let server_addr = listener.local_addr().unwrap();

    let server_handle = tokio::spawn(async move {
        let (stream, peer) = listener.accept().await.unwrap();
        let mut server_transport = TcpTransport::from_connected_stream(stream, peer).unwrap();
        let mut buf = [0u8; 1500];
        let n = server_transport.recv_packet(&mut buf).await.unwrap();
        assert_eq!(&buf[..n], b"Hello TCP OpenVPN");

        server_transport
            .send_packet(b"TCP Ack from Server")
            .await
            .unwrap();
    });

    let mut client = TcpTransport::connect(server_addr).await.unwrap();
    client.send_packet(b"Hello TCP OpenVPN").await.unwrap();

    let mut reply = [0u8; 1500];
    let n = client.recv_packet(&mut reply).await.unwrap();
    assert_eq!(&reply[..n], b"TCP Ack from Server");

    server_handle.await.unwrap();
}

#[tokio::test]
async fn test_socks5_proxy_handshake() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let proxy_addr = listener.local_addr().unwrap();

    let mock_proxy = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        // 1. Greeting (client sends 3 bytes: [0x05, 0x01, 0x00])
        let mut greet = [0u8; 3];
        stream.read_exact(&mut greet).await.unwrap();
        assert_eq!(greet[0], 0x05); // SOCKS5
        stream.write_all(&[0x05, 0x00]).await.unwrap(); // Method: No Auth

        // 2. Connect request
        let mut req_hdr = [0u8; 4];
        stream.read_exact(&mut req_hdr).await.unwrap();
        assert_eq!(req_hdr[1], 0x01); // CONNECT

        let mut domain_len = [0u8; 1];
        stream.read_exact(&mut domain_len).await.unwrap();
        let mut domain_and_port = vec![0u8; domain_len[0] as usize + 2];
        stream.read_exact(&mut domain_and_port).await.unwrap();

        // 3. Success reply (BND.ADDR = 0.0.0.0, BND.PORT = 0)
        stream
            .write_all(&[0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
            .await
            .unwrap();

        // Send confirmation data
        stream.write_all(b"TUNNEL_ESTABLISHED").await.unwrap();
    });

    let mut client_stream = Socks5Client::connect(proxy_addr, "vpn.remote.net", 1194, None)
        .await
        .expect("SOCKS5 connection failed");

    let mut buf = [0u8; 18];
    client_stream.read_exact(&mut buf).await.unwrap();
    assert_eq!(&buf, b"TUNNEL_ESTABLISHED");

    mock_proxy.await.unwrap();
}

#[tokio::test]
async fn test_http_connect_proxy_handshake() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let proxy_addr = listener.local_addr().unwrap();

    let mock_proxy = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut req_buf = vec![0u8; 1024];
        let n = stream.read(&mut req_buf).await.unwrap();
        let req_str = String::from_utf8_lossy(&req_buf[..n]);
        assert!(req_str.starts_with("CONNECT vpn.server.io:443 HTTP/1.1"));
        assert!(req_str.contains("Proxy-Authorization: Basic"));

        stream
            .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            .await
            .unwrap();
        stream.write_all(b"HTTP_TUNNEL_READY").await.unwrap();
    });

    let mut client_stream = HttpConnectClient::connect(
        proxy_addr,
        "vpn.server.io",
        443,
        Some(("vpnuser", "vpnpass123")),
    )
    .await
    .expect("HTTP CONNECT failed");

    let mut buf = [0u8; 17];
    client_stream.read_exact(&mut buf).await.unwrap();
    assert_eq!(&buf, b"HTTP_TUNNEL_READY");

    mock_proxy.await.unwrap();
}
