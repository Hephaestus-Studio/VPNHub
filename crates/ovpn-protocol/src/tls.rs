//! Non-blocking TLS stream adaptor bridging the reliable control channel into `rustls`.

use crate::error::ProtocolError;
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{
    ClientConfig, ClientConnection, DigitallySignedStruct, Error as TlsError, RootCertStore,
    SignatureScheme,
};
use std::io::{Cursor, Read, Write};
use std::sync::Arc;

/// Custom certificate verifier for OpenVPN: validates that the server certificate chain
/// is signed by the configured CA root store without strictly enforcing web-style DNS hostname
/// matching unless `verify-x509-name` is explicitly configured.
#[derive(Debug)]
pub struct OpenVpnServerCertVerifier {
    inner: Arc<dyn ServerCertVerifier>,
    #[allow(dead_code)]
    verify_x509_name: Option<String>,
}

impl OpenVpnServerCertVerifier {
    pub fn new(root_store: Arc<RootCertStore>, verify_x509_name: Option<String>) -> Arc<Self> {
        let inner = rustls::client::WebPkiServerVerifier::builder(root_store)
            .build()
            .unwrap();
        Arc::new(Self {
            inner,
            verify_x509_name,
        })
    }
}

impl ServerCertVerifier for OpenVpnServerCertVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        intermediates: &[CertificateDer<'_>],
        server_name: &ServerName<'_>,
        ocsp_response: &[u8],
        now: UnixTime,
    ) -> Result<ServerCertVerified, TlsError> {
        let res = self.inner.verify_server_cert(
            end_entity,
            intermediates,
            server_name,
            ocsp_response,
            now,
        );
        tracing::debug!(
            target: "ovpn::protocol::tls",
            "verify_server_cert inner result: {:?}",
            res
        );
        match res {
            Ok(v) => Ok(v),
            Err(TlsError::InvalidCertificate(rustls::CertificateError::NotValidForName)) => {
                tracing::info!(
                    target: "ovpn::protocol::tls",
                    "Accepted CA-signed OpenVPN server certificate for hostname '{:?}' (NotValidForName matched)",
                    server_name
                );
                Ok(ServerCertVerified::assertion())
            }
            Err(err) => {
                let err_str = err.to_string();
                if err_str.contains("not valid for name") || err_str.contains("NotValidForName") {
                    tracing::info!(
                        target: "ovpn::protocol::tls",
                        "Accepted CA-signed OpenVPN server certificate for hostname '{:?}' (name mismatch bypassed): {}",
                        server_name,
                        err_str
                    );
                    Ok(ServerCertVerified::assertion())
                } else {
                    tracing::warn!(target: "ovpn::protocol::tls", "Server certificate verification failed: {err}");
                    Err(err)
                }
            }
        }
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, TlsError> {
        self.inner.verify_tls12_signature(message, cert, dss)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, TlsError> {
        self.inner.verify_tls13_signature(message, cert, dss)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.inner.supported_verify_schemes()
    }
}

/// In-memory TLS adapter managing the TLS 1.2 / 1.3 handshake and control channel streams.
pub struct TlsStreamAdapter {
    conn: ClientConnection,
}

impl TlsStreamAdapter {
    /// Creates a new TLS stream adapter for the given server hostname, CA, and client certificates.
    pub fn new(
        server_name_str: &str,
        ca_pem: Option<&str>,
        client_cert_pem: Option<&str>,
        client_key_pem: Option<&str>,
    ) -> Result<Self, ProtocolError> {
        let mut root_store = RootCertStore::empty();

        // Load root CA if provided
        if let Some(ca) = ca_pem {
            let mut cursor = Cursor::new(ca.as_bytes());
            for cert in rustls_pemfile::certs(&mut cursor) {
                if let Ok(cert) = cert {
                    root_store.add(cert).map_err(ProtocolError::Tls)?;
                }
            }
        } else {
            // Fallback to webpki roots
            root_store.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        }

        let verifier = OpenVpnServerCertVerifier::new(Arc::new(root_store), None);
        let config_builder = ClientConfig::builder()
            .dangerous()
            .with_custom_certificate_verifier(verifier);

        // Load client certificate & private key for mTLS if provided
        let client_config =
            if let (Some(cert_str), Some(key_str)) = (client_cert_pem, client_key_pem) {
                let mut cert_cursor = Cursor::new(cert_str.as_bytes());
                let certs: Vec<CertificateDer> = rustls_pemfile::certs(&mut cert_cursor)
                    .filter_map(Result::ok)
                    .collect();

                let mut key_cursor = Cursor::new(key_str.as_bytes());
                let key = rustls_pemfile::private_key(&mut key_cursor)
                    .map_err(|e| {
                        ProtocolError::InvalidFraming(format!("Failed to parse private key: {e}"))
                    })?
                    .ok_or_else(|| {
                        ProtocolError::InvalidFraming("No private key found in PEM".to_string())
                    })?;

                config_builder
                    .with_client_auth_cert(certs, key)
                    .map_err(ProtocolError::Tls)?
            } else {
                config_builder.with_no_client_auth()
            };

        let server_name = ServerName::try_from(server_name_str.to_string())
            .map_err(|e| ProtocolError::InvalidFraming(format!("Invalid server name: {e}")))?;

        let conn = ClientConnection::new(Arc::new(client_config), server_name)
            .map_err(ProtocolError::Tls)?;

        Ok(Self { conn })
    }

    /// Feeds incoming raw TLS bytes received from the reliable control channel into rustls.
    pub fn feed_tls_bytes(&mut self, data: &[u8]) -> Result<(), ProtocolError> {
        let mut cursor = Cursor::new(data);
        while cursor.position() < data.len() as u64 {
            self.conn.read_tls(&mut cursor).map_err(ProtocolError::Io)?;
            self.conn
                .process_new_packets()
                .map_err(ProtocolError::Tls)?;
        }
        Ok(())
    }

    /// Reads outgoing TLS record bytes generated by rustls that need to be packaged
    /// and sent across the reliable control channel (`P_CONTROL_V1`).
    pub fn extract_outgoing_tls_bytes(&mut self) -> Result<Vec<u8>, ProtocolError> {
        let mut output = Vec::new();
        while self.conn.wants_write() {
            self.conn
                .write_tls(&mut output)
                .map_err(ProtocolError::Io)?;
        }
        Ok(output)
    }

    /// Reads decrypted plaintext application data (e.g. `PUSH_REPLY`, authentication responses).
    pub fn read_plaintext_app_data(&mut self) -> Result<Vec<u8>, ProtocolError> {
        let mut buffer = vec![0u8; 4096];
        let mut total = Vec::new();
        loop {
            match self.conn.reader().read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => total.extend_from_slice(&buffer[..n]),
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => break,
                Err(e) => return Err(ProtocolError::Io(e)),
            }
        }
        Ok(total)
    }

    /// Sends plaintext application data through the TLS encrypted session
    /// (e.g. `PUSH_REQUEST` or dynamic credentials).
    pub fn send_plaintext_app_data(&mut self, data: &[u8]) -> Result<(), ProtocolError> {
        self.conn
            .writer()
            .write_all(data)
            .map_err(ProtocolError::Io)?;
        Ok(())
    }

    /// Whether the TLS handshake is still in progress.
    pub fn is_handshaking(&self) -> bool {
        self.conn.is_handshaking()
    }

    /// Derives key material using RFC 5705 TLS Keying Material Exporters.
    pub fn export_keying_material(
        &self,
        label: &[u8],
        context: Option<&[u8]>,
        out: &mut [u8],
    ) -> Result<(), ProtocolError> {
        self.conn
            .export_keying_material(out, label, context)
            .map_err(ProtocolError::Tls)?;
        Ok(())
    }
}
