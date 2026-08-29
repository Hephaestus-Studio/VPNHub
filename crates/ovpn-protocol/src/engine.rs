//! Pure No-I/O deterministic state machine protocol engine for OpenVPN 3.

use crate::auth::{AuthChallenge, AuthHandler};
use crate::error::ProtocolError;
use crate::frame::{ControlPacket, DataPacket};
use crate::key_slots::KeySlotManager;
use crate::mssfix::clamp_tcp_mss;
use crate::opcode::Opcode;
use crate::reliable::{ReliableRecvQueue, ReliableSendQueue};
use crate::tls::TlsStreamAdapter;
use bytes::BytesMut;
use ovpn_config::network_config::NetworkProvisioningConfig;
use ovpn_config::{parse_push_reply, KeyDirection, OpenVpnConfig};
use ovpn_crypto::{
    AuthDigest, CipherSuite, DirectionalKey, SessionKeySet, StaticKey, TlsAuthContext,
};

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::time::{Duration, Instant};
use tracing::{debug, error, info, trace, warn};

/// High-level protocol state of the OpenVPN engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum EngineState {
    #[default]
    Disconnected,
    Connecting,
    TlsHandshake,
    Authenticating,
    PullingConfig,
    Connected,
    Rekeying,
    Disconnecting,
    Error,
}

/// Action to be performed by the outer pipeline loop.
#[derive(Debug, Clone, PartialEq)]
pub enum OutputAction {
    SendToNetwork(BytesMut),
    SendToTun(BytesMut),
    ConfigureNetwork(NetworkProvisioningConfig),
    RequestAuthChallenge(AuthChallenge),
    StateChange(EngineState),
    CloseSession(String),
}

/// OpenVPN Data Channel Keepalive ping magic sequence.
pub const KEEPALIVE_MAGIC: [u8; 16] = [
    0x2a, 0x18, 0x7b, 0xf3, 0x64, 0x1e, 0xb4, 0xcb, 0x07, 0xed, 0x2d, 0x0a, 0x98, 0x1f, 0xc7, 0x48,
];

/// OpenVPN Data Channel Explicit Exit Notify magic sequence.
pub const EXPLICIT_EXIT_NOTIFY_MAGIC: [u8; 16] = [
    0x28, 0x7f, 0x34, 0x6b, 0xd4, 0xef, 0x7a, 0x81, 0x2d, 0x56, 0xb8, 0xd3, 0xaf, 0xc5, 0x45, 0x9c,
];

/// Pure deterministic OpenVPN protocol engine.
pub struct ProtocolEngine {
    config: OpenVpnConfig,
    state: EngineState,
    local_session_id: u64,
    remote_session_id: Option<u64>,
    #[allow(dead_code)]
    client_random: [u8; 32],
    peer_id: Option<u32>,

    send_queue: ReliableSendQueue,
    recv_queue: ReliableRecvQueue,
    tls_adapter: Option<TlsStreamAdapter>,
    tls_auth: Option<TlsAuthContext>,
    key_manager: KeySlotManager,
    outbox: VecDeque<OutputAction>,
    last_ping_sent: Instant,
    last_packet_recv: Instant,
    cipher_suite: CipherSuite,
    mss_fix: Option<u16>,
    pushed_options_accumulator: String,
    auth_token: Option<String>,
}

