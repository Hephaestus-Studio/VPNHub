//! Nom-based parser for `.ovpn` configuration files, directives, and inline blocks.

use crate::error::ConfigError;
use crate::model::*;
use crate::network_config::{Ipv4Route, Ipv6Route, NetworkTopology, RedirectGatewayFlags};
use nom::{
    branch::alt,
    bytes::complete::{escaped_transform, tag, take_while},
    character::complete::{char, none_of},
    combinator::{map, value},
    sequence::delimited,
    IResult,
};

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::str::FromStr;
use std::time::Duration;

/// Parses a quoted argument enclosed in double quotes `"..."`.
fn parse_double_quoted(input: &str) -> IResult<&str, String> {
    delimited(
        char('"'),
        escaped_transform(
            none_of("\"\\"),
            '\\',
            alt((
                value("\\", tag("\\")),
                value("\"", tag("\"")),
                value("\n", tag("n")),
                value("\r", tag("r")),
                value("\t", tag("t")),
                value(" ", tag(" ")),
            )),
        ),
        char('"'),
    )(input)
}

/// Parses a single-quoted argument `'...'`.
fn parse_single_quoted(input: &str) -> IResult<&str, String> {
    delimited(
        char('\''),
        map(take_while(|c| c != '\''), |s: &str| s.to_string()),
        char('\''),
    )(input)
}

/// Parses an unquoted argument (characters until whitespace or quote or comment).
fn parse_unquoted(input: &str) -> IResult<&str, String> {
    map(
        take_while(|c: char| !c.is_whitespace() && c != '#' && c != ';' && c != '"' && c != '\''),
        |s: &str| s.to_string(),
    )(input)
}

/// Parses a single argument (quoted or unquoted).
fn parse_argument(input: &str) -> IResult<&str, String> {
    alt((parse_double_quoted, parse_single_quoted, parse_unquoted))(input)
}

/// Parses multiple whitespace-delimited arguments from a directive line.
fn parse_arguments(input: &str) -> IResult<&str, Vec<String>> {
    let mut args = Vec::new();
    let mut curr = input.trim_start();

    while !curr.is_empty() {
        if curr.starts_with('#') || curr.starts_with(';') {
            break;
        }
        let (next_input, arg) = parse_argument(curr)?;
        if !arg.is_empty() {
            args.push(arg);
        }
        curr = next_input.trim_start();
    }

    Ok((curr, args))
}

/// Checks if a line is opening an XML inline block like `<ca>` or `<tls-auth 1>`.
fn parse_inline_open_tag(line: &str) -> Option<(String, Option<String>)> {
    let trimmed = line.trim();
    if !trimmed.starts_with('<') || trimmed.starts_with("</") || !trimmed.ends_with('>') {
        return None;
    }
    let inner = &trimmed[1..trimmed.len() - 1].trim();
    let mut parts = inner.split_whitespace();
    let tag = parts.next()?.to_lowercase();
    let attr = parts.next().map(|s| s.to_string());
    Some((tag, attr))
}

/// Checks if a line is closing an XML inline block like `</ca>`.
fn parse_inline_close_tag(line: &str, expected_tag: &str) -> bool {
    let trimmed = line.trim();
    if trimmed.starts_with("</") && trimmed.ends_with('>') {
        let inner = &trimmed[2..trimmed.len() - 1].trim();
        inner.eq_ignore_ascii_case(expected_tag)
    } else {
        false
    }
}

/// Raw parsed components from `.ovpn` text before merging.
#[derive(Debug, Default)]
pub struct ParsedOvpnFile {
    pub directives: Vec<Directive>,
    pub inline_blocks: Vec<InlineBlock>,
}

