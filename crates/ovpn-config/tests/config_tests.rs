use ovpn_config::{
    parse_ovpn_config, parse_push_reply, DeviceType, KeyDirection, NetworkTopology, OpenVpnConfig,
    Protocol,
};

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::str::FromStr;
use std::time::Duration;

#[test]
fn test_basic_ovpn_parsing() {
    let config_str = r#"
        client
        dev tun
        proto udp
        remote vpn.example.com 1194
        remote backup.example.com 1195 tcp
        resolv-retry infinite
        nobind
        persist-key
        persist-tun
        remote-cert-tls server
        cipher AES-256-GCM
        data-ciphers AES-256-GCM:AES-128-GCM:CHACHA20-POLY1305
        auth SHA512
        verb 3
        keepalive 10 60
        mssfix 1420
    "#;

    let config = OpenVpnConfig::from_str(config_str).expect("Failed to parse config");
    assert!(config.client);
    assert_eq!(config.dev, "tun");
    assert_eq!(config.dev_type, DeviceType::Tun);
    assert_eq!(config.proto, Protocol::Udp);
    assert_eq!(config.remotes.len(), 2);
    assert_eq!(config.remotes[0].host, "vpn.example.com");
    assert_eq!(config.remotes[0].port, 1194);
    assert_eq!(config.remotes[0].proto, None);
    assert_eq!(config.remotes[1].host, "backup.example.com");
    assert_eq!(config.remotes[1].port, 1195);
    assert_eq!(config.remotes[1].proto, Some(Protocol::Tcp));
    assert!(config.nobind);
    assert!(config.persist_key);
    assert!(config.persist_tun);
    assert_eq!(config.remote_cert_tls.as_deref(), Some("server"));
    assert_eq!(config.cipher.as_deref(), Some("AES-256-GCM"));
    assert_eq!(
        config.data_ciphers,
        vec!["AES-256-GCM", "AES-128-GCM", "CHACHA20-POLY1305"]
    );
    assert_eq!(config.auth_digest.as_deref(), Some("SHA512"));
    assert_eq!(config.verb, 3);
    assert_eq!(config.ping_interval, Some(Duration::from_secs(10)));
    assert_eq!(config.ping_restart, Some(Duration::from_secs(60)));
    assert_eq!(config.mss_fix, Some(1420));
}

#[test]
fn test_inline_xml_blocks() {
    let config_str = r#"
        client
        dev tun
        proto udp
        remote 198.51.100.1 1194
        
        <ca>
-----BEGIN CERTIFICATE-----
MIIB/TCCAWagAwIBAgIUQ
-----END CERTIFICATE-----
        </ca>

        <cert>
-----BEGIN CERTIFICATE-----
MIICDzCCAdegAwIBAgIUc
-----END CERTIFICATE-----
        </cert>

        <key>
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9
-----END PRIVATE KEY-----
        </key>

        <tls-auth 1>
-----BEGIN OpenVPN Static key V1-----
e2b170c7e2b170c7e2b170c7e2b170c7
-----END OpenVPN Static key V1-----
        </tls-auth>

        <tls-crypt>
-----BEGIN OpenVPN Static key V1-----
c3d281d8c3d281d8c3d281d8c3d281d8
-----END OpenVPN Static key V1-----
        </tls-crypt>
    "#;

    let config = parse_ovpn_config(config_str).expect("Failed to parse inline blocks");
    assert!(config.ca.is_some());
    assert!(config.ca.unwrap().contains("BEGIN CERTIFICATE"));

    assert!(config.cert.is_some());
    assert!(config.cert.unwrap().contains("BEGIN CERTIFICATE"));

    assert!(config.key.is_some());
    assert!(config.key.unwrap().as_str().contains("BEGIN PRIVATE KEY"));

    let tls_auth = config.tls_auth.expect("Missing tls-auth");
    assert!(tls_auth
        .key
        .as_str()
        .contains("BEGIN OpenVPN Static key V1"));
    assert_eq!(tls_auth.direction, Some(KeyDirection::Client)); // '1' is Client direction

    let tls_crypt = config.tls_crypt.expect("Missing tls-crypt");
    assert!(tls_crypt.as_str().contains("BEGIN OpenVPN Static key V1"));
}

#[test]
fn test_nested_connection_blocks() {
    let config_str = r#"
        client
        dev tun
        proto udp
        
        <connection>
        remote primary.vpn.net 1194 udp
        </connection>
        
        <connection>
        remote fallback.vpn.net 443 tcp
        http-proxy proxy.corporate.local 8080
        </connection>
    "#;

    let config = parse_ovpn_config(config_str).expect("Failed to parse connection blocks");
    assert_eq!(config.remotes.len(), 2);
    assert_eq!(config.remotes[0].host, "primary.vpn.net");
    assert_eq!(config.remotes[0].port, 1194);
    assert_eq!(config.remotes[0].proto, Some(Protocol::Udp));

    assert_eq!(config.remotes[1].host, "fallback.vpn.net");
    assert_eq!(config.remotes[1].port, 443);
    assert_eq!(config.remotes[1].proto, Some(Protocol::Tcp));
}

#[test]
fn test_quoted_arguments_and_comments() {
    let config_str = r#"
        # Top-level comment
        client
        ; Semicolon comment
        dev "tun0" # inline comment
        remote "vpn space.example.com" 1194
        auth-user-pass "/etc/openvpn/credentials with spaces.txt"
        dhcp-option DOMAIN "internal corp domain"
    "#;

    let config = parse_ovpn_config(config_str).expect("Failed to parse quoted arguments");
    assert_eq!(config.dev, "tun0");
    assert_eq!(config.remotes[0].host, "vpn space.example.com");
    assert_eq!(
        config.auth_user_pass.unwrap().path.as_deref(),
        Some("/etc/openvpn/credentials with spaces.txt")
    );
    assert_eq!(config.search_domains, vec!["internal corp domain"]);
}

