//! # Tauri VPN Commands

use std::sync::Arc;
use tauri::State;
use vpnhub_daemon::ipc::protocol::{
    ConnectParams, DaemonRequest, DaemonResponse, SplitTunnelConfig,
};

use crate::error::AppError;
use crate::ipc::DaemonClient;

use crate::storage::{StorageManager, StoredProfileSecret};

#[tauri::command]
pub async fn vpn_connect(
    client: State<'_, Arc<DaemonClient>>,
    storage: State<'_, Arc<StorageManager>>,
    mut params: ConnectParams,
) -> Result<DaemonResponse, AppError> {
    // Seamlessly inject decrypted secrets from the encrypted vault
    if let Some(secret) = storage.vault().get_secret(&params.profile_id) {
        match secret {
            StoredProfileSecret::Wireguard {
                private_key,
                preshared_key,
            } => {
                params.auth_config = vpnhub_daemon::ipc::protocol::AuthConfig::WireguardKey {
                    private_key,
                    preshared_key,
                };
            }
            StoredProfileSecret::UserPassword {
                username,
                password,
                totp_secret: _,
                totp_format: _,
                ca_cert,
                client_cert,
                client_key,
                tls_auth_key,
                tls_crypt_key,
                key_direction,
                remote_cert_tls_server,
                reneg_sec,
                ovpn_config,
            } => {
                let final_password = match &params.auth_config {
                    vpnhub_daemon::ipc::protocol::AuthConfig::UserPassword {
                        password: p, ..
                    } if !p.is_empty() => p.clone(),
                    _ => password,
                };

                params.auth_config = vpnhub_daemon::ipc::protocol::AuthConfig::UserPassword {
                    username,
                    password: final_password,
                    ca_cert,
                    client_cert,
                    client_key,
                    tls_auth_key,
                    tls_crypt_key,
                    key_direction,
                    remote_cert_tls_server,
                    reneg_sec,
                    ovpn_config,
                };
            }

            StoredProfileSecret::RawOvpnConfig {
                config_content,
                username,
                password,
                totp_secret: _,
                totp_format: _,
            } => {
                let (final_username, final_password) = match &params.auth_config {
                    vpnhub_daemon::ipc::protocol::AuthConfig::UserPassword {
                        username: u,
                        password: p,
                        ..
                    } if !p.is_empty() => (
                        if !u.is_empty() {
                            Some(u.clone())
                        } else {
                            username
                        },
                        Some(p.clone()),
                    ),
                    _ => (username, password),
                };

                params.auth_config = vpnhub_daemon::ipc::protocol::AuthConfig::RawOvpnConfig {
                    config_content,
                    username: final_username,
                    password: final_password,
                };
            }
        }
    }

    client.send_request(DaemonRequest::Connect(params)).await
}

#[tauri::command]
pub async fn vpn_disconnect(
    client: State<'_, Arc<DaemonClient>>,
    force: Option<bool>,
) -> Result<DaemonResponse, AppError> {
    client
        .send_request(DaemonRequest::Disconnect {
            force: force.unwrap_or(false),
        })
        .await
}

#[tauri::command]
pub async fn get_daemon_status(
    client: State<'_, Arc<DaemonClient>>,
) -> Result<DaemonResponse, AppError> {
    client.send_request(DaemonRequest::GetStatus).await
}

#[tauri::command]
pub async fn get_metrics(client: State<'_, Arc<DaemonClient>>) -> Result<DaemonResponse, AppError> {
    client.send_request(DaemonRequest::GetMetrics).await
}

#[tauri::command]
pub async fn set_kill_switch(
    client: State<'_, Arc<DaemonClient>>,
    enabled: bool,
    mode: Option<vpnhub_daemon::ipc::protocol::KillSwitchMode>,
) -> Result<DaemonResponse, AppError> {
    client
        .send_request(DaemonRequest::SetKillSwitch { enabled, mode })
        .await
}

#[tauri::command]
pub async fn set_split_tunneling(
    client: State<'_, Arc<DaemonClient>>,
    config: SplitTunnelConfig,
) -> Result<DaemonResponse, AppError> {
    client
        .send_request(DaemonRequest::SetSplitTunneling(config))
        .await
}

#[tauri::command]
pub async fn get_diagnostics(
    client: State<'_, Arc<DaemonClient>>,
) -> Result<DaemonResponse, AppError> {
    client.send_request(DaemonRequest::GetDiagnostics).await
}

#[tauri::command]
pub async fn ping_daemon(client: State<'_, Arc<DaemonClient>>) -> Result<bool, AppError> {
    Ok(client.ping().await)
}

#[tauri::command]
pub async fn ping_server(host: String, port: u16) -> Result<u32, String> {
    let target = format!("{}:{}", host, port);
    let start = std::time::Instant::now();
    match tokio::time::timeout(
        std::time::Duration::from_millis(2500),
        tokio::net::TcpStream::connect(&target),
    )
    .await
    {
        Ok(Ok(_stream)) => Ok(start.elapsed().as_millis().max(1) as u32),
        Ok(Err(e)) => {
            if e.kind() == std::io::ErrorKind::ConnectionRefused {
                Ok(start.elapsed().as_millis().max(1) as u32)
            } else {
                Err(e.to_string())
            }
        }
        Err(_) => Err("Timeout".to_string()),
    }
}