impl ProtocolEngine {
    /// Creates and initializes a new protocol engine for the given configuration.
    pub fn new(config: OpenVpnConfig, now: Instant) -> Result<Self, ProtocolError> {
        let mut rng = rand::thread_rng();
        let local_session_id = rand::Rng::gen::<u64>(&mut rng);
        let mut client_random = [0u8; 32];
        rand::RngCore::fill_bytes(&mut rng, &mut client_random);

        let cipher_suite = config
            .data_ciphers
            .first()
            .and_then(|name| CipherSuite::from_name(name))
            .unwrap_or(CipherSuite::Aes256Gcm);

        let mss_fix = config.mss_fix;

        let tls_auth = if let Some(ref ta_cfg) = config.tls_auth {
            match StaticKey::parse(ta_cfg.key.as_str()) {
                Ok(static_key) => {
                    let is_client = match ta_cfg.direction.or(config.key_direction) {
                        Some(KeyDirection::Client) => true,
                        Some(KeyDirection::Server) => false,
                        _ => true,
                    };
                    let bidirectional = ta_cfg.direction.or(config.key_direction).is_none()
                        || ta_cfg.direction.or(config.key_direction)
                            == Some(KeyDirection::Bidirectional);
                    let digest = match config.auth_digest.as_deref() {
                        Some(d)
                            if d.eq_ignore_ascii_case("SHA256")
                                || d.eq_ignore_ascii_case("SHA-256") =>
                        {
                            AuthDigest::Sha256
                        }
                        Some(d)
                            if d.eq_ignore_ascii_case("SHA1")
                                || d.eq_ignore_ascii_case("SHA-1") =>
                        {
                            AuthDigest::Sha1
                        }
                        _ => AuthDigest::Sha1,
                    };
                    info!(
                        target: "ovpn::protocol",
                        "tls-auth configured: is_client={}, bidirectional={}, digest={:?}",
                        is_client,
                        bidirectional,
                        digest
                    );
                    Some(TlsAuthContext::new(
                        &static_key,
                        is_client,
                        bidirectional,
                        digest,
                    ))
                }
                Err(e) => {
                    warn!(target: "ovpn::protocol", "Failed to parse tls-auth key: {e}");
                    None
                }
            }
        } else {
            info!(target: "ovpn::protocol", "No tls-auth configured");
            None
        };

        info!(
            target: "ovpn::protocol",
            "ProtocolEngine initialized: session_id={:016x}, cipher={:?}, has_tls_auth={}, has_ca={}, has_cert={}",
            local_session_id,
            cipher_suite,
            tls_auth.is_some(),
            config.ca.is_some(),
            config.cert.is_some()
        );

        Ok(Self {
            config,
            state: EngineState::Disconnected,
            local_session_id,
            remote_session_id: None,
            client_random,
            peer_id: None,
            send_queue: ReliableSendQueue::new(local_session_id, 16),
            recv_queue: ReliableRecvQueue::new(),
            tls_adapter: None,
            tls_auth,
            key_manager: KeySlotManager::new(cipher_suite),
            outbox: VecDeque::new(),
            last_ping_sent: now,
            last_packet_recv: now,
            cipher_suite,
            mss_fix,
            pushed_options_accumulator: String::new(),
            auth_token: None,
        })
    }

    fn emit_control_packet(&mut self, cp: &ControlPacket) {
        if let Some(ref ta) = self.tls_auth {
            let header_byte = crate::opcode::encode_header_byte(cp.opcode, cp.key_id);
            let mut body = BytesMut::new();
            cp.encode_body(&mut body);
            let wrapped = ta.wrap_packet(header_byte, cp.session_id, &body);
            debug!(
                target: "ovpn::protocol",
                "emit_control_packet (tls-auth wrapped): opcode={:?}, key_id={}, session_id={:016x}, raw_body_len={}, wrapped_total_len={}, hex={}",
                cp.opcode,
                cp.key_id,
                cp.session_id,
                body.len(),
                wrapped.len(),
                hex::encode(&wrapped)
            );

            self.outbox.push_back(OutputAction::SendToNetwork(wrapped));
        } else {
            let mut pkt_buf = BytesMut::new();
            cp.encode(&mut pkt_buf);
            debug!(
                target: "ovpn::protocol",
                "emit_control_packet (plain): opcode={:?}, key_id={}, session_id={:016x}, total_len={}",
                cp.opcode,
                cp.key_id,
                cp.session_id,
                pkt_buf.len()
            );
            self.outbox.push_back(OutputAction::SendToNetwork(pkt_buf));
        }
    }

