use bytes::{Bytes, BytesMut};
use ovpn_config::OpenVpnConfig;
use ovpn_crypto::{CipherSuite, DirectionalKey, SessionKeySet};

use ovpn_protocol::{
    clamp_tcp_mss, encode_header_byte, parse_header_byte, AuthChallenge, AuthHandler,
    ControlPacket, DataPacket, EngineState, KeySlotManager, Opcode, OutputAction, ProtocolEngine,
    ReliableRecvQueue, ReliableSendQueue,
};
use std::time::{Duration, Instant};

#[test]
fn test_opcode_and_header_encoding() {
    let test_cases = [
        (Opcode::ControlHardResetClientV1, 0, 0x08),
        (Opcode::ControlHardResetServerV1, 1, 0x11),
        (Opcode::ControlSoftResetV1, 2, 0x1A),
        (Opcode::ControlV1, 0, 0x20),
        (Opcode::AckV1, 5, 0x2D),
        (Opcode::DataV1, 0, 0x30),
        (Opcode::ControlHardResetClientV2, 0, 0x38),
        (Opcode::ControlHardResetServerV2, 3, 0x43),
        (Opcode::DataV2, 0, 0x48),
        (Opcode::ControlHardResetClientV3, 7, 0x57),
        (Opcode::ControlWkcV1, 0, 0x58),
    ];

    for (op, kid, expected_byte) in test_cases {
        let encoded = encode_header_byte(op, kid);
        assert_eq!(encoded, expected_byte);

        let (parsed_op, parsed_kid) = parse_header_byte(encoded).unwrap();
        assert_eq!(parsed_op, op);
        assert_eq!(parsed_kid, kid);
    }
}

#[test]
fn test_control_packet_encode_decode_roundtrip() {
    let cp = ControlPacket {
        opcode: Opcode::ControlV1,
        key_id: 0,
        session_id: 0x0123456789ABCDEF,
        ack_array: vec![100, 101, 102],
        remote_session_id: Some(0xFEDCBA9876543210),
        packet_id: Some(42),
        payload: Bytes::from_static(b"TLS Handshake Record Bytes"),
    };

    let mut buf = BytesMut::new();
    cp.encode(&mut buf);

    let decoded = ControlPacket::decode(&buf).expect("Failed to decode control packet");
    assert_eq!(decoded.opcode, Opcode::ControlV1);
    assert_eq!(decoded.key_id, 0);
    assert_eq!(decoded.session_id, 0x0123456789ABCDEF);
    assert_eq!(decoded.ack_array, vec![100, 101, 102]);
    assert_eq!(decoded.remote_session_id, Some(0xFEDCBA9876543210));
    assert_eq!(decoded.packet_id, Some(42));
    assert_eq!(&decoded.payload[..], b"TLS Handshake Record Bytes");
}

#[test]
fn test_data_packet_encode_decode_v2_roundtrip() {
    let mut buf = BytesMut::new();
    let peer_id = Some(0x123456);
    let packet_id = 9999;

    DataPacket::encode_header(Opcode::DataV2, 2, peer_id, packet_id, &mut buf);
    buf.extend_from_slice(b"encrypted payload and auth tag");

    let (op, kid, parsed_pid, parsed_seq, payload) = DataPacket::decode(&buf).unwrap();
    assert_eq!(op, Opcode::DataV2);
    assert_eq!(kid, 2);
    assert_eq!(parsed_pid, Some(0x123456));
    assert_eq!(parsed_seq, 9999);
    assert_eq!(payload, b"encrypted payload and auth tag");
}