/// Parses raw `.ovpn` text into high-level AST directives and inline blocks.
pub fn parse_ovpn_ast(content: &str) -> Result<ParsedOvpnFile, ConfigError> {
    let mut result = ParsedOvpnFile::default();
    let mut lines = content.lines().enumerate().peekable();

    while let Some((line_idx, line)) = lines.next() {
        let line_num = line_idx + 1;
        let trimmed = line.trim();

        // Skip empty lines and full-line comments
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with(';') {
            continue;
        }

        // Check for opening XML-like block tag
        if let Some((tag, attr)) = parse_inline_open_tag(trimmed) {
            let mut block_content = String::new();
            let mut closed = false;

            while let Some((_, inner_line)) = lines.next() {
                if parse_inline_close_tag(inner_line, &tag) {
                    closed = true;
                    break;
                }
                block_content.push_str(inner_line);
                block_content.push('\n');
            }

            if !closed {
                return Err(ConfigError::UnclosedInlineTag {
                    tag,
                    line: line_num,
                });
            }

            result.inline_blocks.push(InlineBlock {
                tag,
                content: block_content.trim().to_string(),
                attribute: attr,
                line_number: line_num,
            });
            continue;
        }

        // Parse directive and arguments
        let (_, args) = parse_arguments(trimmed).map_err(|e| ConfigError::NomParse {
            line: line_num,
            message: e.to_string(),
        })?;

        if args.is_empty() {
            continue;
        }

        let name = args[0].to_ascii_lowercase();
        let directive_args = args[1..].to_vec();

        result.directives.push(Directive {
            name,
            args: directive_args,
            line_number: line_num,
        });
    }

    Ok(result)
}

/// Parses `.ovpn` content string directly into a validated [`OpenVpnConfig`].
pub fn parse_ovpn_config(content: &str) -> Result<OpenVpnConfig, ConfigError> {
    let ast = parse_ovpn_ast(content)?;
    let mut config = OpenVpnConfig::default();

    // Process inline blocks first
    for block in &ast.inline_blocks {
        match block.tag.as_str() {
            "ca" => {
                config.ca = Some(block.content.clone());
            }
            "cert" => {
                config.cert = Some(block.content.clone());
            }
            "key" => {
                config.key = Some(SecretString::new(&block.content));
            }
            "extra-certs" => {
                config.extra_certs = Some(block.content.clone());
            }
            "tls-auth" => {
                let dir = block
                    .attribute
                    .as_deref()
                    .and_then(|s| KeyDirection::from_str(s).ok());
                config.tls_auth = Some(TlsAuthConfig {
                    key: SecretString::new(&block.content),
                    direction: dir,
                });
            }
            "tls-crypt" => {
                config.tls_crypt = Some(SecretString::new(&block.content));
            }
            "tls-crypt-v2" => {
                config.tls_crypt_v2 = Some(SecretString::new(&block.content));
            }
            "pkcs12" => {
                // PKCS12 inline data is base64 encoded
                let raw = base64::Engine::decode(
                    &base64::engine::general_purpose::STANDARD,
                    block.content.replace(['\n', '\r', ' '], "").as_bytes(),
                )
                .map_err(ConfigError::Base64Error)?;
                config.pkcs12 = Some(Pkcs12Config {
                    data: SecretBytes::new(raw),
                    password: None,
                });
            }
            "connection" => {
                // Nested connection block
                let sub_ast = parse_ovpn_ast(&block.content)?;
                apply_connection_block(&sub_ast, &mut config)?;
            }
            "http-proxy-user-pass" => {
                // Handled in proxy section
            }
            _ => {
                // Unknown or custom inline block, can be preserved or ignored
            }
        }
    }

    // Process regular directives
    for dir in &ast.directives {
        apply_directive(dir, &mut config)?;
    }

    Ok(config)
}

