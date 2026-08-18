//! # Storage Manager & Lifecycle Orchestrator

use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tracing::{debug, info};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use crate::error::AppError;
use crate::storage::models::*;
use crate::storage::vault::EncryptedVault;

pub struct StorageManager {
    base_dir: PathBuf,
    vault: Arc<EncryptedVault>,
    profiles: Mutex<Vec<StoredProfile>>,
    security_settings: Mutex<StoredSecuritySettings>,
    app_rules: Mutex<Vec<StoredAppRule>>,
    ip_rules: Mutex<Vec<StoredIpRule>>,
}

impl StorageManager {
    /// Initializes StorageManager, creates the secure directory, and loads or seeds data.
    pub fn new() -> Result<Self, AppError> {
        let base_dir = Self::resolve_storage_directory()?;

        // Ensure parent directory exists with 0700 permissions
        if !base_dir.exists() {
            fs::create_dir_all(&base_dir)?;
            #[cfg(unix)]
            {
                if let Ok(metadata) = fs::metadata(&base_dir) {
                    let mut perms = metadata.permissions();
                    perms.set_mode(0o700);
                    let _ = fs::set_permissions(&base_dir, perms);
                }
            }
            info!("Created secure VPNHub storage directory at {:?}", base_dir);
        }

        let vault_path = base_dir.join("vault.enc");
        let vault = Arc::new(EncryptedVault::new(vault_path)?);

        let manager = Self {
            base_dir,
            vault,
            profiles: Mutex::new(Vec::new()),
            security_settings: Mutex::new(StoredSecuritySettings::default()),
            app_rules: Mutex::new(Vec::new()),
            ip_rules: Mutex::new(Vec::new()),
        };

        manager.load_or_seed_initial_data()?;
        Ok(manager)
    }

    /// Access the vault directly.
    pub fn vault(&self) -> &EncryptedVault {
        &self.vault
    }

    /// Resolves the OS-specific application data directory.
    fn resolve_storage_directory() -> Result<PathBuf, AppError> {
        if let Ok(custom_dir) = std::env::var("VPNHUB_CONFIG_DIR") {
            return Ok(PathBuf::from(custom_dir));
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(app_data) = std::env::var("APPDATA") {
                return Ok(PathBuf::from(app_data).join("vpnhub"));
            }
        }

        #[cfg(target_os = "macos")]
        {
            if let Ok(home) = std::env::var("HOME") {
                return Ok(PathBuf::from(home).join("Library/Application Support/vpnhub"));
            }
        }

        #[cfg(unix)]
        {
            if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
                return Ok(PathBuf::from(xdg).join("vpnhub"));
            }
            if let Ok(home) = std::env::var("HOME") {
                return Ok(PathBuf::from(home).join(".config/vpnhub"));
            }
        }

