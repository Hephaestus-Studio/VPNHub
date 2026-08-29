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
import { useTranslation } from "../../i18n";
import styles from "./CertificateManagerModal.module.css";

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
  const { t } = useTranslation();
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
          <Text fw={700} size="md" className={styles.modalTitle}>
            {t.modals.certManagerTitle}
          </Text>
        </Group>
      }
      size="lg"
      centered
      classNames={{
        content: styles.modalContent,
        header: styles.modalHeader,
        body: styles.modalBody,
      }}
    >
      <Stack gap="md">
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          color="cyan"
          classNames={{
            list: styles.tabsList,
            tab: styles.tabItem,
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
              {t.modals.tabRootCa}
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
              {t.modals.tabTlsChannel}
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
              {t.modals.tabClientIdentity}
            </Tabs.Tab>
            <Tabs.Tab value="advanced" leftSection={<IconAdjustments size={15} />}>
              {t.modals.tabAdvanced}
            </Tabs.Tab>
          </Tabs.List>

          {/* TAB 1: ROOT CA */}
          <Tabs.Panel value="ca" pt="md">
            <Stack gap="sm">
              <Paper p="xs" className={styles.paperBox}>
                <Group justify="space-between" align="center">
                  <Box>
                    <Text size="xs" fw={600} className={styles.paperTitle}>
                      {t.modals.rootCaTitle}
                    </Text>
                    <Text size="11px" c="dimmed">
                      {caCert
                        ? t.modals.rootCaLoaded.replace("{length}", String(caCert.length))
                        : t.modals.rootCaDefaultSystem}
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
                      {t.modals.importCrtPem}
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
                label={t.modals.rootCaPemLabel}
                placeholder={t.modals.rootCaPemPlaceholder}
                value={caCert}
                onChange={(e) => setCaCert(e.currentTarget.value)}
                minRows={6}
                maxRows={10}
                autosize
                className="font-mono"
                classNames={{
                  input: styles.codeTextareaInput,
                }}
              />
            </Stack>
          </Tabs.Panel>

          {/* TAB 2: TLS AUTH & CRYPT */}
          <Tabs.Panel value="tls" pt="md">
            <Stack gap="sm">
              <Select
                label={t.modals.tlsModeLabel}
                description={t.modals.tlsModeDesc}
                value={tlsMode}
                onChange={(val) => setTlsMode((val as any) || "none")}
                data={[
                  { value: "none", label: t.modals.tlsModeNone },
                  { value: "tls-auth", label: t.modals.tlsModeAuth },
                  {
                    value: "tls-crypt",
                    label: t.modals.tlsModeCrypt,
                  },
                ]}
              />

              {tlsMode === "tls-auth" && (
                <Stack gap="xs" mt="xs">
                  <Paper p="xs" className={styles.paperBox}>
                    <Group justify="space-between" align="center">
                      <Box>
                        <Text size="xs" fw={600} className={styles.paperTitle}>
                          {t.modals.tlsAuthStaticKeyTitle}
                        </Text>
                        <Text size="11px" c="dimmed">
                          {tlsAuthKey
                            ? t.modals.tlsKeyLoaded.replace("{length}", String(tlsAuthKey.length))
                            : t.modals.noKeyLoaded}
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
                          {t.modals.importKeyFile}
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
                      label={t.modals.tlsAuthKeyContentLabel}
                      placeholder="-----BEGIN OpenVPN Static key V1-----&#10;...&#10;-----END OpenVPN Static key V1-----"
                      value={tlsAuthKey}
                      onChange={(e) => setTlsAuthKey(e.currentTarget.value)}
                      minRows={4}
                      maxRows={8}
                      autosize
                      className="font-mono"
                      classNames={{
                        input: styles.codeTextareaInput,
                      }}
                    />

                    <Select
                      label={t.modals.keyDirectionLabel}
                      description={t.modals.keyDirectionDesc}
                      value={keyDirection}
                      onChange={(val) => setKeyDirection(val || "none")}
                      data={[
                        { value: "none", label: t.modals.keyDirNone },
                        { value: "0", label: t.modals.keyDir0 },
                        { value: "1", label: t.modals.keyDir1 },
                      ]}
                      className={styles.selectKeyDirection}
                    />
                  </Group>
                </Stack>
              )}

              {tlsMode === "tls-crypt" && (
                <Stack gap="xs" mt="xs">
                  <Paper p="xs" className={styles.paperBox}>
                    <Group justify="space-between" align="center">
                      <Box>
                        <Text size="xs" fw={600} className={styles.paperTitle}>
                          {t.modals.tlsCryptKeyTitle}
                        </Text>
                        <Text size="11px" c="dimmed">
                          {tlsCryptKey
                            ? t.modals.tlsKeyLoaded.replace("{length}", String(tlsCryptKey.length))
                            : t.modals.noKeyLoaded}
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
                          {t.modals.importKeyFile}
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
                    label={t.modals.tlsCryptKeyContentLabel}
                    placeholder="-----BEGIN OpenVPN Static key V1-----&#10;...&#10;-----END OpenVPN Static key V1-----"
                    value={tlsCryptKey}
                    onChange={(e) => setTlsCryptKey(e.currentTarget.value)}
                    minRows={5}
                    maxRows={8}
                    autosize
                    className="font-mono"
                    classNames={{
                      input: styles.codeTextareaInput,
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
                {t.modals.clientIdentityDesc}
              </Text>

              {/* Client Cert */}
              <Box>
                <Paper p="xs" mb="xs" className={styles.paperBox}>
                  <Group justify="space-between" align="center">
                    <Box>
                      <Text size="xs" fw={600} className={styles.paperTitle}>
                        {t.modals.clientCertTitle}
                      </Text>
                      <Text size="11px" c="dimmed">
                        {clientCert
                          ? t.modals.clientCertLoaded.replace("{length}", String(clientCert.length))
                          : t.modals.noCertLoaded}
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
                        {t.modals.importCrt}
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
                  classNames={{
                    input: styles.codeTextareaInput,
                  }}
                />
              </Box>

              {/* Client Key */}
              <Box>
                <Paper p="xs" mb="xs" className={styles.paperBox}>
                  <Group justify="space-between" align="center">
                    <Box>
                      <Text size="xs" fw={600} className={styles.paperTitle}>
                        {t.modals.clientKeyTitle}
                      </Text>
                      <Text size="11px" c="dimmed">
                        {clientKey
                          ? t.modals.clientKeyLoaded.replace("{length}", String(clientKey.length))
                          : t.modals.noPrivateKeyLoaded}
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
                        {t.modals.importKey}
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
                  classNames={{
                    input: styles.codeTextareaInput,
                  }}
                />
              </Box>
            </Stack>
          </Tabs.Panel>

          {/* TAB 4: ADVANCED SETTINGS */}
          <Tabs.Panel value="advanced" pt="md">
            <Stack gap="md">
              <Paper p="sm" className={styles.paperBox}>
                <Group justify="space-between" align="center">
                  <Box>
                    <Text size="xs" fw={600} className={styles.paperTitle}>
                      {t.modals.verifyServerCertTitle}
                    </Text>
                    <Text size="11px" c="dimmed">
                      {t.modals.verifyServerCertDesc}
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
                label={t.modals.renegSecLabel}
                placeholder={t.modals.renegSecPlaceholder}
                description={t.modals.renegSecDesc}
                value={renegSec}
                onChange={(val) =>
                  setRenegSec(val !== "" && val !== undefined ? Number(val) : undefined)
                }
                min={0}
                className={styles.renegInput}
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Divider color="rgba(255, 255, 255, 0.08)" my="xs" />

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button color="cyan" leftSection={<IconCheck size={16} />} onClick={handleSave}>
            {t.modals.applyCertSettings}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