#[test]
fn test_reliable_sliding_window_reordering_and_retransmits() {
    let now = Instant::now();
    let mut send_q = ReliableSendQueue::new(0x11223344, 8);
    let mut recv_q = ReliableRecvQueue::new();

    // Enqueue 3 packets
    let p0 = send_q
        .enqueue(Opcode::ControlV1, 0, Bytes::from_static(b"pkt 0"), now)
        .unwrap();
    let p1 = send_q
        .enqueue(Opcode::ControlV1, 0, Bytes::from_static(b"pkt 1"), now)
        .unwrap();
    let p2 = send_q
        .enqueue(Opcode::ControlV1, 0, Bytes::from_static(b"pkt 2"), now)
        .unwrap();

    assert_eq!(p0, 0);
    assert_eq!(p1, 1);
    assert_eq!(p2, 2);

    // Deliver out-of-order to receiver: receive packet 2 first, then 0, then 1
    recv_q
        .process_packet(2, Bytes::from_static(b"pkt 2"))
        .unwrap();
    assert!(
        recv_q.drain_ready().is_empty(),
        "Packet 2 alone should not be ready"
    );

    recv_q
        .process_packet(0, Bytes::from_static(b"pkt 0"))
        .unwrap();
    let ready = recv_q.drain_ready();
    assert_eq!(ready.len(), 1);
    assert_eq!(&ready[0][..], b"pkt 0");

    recv_q
        .process_packet(1, Bytes::from_static(b"pkt 1"))
        .unwrap();
    let ready2 = recv_q.drain_ready();
    assert_eq!(ready2.len(), 2);
    assert_eq!(&ready2[0][..], b"pkt 1");
    assert_eq!(&ready2[1][..], b"pkt 2");

    // Sender processes ACKs
    let acks = recv_q.drain_acks();
    assert_eq!(acks, vec![2, 0, 1]);
    let removed = send_q.process_acks(&acks);
    assert_eq!(removed, 3);
    assert!(send_q.is_empty());

    // Test retransmission trigger
    let _p3 = send_q
        .enqueue(Opcode::ControlV1, 0, Bytes::from_static(b"pkt 3"), now)
        .unwrap();
    let future = now + Duration::from_secs(3);
    let retransmits = send_q.poll_retransmissions(future).unwrap();
    assert_eq!(retransmits.len(), 1);
    assert_eq!(retransmits[0].packet_id, Some(3));
}

#[test]
fn test_tcp_mss_clamping() {
    // Construct a synthetic IPv4 TCP SYN packet
    let mut syn_packet = vec![
        0x45, 0x00, 0x00, 0x3C, // IPv4, IHL=5, Len=60
        0x12, 0x34, 0x40, 0x00, // ID, Flags=DF
        0x40, 0x06, 0x00, 0x00, // TTL=64, Proto=TCP(6), Checksum=0
        0x0A, 0x08, 0x00, 0x02, // Src IP: 10.8.0.2
        0x08, 0x08, 0x08, 0x08, // Dst IP: 8.8.8.8
        // TCP Header (24 bytes)
        0x1F, 0x90, 0x01, 0xBB, // Src Port: 8080, Dst Port: 443
        0x00, 0x00, 0x00, 0x01, // Seq num: 1
        0x00, 0x00, 0x00, 0x00, // Ack num: 0
        0x60, 0x02, 0x72, 0x10, // Data offset: 6 (24 bytes), Flags: SYN(0x02), Window: 29200
        0x00, 0x00, 0x00, 0x00, // Checksum, Urgent pointer
        // TCP Options: MSS Option (Kind: 2, Len: 4, Value: 1460 (0x05B4))
        0x02, 0x04, 0x05, 0xB4,
    ];

    // Clamp MSS to 1300 (0x0514)
    let clamped = clamp_tcp_mss(&mut syn_packet, 1300);
    assert!(clamped);

    // Verify clamped MSS value
    let new_mss = u16::from_be_bytes([syn_packet[42], syn_packet[43]]);
    assert_eq!(new_mss, 1300);

    // Non-SYN packet should not be clamped
    syn_packet[33] = 0x10; // ACK flag only
    let not_clamped = clamp_tcp_mss(&mut syn_packet, 1200);
    assert!(!not_clamped);
}

