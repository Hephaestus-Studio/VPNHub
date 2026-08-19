import React, { useState } from "react";
import { Modal, Tabs, Stack, Text, Group, Button, TextInput, Box } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import {
  IconFileUpload,
  IconLink,
  IconQrcode,
  IconCheck,
  IconFileTypeTxt,
} from "@tabler/icons-react";
import { VpnProfile } from "../../types/vpn";
import { useVpnStore } from "../../state/useVpnStore";

interface ImportProfileModalProps {
  opened: boolean;
  onClose: () => void;
}

export const ImportProfileModal: React.FC<ImportProfileModalProps> = ({ opened, onClose }) => {
  const { addProfile } = useVpnStore();
  const [importUrl, setImportUrl] = useState("");
  const [parsedProfile, setParsedProfile] = useState<VpnProfile | null>(null);

  const handleDrop = (files: File[]) => {
    const file = files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const isWireGuard = file.name.endsWith(".conf") || content.includes("[Interface]");
      let protocol: import("../../types/vpn").ProtocolType = isWireGuard
        ? "wireguard"
        : "openvpn_udp";
      let serverHost = "";
      let serverPort = isWireGuard ? 51820 : 1194;
      let privateKey: string | undefined = undefined;
      let presharedKey: string | undefined = undefined;
      let virtualIp = "10.8.0.50/24";
      let username: string | undefined = undefined;

      if (isWireGuard) {
        const privMatch = content.match(/PrivateKey\s*=\s*([^\s#]+)/i);
        if (privMatch) privateKey = privMatch[1];
        const pskMatch = content.match(/PresharedKey\s*=\s*([^\s#]+)/i);
        if (pskMatch) presharedKey = pskMatch[1];
        const addrMatch = content.match(/Address\s*=\s*([^\s#]+)/i);
        if (addrMatch) virtualIp = addrMatch[1];

        const endpointMatch = content.match(/Endpoint\s*=\s*([^:\s]+):(\d+)/i);
        if (endpointMatch) {
          serverHost = endpointMatch[1];
          serverPort = parseInt(endpointMatch[2], 10);
        }
      } else {
        const protoMatch = content.match(/^proto\s+(tcp\d*|udp\d*|tcp|udp)/im);
        if (protoMatch) {
          const p = protoMatch[1].toLowerCase();
          protocol = p.startsWith("tcp") ? "openvpn_tcp" : "openvpn_udp";
        }

        const remoteMatch = content.match(/^remote\s+([^\s]+)(?:\s+(\d+))?(?:\s+(tcp|udp))?/im);
        if (remoteMatch) {
          serverHost = remoteMatch[1];
          if (remoteMatch[2]) {
            serverPort = parseInt(remoteMatch[2], 10);
          }
          if (remoteMatch[3]) {
            protocol = remoteMatch[3].toLowerCase().startsWith("tcp")
              ? "openvpn_tcp"
              : "openvpn_udp";
          }
        }
      }

      const newProf: VpnProfile = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.(conf|ovpn)$/, ""),
        protocol,
        serverHost: serverHost || (isWireGuard ? "127.0.0.1" : "127.0.0.1"),
        serverPort: serverPort || (isWireGuard ? 51820 : 1194),
        serverCountry: "Imported Gateway",
        serverCity: "Remote DC",
        serverFlag: "🌐",
        virtualIp,
        isFavorite: false,
        tags: ["Imported", isWireGuard ? "WireGuard" : "OpenVPN"],
        pingMs: 32,
        credentials: {
          username,
          passwordMode: "static",
          totpFormat: "append",
          hasPassword: false,
          hasPrivateKey: Boolean(privateKey),
          hasCert: content.includes("<cert>") || content.includes("cert "),
          privateKey,
          presharedKey,
        },
        rawConfig: content,
      };

      setParsedProfile(newProf);
    };

    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (parsedProfile) {
      let secretPayload: import("../../services/ipcBridge").ProfileSecretPayload | undefined;
      if (parsedProfile.protocol === "wireguard" && parsedProfile.credentials?.privateKey) {
        secretPayload = {
          type: "wireguard",
          private_key: parsedProfile.credentials.privateKey,
          preshared_key: parsedProfile.credentials.presharedKey,
        };
      } else if (parsedProfile.rawConfig) {
        secretPayload = {
          type: "raw_ovpn_config",
          config_content: parsedProfile.rawConfig,
          username: parsedProfile.credentials?.username,
          password: parsedProfile.credentials?.password,
        };
      }
      addProfile(parsedProfile, secretPayload);
      setParsedProfile(null);
      onClose();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconFileUpload size={18} color="var(--vpn-cyan)" />
          <Text fw={700} size="md" style={{ color: "#fff" }}>
            Import VPN Profiles
          </Text>
        </Group>
      }
      size="md"
      centered
      styles={{
        content: {
          background: "rgba(17, 24, 39, 0.95)",
          backdropFilter: "blur(16px)",
          border: "1px solid var(--vpn-border)",
          borderRadius: 12,
        },
        header: {
          background: "transparent",
          borderBottom: "1px solid var(--vpn-border)",
        },
      }}
    >
      <Tabs defaultValue="file" color="cyan">
        <Tabs.List mb="md">
          <Tabs.Tab value="file" leftSection={<IconFileUpload size={14} />}>
            File Drop (.ovpn / .conf)
          </Tabs.Tab>
          <Tabs.Tab value="url" leftSection={<IconLink size={14} />}>
            Subscription URL
          </Tabs.Tab>
          <Tabs.Tab value="qr" leftSection={<IconQrcode size={14} />}>
            Scan QR Code
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="file">
          <Stack gap="md">
            <Dropzone
              onDrop={handleDrop}
              maxSize={5 * 1024 * 1024}
              accept={[
                "text/plain",
                "application/x-openvpn-profile",
                "application/octet-stream",
                ".ovpn",
                ".conf",
              ]}
              style={{
                background: "rgba(31, 41, 55, 0.4)",
                border: "2px dashed var(--vpn-border)",
                borderRadius: 10,
                padding: "24px",
                textAlign: "center",
                cursor: "pointer",
              }}
            >
              <Stack align="center" gap="xs">
                <Box
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "rgba(6, 182, 212, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconFileTypeTxt size={24} color="var(--vpn-cyan)" />
                </Box>
                <Text size="sm" fw={600} style={{ color: "#fff" }}>
                  Drag & Drop .ovpn or .conf configuration files
                </Text>
                <Text size="xs" c="dimmed">
                  Supports WireGuard config, OpenVPN 2.x/3.x profiles up to 5MB
                </Text>
              </Stack>
            </Dropzone>

            {parsedProfile && (
              <Box
                style={{
                  padding: "12px",
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: 8,
                }}
              >
                <Group justify="space-between" align="center">
                  <Group gap="xs">
                    <IconCheck size={16} color="var(--vpn-emerald)" />
                    <Box>
                      <Text size="xs" fw={700} style={{ color: "#fff" }}>
                        Parsed Profile: {parsedProfile.name}
                      </Text>
                      <Text size="10px" c="dimmed">
                        Protocol: {parsedProfile.protocol.toUpperCase()} • Endpoint:{" "}
                        {parsedProfile.serverHost}:{parsedProfile.serverPort}
                      </Text>
                    </Box>
                  </Group>
                  <Button size="xs" color="teal" onClick={handleConfirmImport}>
                    Import Now
                  </Button>
                </Group>
              </Box>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="url">
          <Stack gap="sm">
            <TextInput
              label="Remote Subscription / API Endpoint"
              placeholder="https://vpn.corp.company.com/api/v1/profile.ovpn"
              value={importUrl}
              onChange={(e) => setImportUrl(e.currentTarget.value)}
            />
            <Button
              color="cyan"
              disabled={!importUrl}
              onClick={() => {
                const newProf: VpnProfile = {
                  id: crypto.randomUUID(),
                  name: "Corporate Managed Gateway",
                  protocol: "wireguard",
                  serverHost: "vpn.corp.company.com",
                  serverPort: 51820,
                  serverCountry: "Enterprise Cloud",
                  serverCity: "Multi-Region",
                  serverFlag: "🏢",
                  virtualIp: "10.8.10.12/24",
                  isFavorite: true,
                  tags: ["Managed", "Corporate"],
                  pingMs: 28,
                };
                addProfile(newProf);
                onClose();
              }}
            >
              Fetch & Sync Profile
            </Button>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="qr">
          <Stack align="center" gap="sm" py="md">
            <Box
              style={{
                width: 140,
                height: 140,
                border: "2px dashed var(--vpn-border)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0, 0, 0, 0.3)",
              }}
            >
              <IconQrcode size={64} color="var(--vpn-text-muted)" />
            </Box>
            <Text size="xs" c="dimmed" style={{ textAlign: "center" }}>
              Point your camera or paste a QR code image to import tunnel credentials
            </Text>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
};
