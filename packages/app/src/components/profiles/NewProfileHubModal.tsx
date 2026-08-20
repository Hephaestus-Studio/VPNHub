import React, { useState, useEffect } from "react";
import {
  Modal,
  Stack,
  Text,
  Group,
  Box,
  Paper,
  Badge,
  Divider,
  Alert,
  SimpleGrid,
  Loader,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import {
  IconBolt,
  IconShieldLock,
  IconFileUpload,
  IconFileTypeTxt,
  IconAlertCircle,
  IconChevronRight,
  IconDownload,
} from "@tabler/icons-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { VpnProfile, ProtocolType } from "../../types/vpn";
import styles from "./NewProfileHubModal.module.css";

interface NewProfileHubModalProps {
  opened: boolean;
  onClose: () => void;
  onSelectManualCreate: (protocol: "wireguard" | "openvpn") => void;
  onImportParsed: (profile: VpnProfile) => void;
}

export const parseConfigContent = (content: string, fileName: string): VpnProfile => {
  const isWireGuard =
    fileName.toLowerCase().endsWith(".conf") ||
    content.includes("[Interface]") ||
    content.includes("[Peer]");

  let protocol: ProtocolType = isWireGuard ? "wireguard" : "openvpn_udp";
  let serverHost = "";
  let serverPort = isWireGuard ? 51820 : 1194;
  let privateKey: string | undefined = undefined;
  let presharedKey: string | undefined = undefined;
  let virtualIp = isWireGuard ? "10.8.0.2/24" : "10.8.0.50/24";
  let username: string | undefined = undefined;
  let hasAuthUserPass = false;

  let caCert: string | undefined = undefined;
  let clientCert: string | undefined = undefined;
  let clientKey: string | undefined = undefined;
  let tlsAuthKey: string | undefined = undefined;
  let tlsCryptKey: string | undefined = undefined;
  let keyDirection: string | undefined = undefined;
  let remoteCertTlsServer: boolean | undefined = undefined;
  let renegSec: number | undefined = undefined;

  if (isWireGuard) {
    const privMatch = content.match(/PrivateKey\s*=\s*([^\s#]+)/i);
    if (privMatch) privateKey = privMatch[1].trim();

    const pskMatch = content.match(/PresharedKey\s*=\s*([^\s#]+)/i);
    if (pskMatch) presharedKey = pskMatch[1].trim();

    const addrMatch = content.match(/Address\s*=\s*([^\r\n,#]+)/i);
    if (addrMatch) virtualIp = addrMatch[1].trim();

    const endpointMatch = content.match(/Endpoint\s*=\s*([^:\s#]+)(?::(\d+))?/i);
    if (endpointMatch) {
      serverHost = endpointMatch[1].trim();
      if (endpointMatch[2]) {
        serverPort = parseInt(endpointMatch[2], 10);
      }
    }
  } else {
    const protoMatch = content.match(/^[ \t]*proto\s+(tcp\d*|udp\d*|tcp|udp)/im);
    if (protoMatch) {
      const p = protoMatch[1].toLowerCase();
      protocol = p.startsWith("tcp") ? "openvpn_tcp" : "openvpn_udp";
    }

    const remoteMatch = content.match(/^[ \t]*remote\s+([^\s]+)(?:\s+(\d+))?(?:\s+(tcp|udp))?/im);
    if (remoteMatch) {
      serverHost = remoteMatch[1].trim();
      if (remoteMatch[2]) {
        serverPort = parseInt(remoteMatch[2], 10);
      }
      if (remoteMatch[3]) {
        protocol = remoteMatch[3].toLowerCase().startsWith("tcp") ? "openvpn_tcp" : "openvpn_udp";
      }
    }

    const ifconfigMatch = content.match(/^[ \t]*ifconfig\s+([^\s]+)/im);
    if (ifconfigMatch) {
      virtualIp = `${ifconfigMatch[1].trim()}/24`;
    }

    hasAuthUserPass = /^[ \t]*auth-user-pass/im.test(content);
    // Only extract explicit username if defined in comment tag like # username: my_user
    const userCommentMatch = content.match(/^[ \t]*#\s*(?:username|user)\s*[:=]\s*([^\r\n]+)/im);
    if (userCommentMatch) {
      username = userCommentMatch[1].trim();
    }

    // Extract XML Certificate & Key Blocks
    const caMatch = content.match(/<ca>([\s\S]*?)<\/ca>/i);
    if (caMatch) caCert = caMatch[1].trim();

    const certMatch = content.match(/<cert>([\s\S]*?)<\/cert>/i);
    if (certMatch) clientCert = certMatch[1].trim();

    const keyMatch = content.match(/<key>([\s\S]*?)<\/key>/i);
    if (keyMatch) clientKey = keyMatch[1].trim();

    const tlsAuthMatch = content.match(/<tls-auth>([\s\S]*?)<\/tls-auth>/i);
    if (tlsAuthMatch) tlsAuthKey = tlsAuthMatch[1].trim();

    const tlsCryptMatch = content.match(/<tls-crypt>([\s\S]*?)<\/tls-crypt>/i);
    if (tlsCryptMatch) tlsCryptKey = tlsCryptMatch[1].trim();

    const kdMatch = content.match(/^[ \t]*key-direction\s+([^\s]+)/im);
    if (kdMatch) keyDirection = kdMatch[1].trim();

    if (content.match(/^[ \t]*remote-cert-tls\s+server/im)) {
      remoteCertTlsServer = true;
    }

    const renegMatch = content.match(/^[ \t]*reneg-sec\s+(\d+)/im);
    if (renegMatch) {
      renegSec = parseInt(renegMatch[1], 10);
    }
  }

  const cleanName = fileName.replace(/\.(conf|ovpn)$/i, "");

  return {
    id: crypto.randomUUID(),
    name: cleanName || (isWireGuard ? "WireGuard Profile" : "OpenVPN Profile"),
    protocol,
    serverHost: serverHost || "127.0.0.1",
    serverPort: serverPort || (isWireGuard ? 51820 : 1194),
    serverCountry: "Imported Gateway",
    serverCity: "Remote DC",
    serverFlag: isWireGuard ? "⚡" : "🛡️",
    virtualIp,
    isFavorite: false,
    tags: ["Imported", isWireGuard ? "WireGuard" : "OpenVPN"],
    pingMs: Math.floor(20 + Math.random() * 30),
    credentials: {
      username: username || undefined,
      passwordMode: "static",
      totpFormat: "append",
      hasPassword: hasAuthUserPass,
      hasPrivateKey: Boolean(privateKey || clientKey),
      hasCert: Boolean(clientCert),
      hasCaCert: Boolean(caCert),
      hasTlsAuth: Boolean(tlsAuthKey),
      hasTlsCrypt: Boolean(tlsCryptKey),
      privateKey,
      presharedKey,
      caCert,
      clientCert,
      clientKey,
      tlsAuthKey,
      tlsCryptKey,
      keyDirection,
      remoteCertTlsServer,
      renegSec,
    },
  };
};

export const NewProfileHubModal: React.FC<NewProfileHubModalProps> = ({
  opened,
  onClose,
  onSelectManualCreate,
  onImportParsed,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFileName, setLoadingFileName] = useState("");

  // Reset states on open/close
  useEffect(() => {
    if (!opened) {
      setError(null);
      setIsDraggingOver(false);
      setIsLoading(false);
      setLoadingFileName("");
    }
  }, [opened]);

  // Native Tauri Window File Drop Handler (Desktop OS drag & drop)
  useEffect(() => {
    if (!opened) return;
    try {
      const appWindow = getCurrentWebviewWindow();
      const unlistenPromise = appWindow.onDragDropEvent(async (event) => {
        if (event.payload.type === "over" || event.payload.type === "enter") {
          setIsDraggingOver(true);
        } else if (event.payload.type === "leave") {
          setIsDraggingOver(false);
        } else if (event.payload.type === "drop") {
          setIsDraggingOver(false);
          const paths = event.payload.paths;
          if (paths && paths.length > 0) {
            const filePath = paths[0];
            const fileName = filePath.split(/[/\\]/).pop() || "profile.ovpn";
            setLoadingFileName(fileName);
            setIsLoading(true);
            try {
              const fileContent = await invoke<string>("read_text_file", { path: filePath });
              const parsedProfile = parseConfigContent(fileContent, fileName);
              // Brief UI feedback before opening parsed profile modal
              setTimeout(() => {
                setIsLoading(false);
                onClose();
                onImportParsed(parsedProfile);
              }, 300);
            } catch (err: any) {
              setIsLoading(false);
              setError(err?.message || `Failed to read file: ${filePath}`);
            }
          }
        }
      });

      return () => {
        unlistenPromise.then((unlisten) => unlisten());
      };
    } catch {
      // Fallback for non-tauri or browser context
    }
  }, [opened, onClose, onImportParsed]);

  const handleFiles = (files: File[]) => {
    setError(null);
    setIsDraggingOver(false);
    const file = files[0];
    if (!file) return;

    setLoadingFileName(file.name);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onerror = () => {
      setIsLoading(false);
      setError("Failed to read configuration file. Please try again.");
    };

    reader.onload = (e) => {
      try {
        const content = (e.target?.result as string) || "";
        const parsed = parseConfigContent(content, file.name);
        setTimeout(() => {
          setIsLoading(false);
          onClose();
          onImportParsed(parsed);
        }, 300);
      } catch (err: any) {
        setIsLoading(false);
        setError(err?.message || "Failed to parse configuration file.");
      }
    };

    reader.readAsText(file);
  };

  let dropzoneClass = styles.dropzoneIdle;
  if (isLoading) dropzoneClass = styles.dropzoneLoading;
  else if (isDraggingOver) dropzoneClass = styles.dropzoneDragging;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconFileUpload size={20} color="var(--vpn-cyan)" />
          <Text fw={700} size="md" className={styles.modalTitle}>
            Add or Import VPN Profile
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
      <Stack gap="lg">
        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            variant="light"
            style={{ padding: "8px 12px" }}
          >
            {error}
          </Alert>
        )}

        {/* SECTION 1: IMPORT FROM FILE */}
        <Box>
          <Group justify="space-between" align="center" mb="xs">
            <Text size="xs" fw={600} c="dimmed" className={styles.sectionHeader}>
              Option 1: Import Configuration File
            </Text>
            {isDraggingOver && (
              <Badge size="xs" color="cyan" variant="filled" className="animate-pulse">
                Release File to Import
              </Badge>
            )}
          </Group>

          <Dropzone
            onDrop={handleFiles}
            onDragEnter={() => setIsDraggingOver(true)}
            onDragLeave={() => setIsDraggingOver(false)}
            onReject={() => {
              setIsDraggingOver(false);
              setError(
                "Invalid file type. Please upload a valid .ovpn or .conf configuration file."
              );
            }}
            maxSize={10 * 1024 * 1024}
            disabled={isLoading}
            className={dropzoneClass}
          >
            {isLoading ? (
              <Stack align="center" gap="sm" py="xs">
                <Box className={styles.loadingIconBox}>
                  <Loader size="md" color="cyan" />
                </Box>
                <Text size="sm" fw={700} className={styles.loadingTitle}>
                  Analyzing & Parsing Configuration...
                </Text>
                <Text size="xs" c="dimmed">
                  Extracting TLS certificates, keys & tunnel endpoints from{" "}
                  <span className={styles.loadingFileName}>{loadingFileName || "config"}</span>
                </Text>
              </Stack>
            ) : (
              <Stack align="center" gap="xs">
                <Box
                  className={
                    isDraggingOver ? styles.dropzoneIconBoxDragging : styles.dropzoneIconBox
                  }
                >
                  {isDraggingOver ? (
                    <IconDownload size={28} color="var(--vpn-cyan)" />
                  ) : (
                    <IconFileTypeTxt size={26} color="var(--vpn-cyan)" />
                  )}
                </Box>
                <Text size="sm" fw={600} className={styles.dropzoneText}>
                  {isDraggingOver ? (
                    <span className={styles.cyanHighlight}>Drop file now to import</span>
                  ) : (
                    <>
                      Drag & Drop <span className={styles.cyanHighlight}>.ovpn</span> or{" "}
                      <span className={styles.cyanHighlight}>.conf</span> file here
                    </>
                  )}
                </Text>
                <Text size="xs" c="dimmed">
                  Auto-detects OpenVPN 2.x/3.x bundles and WireGuard configs up to 10MB
                </Text>
                <Text size="11px" c="cyan" className={styles.browseLink}>
                  or click to browse files from your computer
                </Text>
              </Stack>
            )}
          </Dropzone>
        </Box>

        <Divider
          label={
            <Text size="xs" fw={600} c="dimmed" className={styles.dividerText}>
              OR CONFIGURE MANUALLY
            </Text>
          }
          labelPosition="center"
          color="rgba(255, 255, 255, 0.08)"
        />

        {/* SECTION 2: CREATE MANUALLY BY PROTOCOL */}
        <Box>
          <Text size="xs" fw={600} c="dimmed" mb="xs" className={styles.sectionHeader}>
            Option 2: Create Connection Manually
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {/* WireGuard Manual Card */}
            <Paper
              onClick={() => {
                onClose();
                onSelectManualCreate("wireguard");
              }}
              className={styles.wireguardCard}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group gap="sm" align="flex-start">
                  <Box className={styles.wireguardIconBox}>
                    <IconBolt size={20} color="var(--vpn-cyan)" />
                  </Box>
                  <Box>
                    <Group gap="xs" align="center" mb={2}>
                      <Text fw={700} size="sm" className={styles.cardTitle}>
                        WireGuard
                      </Text>
                      <Badge size="xs" color="cyan" variant="light">
                        UDP Only
                      </Badge>
                    </Group>
                    <Text size="11px" c="dimmed">
                      Modern cryptographic key exchange with minimal latency.
                    </Text>
                  </Box>
                </Group>
                <IconChevronRight size={16} className={styles.chevronIcon} />
              </Group>
            </Paper>

            {/* OpenVPN Manual Card */}
            <Paper
              onClick={() => {
                onClose();
                onSelectManualCreate("openvpn");
              }}
              className={styles.openvpnCard}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group gap="sm" align="flex-start">
                  <Box className={styles.openvpnIconBox}>
                    <IconShieldLock size={20} color="var(--vpn-emerald)" />
                  </Box>
                  <Box>
                    <Group gap="xs" align="center" mb={2}>
                      <Text fw={700} size="sm" className={styles.cardTitle}>
                        OpenVPN
                      </Text>
                      <Badge size="xs" color="teal" variant="light">
                        TCP / UDP + 2FA
                      </Badge>
                    </Group>
                    <Text size="11px" c="dimmed">
                      Enterprise TLS tunnel with TCP/UDP switch and 2FA TOTP.
                    </Text>
                  </Box>
                </Group>
                <IconChevronRight size={16} className={styles.chevronIcon} />
              </Group>
            </Paper>
          </SimpleGrid>
        </Box>
      </Stack>
    </Modal>
  );
};