#[test]
fn test_auth_challenge_and_crv1_parsing() {
    let crv1_msg = "CRV1:R,E:state_abc123:alice:Enter Google Authenticator OTP Code";
    let challenge = AuthHandler::parse_challenge(crv1_msg).unwrap();

    match challenge {
        AuthChallenge::CrV1 {
            flags,
            state_id,
            username,
            prompt,
        } => {
            assert_eq!(flags, "R,E");
            assert_eq!(state_id, "state_abc123");
            assert_eq!(username, "alice");
            assert_eq!(prompt, "Enter Google Authenticator OTP Code");
        }
        _ => panic!("Expected CRV1 challenge"),
    }

    let response = AuthHandler::encode_crv1_response("state_abc123", "123456");
    assert_eq!(response, b"CRV1::state_abc123::123456\n");

    // SSO Web Auth URL test
    let sso_msg = "OPEN_URL:https://auth.company.com/sso/authorize?client_id=vpn";
    let sso_challenge = AuthHandler::parse_challenge(sso_msg).unwrap();
    match sso_challenge {
        AuthChallenge::WebSso { url } => {
            assert_eq!(url, "https://auth.company.com/sso/authorize?client_id=vpn");
        }
        _ => panic!("Expected WebSso challenge"),
    }
}

#[test]
fn test_key_slot_manager_hitless_rollover() {
    let now = Instant::now();
    let mut manager = KeySlotManager::new(CipherSuite::Aes256Gcm);
    assert!(!manager.has_active_keys());

    let session_keys_1 = SessionKeySet {
        key_id: 0,
        tx_key: DirectionalKey {
            cipher_key: vec![0x11u8; 32],
            hmac_key: vec![0x12u8; 32],
        },
        rx_key: DirectionalKey {
            cipher_key: vec![0x13u8; 32],
            hmac_key: vec![0x14u8; 32],
        },
    };

    manager.install_new_key(&session_keys_1, now).unwrap();
    assert!(manager.has_active_keys());
    assert_eq!(manager.get_tx_slot().unwrap().key_id, 0);
    assert!(manager.get_rx_slot(0).is_some());
    assert!(manager.get_rx_slot(1).is_none());

    // TLS rekey event: Install key_id 1
    let session_keys_2 = SessionKeySet {
        key_id: 1,
        tx_key: DirectionalKey {
            cipher_key: vec![0x21u8; 32],
            hmac_key: vec![0x22u8; 32],
        },
        rx_key: DirectionalKey {
            cipher_key: vec![0x23u8; 32],
            hmac_key: vec![0x24u8; 32],
        },
    };

    manager.install_new_key(&session_keys_2, now).unwrap();

    // During rollover, primary is key 1, secondary is key 0 -> both can decrypt!
    assert_eq!(manager.get_tx_slot().unwrap().key_id, 1);
    assert!(manager.get_rx_slot(1).is_some(), "Key 1 must decrypt");
    assert!(
        manager.get_rx_slot(0).is_some(),
        "Key 0 must decrypt simultaneously"
    );

    // Retire secondary
    manager.retire_secondary();
    assert!(manager.get_rx_slot(0).is_none(), "Key 0 must be retired");
    assert!(manager.get_rx_slot(1).is_some(), "Key 1 remains active");
}

#[test]
fn test_protocol_engine_deterministic_handshake_flow() {
    let now = Instant::now();
    let config = OpenVpnConfig::default();
    let mut engine = ProtocolEngine::new(config, now).expect("Engine initialization failed");

    assert_eq!(engine.state(), EngineState::Disconnected);

    // 1. Start connect
    engine.start_connect(now).expect("Start connect failed");
    assert_eq!(engine.state(), EngineState::Connecting);

    // 2. Poll initial actions: StateChange, then Hard Reset packet
    let mut actions = Vec::new();
    while let Some(act) = engine.poll_output_action() {
        actions.push(act);
    }

    assert!(actions.len() >= 2);
    let has_state_change = actions
        .iter()
        .any(|a| matches!(a, OutputAction::StateChange(EngineState::Connecting)));
    let has_net_send = actions
        .iter()
        .any(|a| matches!(a, OutputAction::SendToNetwork(_)));
    assert!(has_state_change);
    assert!(has_net_send);
}
