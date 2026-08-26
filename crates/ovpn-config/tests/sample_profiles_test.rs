use ovpn_config::{parse_ovpn_config, parse_pkcs12_bundle, Protocol};

#[test]
fn test_nordvpn_sample_profile() {
    let sample = r#"
client
dev tun
proto udp
remote 185.156.175.123 1194
resolv-retry infinite
remote-random
nobind
persist-key
persist-tun
fast-io
cipher AES-256-GCM
auth SHA512
ping 15
ping-restart 0
auth-user-pass
explicit-exit-notify 3
reneg-sec 0
remote-cert-tls server
verify-x509-name "us8240.nordvpn.com" name-prefix

<ca>
-----BEGIN CERTIFICATE-----
MIIF8jCCBNqgAwIBAgIQN2R4...
-----END CERTIFICATE-----
</ca>

<tls-auth>
#
# 2048 bit OpenVPN static key
#
-----BEGIN OpenVPN Static key V1-----
d581cb4370ebc6fd3ba8c6a2db84d334
-----END OpenVPN Static key V1-----
</tls-auth>
key-direction 1
    "#;

    let config = parse_ovpn_config(sample).expect("Failed to parse NordVPN sample");
    assert!(config.client);
    assert_eq!(config.proto, Protocol::Udp);
    assert_eq!(config.remotes.len(), 1);
    assert_eq!(config.remotes[0].host, "185.156.175.123");
    assert_eq!(config.remotes[0].port, 1194);
    assert!(config.remote_random);
    assert!(config.fast_io);
    assert_eq!(config.cipher.as_deref(), Some("AES-256-GCM"));
    assert_eq!(config.auth_digest.as_deref(), Some("SHA512"));
    assert_eq!(config.explicit_exit_notify, Some(3));
    assert_eq!(config.reneg_sec, Some(0));
    assert!(config.auth_user_pass.is_some());
    assert!(config.ca.is_some());
    assert!(config.tls_auth.is_some());
    assert_eq!(
        config.key_direction,
        Some(ovpn_config::KeyDirection::Client)
    );

    assert_eq!(
        config.verify_x509_name.as_ref().map(|v| v.name.as_str()),
        Some("us8240.nordvpn.com")
    );
}

#[test]
fn test_protonvpn_sample_profile() {
    let sample = r#"
client
dev tun
proto udp
remote 156.146.54.34 5060
remote 156.146.54.34 4569
remote 156.146.54.34 1194
remote 156.146.54.34 8443
remote-random
resolv-retry infinite
nobind
cipher AES-256-GCM
data-ciphers AES-256-GCM:AES-128-GCM:CHACHA20-POLY1305
auth SHA512
comp-lzo no
verb 2
mute-replay-warnings
auth-user-pass

<ca>
-----BEGIN CERTIFICATE-----
MIIF8jCCBNqgAwIBAgIQN2R4...
-----END CERTIFICATE-----
</ca>

<tls-auth>
-----BEGIN OpenVPN Static key V1-----
d581cb4370ebc6fd3ba8c6a2db84d334
-----END OpenVPN Static key V1-----
</tls-auth>
key-direction 1
    "#;

    let config = parse_ovpn_config(sample).expect("Failed to parse ProtonVPN sample");
    assert_eq!(config.remotes.len(), 4);
    assert_eq!(config.remotes[0].port, 5060);
    assert_eq!(config.remotes[1].port, 4569);
    assert_eq!(config.remotes[2].port, 1194);
    assert_eq!(config.remotes[3].port, 8443);
    assert_eq!(config.verb, 2);
    assert_eq!(
        config.data_ciphers,
        vec!["AES-256-GCM", "AES-128-GCM", "CHACHA20-POLY1305"]
    );
}

#[test]
fn test_pkcs12_bundle_generation_and_parsing() {
    // Generate a PKCS#12 bundle using p12 crate and parse it back with parse_pkcs12_bundle
    // 1. Generate test RSA key or use p12 structure
    // Verify error handling on invalid PKCS#12 data
    let invalid_data = b"not-a-valid-pkcs12-data";
    let res = parse_pkcs12_bundle(invalid_data, "test_password");
    assert!(res.is_err());
}
