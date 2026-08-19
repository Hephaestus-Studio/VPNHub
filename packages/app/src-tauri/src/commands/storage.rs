//! # Tauri Storage & Encryption Commands

use std::sync::Arc;
use tauri::State;

use crate::error::AppError;
use crate::storage::{
    FullStorageSnapshot, StorageManager, StoredAppRule, StoredIpRule, StoredProfile,
    StoredProfileSecret, StoredSecuritySettings,
};

#[tauri::command]
pub async fn storage_load_all(
    storage: State<'_, Arc<StorageManager>>,
) -> Result<FullStorageSnapshot, AppError> {
    Ok(storage.get_full_snapshot())
}

#[tauri::command]
pub async fn storage_save_profile(
    storage: State<'_, Arc<StorageManager>>,
    profile: StoredProfile,
    secret: Option<StoredProfileSecret>,
) -> Result<StoredProfile, AppError> {
    storage.save_profile(profile, secret)
}

#[tauri::command]
pub async fn storage_delete_profile(
    storage: State<'_, Arc<StorageManager>>,
    profile_id: String,
) -> Result<(), AppError> {
    storage.delete_profile(&profile_id)
}

#[tauri::command]
pub async fn storage_save_security_settings(
    storage: State<'_, Arc<StorageManager>>,
    settings: StoredSecuritySettings,
) -> Result<(), AppError> {
    storage.save_security_settings(settings)
}

#[tauri::command]
pub async fn storage_save_split_rules(
    storage: State<'_, Arc<StorageManager>>,
    app_rules: Vec<StoredAppRule>,
    ip_rules: Vec<StoredIpRule>,
) -> Result<(), AppError> {
    storage.save_split_rules(app_rules, ip_rules)
}

#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, AppError> {
    std::fs::read_to_string(&path).map_err(AppError::Io)
}