    /// Starts the connection handshake sequence by queuing the Hard Reset packet.
    pub fn start_connect(&mut self, now: Instant) -> Result<(), ProtocolError> {
        self.transition_state(EngineState::Connecting);
        info!(
            target: "ovpn::protocol",
            "start_connect: local_session_id={:016x}, sending ControlHardResetClientV2",
            self.local_session_id
        );

        // Queue Control Hard Reset Client V2 (standard OpenVPN reset packet has 0-length payload)
        let pid = self.send_queue.enqueue(
            Opcode::ControlHardResetClientV2,
            0,
            bytes::Bytes::new(),
            now,
        )?;

        let cp = ControlPacket {
            opcode: Opcode::ControlHardResetClientV2,
            key_id: 0,
            session_id: self.local_session_id,
            ack_array: Vec::new(),
            remote_session_id: None,
            packet_id: Some(pid),
            payload: bytes::Bytes::new(),
        };
        self.emit_control_packet(&cp);

        // Initialize TLS adapter
        let server_host = self
            .config
            .remotes
            .first()
            .map(|r| r.host.as_str())
            .unwrap_or("vpn.example.com");

        debug!(target: "ovpn::protocol", "Initializing TLS stream adapter for host '{server_host}'");
        let tls = TlsStreamAdapter::new(
            server_host,
            self.config.ca.as_deref(),
            self.config.cert.as_deref(),
            self.config.key.as_ref().map(|s| s.as_str()),
        )?;

        self.tls_adapter = Some(tls);
        Ok(())
    }

    /// Current engine state.
    pub fn state(&self) -> EngineState {
        self.state
    }

    /// Transitions the engine state and queues a state notification.
    fn transition_state(&mut self, new_state: EngineState) {
        if self.state != new_state {
            info!(target: "ovpn::protocol", "EngineState transition: {:?} -> {:?}", self.state, new_state);
            self.state = new_state;
            self.outbox.push_back(OutputAction::StateChange(new_state));
        }
    }

    /// Processes an incoming raw packet received from the network socket.
    pub fn process_network_packet(
        &mut self,
        now: Instant,
        packet: &[u8],
    ) -> Result<(), ProtocolError> {
        self.last_packet_recv = now;
        if packet.is_empty() {
            return Ok(());
        }

        let header_byte = packet[0];
        let (opcode, key_id) = crate::opcode::parse_header_byte(header_byte)?;
        trace!(
            target: "ovpn::protocol",
            "process_network_packet: len={}, opcode={:?}, key_id={}, header_hex=0x{:02x}",
            packet.len(),
            opcode,
            key_id,
            header_byte
        );

        if opcode.is_data() {
            self.process_incoming_data_packet(opcode, key_id, packet)
        } else {
            self.process_incoming_control_packet(now, packet)
        }
    }

