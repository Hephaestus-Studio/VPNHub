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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconFileUpload size={20} color="var(--vpn-cyan)" />
          <Text fw={700} size="md" style={{ color: "#fff" }}>
            Add or Import VPN Profile
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
          borderRadius: 14,
        },
        header: {
          background: "transparent",
          borderBottom: "1px solid var(--vpn-border)",
          paddingBottom: 12,
        },
        body: {
          padding: "20px",
        },
      }}
    >
      <Stack gap="lg">
        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            variant="light"
            styles={{ root: { padding: "8px 12px" } }}
          >
            {error}
          </Alert>
        )}

        {/* SECTION 1: IMPORT FROM FILE */}
        <Box>
          <Group justify="space-between" align="center" mb="xs">
            <Text
              size="xs"
              fw={600}
              c="dimmed"
              style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
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
            style={{
              background: isLoading
                ? "rgba(6, 182, 212, 0.08)"
                : isDraggingOver
                  ? "rgba(6, 182, 212, 0.16)"
                  : "rgba(31, 41, 55, 0.45)",
              border: isDraggingOver
                ? "2px dashed var(--vpn-cyan)"
                : isLoading
                  ? "2px solid rgba(6, 182, 212, 0.6)"
                  : "2px dashed rgba(6, 182, 212, 0.35)",
              boxShadow: isDraggingOver
                ? "0 0 30px rgba(6, 182, 212, 0.4), inset 0 0 20px rgba(6, 182, 212, 0.15)"
                : "none",
              transform: isDraggingOver ? "scale(1.015)" : "none",
              borderRadius: 12,
              padding: "28px 20px",
              textAlign: "center",
              cursor: isLoading ? "wait" : "pointer",
              transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {isLoading ? (
              <Stack align="center" gap="sm" py="xs">
                <Box
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: "rgba(6, 182, 212, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Loader size="md" color="cyan" />
                </Box>
                <Text size="sm" fw={700} style={{ color: "var(--vpn-cyan)" }}>
                  Analyzing & Parsing Configuration...
                </Text>
                <Text size="xs" c="dimmed">
                  Extracting TLS certificates, keys & tunnel endpoints from{" "}
                  <span style={{ color: "#fff", fontFamily: "monospace" }}>
                    {loadingFileName || "config"}
                  </span>
                </Text>
              </Stack>
            ) : (
              <Stack align="center" gap="xs">
                <Box
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: isDraggingOver
                      ? "rgba(6, 182, 212, 0.3)"
                      : "rgba(6, 182, 212, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: isDraggingOver ? "scale(1.15)" : "none",
                    transition: "transform 0.2s ease, background 0.2s ease",
                  }}
                >
                  {isDraggingOver ? (
                    <IconDownload size={28} color="var(--vpn-cyan)" />
                  ) : (
                    <IconFileTypeTxt size={26} color="var(--vpn-cyan)" />
                  )}
                </Box>
                <Text size="sm" fw={600} style={{ color: "#fff" }}>
                  {isDraggingOver ? (
                    <span style={{ color: "var(--vpn-cyan)" }}>Drop file now to import</span>
                  ) : (
                    <>
                      Drag & Drop <span style={{ color: "var(--vpn-cyan)" }}>.ovpn</span> or{" "}
                      <span style={{ color: "var(--vpn-cyan)" }}>.conf</span> file here
                    </>
                  )}
                </Text>
                <Text size="xs" c="dimmed">
                  Auto-detects OpenVPN 2.x/3.x bundles and WireGuard configs up to 10MB
                </Text>
                <Text size="11px" c="cyan" style={{ textDecoration: "underline" }}>
                  or click to browse files from your computer
                </Text>
              </Stack>
            )}
          </Dropzone>
        </Box>

        <Divider
          label={
            <Text size="xs" fw={600} c="dimmed" style={{ letterSpacing: "0.05em" }}>
              OR CONFIGURE MANUALLY
            </Text>
          }
          labelPosition="center"
          color="rgba(255, 255, 255, 0.08)"
        />

        {/* SECTION 2: CREATE MANUALLY BY PROTOCOL */}
        <Box>
          <Text
            size="xs"
            fw={600}
            c="dimmed"
            mb="xs"
            style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Option 2: Create Connection Manually
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {/* WireGuard Manual Card */}
            <Paper
              p="md"
              onClick={() => {
                onClose();
                onSelectManualCreate("wireguard");
              }}
              style={{
                background: "rgba(6, 182, 212, 0.04)",
                border: "1px solid rgba(6, 182, 212, 0.2)",
                borderRadius: 12,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(6, 182, 212, 0.1)";
                e.currentTarget.style.borderColor = "var(--vpn-cyan)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(6, 182, 212, 0.04)";
                e.currentTarget.style.borderColor = "rgba(6, 182, 212, 0.2)";
                e.currentTarget.style.transform = "none";
              }}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group gap="sm" align="flex-start">
                  <Box
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      background: "rgba(6, 182, 212, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IconBolt size={20} color="var(--vpn-cyan)" />
                  </Box>
                  <Box>
                    <Group gap="xs" align="center" mb={2}>
                      <Text fw={700} size="sm" style={{ color: "#fff" }}>
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
                <IconChevronRight
                  size={16}
                  color="rgba(255, 255, 255, 0.3)"
                  style={{ marginTop: 4 }}
                />
              </Group>
            </Paper>

            {/* OpenVPN Manual Card */}
            <Paper
              p="md"
              onClick={() => {
                onClose();
                onSelectManualCreate("openvpn");
              }}
              style={{
                background: "rgba(16, 185, 129, 0.04)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                borderRadius: 12,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(16, 185, 129, 0.1)";
                e.currentTarget.style.borderColor = "var(--vpn-emerald)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(16, 185, 129, 0.04)";
                e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.2)";
                e.currentTarget.style.transform = "none";
              }}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group gap="sm" align="flex-start">
                  <Box
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      background: "rgba(16, 185, 129, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IconShieldLock size={20} color="var(--vpn-emerald)" />
                  </Box>
                  <Box>
                    <Group gap="xs" align="center" mb={2}>
                      <Text fw={700} size="sm" style={{ color: "#fff" }}>
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
                <IconChevronRight
                  size={16}
                  color="rgba(255, 255, 255, 0.3)"
                  style={{ marginTop: 4 }}
                />
              </Group>
            </Paper>
          </SimpleGrid>
        </Box>
      </Stack>
    </Modal>
  );
};
