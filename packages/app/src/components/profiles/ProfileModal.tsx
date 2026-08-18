import React, { useState, useEffect } from "react";
import {
  Modal,
  Tabs,
  TextInput,
  PasswordInput,
  Select,
  NumberInput,
  Group,
  Stack,
  Button,
  Text,
  Textarea,
  SegmentedControl,
  Box,
  Badge,
  RingProgress,
  Center,
} from "@mantine/core";
import {
  IconSettings,
  IconKey,
  IconWorld,
  IconFileCode,
  IconShieldLock,
  IconClock,
  IconBolt,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import { VpnProfile, ProtocolType } from "../../types/vpn";
import { TotpGenerator } from "../../utils/totp";

interface ProfileModalProps {
  opened: boolean;
  onClose: () => void;
  initialProfile?: VpnProfile | null;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ opened, onClose, initialProfile }) => {
  const { addProfile, updateProfile } = useVpnStore();

  const [name, setName] = useState("");
  const [protocol, setProtocol] = useState<ProtocolType>("wireguard");
  const [serverHost, setServerHost] = useState("");
  const [serverPort, setServerPort] = useState<number>(51820);
  const [serverCountry, setServerCountry] = useState("Singapore");
  const [serverCity, setServerCity] = useState("Singapore DC");
  const [serverFlag, setServerFlag] = useState("🇸🇬");
  const [virtualIp, setVirtualIp] = useState("10.8.0.2/24");
  const [privateKey, setPrivateKey] = useState("");
  const [presharedKey, setPresharedKey] = useState("");

  // Password & Dynamic 2FA TOTP state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordMode, setPasswordMode] = useState<"static" | "dynamic_prompt" | "totp_auto">(
    "static"
  );
  const [totpSecret, setTotpSecret] = useState("");
  const [totpFormat, setTotpFormat] = useState<"append" | "prefix" | "totp_only">("append");
  const [liveTotpCode, setLiveTotpCode] = useState("");
  const [totpSecondsRemaining, setTotpSecondsRemaining] = useState(30);

  const [rawConfig, setRawConfig] = useState("");

  // Live TOTP ticker when totp_auto is selected and secret is present
  useEffect(() => {
    if (passwordMode !== "totp_auto" || !totpSecret) {
      setLiveTotpCode("");
      return;
    }

    const updateTotp = async () => {
      const code = await TotpGenerator.generateCode(totpSecret);
      setLiveTotpCode(code);
      setTotpSecondsRemaining(TotpGenerator.getRemainingSeconds());
    };

    updateTotp();
    const interval = setInterval(updateTotp, 1000);
    return () => clearInterval(interval);
  }, [passwordMode, totpSecret]);

  useEffect(() => {
    if (initialProfile) {
      setName(initialProfile.name);
      setProtocol(initialProfile.protocol);
      setServerHost(initialProfile.serverHost);
      setServerPort(initialProfile.serverPort);
      setServerCountry(initialProfile.serverCountry);
      setServerCity(initialProfile.serverCity);
      setServerFlag(initialProfile.serverFlag);
      setVirtualIp(initialProfile.virtualIp);
      setUsername(initialProfile.credentials?.username || "");
      setPassword(initialProfile.credentials?.password || "");
      setPasswordMode(initialProfile.credentials?.passwordMode || "static");
      setTotpSecret(initialProfile.credentials?.totpSecret || "");
      setTotpFormat(initialProfile.credentials?.totpFormat || "append");
      setRawConfig(initialProfile.rawConfig || "");
    } else {
      setName("");
      setProtocol("wireguard");
      setServerHost("103.21.244.18");
      setServerPort(51820);
      setServerCountry("Singapore");
      setServerCity("Central DC");
      setServerFlag("🇸🇬");
      setVirtualIp("10.8.0.99/24");
      setPrivateKey("aGVwaGFlc3R1cy1zZWNyZXQta2V5LTEyMzQ1Njc4OTA=");
      setPresharedKey("");
      setUsername("");
      setPassword("");
      setPasswordMode("static");
      setTotpSecret("");
      setTotpFormat("append");
      setRawConfig("");
    }
  }, [initialProfile, opened]);

  const handleSubmit = () => {
    const profileData: VpnProfile = {
      id: initialProfile ? initialProfile.id : `prof-${Date.now()}`,
      name: name || `${serverCountry} - ${protocol.toUpperCase()}`,
      protocol,
      serverHost,
      serverPort: Number(serverPort) || 51820,
      serverCountry,
      serverCity,
      serverFlag,
      virtualIp,
      isFavorite: initialProfile ? initialProfile.isFavorite : false,
      tags: ["Custom", protocol === "wireguard" ? "WireGuard" : "OpenVPN"],
      pingMs: Math.floor(20 + Math.random() * 40),
      credentials: {
        username: username || undefined,
        password: password || undefined,
        passwordMode,
        totpSecret: totpSecret || undefined,
        totpFormat,
        hasPassword: Boolean(password),
        hasPrivateKey: Boolean(privateKey),
      },
      rawConfig: rawConfig || undefined,
    };

    let secretPayload: import("../../services/ipcBridge").ProfileSecretPayload | undefined;
    if (protocol === "wireguard" && privateKey) {
      secretPayload = {
        type: "wireguard",
        private_key: privateKey,
        preshared_key: presharedKey || undefined,
      };
    } else if (rawConfig) {
      secretPayload = {
        type: "raw_ovpn_config",
        config_content: rawConfig,
        username: username || undefined,
        password: password || undefined,
      };
    } else if (protocol.startsWith("openvpn") && (username || password || totpSecret)) {
      secretPayload = {
        type: "user_password",
        username: username || "",
        password: password || "",
        totp_secret: totpSecret || undefined,
        totp_format: totpFormat,
        ovpn_config: rawConfig || undefined,
      };
    }

    if (initialProfile) {
      updateProfile(profileData, secretPayload);
    } else {
      addProfile(profileData, secretPayload);
    }

    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconSettings size={18} color="var(--vpn-cyan)" />
          <Text fw={700} size="md" style={{ color: "#fff" }}>
            {initialProfile ? "Edit VPN Profile" : "Create Custom VPN Profile"}
          </Text>
        </Group>
      }
      size="lg"
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
      <Tabs defaultValue="general" color="cyan">
        <Tabs.List mb="md">
          <Tabs.Tab value="general" leftSection={<IconWorld size={14} />}>
            Server & Protocol
          </Tabs.Tab>
          <Tabs.Tab value="credentials" leftSection={<IconKey size={14} />}>
            Keys & Authentication
          </Tabs.Tab>
          <Tabs.Tab value="advanced" leftSection={<IconFileCode size={14} />}>
            Raw Config
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general">
          <Stack gap="sm">
            <TextInput
              label="Profile Name"
              placeholder="e.g. Frankfurt Enterprise Edge"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
            />

            <Group grow>
              <Select
                label="Protocol Engine"
                value={protocol}
                data={[
                  { value: "wireguard", label: "WireGuard (High Throughput, Modern UDP)" },
                  { value: "openvpn_udp", label: "OpenVPN UDP (Standard Enterprise)" },
                  { value: "openvpn_tcp", label: "OpenVPN TCP (Stealth Firewall Bypass)" },
                ]}
                onChange={(val) => {
                  if (val) setProtocol(val as ProtocolType);
                  if (val === "wireguard") setServerPort(51820);
                  else if (val === "openvpn_udp") setServerPort(1194);
                  else if (val === "openvpn_tcp") setServerPort(443);
                }}
              />
              <TextInput
                label="Country Flag / Emoji"
                value={serverFlag}
                onChange={(e) => setServerFlag(e.currentTarget.value)}
                style={{ maxWidth: 120 }}
              />
            </Group>

            <Group grow>
              <TextInput
                label="Server Host / IP"
                placeholder="vpn.example.com or 103.21.244.18"
                value={serverHost}
                onChange={(e) => setServerHost(e.currentTarget.value)}
                className="font-mono"
              />
              <NumberInput
                label="Port"
                value={serverPort}
                onChange={(val) => setServerPort(Number(val) || 51820)}
                className="font-mono"
                style={{ maxWidth: 130 }}
              />
            </Group>

            <Group grow>
              <TextInput
                label="Country"
                value={serverCountry}
                onChange={(e) => setServerCountry(e.currentTarget.value)}
              />
              <TextInput
                label="City / DataCenter"
                value={serverCity}
                onChange={(e) => setServerCity(e.currentTarget.value)}
              />
            </Group>

            <TextInput
              label="Assigned Virtual IP (CIDR)"
              placeholder="10.8.0.2/24"
              value={virtualIp}
              onChange={(e) => setVirtualIp(e.currentTarget.value)}
              className="font-mono"
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="credentials">
          <Stack gap="sm">
            {protocol === "wireguard" ? (
              <>
                <PasswordInput
                  label="WireGuard Private Key (Base64)"
                  placeholder="Private key generated for this peer"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.currentTarget.value)}
                  className="font-mono"
                />
                <PasswordInput
                  label="Preshared Key (Optional Post-Quantum Shield)"
                  placeholder="Optional PSK"
                  value={presharedKey}
                  onChange={(e) => setPresharedKey(e.currentTarget.value)}
                  className="font-mono"
                />
              </>
            ) : (
              <>
                <TextInput
                  label="Username"
                  placeholder="Enter VPN account username"
                  value={username}
                  onChange={(e) => setUsername(e.currentTarget.value)}
                />

                {/* Password / Dynamic 2FA Mode Selector */}
                <Box>
                  <Text size="xs" fw={500} mb={4}>
                    Password & 2FA / TOTP Authentication Mode
                  </Text>
                  <SegmentedControl
                    fullWidth
                    size="xs"
                    value={passwordMode}
                    onChange={(val) => setPasswordMode(val as typeof passwordMode)}
                    data={[
                      {
                        value: "static",
                        label: (
                          <Group gap={4} justify="center">
                            <IconKey size={13} />
                            <span>Static Password</span>
                          </Group>
                        ),
                      },
                      {
                        value: "totp_auto",
                        label: (
                          <Group gap={4} justify="center">
                            <IconBolt size={13} color="var(--vpn-cyan)" />
                            <span>Auto TOTP (Base + Key)</span>
                          </Group>
                        ),
                      },
                      {
                        value: "dynamic_prompt",
                        label: (
                          <Group gap={4} justify="center">
                            <IconClock size={13} color="var(--vpn-amber)" />
                            <span>Prompt on Connect</span>
                          </Group>
                        ),
                      },
                    ]}
                  />
                </Box>

                {/* Base Password Input */}
                <PasswordInput
                  label={passwordMode === "totp_auto" ? "Base Password" : "Password"}
                  placeholder={
                    passwordMode === "dynamic_prompt"
                      ? "Base password (or leave empty to enter on connect)"
                      : "Enter password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                />

                {/* Auto TOTP Secret Section */}
                {passwordMode === "totp_auto" && (
                  <Box
                    style={{
                      background: "rgba(6, 182, 212, 0.05)",
                      border: "1px solid rgba(6, 182, 212, 0.25)",
                      borderRadius: 8,
                      padding: 10,
                    }}
                  >
                    <Stack gap="xs">
                      <PasswordInput
                        label="TOTP Secret Key (Base32)"
                        placeholder="e.g. JBSWY3DPEHPK3PXP"
                        value={totpSecret}
                        onChange={(e) => setTotpSecret(e.currentTarget.value)}
                        className="font-mono"
                        description="Stored securely in AES-256-GCM Encrypted Vault"
                      />

                      <Select
                        label="Combination Format"
                        size="xs"
                        value={totpFormat}
                        onChange={(val) => setTotpFormat(val as typeof totpFormat)}
                        data={[
                          {
                            value: "append",
                            label: "Base Password + TOTP (e.g. MyPassword123456)",
                          },
                          {
                            value: "prefix",
                            label: "TOTP + Base Password (e.g. 123456MyPassword)",
                          },
                          { value: "totp_only", label: "TOTP Code Only (e.g. 123456)" },
                        ]}
                      />

                      {/* Live Code Preview */}
                      {liveTotpCode && (
                        <Group justify="space-between" align="center" mt={4}>
                          <Group gap="xs">
                            <IconShieldLock size={16} color="var(--vpn-emerald)" />
                            <Box>
                              <Text size="10px" c="dimmed">
                                Live Authenticator OTP:
                              </Text>
                              <Text size="md" fw={700} className="font-mono" c="cyan">
                                {liveTotpCode}
                              </Text>
                            </Box>
                          </Group>

                          <Group gap="xs">
                            <RingProgress
                              size={28}
                              thickness={3}
                              roundCaps
                              sections={[
                                { value: (totpSecondsRemaining / 30) * 100, color: "cyan" },
                              ]}
                              label={
                                <Center>
                                  <Text size="8px" fw={700}>
                                    {totpSecondsRemaining}
                                  </Text>
                                </Center>
                              }
                            />
                            <Badge size="xs" variant="light" color="cyan">
                              Active OTP
                            </Badge>
                          </Group>
                        </Group>
                      )}
                    </Stack>
                  </Box>
                )}

                {passwordMode === "dynamic_prompt" && (
                  <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
                    💡 Khi bấm Kết Nối, VPNHub sẽ hiển thị hộp thoại xác thực 2FA nhanh để bạn nhập
                    mã OTP động (Google Authenticator / YubiKey).
                  </Text>
                )}
              </>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="advanced">
          <Stack gap="xs">
            <Textarea
              label="Raw Configuration File (.conf / .ovpn)"
              placeholder="Paste raw OpenVPN or WireGuard config here"
              value={rawConfig}
              onChange={(e) => {
                const val = e.currentTarget.value;
                setRawConfig(val);
                if (val.includes("[Interface]")) {
                  setProtocol("wireguard");
                  const match = val.match(/Endpoint\s*=\s*([^:\s]+):(\d+)/i);
                  if (match) {
                    setServerHost(match[1]);
                    setServerPort(parseInt(match[2], 10));
                  }
                } else if (
                  val.includes("client") ||
                  val.includes("remote ") ||
                  val.includes("dev tun")
                ) {
                  const protoMatch = val.match(/^proto\s+(tcp\d*|udp\d*|tcp|udp)/im);
                  if (protoMatch) {
                    setProtocol(
                      protoMatch[1].toLowerCase().startsWith("tcp") ? "openvpn_tcp" : "openvpn_udp"
                    );
                  }
                  const remoteMatch = val.match(/^remote\s+([^\s]+)(?:\s+(\d+))?/im);
                  if (remoteMatch) {
                    setServerHost(remoteMatch[1]);
                    if (remoteMatch[2]) setServerPort(parseInt(remoteMatch[2], 10));
                  }
                }
              }}
              minRows={6}
              className="font-mono"
            />
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Group justify="flex-end" mt="lg">
        <Button variant="subtle" color="gray" onClick={onClose}>
          Cancel
        </Button>
        <Button color="cyan" onClick={handleSubmit}>
          Save Changes
        </Button>
      </Group>
    </Modal>
  );
};