    fn process_incoming_data_packet(
        &mut self,
        _opcode: Opcode,
        key_id: u8,
        packet: &[u8],
    ) -> Result<(), ProtocolError> {
        let (_op, _kid, _peer_id_opt, packet_id, payload_with_tag) = DataPacket::decode(packet)?;

        let slot = self.key_manager.get_rx_slot(key_id).ok_or_else(|| {
            ProtocolError::InvalidFraming(format!("No key slot for key_id {key_id}"))
        })?;

        // Anti-replay check
        slot.anti_replay
            .check_and_update(packet_id as u64)
            .map_err(ProtocolError::Crypto)?;

        if payload_with_tag.len() < 16 {
            return Err(ProtocolError::InvalidFraming(
                "Data packet payload too short for AEAD tag".to_string(),
            ));
        }

        // OpenVPN AEAD layout: [ Header (4/8B) ] [ Tag (16B) ] [ Ciphertext ]
        let mut nonce = [0u8; 12];
        nonce[0..4].copy_from_slice(&packet_id.to_be_bytes());
        nonce[4..12].copy_from_slice(&slot.rx_implicit_iv);

        let header_len = packet.len() - payload_with_tag.len();
        let aad = &packet[..header_len];

        let mut tag = [0u8; 16];
        tag.copy_from_slice(&payload_with_tag[..16]);
        let mut ciphertext_buf = BytesMut::from(&payload_with_tag[16..]);

        slot.rx_cipher
            .decrypt_in_place(&nonce, aad, &mut ciphertext_buf, &tag)
            .map_err(ProtocolError::Crypto)?;

        slot.bytes_received += ciphertext_buf.len() as u64;

        // Check for OpenVPN Data Channel Keepalive ping message
        if ciphertext_buf.len() >= 16 && &ciphertext_buf[..16] == &KEEPALIVE_MAGIC {
            debug!(target: "ovpn::protocol", "Received OpenVPN keepalive ping packet from server, discarded from TUN");
            return Ok(());
        }

        if ciphertext_buf.len() >= 16 && &ciphertext_buf[..16] == &EXPLICIT_EXIT_NOTIFY_MAGIC {
            info!(target: "ovpn::protocol", "Received explicit exit notify from server");
            return Ok(());
        }

        // Validate that packet is at least minimum IP header (IPv4 min 20B, IPv6 min 40B)
        if ciphertext_buf.len() < 20 {
            debug!(target: "ovpn::protocol", "Ignoring runt/non-IP packet on data channel (len={})", ciphertext_buf.len());
            return Ok(());
        }

        let ip_version = ciphertext_buf[0] >> 4;
        if ip_version != 4 && ip_version != 6 {
            debug!(target: "ovpn::protocol", "Ignoring non-IP frame (version={ip_version}, len={})", ciphertext_buf.len());
            return Ok(());
        }

        // Deliver decrypted valid IP packet to TUN
        self.outbox
            .push_back(OutputAction::SendToTun(ciphertext_buf));
        Ok(())
    }

    fn process_incoming_control_packet(
        &mut self,
        now: Instant,
        packet: &[u8],
    ) -> Result<(), ProtocolError> {
        let cp = if let Some(ref ta) = self.tls_auth {
            let (header_byte, session_id, pid, ts, body) = match ta.unwrap_packet(packet) {
                Ok(res) => res,
                Err(e) => {
                    error!(target: "ovpn::protocol", "tls-auth HMAC verification failed for incoming packet: {e}");
                    return Err(ProtocolError::Crypto(e));
                }
            };
            let (opcode, key_id) = crate::opcode::parse_header_byte(header_byte)?;
            debug!(
                target: "ovpn::protocol",
                "process_incoming_control_packet (tls-auth verified): opcode={:?}, key_id={}, session_id={:016x}, auth_pid={}, auth_ts={}, body_len={}",
                opcode,
                key_id,
                session_id,
                pid,
                ts,
                body.len()
            );
            ControlPacket::decode_body(opcode, key_id, session_id, body)?
        } else {
            ControlPacket::decode(packet)?
        };

        info!(
            target: "ovpn::protocol",
            "Received control packet: opcode={:?}, key_id={}, session_id={:016x}, remote_session_id={:?}, packet_id={:?}, acks={:?}, payload_len={}",
            cp.opcode,
            cp.key_id,
            cp.session_id,
            cp.remote_session_id,
            cp.packet_id,
            cp.ack_array,
            cp.payload.len()
        );

        if self.remote_session_id.is_none() {
            info!(target: "ovpn::protocol", "Discovered server remote_session_id={:016x}", cp.session_id);
            self.remote_session_id = Some(cp.session_id);
            self.send_queue.remote_session_id = Some(cp.session_id);
        }

        self.send_queue.process_acks(&cp.ack_array);

        if let Some(packet_id) = cp.packet_id {
            self.recv_queue.process_packet(packet_id, cp.payload)?;
        }

        self.flush_control_channel(now)?;
        Ok(())
    }

