//! # Atomic State Machine & Event Dispatcher
//!
//! Provides thread-safe, lock-free state transitions and real-time event broadcasting
//! across daemon tasks using Tokio `watch` and `broadcast` channels.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::{broadcast, watch};
use tracing::{debug, info, warn};

use crate::error::DaemonError;
use crate::ipc::protocol::{DaemonEvent, SessionState};

/// Manages atomic state machine transitions and distributes event notifications.
#[derive(Clone)]
pub struct StateManager {
    state_tx: Arc<watch::Sender<SessionState>>,
    state_rx: watch::Receiver<SessionState>,
    event_tx: broadcast::Sender<DaemonEvent>,
    session_start_epoch_secs: Arc<AtomicU64>,
}

impl Default for StateManager {
    fn default() -> Self {
        Self::new()
    }
}

impl StateManager {
    /// Initializes a new state manager starting in `Disconnected` state.
    pub fn new() -> Self {
        let (state_tx, state_rx) = watch::channel(SessionState::Disconnected);
        let (event_tx, _) = broadcast::channel(256);

        Self {
            state_tx: Arc::new(state_tx),
            state_rx,
            event_tx,
            session_start_epoch_secs: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Reads the current session state.
    pub fn current_state(&self) -> SessionState {
        *self.state_rx.borrow()
    }

    /// Subscribes to atomic state transitions.
    pub fn subscribe_state(&self) -> watch::Receiver<SessionState> {
        self.state_rx.clone()
    }

    /// Subscribes to real-time asynchronous push events.
    pub fn subscribe_events(&self) -> broadcast::Receiver<DaemonEvent> {
        self.event_tx.subscribe()
    }

    /// Access the broadcast sender for publishing events.
    pub fn event_sender(&self) -> broadcast::Sender<DaemonEvent> {
        self.event_tx.clone()
    }

    /// Publishes a general push event to all connected listeners.
    pub fn emit_event(&self, event: DaemonEvent) {
        let _ = self.event_tx.send(event);
    }

    /// Attempts to transition to a new state, enforcing validity constraints.
    pub fn transition_to(
        &self,
        new_state: SessionState,
        reason: Option<String>,
    ) -> Result<(), DaemonError> {
        let current = self.current_state();

        if current == new_state {
            debug!("State transition ignored: already in {:?}", new_state);
            return Ok(());
        }

        if !Self::is_valid_transition(current, new_state) {
            warn!(
                "Invalid state transition attempted: {:?} -> {:?}",
                current, new_state
            );
            return Err(DaemonError::InvalidState(format!(
                "Cannot transition from {:?} to {:?}",
                current, new_state
            )));
        }

        if new_state == SessionState::Connected {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            self.session_start_epoch_secs.store(now, Ordering::Relaxed);
        } else if new_state == SessionState::Disconnected {
            self.session_start_epoch_secs.store(0, Ordering::Relaxed);
        }

        info!(
            "Session state changed: {:?} -> {:?} (reason: {:?})",
            current, new_state, reason
        );

        let _ = self.state_tx.send(new_state);

        self.emit_event(DaemonEvent::StateChanged {
            previous: current,
            current: new_state,
            reason,
        });

        Ok(())
    }

    /// Returns session duration in seconds (0 if not connected).
    pub fn session_duration_secs(&self) -> u64 {
        let start = self.session_start_epoch_secs.load(Ordering::Relaxed);
        if start == 0 {
            0
        } else {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            now.saturating_sub(start)
        }
    }

    /// Validates whether a state transition is legal in the lifecycle.
    fn is_valid_transition(from: SessionState, to: SessionState) -> bool {
        match (from, to) {
            // From Disconnected can go to Connecting
            (SessionState::Disconnected, SessionState::Connecting) => true,

            // From Connecting can go to Connected, Error, Disconnecting, or Reconnecting
            (SessionState::Connecting, SessionState::Connected) => true,
            (SessionState::Connecting, SessionState::Error) => true,
            (SessionState::Connecting, SessionState::Disconnecting) => true,
            (SessionState::Connecting, SessionState::Reconnecting) => true,

            // From Connected can go to Reconnecting, Disconnecting, or Error
            (SessionState::Connected, SessionState::Reconnecting) => true,
            (SessionState::Connected, SessionState::Disconnecting) => true,
            (SessionState::Connected, SessionState::Error) => true,

            // From Reconnecting can go back to Connected, Disconnecting, or Error
            (SessionState::Reconnecting, SessionState::Connected) => true,
            (SessionState::Reconnecting, SessionState::Disconnecting) => true,
            (SessionState::Reconnecting, SessionState::Error) => true,

            // From Disconnecting can go to Disconnected or Error
            (SessionState::Disconnecting, SessionState::Disconnected) => true,
            (SessionState::Disconnecting, SessionState::Error) => true,

            // From Error can recover to Disconnected, attempt Connecting, or Disconnecting for teardown
            (SessionState::Error, SessionState::Disconnected) => true,
            (SessionState::Error, SessionState::Connecting) => true,
            (SessionState::Error, SessionState::Disconnecting) => true,

            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_state_transitions() {
        let sm = StateManager::new();
        assert_eq!(sm.current_state(), SessionState::Disconnected);

        assert!(sm
            .transition_to(SessionState::Connecting, Some("User requested".to_string()))
            .is_ok());
        assert_eq!(sm.current_state(), SessionState::Connecting);

        assert!(sm.transition_to(SessionState::Connected, None).is_ok());
        assert_eq!(sm.current_state(), SessionState::Connected);

        assert!(sm.transition_to(SessionState::Disconnecting, None).is_ok());
        assert_eq!(sm.current_state(), SessionState::Disconnecting);

        assert!(sm.transition_to(SessionState::Disconnected, None).is_ok());
        assert_eq!(sm.current_state(), SessionState::Disconnected);
    }

    #[test]
    fn test_invalid_state_transition() {
        let sm = StateManager::new();
        // Disconnected -> Connected directly is invalid (must go through Connecting)
        assert!(sm.transition_to(SessionState::Connected, None).is_err());
    }
}