        Ok(PathBuf::from("./.vpnhub-storage"))
    }

    /// Loads persisted files from disk or seeds default profiles on first run.
    fn load_or_seed_initial_data(&self) -> Result<(), AppError> {
        let profiles_path = self.base_dir.join("profiles.json");
        let settings_path = self.base_dir.join("settings.json");
        let rules_path = self.base_dir.join("rules.json");

        // 1. Profiles
        if profiles_path.exists() {
            if let Ok(data) = fs::read_to_string(&profiles_path) {
                if let Ok(loaded) = serde_json::from_str::<Vec<StoredProfile>>(&data) {
                    let mut lock = self.profiles.lock().unwrap();
                    *lock = loaded;
                    info!("Loaded {} persisted profiles from disk", lock.len());
                }
            }
        } else {
            self.seed_default_profiles()?;
        }

        // 2. Settings
        if settings_path.exists() {
            if let Ok(data) = fs::read_to_string(&settings_path) {
                if let Ok(loaded) = serde_json::from_str::<StoredSecuritySettings>(&data) {
                    let mut lock = self.security_settings.lock().unwrap();
                    *lock = loaded;
                }
            }
        } else {
            self.persist_settings(&StoredSecuritySettings::default())?;
        }

        // 3. Split Rules
        if rules_path.exists() {
            if let Ok(data) = fs::read_to_string(&rules_path) {
                if let Ok((apps, ips)) =
                    serde_json::from_str::<(Vec<StoredAppRule>, Vec<StoredIpRule>)>(&data)
                {
                    let mut app_lock = self.app_rules.lock().unwrap();
                    let mut ip_lock = self.ip_rules.lock().unwrap();
                    *app_lock = apps;
                    *ip_lock = ips;
                }
            }
        } else {
            self.seed_default_rules()?;
        }

        Ok(())
    }

    /// Seeds realistic starter profiles with encrypted vault keys on first run.
    fn seed_default_profiles(&self) -> Result<(), AppError> {
        info!("First run detected: Seeding starter profiles and encrypting secrets into vault");

        let defaults = vec![
            (
                StoredProfile {
                    id: "prof-fra-01".to_string(),
                    name: "Frankfurt Cyber Citadel".to_string(),
                    server_country: "Germany".to_string(),
                    server_flag: "🇩🇪".to_string(),
                    server_host: "fra-citadel.vpnhub.network".to_string(),
                    server_port: 51820,
                    protocol: "wireguard".to_string(),
                    virtual_ip: "10.8.10.2".to_string(),
                    tags: vec![
                        "Production".to_string(),
                        "WireGuard".to_string(),
                        "Low Latency".to_string(),
                    ],
                    is_favorite: true,
                    ping_ms: 24,
                    last_connected: Some("10 mins ago".to_string()),
                    credentials: Some(StoredCredentialsMetadata {
                        username: None,
                        password_mode: None,
                        totp_format: None,
                        has_password: false,
                        has_private_key: true,
                        has_client_cert: false,
                        has_raw_ovpn: false,
                    }),
                },
                StoredProfileSecret::Wireguard {
                    private_key: "aGVwaGFlc3R1cy1mcmEtcHJpdmF0ZS1rZXktMDE=".to_string(),
                    preshared_key: Some("cHJlc2hhcmVkLWtleS0wMQ==".to_string()),
                },
            ),
            (
                StoredProfile {
                    id: "prof-tokyo-02".to_string(),
                    name: "Tokyo Neo Mesh".to_string(),
                    server_country: "Japan".to_string(),
                    server_flag: "🇯🇵".to_string(),
                    server_host: "nrt-edge.vpnhub.network".to_string(),
                    server_port: 51820,
                    protocol: "wireguard".to_string(),
                    virtual_ip: "10.8.20.2".to_string(),
                    tags: vec!["Office".to_string(), "Asia-Pacific".to_string()],
                    is_favorite: true,
                    ping_ms: 68,
                    last_connected: Some("2 hours ago".to_string()),
                    credentials: Some(StoredCredentialsMetadata {
                        username: None,
                        password_mode: None,
                        totp_format: None,
                        has_password: false,
                        has_private_key: true,
                        has_client_cert: false,
                        has_raw_ovpn: false,
                    }),
                },
                StoredProfileSecret::Wireguard {
                    private_key: "aGVwaGFlc3R1cy10b2t5by1wcml2YXRlLWtleS0wMg==".to_string(),
                    preshared_key: None,
                },
            ),
            (
                StoredProfile {
                    id: "prof-sg-03".to_string(),
                    name: "Singapore Ultra Core".to_string(),
                    server_country: "Singapore".to_string(),
                    server_flag: "🇸🇬".to_string(),
                    server_host: "sin-core.vpnhub.network".to_string(),
                    server_port: 1194,
                    protocol: "openvpn_udp".to_string(),
                    virtual_ip: "10.9.30.5".to_string(),
                    tags: vec!["Staging".to_string(), "OpenVPN".to_string()],
                    is_favorite: false,
                    ping_ms: 42,
                    last_connected: None,
                    credentials: Some(StoredCredentialsMetadata {
                        username: Some("developer_sin".to_string()),
                        password_mode: Some("static".to_string()),
                        totp_format: None,
                        has_password: true,
                        has_private_key: false,
                        has_client_cert: false,
                        has_raw_ovpn: false,
                    }),
                },
                StoredProfileSecret::UserPassword {
                    username: "developer_sin".to_string(),
                    password: "encrypted_user_secret_password".to_string(),
                    totp_secret: None,
                    totp_format: None,
                    ca_cert: None,
                    client_cert: None,
                    client_key: None,
                    ovpn_config: None,
                },
            ),
        ];

        let mut stored_list = Vec::new();
        for (profile, secret) in defaults {
            let id = profile.id.clone();
            self.vault.store_secret(id, secret)?;
            stored_list.push(profile);
        }

        self.persist_profiles(&stored_list)?;
        let mut lock = self.profiles.lock().unwrap();
        *lock = stored_list;
        Ok(())
    }

    /// Seeds default split tunneling rules.
    fn seed_default_rules(&self) -> Result<(), AppError> {
        let app_rules = vec![
            StoredAppRule {
                id: "app-1".to_string(),
                name: "Google Chrome".to_string(),
                icon: Some("🌐".to_string()),
                path: "/usr/bin/google-chrome-stable".to_string(),
                mode: "route_vpn".to_string(),
                enabled: true,
            },
            StoredAppRule {
                id: "app-2".to_string(),
                name: "Slack Desktop".to_string(),
                icon: Some("💬".to_string()),
                path: "/usr/bin/slack".to_string(),
                mode: "bypass".to_string(),
                enabled: true,
            },
        ];

        let ip_rules = vec![
            StoredIpRule {
                id: "ip-1".to_string(),
                target: "10.0.0.0/8".to_string(),
                rule_type: "cidr".to_string(),
                description: "Internal Corporate VPC Subnet".to_string(),
                mode: "route_vpn".to_string(),
                enabled: true,
            },
            StoredIpRule {
                id: "ip-2".to_string(),
                target: "*.netflix.com".to_string(),
                rule_type: "domain".to_string(),
                description: "Streaming Domain Direct Route".to_string(),
                mode: "bypass".to_string(),
                enabled: true,
            },
        ];

        self.persist_split_rules(&app_rules, &ip_rules)?;
        let mut app_lock = self.app_rules.lock().unwrap();
        let mut ip_lock = self.ip_rules.lock().unwrap();
        *app_lock = app_rules;
        *ip_lock = ip_rules;
        Ok(())
    }

    /// Returns the full storage snapshot for the frontend.
    pub fn get_full_snapshot(&self) -> FullStorageSnapshot {
        let profiles = self.profiles.lock().unwrap().clone();
        let security_settings = self.security_settings.lock().unwrap().clone();
        let app_rules = self.app_rules.lock().unwrap().clone();
        let ip_rules = self.ip_rules.lock().unwrap().clone();

        FullStorageSnapshot {
            profiles,
            security_settings,
            app_rules,
            ip_rules,
        }
    }

    /// Saves or updates a profile with optional secret persistence.
    pub fn save_profile(
        &self,
        profile: StoredProfile,
        secret: Option<StoredProfileSecret>,
    ) -> Result<StoredProfile, AppError> {
        let profile_id = profile.id.clone();

        // 1. Store secret if provided
        if let Some(sec) = secret {
            self.vault.store_secret(profile_id.clone(), sec)?;
        }

        // 2. Update metadata list
        let mut lock = self.profiles.lock().unwrap();
        let mut updated = false;
        for p in lock.iter_mut() {
            if p.id == profile_id {
                *p = profile.clone();
                updated = true;
                break;
            }
        }

        if !updated {
            lock.insert(0, profile.clone());
        }

        self.persist_profiles(&*lock)?;
        debug!("Saved profile {} to disk", profile_id);
        Ok(profile)
    }

    /// Deletes a profile and cleans its secret from the vault.
    pub fn delete_profile(&self, profile_id: &str) -> Result<(), AppError> {
        let _ = self.vault.remove_secret(profile_id);

        let mut lock = self.profiles.lock().unwrap();
        lock.retain(|p| p.id != profile_id);
        self.persist_profiles(&*lock)?;
        info!("Deleted profile {}", profile_id);
        Ok(())
    }

    /// Saves updated security settings.
    pub fn save_security_settings(&self, settings: StoredSecuritySettings) -> Result<(), AppError> {
        self.persist_settings(&settings)?;
        let mut lock = self.security_settings.lock().unwrap();
        *lock = settings;
        Ok(())
    }

    /// Saves split tunneling rules.
    pub fn save_split_rules(
        &self,
        app_rules: Vec<StoredAppRule>,
        ip_rules: Vec<StoredIpRule>,
    ) -> Result<(), AppError> {
        self.persist_split_rules(&app_rules, &ip_rules)?;
        let mut app_lock = self.app_rules.lock().unwrap();
        let mut ip_lock = self.ip_rules.lock().unwrap();
        *app_lock = app_rules;
        *ip_lock = ip_rules;
        Ok(())
    }

    // Helper file persistence
    fn persist_profiles(&self, profiles: &[StoredProfile]) -> Result<(), AppError> {
        let path = self.base_dir.join("profiles.json");
        let serialized = serde_json::to_string_pretty(profiles)
            .map_err(|e| AppError::Ipc(format!("Serialize profiles failed: {}", e)))?;
        fs::write(path, serialized)?;
        Ok(())
    }

    fn persist_settings(&self, settings: &StoredSecuritySettings) -> Result<(), AppError> {
        let path = self.base_dir.join("settings.json");
        let serialized = serde_json::to_string_pretty(settings)
            .map_err(|e| AppError::Ipc(format!("Serialize settings failed: {}", e)))?;
        fs::write(path, serialized)?;
        Ok(())
    }

    fn persist_split_rules(
        &self,
        app_rules: &[StoredAppRule],
        ip_rules: &[StoredIpRule],
    ) -> Result<(), AppError> {
        let path = self.base_dir.join("rules.json");
        let serialized = serde_json::to_string_pretty(&(app_rules, ip_rules))
            .map_err(|e| AppError::Ipc(format!("Serialize rules failed: {}", e)))?;
        fs::write(path, serialized)?;
        Ok(())
    }
}