    /// Processes an outgoing IP frame read from the TUN device.
    pub fn process_tun_packet(
        &mut self,
        _now: Instant,
        packet: &[u8],
    ) -> Result<(), ProtocolError> {
        if self.state != EngineState::Connected && self.state != EngineState::Rekeying {
            return Ok(());
        }

        let mut pkt_buf = BytesMut::from(packet);

        // Apply TCP MSS clamping if configured
        if let Some(max_mss) = self.mss_fix {
            clamp_tcp_mss(&mut pkt_buf, max_mss);
        }

        let peer_id = self.peer_id;
        let opcode = if peer_id.is_some() {
            Opcode::DataV2
        } else {
            Opcode::DataV1
        };

        let slot = self
            .key_manager
            .get_tx_slot()
            .ok_or_else(|| ProtocolError::InvalidFraming("No active TX key slot".to_string()))?;

        let packet_id = slot.next_tx_packet_id();
        let mut nonce = [0u8; 12];
        nonce[0..4].copy_from_slice(&packet_id.to_be_bytes());
        nonce[4..12].copy_from_slice(&slot.tx_implicit_iv);

        // 1. Header (AAD): [ Opcode (1B) ] [ Peer-ID (3B) if V2 ] [ Packet ID (4B) ]
        let mut header = BytesMut::with_capacity(8);
        DataPacket::encode_header(opcode, slot.key_id, peer_id, packet_id, &mut header);

        // 2. Encrypt plaintext IP payload in-place
        let tag = slot
            .tx_cipher
            .encrypt_in_place(&nonce, header.as_ref(), &mut pkt_buf)
            .map_err(ProtocolError::Crypto)?;

        // 3. OpenVPN AEAD wire layout: [ Header (4/8B) ] [ Tag (16B) ] [ Ciphertext ]
        let mut out_frame = BytesMut::with_capacity(header.len() + 16 + pkt_buf.len());
        out_frame.extend_from_slice(&header);
        out_frame.extend_from_slice(&tag);
        out_frame.extend_from_slice(&pkt_buf);

        slot.bytes_sent += pkt_buf.len() as u64;

        self.outbox
            .push_back(OutputAction::SendToNetwork(out_frame));
        Ok(())
    }

    /// Encrypts and emits an OpenVPN data channel keepalive ping packet to the network outbox.
    pub fn send_keepalive_ping(&mut self, now: Instant) -> Result<(), ProtocolError> {
        if self.state != EngineState::Connected && self.state != EngineState::Rekeying {
            return Ok(());
        }

        let slot = match self.key_manager.get_tx_slot() {
            Some(s) => s,
            None => return Ok(()),
        };

        let peer_id = self.peer_id;
        let opcode = if peer_id.is_some() {
            Opcode::DataV2
        } else {
            Opcode::DataV1
        };

        let packet_id = slot.next_tx_packet_id();
        let mut nonce = [0u8; 12];
        nonce[0..4].copy_from_slice(&packet_id.to_be_bytes());
        nonce[4..12].copy_from_slice(&slot.tx_implicit_iv);

        // 1. Header (AAD): [ Opcode (1B) ] [ Peer-ID (3B) if V2 ] [ Packet ID (4B) ]
        let mut header = BytesMut::with_capacity(8);
        DataPacket::encode_header(opcode, slot.key_id, peer_id, packet_id, &mut header);

        // 2. Encrypt plaintext KEEPALIVE_MAGIC in-place
        let mut ping_buf = BytesMut::from(&KEEPALIVE_MAGIC[..]);
        let tag = slot
            .tx_cipher
            .encrypt_in_place(&nonce, header.as_ref(), &mut ping_buf)
            .map_err(ProtocolError::Crypto)?;

        // 3. OpenVPN AEAD wire layout: [ Header (4/8B) ] [ Tag (16B) ] [ Ciphertext ]
        let mut out_frame = BytesMut::with_capacity(header.len() + 16 + ping_buf.len());
        out_frame.extend_from_slice(&header);
        out_frame.extend_from_slice(&tag);
        out_frame.extend_from_slice(&ping_buf);

        slot.bytes_sent += ping_buf.len() as u64;
        self.last_ping_sent = now;

        debug!(
            target: "ovpn::protocol",
            "Emitted Data Channel keepalive ping (packet_id={}, key_id={}, total_len={})",
            packet_id,
            slot.key_id,
            out_frame.len()
        );

        self.outbox
            .push_back(OutputAction::SendToNetwork(out_frame));
        Ok(())
    }

