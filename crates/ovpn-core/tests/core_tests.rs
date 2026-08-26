use ovpn_config::{OpenVpnConfig, RemoteEntry};
use ovpn_core::{ClientSession, SessionEvent};
use ovpn_protocol::EngineState;
use ovpn_tun::MockTunDevice;
use tokio::net::UdpSocket;

#[tokio::test]
async fn test_client_session_lifecycle_and_handle_control() {
    // 1. Setup mock remote UDP server
    let server_sock = UdpSocket::bind("127.0.0.1:0").await.unwrap();
    let server_addr = server_sock.local_addr().unwrap();

    let mut config = OpenVpnConfig::default();
    config
        .remotes
        .push(RemoteEntry::new("127.0.0.1", server_addr.port(), None));

    // 2. Setup mock TUN device
    let (tun, _inbound_tx) = MockTunDevice::new("mocktun0", 1500);

    // 3. Spawn ClientSession
    let (handle, mut event_rx) = ClientSession::spawn(config, Box::new(tun));
    assert!(handle.is_running());

    // 4. Verify initial state event
    let first_event = tokio::time::timeout(std::time::Duration::from_secs(2), event_rx.recv())
        .await
        .expect("Timeout waiting for event")
        .expect("Event channel error");

    assert_eq!(
        first_event,
        SessionEvent::StateChanged(EngineState::Connecting)
    );

    // 5. Query stats via handle
    let stats = handle.get_stats().await;
    assert_eq!(stats.packets_in, 0);

    // 6. Test graceful disconnection
    handle.disconnect("User requested stop").await.unwrap();

    let disconnect_event = tokio::time::timeout(std::time::Duration::from_secs(2), event_rx.recv())
        .await
        .expect("Timeout waiting for disconnect event")
        .expect("Event channel error");

    match disconnect_event {
        SessionEvent::Disconnected { reason } => {
            assert_eq!(reason, "User requested stop");
        }
        other => panic!("Expected Disconnected event, got {:?}", other),
    }

    // Wait a brief moment for worker task to terminate
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    assert!(!handle.is_running());
}