fn apply_directive(dir: &Directive, config: &mut OpenVpnConfig) -> Result<(), ConfigError> {
    let name = dir.name.as_str();
    let args = &dir.args;
    let _line = dir.line_number;

    match name {
        "client" => {
            config.client = true;
        }
        "dev" => {
            if let Some(dev) = args.first() {
                config.dev = dev.clone();
                if let Ok(dev_type) = DeviceType::from_str(dev) {
                    config.dev_type = dev_type;
                }
            }
        }
        "dev-type" => {
            if let Some(dt) = args.first() {
                if let Ok(dev_type) = DeviceType::from_str(dt) {
                    config.dev_type = dev_type;
                }
            }
        }
        "proto" => {
            if let Some(p) = args.first() {
                if let Ok(proto) = Protocol::from_str(p) {
                    config.proto = proto;
                }
            }
        }
        "remote" => {
            if let Some(host) = args.first() {
                let port = args
                    .get(1)
                    .and_then(|p| p.parse::<u16>().ok())
                    .unwrap_or(1194);
                let proto = args.get(2).and_then(|p| Protocol::from_str(p).ok());
                config.remotes.push(RemoteEntry::new(host, port, proto));
            }
        }
        "remote-random" => {
            config.remote_random = true;
        }
        "resolv-retry" => {
            if let Some(val) = args.first() {
                config.resolv_retry_infinite = val.eq_ignore_ascii_case("infinite");
            }
        }
        "nobind" => {
            config.nobind = true;
        }
        "persist-key" => {
            config.persist_key = true;
        }
        "persist-tun" => {
            config.persist_tun = true;
        }
        "pull" => {
            config.pull = true;
        }
        "ca" => {
            if config.ca.is_none() {
                if let Some(path) = args.first() {
                    config.ca = Some(path.clone());
                }
            }
        }
        "cert" => {
            if config.cert.is_none() {
                if let Some(path) = args.first() {
                    config.cert = Some(path.clone());
                }
            }
        }
        "key" => {
            if config.key.is_none() {
                if let Some(path) = args.first() {
                    config.key = Some(SecretString::new(path));
                }
            }
        }
        "extra-certs" => {
            if config.extra_certs.is_none() {
                if let Some(path) = args.first() {
                    config.extra_certs = Some(path.clone());
                }
            }
        }
        "pkcs12" => {
            if config.pkcs12.is_none() {
                if let Some(path) = args.first() {
                    config.pkcs12 = Some(Pkcs12Config {
                        data: SecretBytes::new(path.as_bytes().to_vec()),
                        password: None,
                    });
                }
            }
        }
        "tls-auth" => {
            if config.tls_auth.is_none() {
                if let Some(path) = args.first() {
                    let dir = args.get(1).and_then(|s| KeyDirection::from_str(s).ok());
                    config.tls_auth = Some(TlsAuthConfig {
                        key: SecretString::new(path),
                        direction: dir,
                    });
                }
            }
        }
        "tls-crypt" => {
            if config.tls_crypt.is_none() {
                if let Some(path) = args.first() {
                    config.tls_crypt = Some(SecretString::new(path));
                }
            }
        }
        "tls-crypt-v2" => {
            if config.tls_crypt_v2.is_none() {
                if let Some(path) = args.first() {
                    config.tls_crypt_v2 = Some(SecretString::new(path));
                }
            }
        }
        "key-direction" => {
            if let Some(kd) = args.first() {
                config.key_direction = KeyDirection::from_str(kd).ok();
            }
        }
        "cipher" => {
            if let Some(c) = args.first() {
                config.cipher = Some(c.clone());
            }
        }
        "data-ciphers" => {
            if let Some(ciphers) = args.first() {
                config.data_ciphers = ciphers
                    .split(':')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
            }
        }
        "data-ciphers-fallback" => {
            if let Some(fb) = args.first() {
                config.data_ciphers_fallback = Some(fb.clone());
            }
        }
        "auth" => {
            if let Some(a) = args.first() {
                config.auth_digest = Some(a.clone());
            }
        }
        "auth-user-pass" => {
            let path = args.first().cloned();
            config.auth_user_pass = Some(AuthUserPassConfig {
                username: None,
                password: None,
                path,
            });
        }
        "remote-cert-tls" => {
            if let Some(t) = args.first() {
                config.remote_cert_tls = Some(t.clone());
            }
        }
        "verify-x509-name" => {
            if let Some(name) = args.first() {
                let name_type = args
                    .get(1)
                    .map(|t| match t.as_str() {
                        "name-prefix" => VerifyX509Type::NamePrefix,
                        "subject" => VerifyX509Type::SubjectAltName,
                        _ => VerifyX509Type::Subject,
                    })
                    .unwrap_or_default();
                config.verify_x509_name = Some(VerifyX509Name {
                    name: name.clone(),
                    name_type,
                });
            }
        }
        "tls-version-min" => {
            if let Some(v) = args.first() {
                config.tls_version_min = Some(v.clone());
            }
        }
        "reneg-sec" => {
            if let Some(s) = args.first() {
                if let Ok(sec) = s.parse::<u32>() {
                    config.reneg_sec = Some(sec);
                }
            }
        }
        "hand-window" => {
            if let Some(s) = args.first() {
                if let Ok(sec) = s.parse::<u32>() {
                    config.hand_window = Some(sec);
                }
            }
        }
        "topology" => {
            if let Some(top) = args.first() {
                config.topology = match top.to_ascii_lowercase().as_str() {
                    "subnet" => Some(NetworkTopology::Subnet),
                    "net30" => Some(NetworkTopology::Net30),
                    "p2p" => Some(NetworkTopology::P2p),
                    _ => None,
                };
            }
        }
        "ifconfig" => {
            if args.len() >= 2 {
                if let (Ok(local), Ok(remote)) =
                    (args[0].parse::<Ipv4Addr>(), args[1].parse::<Ipv4Addr>())
                {
                    config.ifconfig_v4 = Some((local, remote));
                }
            }
        }
        "ifconfig-ipv6" => {
            if args.len() >= 2 {
                if let (Ok(local), Ok(remote)) =
                    (args[0].parse::<Ipv6Addr>(), args[1].parse::<Ipv6Addr>())
                {
                    config.ifconfig_v6 = Some((local, remote));
                }
            }
        }
        "route" => {
            if let Some(dest_str) = args.first() {
                if let Ok(dest) = dest_str.parse::<Ipv4Addr>() {
                    let netmask = args
                        .get(1)
                        .and_then(|m| m.parse::<Ipv4Addr>().ok())
                        .unwrap_or(Ipv4Addr::new(255, 255, 255, 255));
                    let gateway = args.get(2).and_then(|g| g.parse::<Ipv4Addr>().ok());
                    let metric = args.get(3).and_then(|m| m.parse::<u32>().ok());
                    config
                        .routes_v4
                        .push(Ipv4Route::new(dest, netmask, gateway, metric));
                }
            }
        }
        "route-ipv6" => {
            if let Some(dest_str) = args.first() {
                let parts: Vec<&str> = dest_str.split('/').collect();
                if let Ok(dest) = parts[0].parse::<Ipv6Addr>() {
                    let prefix = parts
                        .get(1)
                        .and_then(|p| p.parse::<u8>().ok())
                        .unwrap_or(128);
                    let gateway = args.get(1).and_then(|g| g.parse::<Ipv6Addr>().ok());
                    let metric = args.get(2).and_then(|m| m.parse::<u32>().ok());
                    config
                        .routes_v6
                        .push(Ipv6Route::new(dest, prefix, gateway, metric));
                }
            }
        }
        "redirect-gateway" | "redirect-private" => {
            let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
            config.redirect_gateway = RedirectGatewayFlags::from_args(&str_args);
        }
        "dhcp-option" => {
            if args.len() >= 2 {
                let opt_type = args[0].to_ascii_uppercase();
                let opt_val = &args[1];
                match opt_type.as_str() {
                    "DNS" => {
                        if let Ok(ip) = opt_val.parse::<IpAddr>() {
                            if !config.dns_servers.contains(&ip) {
                                config.dns_servers.push(ip);
                            }
                        }
                    }
                    "DOMAIN" | "DOMAIN-SEARCH" | "ADAPTER_DOMAIN_SUFFIX" => {
                        if !config.search_domains.contains(opt_val) {
                            config.search_domains.push(opt_val.clone());
                        }
                    }
                    _ => {}
                }
            }
        }
        "block-outside-dns" => {
            config.block_outside_dns = true;
        }
        "tun-mtu" => {
            if let Some(m) = args.first().and_then(|s| s.parse::<u32>().ok()) {
                config.tun_mtu = Some(m);
            }
        }
        "link-mtu" => {
            if let Some(m) = args.first().and_then(|s| s.parse::<u32>().ok()) {
                config.link_mtu = Some(m);
            }
        }
        "mssfix" => {
            let mss = args
                .first()
                .and_then(|s| s.parse::<u16>().ok())
                .unwrap_or(1450);
            config.mss_fix = Some(mss);
        }
        "ping" => {
            if let Some(sec) = args.first().and_then(|s| s.parse::<u64>().ok()) {
                config.ping_interval = Some(Duration::from_secs(sec));
            }
        }
        "ping-restart" => {
            if let Some(sec) = args.first().and_then(|s| s.parse::<u64>().ok()) {
                config.ping_restart = Some(Duration::from_secs(sec));
            }
        }
        "keepalive" => {
            if args.len() >= 2 {
                if let (Ok(ping), Ok(restart)) = (args[0].parse::<u64>(), args[1].parse::<u64>()) {
                    config.ping_interval = Some(Duration::from_secs(ping));
                    config.ping_restart = Some(Duration::from_secs(restart));
                }
            }
        }
        "explicit-exit-notify" => {
            let n = args.first().and_then(|s| s.parse::<u8>().ok()).unwrap_or(1);
            config.explicit_exit_notify = Some(n);
        }
        "http-proxy" => {
            if args.len() >= 2 {
                if let Ok(port) = args[1].parse::<u16>() {
                    config.proxy = Some(ProxyConfig::Http {
                        host: args[0].clone(),
                        port,
                        auth_file: args.get(2).cloned(),
                    });
                }
            }
        }
        "socks-proxy" => {
            if args.len() >= 2 {
                if let Ok(port) = args[1].parse::<u16>() {
                    config.proxy = Some(ProxyConfig::Socks {
                        host: args[0].clone(),
                        port,
                        auth_file: args.get(2).cloned(),
                    });
                }
            }
        }
        "verb" => {
            if let Some(v) = args.first().and_then(|s| s.parse::<u8>().ok()) {
                config.verb = v;
            }
        }
        "fast-io" => {
            config.fast_io = true;
        }
        "compress" | "comp-lzo" => {
            config.compression = args
                .first()
                .cloned()
                .or_else(|| Some("adaptive".to_string()));
        }
        _ => {
            // Unrecognized or optional directive ignored gracefully
        }
    }

    Ok(())
}