    /// Advances control channel state, TLS processing, and emits outgoing packets.
    fn flush_control_channel(&mut self, now: Instant) -> Result<(), ProtocolError> {
        let ready_chunks = self.recv_queue.drain_ready();
        let mut outgoing_tls_bytes = Vec::new();
        let mut app_data_bytes = Vec::new();
        let mut handshake_just_completed = false;

        if let Some(ref mut tls) = self.tls_adapter {
            for chunk in ready_chunks {
                debug!(target: "ovpn::protocol", "Feeding {} raw TLS bytes to TLS adapter", chunk.len());
                tls.feed_tls_bytes(&chunk)?;
            }

            outgoing_tls_bytes = tls.extract_outgoing_tls_bytes()?;
            if !outgoing_tls_bytes.is_empty() {
                debug!(target: "ovpn::protocol", "Extracted {} outgoing TLS bytes from TLS adapter", outgoing_tls_bytes.len());
            }

            if !tls.is_handshaking() && self.state == EngineState::Connecting {
                info!(target: "ovpn::protocol", "TLS handshake completed");
                handshake_just_completed = true;
            }

            app_data_bytes = tls.read_plaintext_app_data()?;
            if !app_data_bytes.is_empty() {
                debug!(target: "ovpn::protocol", "Read {} decrypted plaintext app bytes from TLS stream", app_data_bytes.len());
            }
        }

        if !outgoing_tls_bytes.is_empty() {
            let pid = self.send_queue.enqueue(
                Opcode::ControlV1,
                0,
                bytes::Bytes::copy_from_slice(&outgoing_tls_bytes),
                now,
            )?;

            let acks = self.recv_queue.drain_acks();
            let cp = ControlPacket {
                opcode: Opcode::ControlV1,
                key_id: 0,
                session_id: self.local_session_id,
                ack_array: acks,
                remote_session_id: self.remote_session_id,
                packet_id: Some(pid),
                payload: bytes::Bytes::copy_from_slice(&outgoing_tls_bytes),
            };
            self.emit_control_packet(&cp);
        }

        if handshake_just_completed {
            self.transition_state(EngineState::TlsHandshake);
            self.handle_tls_handshake_completion(now)?;
        }

        if !app_data_bytes.is_empty() {
            let msg = String::from_utf8_lossy(&app_data_bytes);
            self.handle_app_message(&msg)?;
        }

        // If pending ACKs remain without payload, send standalone P_ACK_V1
        let acks = self.recv_queue.drain_acks();
        if !acks.is_empty() {
            debug!(target: "ovpn::protocol", "Sending standalone ACK packet for packet IDs: {:?}", acks);
            let cp = ControlPacket {
                opcode: Opcode::AckV1,
                key_id: 0,
                session_id: self.local_session_id,
                ack_array: acks,
                remote_session_id: self.remote_session_id,
                packet_id: None,
                payload: bytes::Bytes::new(),
            };
            self.emit_control_packet(&cp);
        }

        Ok(())
    }

