use bytes::BytesMut;
use ovpn_crypto::{
    decrypt_packet_with_tag, derive_data_channel_keys, derive_tls_crypt_keys,
    derive_tls_crypt_v2_keys, encrypt_packet_with_tag, hkdf_sha256, hkdf_sha512,
    hybrid_encapsulate, openvpn_prf_sha256, Aes128GcmCipher, Aes256GcmCipher, AntiReplayWindow,
    ChaCha20Poly1305Cipher, CipherSuite, CryptoError, HybridKemKeyPair, Key, SecretBox, SymmCipher,
};

#[test]
fn test_aes256_gcm_in_place_encryption_and_decryption() {
    let key = [0x42u8; 32];
    let nonce = [0x11u8; 12];
    let aad = b"openvpn data channel packet header";
    let original_payload = b"Hello, secure OpenVPN 3 wire protocol in Rust!";

    let cipher = Aes256GcmCipher::new(&key).expect("Failed to initialize AES-256-GCM");
    assert_eq!(cipher.key_size(), 32);
    assert_eq!(cipher.nonce_size(), 12);
    assert_eq!(cipher.tag_size(), 16);

    let mut buffer = original_payload.to_vec();
    let tag = cipher
        .encrypt_in_place(&nonce, aad, &mut buffer)
        .expect("Encryption failed");

    // Ciphertext must differ from plaintext
    assert_ne!(&buffer, original_payload);

    // Decrypt in place
    cipher
        .decrypt_in_place(&nonce, aad, &mut buffer, &tag)
        .expect("Decryption failed");
    assert_eq!(&buffer, original_payload);

    // Tampering test: modified ciphertext must fail
    buffer[0] ^= 0xFF;
    let res = cipher.decrypt_in_place(&nonce, aad, &mut buffer, &tag);
    assert!(matches!(res, Err(CryptoError::AeadAuthenticationFailed)));

    // Tampering test: modified AAD must fail
    buffer[0] ^= 0xFF; // restore payload
    let tampered_aad = b"tampered aad header";
    let res_aad = cipher.decrypt_in_place(&nonce, tampered_aad, &mut buffer, &tag);
    assert!(matches!(
        res_aad,
        Err(CryptoError::AeadAuthenticationFailed)
    ));
}

#[test]
fn test_aes128_gcm_and_chacha20_ciphers() {
    let key16 = [0x55u8; 16];
    let key32 = [0x77u8; 32];
    let nonce = [0x22u8; 12];
    let aad = b"packet aad";
    let plaintext = b"Zero-copy in-place payload for AEAD verification";

    // AES-128-GCM
    let aes128 = Aes128GcmCipher::new(&key16).unwrap();
    let mut buf128 = plaintext.to_vec();
    let tag128 = aes128.encrypt_in_place(&nonce, aad, &mut buf128).unwrap();
    aes128
        .decrypt_in_place(&nonce, aad, &mut buf128, &tag128)
        .unwrap();
    assert_eq!(&buf128, plaintext);

    // ChaCha20-Poly1305
    let chacha = ChaCha20Poly1305Cipher::new(&key32).unwrap();
    let mut buf_chacha = plaintext.to_vec();
    let tag_chacha = chacha
        .encrypt_in_place(&nonce, aad, &mut buf_chacha)
        .unwrap();
    chacha
        .decrypt_in_place(&nonce, aad, &mut buf_chacha, &tag_chacha)
        .unwrap();
    assert_eq!(&buf_chacha, plaintext);
}

#[test]
fn test_zero_copy_bytes_mut_packet_helpers() {
    let suite = CipherSuite::from_name("AES-256-GCM").unwrap();
    let key = [0x88u8; 32];
    let cipher = suite.create_cipher(&key).unwrap();

    let nonce = [0x33u8; 12];
    let aad = b"packet header aad";
    let original = b"Testing BytesMut zero-copy framing helper functions";

    let mut packet = BytesMut::from(&original[..]);
    encrypt_packet_with_tag(cipher.as_ref(), &nonce, aad, &mut packet).unwrap();
    assert_eq!(packet.len(), original.len() + 16);

    decrypt_packet_with_tag(cipher.as_ref(), &nonce, aad, &mut packet).unwrap();
    assert_eq!(&packet[..], original);
}

#[test]
fn test_hkdf_rfc5869_vectors() {
    let ikm = hex::decode("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b").unwrap();
    let salt = hex::decode("000102030405060708090a0b0c").unwrap();
    let info = hex::decode("f0f1f2f3f4f5f6f7f8f9").unwrap();

    let mut okm = [0u8; 42];
    hkdf_sha256(Some(&salt), &ikm, &info, &mut okm).unwrap();

    let expected_okm = hex::decode(
        "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865",
    )
    .unwrap();
    assert_eq!(&okm[..], &expected_okm[..]);

    // HKDF SHA-512 test
    let mut okm512 = [0u8; 64];
    hkdf_sha512(Some(&salt), &ikm, &info, &mut okm512).unwrap();
    assert_ne!(okm512, [0u8; 64]);
}

#[test]
fn test_openvpn_prf_and_data_channel_key_derivation() {
    let master_secret = [0x99u8; 48];
    let client_random = [0xAAu8; 32];
    let server_random = [0xBBu8; 32];

    let mut prf_output = [0u8; 64];
    openvpn_prf_sha256(
        &master_secret,
        b"OpenVPN master secret",
        &client_random,
        &mut prf_output,
    )
    .unwrap();
    assert_ne!(prf_output, [0u8; 64]);

    // Test data channel session keys derivation
    let session_keys = derive_data_channel_keys(
        1, // Key ID 1
        &master_secret,
        &client_random,
        &server_random,
        32, // 32 bytes cipher key (AES-256)
        32, // 32 bytes HMAC key (SHA256)
    )
    .unwrap();

    assert_eq!(session_keys.key_id, 1);
    assert_eq!(session_keys.tx_key.cipher_key.len(), 32);
    assert_eq!(session_keys.tx_key.hmac_key.len(), 32);
    assert_eq!(session_keys.rx_key.cipher_key.len(), 32);
    assert_eq!(session_keys.rx_key.hmac_key.len(), 32);
    assert_ne!(
        session_keys.tx_key.cipher_key,
        session_keys.rx_key.cipher_key
    );
}

