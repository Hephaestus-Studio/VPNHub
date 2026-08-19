//! # Storage Data Models & Schemas

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Persisted VPN Profile metadata (secrets are stored separately in the encrypted vault).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredProfile {
    pub id: String,
    pub name: String,
    pub server_country: String,
    pub server_flag: String,
    pub server_host: String,
    pub server_port: u16,
    pub protocol: String, // "wireguard" | "openvpn_udp" | "openvpn_tcp"
    pub virtual_ip: String,
    pub tags: Vec<String>,
    pub is_favorite: bool,
    pub ping_ms: u32,
    pub last_connected: Option<String>,
    pub credentials: Option<StoredCredentialsMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredCredentialsMetadata {
    pub username: Option<String>,
    #[serde(default = "default_password_mode")]
    pub password_mode: Option<String>, // "static" | "dynamic_prompt" | "totp_auto"
    #[serde(default = "default_totp_format")]
    pub totp_format: Option<String>, // "append" | "prefix" | "totp_only"
    pub has_password: bool,
    pub has_private_key: bool,
    pub has_client_cert: bool,
    #[serde(default)]
    pub has_ca_cert: bool,
    #[serde(default)]
    pub has_tls_auth: bool,
    #[serde(default)]
    pub has_tls_crypt: bool,
    pub has_raw_ovpn: bool,
}

fn default_password_mode() -> Option<String> {
    Some("static".to_string())
}

fn default_totp_format() -> Option<String> {
    Some("append".to_string())
}

/// Sensitive profile secret to be encrypted and decrypted by the Vault.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StoredProfileSecret {
    Wireguard {
        private_key: String,
        preshared_key: Option<String>,
    },
    UserPassword {
        username: String,
        password: String,
        totp_secret: Option<String>,
        totp_format: Option<String>,
        ca_cert: Option<String>,
        client_cert: Option<String>,
        client_key: Option<String>,
        tls_auth_key: Option<String>,
        tls_crypt_key: Option<String>,
        key_direction: Option<String>,
        remote_cert_tls_server: Option<bool>,
        reneg_sec: Option<u32>,
        ovpn_config: Option<String>,
    },
    RawOvpnConfig {
        config_content: String,
        username: Option<String>,
        password: Option<String>,
        totp_secret: Option<String>,
        totp_format: Option<String>,
    },
}

/// Persisted Security Settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredSecuritySettings {
    pub kill_switch: String, // "off" | "standard" | "strict"
    pub dns_protection: bool,
    pub custom_dns_provider: String,
    pub ipv6_leak_protection: bool,
    pub webrtc_leak_protection: bool,
    pub lan_traffic_bypass: bool,
}

impl Default for StoredSecuritySettings {
    fn default() -> Self {
        Self {
            kill_switch: "strict".to_string(),
            dns_protection: true,
            custom_dns_provider: "cloudflare".to_string(),
            ipv6_leak_protection: true,
            webrtc_leak_protection: true,
            lan_traffic_bypass: true,
        }
    }
}

/// Persisted Split Tunneling Application Rule.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredAppRule {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub path: String,
    pub mode: String, // "route_vpn" | "bypass"
    pub enabled: bool,
}

/// Persisted Split Tunneling CIDR / Domain Route Rule.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredIpRule {
    pub id: String,
    pub target: String,
    #[serde(rename = "type")]
    pub rule_type: String, // "cidr" | "domain"
    pub description: String,
    pub mode: String, // "route_vpn" | "bypass"
    pub enabled: bool,
}

/// Complete Storage Snapshot loaded into the UI on startup.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FullStorageSnapshot {
    pub profiles: Vec<StoredProfile>,
    pub secrets: HashMap<String, StoredProfileSecret>,
    pub security_settings: StoredSecuritySettings,
    pub app_rules: Vec<StoredAppRule>,
    pub ip_rules: Vec<StoredIpRule>,
}