    fn handle_tls_handshake_completion(&mut self, now: Instant) -> Result<(), ProtocolError> {
        info!(target: "ovpn::protocol", "Exporting TLS master keying material (RFC 5705)");
        let mut key_material = [0u8; 256];
        if let Some(ref tls) = self.tls_adapter {
            tls.export_keying_material(b"EXPORTER-OpenVPN-datakeys", None, &mut key_material)?;
        }

        let cipher_key_len = self.cipher_suite.key_size();
        let session_keys = SessionKeySet {
            key_id: 0,
            tx_key: DirectionalKey {
                cipher_key: key_material[0..cipher_key_len].to_vec(),
                hmac_key: key_material[64..128].to_vec(),
            },
            rx_key: DirectionalKey {
                cipher_key: key_material[128..128 + cipher_key_len].to_vec(),
                hmac_key: key_material[192..256].to_vec(),
            },
        };

        self.key_manager.install_new_key(&session_keys, now)?;
        info!(target: "ovpn::protocol", "Data channel session keys successfully installed into KeySlotManager");

        let auth_creds = if let Some(ref token) = self.auth_token {
            let username = self
                .config
                .auth_user_pass
                .as_ref()
                .and_then(|auth| auth.username.clone())
                .unwrap_or_else(|| "auth-token-user".to_string());
            info!(
                target: "ovpn::protocol",
                "Using dynamic server-pushed auth-token for re-authentication as user '{}'",
                username
            );
            Some((username, token.clone()))
        } else {
            self.config.auth_user_pass.as_ref().and_then(|auth| {
                match (&auth.username, &auth.password) {
                    (Some(u), Some(p)) => Some((u.clone(), p.as_str().to_string())),
                    _ => None,
                }
            })
        };

        if let Some((u, p)) = auth_creds {
            info!(target: "ovpn::protocol", "Sending credentials for user '{}'", u);
            self.transition_state(EngineState::Authenticating);
            let creds = AuthHandler::encode_credentials(&u, &p);
            if let Some(ref mut tls) = self.tls_adapter {
                tls.send_plaintext_app_data(&creds)?;
            }
            self.flush_control_channel(now)?;
            return Ok(());
        }

        // Send PUSH_REQUEST
        info!(target: "ovpn::protocol", "Sending PUSH_REQUEST over control channel");
        self.transition_state(EngineState::PullingConfig);
        if let Some(ref mut tls) = self.tls_adapter {
            tls.send_plaintext_app_data(b"PUSH_REQUEST\0")?;
        }
        self.flush_control_channel(now)?;
        Ok(())
    }

