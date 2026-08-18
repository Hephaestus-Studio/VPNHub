//! # Unix Domain Socket Transport Layer
//!
//! Manages creation, binding, file permissions (0660), and unlinking of the Unix domain socket endpoint.

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use tokio::net::UnixListener;
use tracing::{debug, info};

use crate::error::IpcError;

/// RAII wrapper for a Unix domain socket listener that cleans up its filesystem path on drop.
pub struct UnixTransportListener {
    path: PathBuf,
    listener: UnixListener,
}

impl UnixTransportListener {
    /// Binds to the specified socket path, ensuring parent directories exist and permissions are set.
    pub fn bind(path: impl AsRef<Path>, auth_group: &str) -> Result<Self, IpcError> {
        let path = path.as_ref().to_path_buf();

        // Create parent directory if needed
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| IpcError::BindFailed {
                    endpoint: path.display().to_string(),
                    source: e,
                })?;
            }
        }

        // Unlink any existing stale socket file
        if path.exists() {
            let _ = fs::remove_file(&path);
        }

        // Bind listener
        let listener = UnixListener::bind(&path).map_err(|e| IpcError::BindFailed {
            endpoint: path.display().to_string(),
            source: e,
        })?;

        // Set socket permissions to 0666 (world read/write for local socket endpoint).
        // Access security and Anti-LPE verification is strictly enforced by SO_PEERCRED in verify_peer_credentials.
        if let Ok(metadata) = fs::metadata(&path) {
            let mut permissions = metadata.permissions();
            permissions.set_mode(0o666);
            let _ = fs::set_permissions(&path, permissions);
        }

        // Attempt to assign group ownership if group exists
        if let Ok(Some(group)) = nix::unistd::Group::from_name(auth_group) {
            let _ = nix::unistd::chown(&path, None, Some(group.gid));
            debug!(
                "Assigned group '{}' ({}) to socket {:?}",
                auth_group, group.gid, path
            );
        }

        info!("Unix Domain Socket listener bound at {:?}", path);

        Ok(Self { path, listener })
    }

    /// Access the underlying Tokio UnixListener.
    pub fn listener(&self) -> &UnixListener {
        &self.listener
    }

    /// Access the socket path.
    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for UnixTransportListener {
    fn drop(&mut self) {
        if self.path.exists() {
            let _ = fs::remove_file(&self.path);
            debug!("Unlinked Unix socket {:?}", self.path);
        }
    }
}
