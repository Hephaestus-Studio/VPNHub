//! Authentication protocols, dynamic challenge handling (CRV1, OTP), and Web SSO / OIDC redirects.

use serde::{Deserialize, Serialize};

/// Type of authentication challenge presented by the OpenVPN server.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AuthChallenge {
    /// Challenge-Response v1 (OTP/TOTP or multi-factor prompt).
    CrV1 {
        flags: String,
        state_id: String,
        username: String,
        prompt: String,
    },
    /// Web-based browser SSO / OIDC redirection URL.
    WebSso { url: String },
    /// Plain username / password prompt.
    UserPassRequired,
}

/// Authentication state and message formatter.
pub struct AuthHandler;

impl AuthHandler {
    /// Helper to write 16-bit length-prefixed null-terminated string for Key Method 2.
    pub fn write_auth_string(buf: &mut Vec<u8>, s: &str) {
        if s.is_empty() {
            buf.extend_from_slice(&0u16.to_be_bytes());
        } else {
            let len = (s.len() + 1) as u16;
            buf.extend_from_slice(&len.to_be_bytes());
            buf.extend_from_slice(s.as_bytes());
            buf.push(0); // null terminator
        }
    }

    /// Formats OpenVPN Key Method 2 Handshake Message carrying client randoms,
    /// options string, credentials, and peer info over the TLS stream.
    pub fn encode_key_method_2(
        options: &str,
        username: Option<&str>,
        password: Option<&str>,
        peer_info: &str,
    ) -> Vec<u8> {
        let mut buf = Vec::with_capacity(512);

        // 1. Literal auth prefix [0, 0, 0, 0, 2] (key-method 2)
        buf.extend_from_slice(&[0x00, 0x00, 0x00, 0x00, 0x02]);

        // 2. Random bytes: 48 bytes pre_master + 32 bytes random1 + 32 bytes random2 = 112 bytes
        use rand::RngCore;
        let mut rng = rand::thread_rng();
        let mut pre_master = [0u8; 48];
        let mut random1 = [0u8; 32];
        let mut random2 = [0u8; 32];
        rng.fill_bytes(&mut pre_master);
        rng.fill_bytes(&mut random1);
        rng.fill_bytes(&mut random2);

        buf.extend_from_slice(&pre_master);
        buf.extend_from_slice(&random1);
        buf.extend_from_slice(&random2);

        // 3. Options string
        Self::write_auth_string(&mut buf, options);

        // 4. Username string
        Self::write_auth_string(&mut buf, username.unwrap_or(""));

        // 5. Password string
        Self::write_auth_string(&mut buf, password.unwrap_or(""));

        // 6. Peer info string
        Self::write_auth_string(&mut buf, peer_info);

        buf
    }

    /// Formats standard `auth-user-pass` credentials for transmission over the TLS control channel.
    pub fn encode_credentials(username: &str, password: &str) -> Vec<u8> {
        let options = "V4,dev-type tun,link-mtu 1550,tun-mtu 1500,proto TCPv4_CLIENT,keydir 1,cipher AES-256-GCM,auth [null-digest],keysize 256,tls-auth,key-method 2,tls-client";
        let peer_info = "IV_VER=3.0\nIV_PLAT=linux\nIV_NCP=2\nIV_TCP=1\nIV_PROTO=30\nIV_CIPHERS=AES-256-GCM:AES-128-GCM:CHACHA20-POLY1305\nIV_GUI_VER=VPNHub-Daemon/0.1.0\n";
        Self::encode_key_method_2(options, Some(username), Some(password), peer_info)
    }

    /// Formats a CRV1 challenge response token for the server.
    pub fn encode_crv1_response(state_id: &str, response_token: &str) -> Vec<u8> {
        format!("CRV1::{}::{}\n", state_id, response_token).into_bytes()
    }

    /// Inspects an incoming control channel text message for dynamic authentication challenges.
    pub fn parse_challenge(message: &str) -> Option<AuthChallenge> {
        let trimmed = message.trim();

        // 1. Check for Challenge-Response v1 (CRV1)
        if let Some(rest) = trimmed.strip_prefix("CRV1:") {
            let parts: Vec<&str> = rest.splitn(4, ':').collect();
            if parts.len() >= 4 {
                return Some(AuthChallenge::CrV1 {
                    flags: parts[0].to_string(),
                    state_id: parts[1].to_string(),
                    username: parts[2].to_string(),
                    prompt: parts[3].to_string(),
                });
            }
        }

        // 2. Check for Web SSO / Browser redirect
        if let Some(url) = trimmed.strip_prefix("OPEN_URL:") {
            return Some(AuthChallenge::WebSso {
                url: url.trim().to_string(),
            });
        }

        if let Some(url) = trimmed.strip_prefix("INFO_PRE:WEB_AUTH:") {
            return Some(AuthChallenge::WebSso {
                url: url.trim().to_string(),
            });
        }

        None
    }
}