    fn handle_app_message(&mut self, message: &str) -> Result<(), ProtocolError> {
        info!(target: "ovpn::protocol", "Received plaintext app message from server:\n{}", message.trim());
        if message.contains("PUSH_REPLY") {
            for part in message.split("PUSH_REPLY") {
                let trimmed = part.trim().trim_matches(',').trim();
                if !trimmed.is_empty() {
                    if !self.pushed_options_accumulator.is_empty() {
                        self.pushed_options_accumulator.push(',');
                    }
                    self.pushed_options_accumulator.push_str(trimmed);
                }
            }

            if message.contains("push-continuation 2") {
                info!(
                    target: "ovpn::protocol",
                    "Accumulated partial PUSH_REPLY fragment (total len={}), waiting for continuation...",
                    self.pushed_options_accumulator.len()
                );
                return Ok(());
            }

            let full_push_reply = format!("PUSH_REPLY,{}", self.pushed_options_accumulator);
            info!(
                target: "ovpn::protocol",
                "Final PUSH_REPLY fragment received. Parsing full aggregated config (len={})",
                full_push_reply.len()
            );

            let push_opts = parse_push_reply(&full_push_reply).map_err(ProtocolError::Config)?;
            if let Some(pid) = push_opts.peer_id {
                info!(target: "ovpn::protocol", "Received server assigned peer-id={pid}");
                self.peer_id = Some(pid);
            }
            if let Some(ping) = push_opts.ping_interval {
                info!(target: "ovpn::protocol", "Server pushed ping_interval: {:?}", ping);
                self.config.ping_interval = Some(ping);
            }
            if let Some(restart) = push_opts.ping_restart {
                info!(target: "ovpn::protocol", "Server pushed ping_restart: {:?}", restart);
                self.config.ping_restart = Some(restart);
            }
            if let Some(ref token) = push_opts.auth_token {
                info!(target: "ovpn::protocol", "Server pushed dynamic auth-token (len={})", token.as_str().len());
                self.auth_token = Some(token.as_str().to_string());
            }

            let prov_config = push_opts.build_provisioning_config(&self.config);
            info!(target: "ovpn::protocol", "Parsed network provisioning config: ip={:?}, netmask={:?}, gw={:?}, dns={:?}, routes={}", 
                prov_config.ipv4_address, prov_config.ipv4_netmask, prov_config.ipv4_gateway, prov_config.dns_servers, prov_config.routes_v4.len());
            self.transition_state(EngineState::Connected);
            self.outbox
                .push_back(OutputAction::ConfigureNetwork(prov_config));
            return Ok(());
        }

        if let Some(challenge) = AuthHandler::parse_challenge(message) {
            info!(target: "ovpn::protocol", "Received auth challenge: {:?}", challenge);
            self.transition_state(EngineState::Authenticating);
            self.outbox
                .push_back(OutputAction::RequestAuthChallenge(challenge));
            return Ok(());
        }

        if message.contains("AUTH_FAILED") {
            error!(target: "ovpn::protocol", "Authentication failed: {}", message.trim());
            self.transition_state(EngineState::Error);
            self.outbox
                .push_back(OutputAction::CloseSession(message.to_string()));
            return Err(ProtocolError::AuthenticationFailed(message.to_string()));
        }

        Ok(())
    }

    /// Submits challenge response for dynamic CRV1 / OTP.
    pub fn submit_challenge_response(
        &mut self,
        now: Instant,
        state_id: &str,
        response: &str,
    ) -> Result<(), ProtocolError> {
        let resp = AuthHandler::encode_crv1_response(state_id, response);
        if let Some(ref mut tls) = self.tls_adapter {
            tls.send_plaintext_app_data(&resp)?;
        }
        self.flush_control_channel(now)
    }

    /// Periodic timeout driver handling retransmissions, keepalive pings, and inactivity timeouts.
    pub fn handle_timeout(&mut self, now: Instant) -> Result<(), ProtocolError> {
        let resends = self.send_queue.poll_retransmissions(now)?;
        for mut cp in resends {
            cp.ack_array = self.recv_queue.drain_acks();
            self.emit_control_packet(&cp);
        }

        if self.state == EngineState::Connected {
            // 1. Send keepalive ping if interval elapsed
            let ping_interval = self.config.ping_interval.unwrap_or(Duration::from_secs(10));
            if now.duration_since(self.last_ping_sent) >= ping_interval {
                self.send_keepalive_ping(now)?;
            }

            // 2. Check for inactivity timeout (ping-restart)
            let ping_restart = self.config.ping_restart.unwrap_or(Duration::from_secs(120));
            if now.duration_since(self.last_packet_recv) >= ping_restart {
                let err_msg = format!(
                    "Inactivity timeout: no packets received from server in {}s (ping-restart)",
                    ping_restart.as_secs()
                );
                error!(target: "ovpn::protocol", "{}", err_msg);
                self.transition_state(EngineState::Error);
                self.outbox.push_back(OutputAction::CloseSession(err_msg));
                return Err(ProtocolError::HandshakeTimeout(ping_restart));
            }
        }

        Ok(())
    }

    /// Polls the next queued output action.
    pub fn poll_output_action(&mut self) -> Option<OutputAction> {
        self.outbox.pop_front()
    }

    /// Determines the nearest deadline when `handle_timeout` should be invoked.
    pub fn poll_timeout(&self, _now: Instant) -> Option<Instant> {
        self.send_queue.nearest_deadline()
    }
}
