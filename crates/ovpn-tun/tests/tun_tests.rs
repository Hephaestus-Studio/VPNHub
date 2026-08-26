use ovpn_tun::{DcoDriver, DcoPeerKeyConfig, LinuxDcoDriver, MockTunDevice, VirtualTunDevice};

#[tokio::test]
async fn test_mock_tun_device_read_write() {
    let (mut tun, inbound_sender) = MockTunDevice::new("mocktun0", 1500);
    assert_eq!(tun.name(), "mocktun0");
    assert_eq!(tun.mtu(), 1500);

    // 1. Inbound packet from TUN into protocol engine
    let test_ip_packet = vec![0x45, 0x00, 0x00, 0x28, 0x11, 0x22, 0x00, 0x00];
    inbound_sender.send(test_ip_packet.clone()).await.unwrap();

    let mut read_buf = [0u8; 1500];
    let n = tun.read(&mut read_buf).await.unwrap();
    assert_eq!(&read_buf[..n], &test_ip_packet);

    // 2. Outbound packet from protocol engine written to TUN
    let outbound_ip_packet = vec![0x45, 0x00, 0x00, 0x30, 0x33, 0x44, 0x00, 0x00];
    let written = tun.write(&outbound_ip_packet).await.unwrap();
    assert_eq!(written, outbound_ip_packet.len());

    // Give asynchronous collector task a moment to store packet
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    let written_packets = tun.get_written_packets().await;
    assert_eq!(written_packets.len(), 1);
    assert_eq!(written_packets[0], outbound_ip_packet);
}

#[test]
fn test_linux_dco_driver_interface() {
    let mut dco = LinuxDcoDriver::new("tun0");
    let available = dco.is_available();

    // If DCO module is not loaded on host, calls should return Dco error cleanly without panic
    if !available {
        let addr = "198.51.100.1:1194".parse().unwrap();
        let res = dco.new_peer(1, addr);
        assert!(res.is_err());

        let key_cfg = DcoPeerKeyConfig {
            peer_id: 1,
            key_id: 0,
            cipher_name: "AES-256-GCM".to_string(),
            encrypt_key: vec![0x11; 32],
            decrypt_key: vec![0x22; 32],
        };
        assert!(dco.set_peer_key(&key_cfg).is_err());
        assert!(dco.del_peer(1).is_err());
    }
}
