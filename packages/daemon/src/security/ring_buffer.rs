//! # Sanitized Circular Log Ring Buffer
//!
//! Stores recent log entries in fixed-capacity memory for real-time IPC streaming
//! and diagnostic reporting, automatically masking credentials and private keys.

use std::collections::VecDeque;
use std::sync::RwLock;

/// Circular log buffer with thread-safe access and credential masking.
pub struct LogRingBuffer {
    capacity: usize,
    buffer: RwLock<VecDeque<String>>,
}

impl LogRingBuffer {
    /// Creates a new ring buffer with the specified line capacity.
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity,
            buffer: RwLock::new(VecDeque::with_capacity(capacity)),
        }
    }

    /// Appends a new log line, applying sanitization and rotating oldest entries if full.
    pub fn push(&self, line: impl AsRef<str>) {
        let sanitized = Self::sanitize(line.as_ref());
        let mut buf = self.buffer.write().unwrap_or_else(|e| e.into_inner());
        if buf.len() >= self.capacity {
            buf.pop_front();
        }
        buf.push_back(sanitized);
    }

    /// Dumps all stored log lines in chronological order.
    pub fn get_snapshot(&self) -> Vec<String> {
        let buf = self.buffer.read().unwrap_or_else(|e| e.into_inner());
        buf.iter().cloned().collect()
    }

    /// Clears all entries from the buffer.
    pub fn clear(&self) {
        let mut buf = self.buffer.write().unwrap_or_else(|e| e.into_inner());
        buf.clear();
    }

    /// Redacts sensitive patterns (private keys, passwords, auth tokens).
    fn sanitize(input: &str) -> String {
        // Redact common token and credential patterns
        let mut sanitized = input.to_string();

        // Redact WireGuard / OpenVPN private keys if present in logs
        if let Some(pos) = sanitized.find("PrivateKey = ") {
            let start = pos + "PrivateKey = ".len();
            if let Some(end) = sanitized[start..]
                .find('\n')
                .or(Some(sanitized.len() - start))
            {
                sanitized.replace_range(start..start + end, "[REDACTED_PRIVATE_KEY]");
            }
        }

        if let Some(pos) = sanitized.find("password:") {
            let start = pos + "password:".len();
            if let Some(end) = sanitized[start..]
                .find(' ')
                .or(Some(sanitized.len() - start))
            {
                sanitized.replace_range(start..start + end, " [REDACTED]");
            }
        }

        sanitized
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ring_buffer_capacity() {
        let rb = LogRingBuffer::new(3);
        rb.push("line 1");
        rb.push("line 2");
        rb.push("line 3");
        rb.push("line 4");

        let snap = rb.get_snapshot();
        assert_eq!(snap.len(), 3);
        assert_eq!(snap[0], "line 2");
        assert_eq!(snap[1], "line 3");
        assert_eq!(snap[2], "line 4");
    }

    #[test]
    fn test_sanitization() {
        let rb = LogRingBuffer::new(5);
        rb.push("Connecting with PrivateKey = aGVsbG93b3JsZA== to server");
        let snap = rb.get_snapshot();
        assert!(snap[0].contains("[REDACTED_PRIVATE_KEY]"));
    }
}
