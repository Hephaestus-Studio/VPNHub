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
    /// Initializes StorageManager, creates the secure directory, and loads persisted data.
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

        manager.load_initial_data()?;
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

    /// Loads persisted files from disk or initializes empty storage on first run.
    fn load_initial_data(&self) -> Result<(), AppError> {
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
            self.persist_profiles(&[])?;
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
            self.persist_split_rules(&[], &[])?;
        }

        Ok(())
    }

    /// Returns the full storage snapshot for the frontend.
    pub fn get_full_snapshot(&self) -> FullStorageSnapshot {
        let profiles = self.profiles.lock().unwrap().clone();
        let secrets = self.vault.get_all_secrets();
        let security_settings = self.security_settings.lock().unwrap().clone();
        let app_rules = self.app_rules.lock().unwrap().clone();
        let ip_rules = self.ip_rules.lock().unwrap().clone();

        FullStorageSnapshot {
            profiles,
            secrets,
            security_settings,
            app_rules,
            ip_rules,
        }
    }

    /// Saves or updates a profile with optional secret persistence.
    pub fn save_profile(
        &self,
        mut profile: StoredProfile,
        secret: Option<StoredProfileSecret>,
    ) -> Result<StoredProfile, AppError> {
        if profile.id.trim().is_empty() {
            profile.id = uuid::Uuid::new_v4().to_string();
        }
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