#[test]
fn test_tls_crypt_and_tls_crypt_v2_derivation() {
    let psk = [0x12u8; 256];
    let session_id = [0x34u8; 8];
    let random = [0x56u8; 32];

    let (tx_crypt, rx_crypt) = derive_tls_crypt_keys(&psk, &session_id, &random).unwrap();
    assert_eq!(tx_crypt.cipher_key.len(), 32);
    assert_eq!(tx_crypt.hmac_key.len(), 32);
    assert_eq!(rx_crypt.cipher_key.len(), 32);
    assert_eq!(rx_crypt.hmac_key.len(), 32);
    assert_ne!(tx_crypt.cipher_key, rx_crypt.cipher_key);

    // TLS-Crypt v2
    let client_key = [0x78u8; 64];
    let (tx_v2, rx_v2) = derive_tls_crypt_v2_keys(&client_key, &session_id).unwrap();
    assert_eq!(tx_v2.cipher_key.len(), 32);
    assert_eq!(rx_v2.cipher_key.len(), 32);
    assert_ne!(tx_v2.cipher_key, rx_v2.cipher_key);
}

#[test]
fn test_anti_replay_sliding_window() {
    let mut window = AntiReplayWindow::new();
    assert_eq!(window.max_seq(), 0);
    assert_eq!(window.accepted_count(), 0);

    // 1. Initial packet
    window.check_and_update(100).expect("Initial packet failed");
    assert_eq!(window.max_seq(), 100);
    assert_eq!(window.accepted_count(), 1);

    // 2. Reject duplicate
    let dup_res = window.check_and_update(100);
    assert!(matches!(
        dup_res,
        Err(CryptoError::AntiReplayRejection { .. })
    ));
    assert_eq!(window.rejected_count(), 1);

    // 3. Out-of-order arrival within window (e.g. packet 98, 99)
    window
        .check_and_update(98)
        .expect("Out of order within window should succeed");
    window
        .check_and_update(99)
        .expect("Out of order within window should succeed");
    assert_eq!(window.accepted_count(), 3);

    // 4. Reject previously accepted out-of-order packet
    assert!(window.check_and_update(98).is_err());

    // 5. Advance window forward sequentially
    window
        .check_and_update(101)
        .expect("Sequential advance failed");
    window.check_and_update(105).expect("Jump forward failed");
    assert_eq!(window.max_seq(), 105);

    // 6. Packet too old (> 128 packets behind max_seq 105, e.g. packet 105 - 130)
    // 105 is smaller than 130 so let's jump window up to 500
    window.check_and_update(500).expect("Jump to 500 failed");
    assert_eq!(window.max_seq(), 500);

    // Packet 370 is 130 packets behind 500 (diff > 128)
    let stale_res = window.check_and_update(370);
    assert!(matches!(
        stale_res,
        Err(CryptoError::AntiReplayRejection { .. })
    ));

    // Packet 400 is 100 packets behind 500 (diff <= 128), should be accepted
    window
        .check_and_update(400)
        .expect("Valid window offset failed");

    // Reset test
    window.reset();
    assert_eq!(window.max_seq(), 0);
    assert_eq!(window.accepted_count(), 0);
}

#[test]
fn test_post_quantum_hybrid_ml_kem_768_x25519_key_exchange() {
    // 1. Generate Hybrid KEM keypair (Server / Peer B)
    let peer_b_keypair =
        HybridKemKeyPair::generate().expect("Failed to generate Hybrid KEM keypair");

    // 2. Encapsulate shared secret to Peer B's public key (Client / Peer A)
    let (ciphertext, shared_secret_a) =
        hybrid_encapsulate(&peer_b_keypair.public_key).expect("Encapsulation failed");

    assert_eq!(ciphertext.x25519_ephemeral_public.len(), 32);
    assert_ne!(ciphertext.ml_kem_ciphertext.len(), 0);

    // 3. Decapsulate ciphertext with Peer B's private key
    let shared_secret_b = peer_b_keypair
        .decapsulate(&ciphertext)
        .expect("Decapsulation failed");

    // 4. Shared secrets must match exactly
    assert_eq!(shared_secret_a, shared_secret_b);
    assert_ne!(shared_secret_a, [0u8; 32]);

    // 5. Tampered ciphertext must fail decapsulation or produce mismatched secret
    let mut tampered_ct = ciphertext.clone();
    tampered_ct.ml_kem_ciphertext[10] ^= 0xFF;
    let tampered_result = peer_b_keypair.decapsulate(&tampered_ct);
    if let Ok(tampered_ss) = tampered_result {
        assert_ne!(shared_secret_a, tampered_ss);
    }
}

#[test]
fn test_secret_containers_and_zeroization() {
    let raw_key = [0x5Au8; 32];
    let key_container: Key<32> = Key::new(raw_key);
    assert_eq!(key_container.as_slice(), &raw_key);

    let secret_box = SecretBox::new("super_secret_vpn_password".to_string());
    assert_eq!(secret_box.expose_secret(), "super_secret_vpn_password");

    // Format redaction verification
    let debug_str = format!("{:?}", secret_box);
    assert_eq!(debug_str, "[REDACTED SECRET]");
}