fn apply_connection_block(
    ast: &ParsedOvpnFile,
    config: &mut OpenVpnConfig,
) -> Result<(), ConfigError> {
    for dir in &ast.directives {
        match dir.name.as_str() {
            "remote" => {
                if let Some(host) = dir.args.first() {
                    let port = dir
                        .args
                        .get(1)
                        .and_then(|p| p.parse::<u16>().ok())
                        .unwrap_or(1194);
                    let proto = dir.args.get(2).and_then(|p| Protocol::from_str(p).ok());
                    config.remotes.push(RemoteEntry::new(host, port, proto));
                }
            }
            "proto" => {
                if let Some(p) = dir.args.first() {
                    if let Ok(proto) = Protocol::from_str(p) {
                        config.proto = proto;
                    }
                }
            }
            "http-proxy" => {
                if dir.args.len() >= 2 {
                    if let Ok(port) = dir.args[1].parse::<u16>() {
                        config.proxy = Some(ProxyConfig::Http {
                            host: dir.args[0].clone(),
                            port,
                            auth_file: dir.args.get(2).cloned(),
                        });
                    }
                }
            }
            "socks-proxy" => {
                if dir.args.len() >= 2 {
                    if let Ok(port) = dir.args[1].parse::<u16>() {
                        config.proxy = Some(ProxyConfig::Socks {
                            host: dir.args[0].clone(),
                            port,
                            auth_file: dir.args.get(2).cloned(),
                        });
                    }
                }
            }
            _ => {}
        }
    }
    Ok(())
}