#[test]
fn test_dynamic_push_reply_parsing() {
    let push_msg = r#"PUSH_REPLY,route 10.8.0.0 255.255.255.0,route 192.168.1.0 255.255.255.0 10.8.0.1 50,topology subnet,ping 10,ping-restart 60,ifconfig 10.8.0.14 255.255.255.0,dhcp-option DNS 1.1.1.1,dhcp-option DNS 1.0.0.1,dhcp-option DOMAIN corp.lan,redirect-gateway def1 bypass-dhcp,peer-id 42,cipher AES-256-GCM,auth-token session_token_secret_12345"#;

    let push_opts = parse_push_reply(push_msg).expect("Failed to parse PUSH_REPLY");
    assert_eq!(push_opts.topology, Some(NetworkTopology::Subnet));
    assert_eq!(
        push_opts.ifconfig_v4,
        Some((Ipv4Addr::new(10, 8, 0, 14), Ipv4Addr::new(255, 255, 255, 0)))
    );
    assert_eq!(push_opts.dns_servers.len(), 2);
    assert_eq!(
        push_opts.dns_servers[0],
        IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1))
    );
    assert_eq!(
        push_opts.dns_servers[1],
        IpAddr::V4(Ipv4Addr::new(1, 0, 0, 1))
    );
    assert_eq!(push_opts.search_domains, vec!["corp.lan"]);
    assert_eq!(push_opts.peer_id, Some(42));
    assert_eq!(push_opts.cipher.as_deref(), Some("AES-256-GCM"));
    assert_eq!(
        push_opts.auth_token.as_ref().map(|s| s.as_str()),
        Some("session_token_secret_12345")
    );

    let redirect = push_opts
        .redirect_gateway
        .expect("Missing redirect_gateway");
    assert!(redirect.enabled);
    assert!(redirect.def1);
    assert!(redirect.bypass_dhcp);
    assert!(!redirect.ipv6);

    assert_eq!(push_opts.routes_v4.len(), 2);
    assert_eq!(
        push_opts.routes_v4[0].destination,
        Ipv4Addr::new(10, 8, 0, 0)
    );
    assert_eq!(
        push_opts.routes_v4[0].netmask,
        Ipv4Addr::new(255, 255, 255, 0)
    );
    assert_eq!(
        push_opts.routes_v4[1].destination,
        Ipv4Addr::new(192, 168, 1, 0)
    );
    assert_eq!(
        push_opts.routes_v4[1].gateway,
        Some(Ipv4Addr::new(10, 8, 0, 1))
    );
    assert_eq!(push_opts.routes_v4[1].metric, Some(50));
}

#[test]
fn test_push_reply_ipv6() {
    let push_msg = "PUSH_REPLY,ifconfig-ipv6 2001:db8:1::100/64 2001:db8:1::1,route-ipv6 2001:db8:2::/64 2001:db8:1::1 100,dhcp-option DNS 2606:4700:4700::1111";

    let push_opts = parse_push_reply(push_msg).expect("Failed to parse IPv6 PUSH_REPLY");
    assert_eq!(
        push_opts.ifconfig_v6,
        Some((
            Ipv6Addr::from_str("2001:db8:1::100").unwrap(),
            64,
            Some(Ipv6Addr::from_str("2001:db8:1::1").unwrap())
        ))
    );
    assert_eq!(push_opts.routes_v6.len(), 1);
    assert_eq!(
        push_opts.routes_v6[0].destination,
        Ipv6Addr::from_str("2001:db8:2::").unwrap()
    );
    assert_eq!(push_opts.routes_v6[0].prefix_len, 64);
    assert_eq!(
        push_opts.routes_v6[0].gateway,
        Some(Ipv6Addr::from_str("2001:db8:1::1").unwrap())
    );
    assert_eq!(push_opts.routes_v6[0].metric, Some(100));

    assert_eq!(
        push_opts.dns_servers[0],
        IpAddr::V6(Ipv6Addr::from_str("2606:4700:4700::1111").unwrap())
    );
}

#[test]
fn test_merge_push_options_into_network_provisioning_config() {
    let base_config_str = r#"
        client
        dev tun0
        proto udp
        remote 1.2.3.4 1194
        dhcp-option DNS 8.8.8.8
        block-outside-dns
        tun-mtu 1400
    "#;

    let base = parse_ovpn_config(base_config_str).unwrap();
    let push_str = "PUSH_REPLY,ifconfig 10.10.0.5 255.255.255.0,dhcp-option DNS 1.1.1.1,topology subnet,redirect-gateway def1,peer-id 10";
    let push_opts = parse_push_reply(push_str).unwrap();

    let prov = push_opts.build_provisioning_config(&base);
    assert_eq!(prov.interface_name.as_deref(), Some("tun0"));
    assert_eq!(prov.mtu, 1400);
    assert_eq!(prov.topology, NetworkTopology::Subnet);
    assert_eq!(prov.ipv4_address, Some(Ipv4Addr::new(10, 10, 0, 5)));
    assert_eq!(prov.ipv4_netmask, Some(Ipv4Addr::new(255, 255, 255, 0)));
    assert_eq!(prov.peer_id, Some(10));
    assert!(prov.block_outside_dns);
    assert!(prov.redirect_gateway.enabled);
    assert!(prov.redirect_gateway.def1);

    // DNS servers should include pushed 1.1.1.1 first, followed by base 8.8.8.8
    assert_eq!(
        prov.dns_servers,
        vec![
            IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1)),
            IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8)),
        ]
    );
}
