import React, { useState, useEffect } from "react";
import {
  Modal,
  Tabs,
  Group,
  Stack,
  Button,
  Text,
  Textarea,
  Select,
  NumberInput,
  Switch,
  Box,
  Badge,
  ActionIcon,
  Divider,
  Paper,
} from "@mantine/core";
import {
  IconCertificate,
  IconKey,
  IconShieldLock,
  IconAdjustments,
  IconUpload,
  IconTrash,
  IconCheck,
  IconFileText,
} from "@tabler/icons-react";

export interface TlsSecurityConfig {
  caCert?: string;
  tlsAuthKey?: string;
  tlsCryptKey?: string;
  keyDirection?: string;
  clientCert?: string;
  clientKey?: string;
  remoteCertTlsServer?: boolean;
  renegSec?: number;
}

interface CertificateManagerModalProps {
  opened: boolean;
  onClose: () => void;
  config: TlsSecurityConfig;
  onSave: (config: TlsSecurityConfig) => void;
}

const triggerFilePicker = (
  accept: string,
  onLoaded: (content: string, filename: string) => void
) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || "";
      onLoaded(text.trim(), file.name);
    };
    reader.readAsText(file);
  };
  input.click();
};

export const CertificateManagerModal: React.FC<CertificateManagerModalProps> = ({
  opened,
  onClose,
  config,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<string | null>("ca");

  // Local state for editing
  const [caCert, setCaCert] = useState("");
  const [tlsMode, setTlsMode] = useState<"none" | "tls-auth" | "tls-crypt">("none");
  const [tlsAuthKey, setTlsAuthKey] = useState("");
  const [tlsCryptKey, setTlsCryptKey] = useState("");
  const [keyDirection, setKeyDirection] = useState("none");
  const [clientCert, setClientCert] = useState("");
  const [clientKey, setClientKey] = useState("");
  const [remoteCertTlsServer, setRemoteCertTlsServer] = useState(true);
  const [renegSec, setRenegSec] = useState<number | undefined>(undefined);

  // Sync state when modal opens
  useEffect(() => {
    if (opened) {
      setCaCert(config.caCert || "");
      if (config.tlsCryptKey) {
        setTlsMode("tls-crypt");
      } else if (config.tlsAuthKey) {
        setTlsMode("tls-auth");
      } else {
        setTlsMode("none");
      }
      setTlsAuthKey(config.tlsAuthKey || "");
      setTlsCryptKey(config.tlsCryptKey || "");
      setKeyDirection(config.keyDirection || "none");
      setClientCert(config.clientCert || "");
      setClientKey(config.clientKey || "");
      setRemoteCertTlsServer(
        config.remoteCertTlsServer !== undefined ? config.remoteCertTlsServer : true
      );
      setRenegSec(config.renegSec);
    }
  }, [opened, config]);

  const handleSave = () => {
    onSave({
      caCert: caCert.trim() || undefined,
      tlsAuthKey: tlsMode === "tls-auth" ? tlsAuthKey.trim() || undefined : undefined,
      tlsCryptKey: tlsMode === "tls-crypt" ? tlsCryptKey.trim() || undefined : undefined,
      keyDirection: tlsMode === "tls-auth" ? keyDirection : undefined,
      clientCert: clientCert.trim() || undefined,
      clientKey: clientKey.trim() || undefined,
      remoteCertTlsServer,
      renegSec,
    });
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconShieldLock size={20} color="var(--vpn-cyan)" />
          <Text fw={700} size="md" style={{ color: "#fff" }}>
            TLS & Certificate Security Manager
          </Text>
        </Group>
      }
      size="lg"
      centered
      styles={{
        content: {
          background: "rgba(17, 24, 39, 0.98)",
          backdropFilter: "blur(20px)",
          border: "1px solid var(--vpn-border)",
          borderRadius: 12,
          minHeight: 520,
        },
        header: {
          background: "transparent",
          borderBottom: "1px solid var(--vpn-border)",
          paddingBottom: 12,
        },
        body: {
          padding: "16px 20px",
        },
      }}
    >
      <Stack gap="md">
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          color="cyan"
          styles={{
            list: {
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            },
            tab: {
              color: "rgba(255, 255, 255, 0.7)",
              fontWeight: 500,
              fontSize: 13,
              "&[data-active]": {
                color: "var(--vpn-cyan)",
                borderColor: "var(--vpn-cyan)",
              },
            },
          }}
        >
          <Tabs.List>
            <Tabs.Tab
              value="ca"
              leftSection={<IconCertificate size={15} />}
              rightSection={
                caCert ? (
                  <Badge size="xs" color="teal" variant="filled" circle>
                    ✓
                  </Badge>
                ) : null
              }
            >
              Root CA
            </Tabs.Tab>
            <Tabs.Tab
              value="tls"
              leftSection={<IconKey size={15} />}
              rightSection={
                (tlsMode === "tls-auth" && tlsAuthKey) ||
                (tlsMode === "tls-crypt" && tlsCryptKey) ? (
                  <Badge size="xs" color="teal" variant="filled" circle>
                    ✓
                  </Badge>
                ) : null
              }
            >
              TLS Channel
            </Tabs.Tab>
            <Tabs.Tab
              value="client"
              leftSection={<IconFileText size={15} />}
              rightSection={
                clientCert || clientKey ? (
                  <Badge size="xs" color="teal" variant="filled" circle>
                    ✓
                  </Badge>
                ) : null
              }
            >
              Client Identity
            </Tabs.Tab>
            <Tabs.Tab value="advanced" leftSection={<IconAdjustments size={15} />}>
              Advanced
            </Tabs.Tab>
          </Tabs.List>

          {/* TAB 1: ROOT CA */}
          <Tabs.Panel value="ca" pt="md">
            <Stack gap="sm">
              <Paper
                p="xs"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 8,
                }}
              >
                <Group justify="space-between" align="center">
                  <Box>
                    <Text size="xs" fw={600} style={{ color: "#fff" }}>
                      Certificate Authority (&lt;ca&gt;)
                    </Text>
                    <Text size="11px" c="dimmed">
                      {caCert
                        ? `Custom Root CA Loaded (${caCert.length} characters)`
                        : "Operating system default Root CA bundle will be used."}
                    </Text>
                  </Box>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="light"
                      color="cyan"
                      leftSection={<IconUpload size={13} />}
                      onClick={() =>
                        triggerFilePicker(".crt,.pem,.cer,.txt", (content) => setCaCert(content))
                      }
                    >
                      Import .crt / .pem
                    </Button>
                    {caCert && (
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => setCaCert("")}
                        title="Clear CA Certificate"
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    )}
                  </Group>
                </Group>
              </Paper>

              <Textarea
                label="Root CA PEM Content"
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                value={caCert}
                onChange={(e) => setCaCert(e.currentTarget.value)}
                minRows={6}
                maxRows={10}
                autosize
                className="font-mono"
                styles={{
                  input: {
                    fontSize: 11,
                  },
                }}
              />
            </Stack>
          </Tabs.Panel>

          {/* TAB 2: TLS AUTH & CRYPT */}
          <Tabs.Panel value="tls" pt="md">
            <Stack gap="sm">
              <Select
                label="TLS Channel Protection Mode"
                description="Provides an additional HMAC signature or control channel encryption layer."
                value={tlsMode}
                onChange={(val) => setTlsMode((val as any) || "none")}
                data={[
                  { value: "none", label: "None (Standard OpenVPN TLS Handshake)" },
                  { value: "tls-auth", label: "TLS-Auth (<tls-auth>) - Static HMAC Signature" },
                  {
                    value: "tls-crypt",
                    label: "TLS-Crypt (<tls-crypt>) - Full Control Channel Encryption",
                  },
                ]}
              />

              {tlsMode === "tls-auth" && (
                <Stack gap="xs" mt="xs">
                  <Paper
                    p="xs"
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: 8,
                    }}
                  >
                    <Group justify="space-between" align="center">
                      <Box>
                        <Text size="xs" fw={600} style={{ color: "#fff" }}>
                          TLS-Auth Static Key
                        </Text>
                        <Text size="11px" c="dimmed">
                          {tlsAuthKey
                            ? `Static Key Loaded (${tlsAuthKey.length} chars)`
                            : "No key loaded"}
                        </Text>
                      </Box>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          color="cyan"
                          leftSection={<IconUpload size={13} />}
                          onClick={() =>
                            triggerFilePicker(".key,.pem,.txt", (content) => setTlsAuthKey(content))
                          }
                        >
                          Import .key file
                        </Button>
                        {tlsAuthKey && (
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={() => setTlsAuthKey("")}
                            title="Clear TLS Auth Key"
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Group>
                  </Paper>

                  <Group grow align="flex-start">
                    <Textarea
                      label="TLS Auth Key Content (<tls-auth>)"
                      placeholder="-----BEGIN OpenVPN Static key V1-----&#10;...&#10;-----END OpenVPN Static key V1-----"
                      value={tlsAuthKey}
                      onChange={(e) => setTlsAuthKey(e.currentTarget.value)}
                      minRows={4}
                      maxRows={8}
                      autosize
                      className="font-mono"
                      styles={{
                        input: {
                          fontSize: 11,
                        },
                      }}
                    />

                    <Select
                      label="Key Direction (key-direction)"
                      description="Must match the server configuration."
                      value={keyDirection}
                      onChange={(val) => setKeyDirection(val || "none")}
                      data={[
                        { value: "none", label: "None / Bidirectional" },
                        { value: "0", label: "0 (Client / Incoming)" },
                        { value: "1", label: "1 (Server / Outgoing)" },
                      ]}
                      style={{ maxWidth: 200 }}
                    />
                  </Group>
                </Stack>
              )}

              {tlsMode === "tls-crypt" && (
                <Stack gap="xs" mt="xs">
                  <Paper
                    p="xs"
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: 8,
                    }}
                  >
                    <Group justify="space-between" align="center">
                      <Box>
                        <Text size="xs" fw={600} style={{ color: "#fff" }}>
                          TLS-Crypt Symmetric Key
                        </Text>
                        <Text size="11px" c="dimmed">
                          {tlsCryptKey
                            ? `TLS-Crypt Key Loaded (${tlsCryptKey.length} chars)`
                            : "No key loaded"}
                        </Text>
                      </Box>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          color="cyan"
                          leftSection={<IconUpload size={13} />}
                          onClick={() =>
                            triggerFilePicker(".key,.pem,.txt", (content) =>
                              setTlsCryptKey(content)
                            )
                          }
                        >
                          Import .key file
                        </Button>
                        {tlsCryptKey && (
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={() => setTlsCryptKey("")}
                            title="Clear TLS Crypt Key"
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Group>
                  </Paper>

                  <Textarea
                    label="TLS Crypt Key Content (<tls-crypt>)"
                    placeholder="-----BEGIN OpenVPN Static key V1-----&#10;...&#10;-----END OpenVPN Static key V1-----"
                    value={tlsCryptKey}
                    onChange={(e) => setTlsCryptKey(e.currentTarget.value)}
                    minRows={5}
                    maxRows={8}
                    autosize
                    className="font-mono"
                    styles={{
                      input: {
                        fontSize: 11,
                      },
                    }}
                  />
                </Stack>
              )}
            </Stack>
          </Tabs.Panel>

          {/* TAB 3: CLIENT CERTIFICATE & KEY */}
          <Tabs.Panel value="client" pt="md">
            <Stack gap="md">
              <Text size="xs" c="dimmed">
                Required for Mutual TLS (mTLS) or certificate-based client authentication.
              </Text>

              {/* Client Cert */}
              <Box>
                <Paper
                  p="xs"
                  mb="xs"
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: 8,
                  }}
                >
                  <Group justify="space-between" align="center">
                    <Box>
                      <Text size="xs" fw={600} style={{ color: "#fff" }}>
                        Client Certificate (&lt;cert&gt;)
                      </Text>
                      <Text size="11px" c="dimmed">
                        {clientCert
                          ? `Client Certificate Loaded (${clientCert.length} chars)`
                          : "No certificate"}
                      </Text>
                    </Box>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="light"
                        color="cyan"
                        leftSection={<IconUpload size={13} />}
                        onClick={() =>
                          triggerFilePicker(".crt,.pem,.cer,.txt", (content) =>
                            setClientCert(content)
                          )
                        }
                      >
                        Import .crt
                      </Button>
                      {clientCert && (
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={() => setClientCert("")}
                          title="Clear Client Cert"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Group>
                </Paper>

                <Textarea
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  value={clientCert}
                  onChange={(e) => setClientCert(e.currentTarget.value)}
                  minRows={3}
                  maxRows={5}
                  autosize
                  className="font-mono"
                  styles={{
                    input: {
                      fontSize: 11,
                    },
                  }}
                />
              </Box>

              {/* Client Key */}
              <Box>
                <Paper
                  p="xs"
                  mb="xs"
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: 8,
                  }}
                >
                  <Group justify="space-between" align="center">
                    <Box>
                      <Text size="xs" fw={600} style={{ color: "#fff" }}>
                        Client Private Key (&lt;key&gt;)
                      </Text>
                      <Text size="11px" c="dimmed">
                        {clientKey
                          ? `Private Key Loaded (${clientKey.length} chars)`
                          : "No private key"}
                      </Text>
                    </Box>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="light"
                        color="cyan"
                        leftSection={<IconUpload size={13} />}
                        onClick={() =>
                          triggerFilePicker(".key,.pem,.txt", (content) => setClientKey(content))
                        }
                      >
                        Import .key
                      </Button>
                      {clientKey && (
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={() => setClientKey("")}
                          title="Clear Client Key"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Group>
                </Paper>

                <Textarea
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                  value={clientKey}
                  onChange={(e) => setClientKey(e.currentTarget.value)}
                  minRows={3}
                  maxRows={5}
                  autosize
                  className="font-mono"
                  styles={{
                    input: {
                      fontSize: 11,
                    },
                  }}
                />
              </Box>
            </Stack>
          </Tabs.Panel>

          {/* TAB 4: ADVANCED SETTINGS */}
          <Tabs.Panel value="advanced" pt="md">
            <Stack gap="md">
              <Paper
                p="sm"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 8,
                }}
              >
                <Group justify="space-between" align="center">
                  <Box>
                    <Text size="xs" fw={600} style={{ color: "#fff" }}>
                      Verify Server Certificate
                    </Text>
                    <Text size="11px" c="dimmed">
                      Enforces server certificate validation flag (
                      <code>remote-cert-tls server</code>)
                    </Text>
                  </Box>
                  <Switch
                    checked={remoteCertTlsServer}
                    onChange={(e) => setRemoteCertTlsServer(e.currentTarget.checked)}
                    color="cyan"
                  />
                </Group>
              </Paper>

              <NumberInput
                label="Renegotiation Interval (reneg-sec)"
                placeholder="e.g. 0 to disable data channel re-keying"
                description="Default: 3600 seconds. Set to 0 if your server or cloud VPN disables renegotiation."
                value={renegSec}
                onChange={(val) =>
                  setRenegSec(val !== "" && val !== undefined ? Number(val) : undefined)
                }
                min={0}
                style={{ maxWidth: 280 }}
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Divider color="rgba(255, 255, 255, 0.08)" my="xs" />

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button color="cyan" leftSection={<IconCheck size={16} />} onClick={handleSave}>
            Apply Certificate Settings
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
