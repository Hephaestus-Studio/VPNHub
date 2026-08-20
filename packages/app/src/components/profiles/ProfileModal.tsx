import React, { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  PasswordInput,
  Select,
  NumberInput,
  Group,
  Stack,
  Button,
  Text,
  SegmentedControl,
  Box,
  Badge,
  RingProgress,
  Center,
  Divider,
  Switch,
} from "@mantine/core";
import {
  IconKey,
  IconWorld,
  IconShieldLock,
  IconClock,
  IconBolt,
  IconLock,
  IconCertificate,
  IconAdjustments,
  IconNetwork,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import { VpnProfile, ProtocolType } from "../../types/vpn";
import { TotpGenerator } from "../../utils/totp";
import { CertificateManagerModal } from "./CertificateManagerModal";
import styles from "./ProfileModal.module.css";

interface ProfileModalProps {
  opened: boolean;
  onClose: () => void;
  initialProfile?: VpnProfile | null;
  defaultProtocol?: "wireguard" | "openvpn";
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  opened,
  onClose,
  initialProfile,
  defaultProtocol = "wireguard",
}) => {
  const { profiles, addProfile, updateProfile } = useVpnStore();

  const isEdit = Boolean(initialProfile && profiles.some((p) => p.id === initialProfile.id));

  const [name, setName] = useState("");
  const [protocol, setProtocol] = useState<ProtocolType>(
    defaultProtocol === "openvpn" ? "openvpn_udp" : "wireguard"
  );
  const [serverHost, setServerHost] = useState("");
  const [serverPort, setServerPort] = useState<number>(
    defaultProtocol === "openvpn" ? 1194 : 51820
  );
  const [virtualIp, setVirtualIp] = useState("10.8.0.2/24");
  const [privateKey, setPrivateKey] = useState("");
  const [presharedKey, setPresharedKey] = useState("");

  // Intranet-Only Routing & Subnets
  const [useOnlyForNetworkResources, setUseOnlyForNetworkResources] = useState(false);
  const [customSubnetsInput, setCustomSubnetsInput] = useState("");

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

  // OpenVPN Structured TLS & Cryptography state
  const [caCert, setCaCert] = useState("");
  const [tlsAuthKey, setTlsAuthKey] = useState("");
  const [tlsCryptKey, setTlsCryptKey] = useState("");
  const [clientCert, setClientCert] = useState("");
  const [clientKey, setClientKey] = useState("");
  const [keyDirection, setKeyDirection] = useState("none");
  const [remoteCertTlsServer, setRemoteCertTlsServer] = useState(true);
  const [renegSec, setRenegSec] = useState<number | undefined>(undefined);
  const [certModalOpened, setCertModalOpened] = useState(false);

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
      setName(initialProfile.name || "");
      setProtocol(initialProfile.protocol || "wireguard");
      setServerHost(initialProfile.serverHost || "");
      setServerPort(
        initialProfile.serverPort || (initialProfile.protocol === "wireguard" ? 51820 : 1194)
      );
      setVirtualIp(initialProfile.virtualIp || "10.8.0.2/24");
      setPrivateKey(initialProfile.credentials?.privateKey || "");
      setPresharedKey(initialProfile.credentials?.presharedKey || "");
      setUseOnlyForNetworkResources(initialProfile.useOnlyForNetworkResources ?? false);
      setCustomSubnetsInput((initialProfile.customSubnets || []).join(", "));
      setUsername(initialProfile.credentials?.username || "");
      setPassword(initialProfile.credentials?.password || "");
      const initTotp = initialProfile.credentials?.totpSecret || "";
      setTotpSecret(initTotp);
      setTotpFormat(initialProfile.credentials?.totpFormat || "append");
      if (initTotp) {
        setPasswordMode(initialProfile.credentials?.passwordMode || "totp_auto");
      } else {
        setPasswordMode(initialProfile.credentials?.passwordMode || "static");
      }

      setCaCert(initialProfile.credentials?.caCert || "");
      setTlsAuthKey(initialProfile.credentials?.tlsAuthKey || "");
      setTlsCryptKey(initialProfile.credentials?.tlsCryptKey || "");
      setClientCert(initialProfile.credentials?.clientCert || "");
      setClientKey(initialProfile.credentials?.clientKey || "");
      setKeyDirection(initialProfile.credentials?.keyDirection || "none");
      setRemoteCertTlsServer(
        initialProfile.credentials?.remoteCertTlsServer !== undefined
          ? initialProfile.credentials.remoteCertTlsServer
          : true
      );
      setRenegSec(initialProfile.credentials?.renegSec);
    } else {
      const initialProto: ProtocolType =
        defaultProtocol === "openvpn" ? "openvpn_udp" : "wireguard";
      setName("");
      setProtocol(initialProto);
      setServerHost("");
      setServerPort(initialProto === "wireguard" ? 51820 : 1194);
      setVirtualIp(initialProto === "wireguard" ? "10.8.0.2/24" : "10.8.0.50/24");
      setPrivateKey("");
      setPresharedKey("");
      setUseOnlyForNetworkResources(false);
      setCustomSubnetsInput("");
      setUsername("");
      setPassword("");
      setPasswordMode("static");
      setTotpSecret("");
      setTotpFormat("append");
      setCaCert("");
      setTlsAuthKey("");
      setTlsCryptKey("");
      setClientCert("");
      setClientKey("");
      setKeyDirection("none");
      setRemoteCertTlsServer(true);
      setRenegSec(undefined);
    }
  }, [initialProfile, opened, defaultProtocol]);

  const handleSubmit = () => {
    const profileId = isEdit && initialProfile ? initialProfile.id : crypto.randomUUID();

    const subnetsList = customSubnetsInput
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const profileData: VpnProfile = {
      id: profileId,
      name: name || `${protocol === "wireguard" ? "WireGuard" : "OpenVPN"} Profile`,
      protocol,
      serverHost,
      serverPort: Number(serverPort) || (protocol === "wireguard" ? 51820 : 1194),
      serverCountry: initialProfile?.serverCountry || "Configured Gateway",
      serverCity: initialProfile?.serverCity || "Remote DC",
      serverFlag: initialProfile?.serverFlag || (protocol === "wireguard" ? "⚡" : "🛡️"),
      virtualIp: virtualIp || "10.8.0.2/24",
      isFavorite: initialProfile ? initialProfile.isFavorite : false,
      tags: initialProfile?.tags || ["Custom", protocol === "wireguard" ? "WireGuard" : "OpenVPN"],
      pingMs: initialProfile?.pingMs || Math.floor(20 + Math.random() * 40),
      useOnlyForNetworkResources,
      customSubnets: subnetsList,
      credentials: {
        username: username || undefined,
        password: password || undefined,
        passwordMode,
        totpSecret: totpSecret || undefined,
        totpFormat,
        hasPassword: Boolean(password),
        hasPrivateKey: Boolean(privateKey || clientKey),
        hasCert: Boolean(clientCert || initialProfile?.credentials?.hasCert),
        hasCaCert: Boolean(caCert || initialProfile?.credentials?.hasCaCert),
        hasTlsAuth: Boolean(tlsAuthKey || initialProfile?.credentials?.hasTlsAuth),
        hasTlsCrypt: Boolean(tlsCryptKey || initialProfile?.credentials?.hasTlsCrypt),
        privateKey: privateKey || undefined,
        presharedKey: presharedKey || undefined,
        caCert: caCert || undefined,
        clientCert: clientCert || undefined,
        clientKey: clientKey || undefined,
        tlsAuthKey: tlsAuthKey || undefined,
        tlsCryptKey: tlsCryptKey || undefined,
        keyDirection: keyDirection !== "none" ? keyDirection : undefined,
        remoteCertTlsServer,
        renegSec,
      },
    };

    let secretPayload: import("../../services/ipcBridge").ProfileSecretPayload | undefined;
    if (protocol === "wireguard" && privateKey) {
      secretPayload = {
        type: "wireguard",
        private_key: privateKey,
        preshared_key: presharedKey || undefined,
      };
    } else if (protocol.startsWith("openvpn")) {
      secretPayload = {
        type: "user_password",
        username: username || "",
        password: password || "",
        totp_secret: totpSecret || undefined,
        totp_format: totpFormat,
        ca_cert: caCert || undefined,
        client_cert: clientCert || undefined,
        client_key: clientKey || undefined,
        tls_auth_key: tlsAuthKey || undefined,
        tls_crypt_key: tlsCryptKey || undefined,
        key_direction: keyDirection !== "none" ? keyDirection : undefined,
        remote_cert_tls_server: remoteCertTlsServer,
        reneg_sec: renegSec !== undefined ? Number(renegSec) : undefined,
      };
    }

    if (isEdit) {
      updateProfile(profileData, secretPayload);
    } else {
      addProfile(profileData, secretPayload);
    }

    onClose();
  };

  const isWireGuard = protocol === "wireguard";
  const hasPopulatedTls = Boolean(
    caCert ||
    tlsAuthKey ||
    tlsCryptKey ||
    clientCert ||
    clientKey ||
    renegSec !== undefined ||
    keyDirection !== "none"
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          {isWireGuard ? (
            <IconBolt size={20} color="var(--vpn-cyan)" />
          ) : (
            <IconShieldLock size={20} color="var(--vpn-emerald)" />
          )}
          <Text fw={700} size="md" className={styles.modalTitle}>
            {isEdit
              ? `Edit ${isWireGuard ? "WireGuard" : "OpenVPN"} Profile`
              : `Create ${isWireGuard ? "WireGuard" : "OpenVPN"} Profile`}
          </Text>
          <Badge size="xs" color={isWireGuard ? "cyan" : "teal"} variant="light">
            {isWireGuard
              ? "WireGuard"
              : protocol === "openvpn_tcp"
                ? "OpenVPN (TCP)"
                : "OpenVPN (UDP)"}
          </Badge>
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
        {/* Section 1: Server & Protocol */}
        <Box>
          <Group gap="xs" mb="xs">
            <IconWorld size={16} color="var(--vpn-cyan)" />
            <Text fw={600} size="sm" className={styles.sectionTitle}>
              Server & Connection Settings
            </Text>
          </Group>

          <Stack gap="sm">
            <TextInput
              label="Profile Name"
              placeholder={
                isWireGuard ? "e.g. WireGuard Frankfurt Tunnel" : "e.g. OpenVPN Corporate Staging"
              }
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
            />

            {!isWireGuard && (
              <Box>
                <Text size="xs" fw={500} mb={4} className={styles.fieldLabel}>
                  Transport Protocol
                </Text>
                <SegmentedControl
                  fullWidth
                  size="xs"
                  value={protocol}
                  onChange={(val) => {
                    const newProto = val as ProtocolType;
                    setProtocol(newProto);
                    if (serverPort === 1194 || serverPort === 443 || serverPort === 51820) {
                      setServerPort(newProto === "openvpn_tcp" ? 443 : 1194);
                    }
                  }}
                  data={[
                    { value: "openvpn_udp", label: "UDP" },
                    { value: "openvpn_tcp", label: "TCP" },
                  ]}
                />
              </Box>
            )}

            <Group grow align="flex-start">
              <TextInput
                label="Server Host / IP"
                placeholder="vpn.example.com or 103.21.244.18"
                value={serverHost}
                onChange={(e) => setServerHost(e.currentTarget.value)}
                className="font-mono"
                required
              />
              <NumberInput
                label="Port"
                value={serverPort}
                onChange={(val) =>
                  setServerPort(
                    Number(val) || (isWireGuard ? 51820 : protocol === "openvpn_tcp" ? 443 : 1194)
                  )
                }
                className={`font-mono ${styles.portInput}`}
              />
            </Group>

            {isWireGuard && (
              <TextInput
                label="Assigned Virtual IP (CIDR)"
                placeholder="10.8.0.2/24"
                value={virtualIp}
                onChange={(e) => setVirtualIp(e.currentTarget.value)}
                className="font-mono"
                description="Assigned static IP for this WireGuard tunnel peer"
                required
              />
            )}

            {/* Section: Routing & Split Gateway (Intranet-Only) */}
            <Box
              className={useOnlyForNetworkResources ? styles.intranetBoxActive : styles.intranetBox}
            >
              <Group
                justify="space-between"
                align="center"
                mb={useOnlyForNetworkResources ? "xs" : 0}
              >
                <Group gap="xs">
                  <IconNetwork size={18} color="var(--vpn-cyan)" />
                  <Box>
                    <Text size="xs" fw={600} className={styles.sectionTitle}>
                      Use this connection only for resources on its network
                    </Text>
                    <Text size="10px" c="dimmed">
                      Intranet-Only: Routes only corporate subnets; native web browsing stays direct
                    </Text>
                  </Box>
                </Group>
                <Switch
                  checked={useOnlyForNetworkResources}
                  onChange={(e) => setUseOnlyForNetworkResources(e.currentTarget.checked)}
                  color="cyan"
                  size="sm"
                />
              </Group>

              {useOnlyForNetworkResources && (
                <Stack gap="xs" mt="xs">
                  <TextInput
                    size="xs"
                    label="Custom Internal Subnets (CIDR)"
                    placeholder="e.g. 10.0.0.0/8, 192.168.10.0/24, 172.16.0.0/12"
                    value={customSubnetsInput}
                    onChange={(e) => setCustomSubnetsInput(e.currentTarget.value)}
                    className="font-mono"
                    description="Private subnets to route into this VPN tunnel (comma-separated)"
                  />
                  <Text size="10px" c="dimmed" className={styles.hintText}>
                    💡 Routes pushed by the VPN server & the assigned tunnel IP are automatically
                    included.
                  </Text>
                </Stack>
              )}
            </Box>
          </Stack>
        </Box>

        <Divider color="rgba(255, 255, 255, 0.08)" />

        {/* Section 2: Keys & Authentication */}
        <Box>
          <Group justify="space-between" align="center" mb="xs">
            <Group gap="xs">
              <IconKey size={16} color="var(--vpn-cyan)" />
              <Text fw={600} size="sm" className={styles.sectionTitle}>
                Keys & Authentication
              </Text>
            </Group>
            <Badge size="xs" variant="light" color={isWireGuard ? "cyan" : "teal"}>
              {isWireGuard ? "WireGuard Key Exchange" : "OpenVPN Auth & 2FA"}
            </Badge>
          </Group>

          {isWireGuard ? (
            <Stack gap="sm" className={styles.wireguardKeysBox}>
              <PasswordInput
                label="WireGuard Private Key (Base64)"
                placeholder="Client peer private key (e.g. aGVwaGFlc3R1cy...)"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.currentTarget.value)}
                className="font-mono"
                description="Encrypted securely in AES-256-GCM Vault"
              />
              <PasswordInput
                label="Preshared Key (Optional Post-Quantum Shield)"
                placeholder="Optional 256-bit symmetric PSK"
                value={presharedKey}
                onChange={(e) => setPresharedKey(e.currentTarget.value)}
                className="font-mono"
                description="Additional layer of post-quantum symmetric encryption"
              />
            </Stack>
          ) : (
            <Stack gap="sm">
              <Box className={styles.openvpnAuthBox}>
                <Stack gap="sm">
                  <TextInput
                    label="Username"
                    placeholder="Enter VPN account username"
                    value={username}
                    onChange={(e) => setUsername(e.currentTarget.value)}
                  />

                  {/* Password / Dynamic 2FA Mode Selector */}
                  <Box>
                    <Text size="xs" fw={500} mb={4} className={styles.fieldLabel}>
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
                              <IconLock size={13} />
                              <span>Static Password</span>
                            </Group>
                          ),
                        },
                        {
                          value: "totp_auto",
                          label: (
                            <Group gap={4} justify="center">
                              <IconBolt size={13} color="var(--vpn-cyan)" />
                              <span>Auto TOTP</span>
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
                        ? "Base password (or leave empty to prompt on connect)"
                        : "Enter password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                  />

                  {/* Auto TOTP Secret Section */}
                  {passwordMode === "totp_auto" && (
                    <Box className={styles.totpAutoBox}>
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
                    <Text size="xs" c="dimmed" className={styles.hintText}>
                      💡 Khi bấm Kết Nối, VPNHub sẽ hiển thị hộp thoại xác thực 2FA nhanh để bạn
                      nhập mã OTP động (Google Authenticator / YubiKey).
                    </Text>
                  )}
                </Stack>
              </Box>

              {/* Section: TLS & Certificates Summary Card */}
              <Box className={hasPopulatedTls ? styles.tlsSummaryBoxActive : styles.tlsSummaryBox}>
                <Group justify="space-between" align="center" mb="xs">
                  <Group gap="xs">
                    <IconCertificate size={18} color="var(--vpn-cyan)" />
                    <Box>
                      <Text size="sm" fw={600} className={styles.sectionTitle}>
                        TLS & Certificate Security
                      </Text>
                      <Text size="11px" c="dimmed">
                        Root CA, TLS Channel Keys, and Client Certificate Authentication
                      </Text>
                    </Box>
                  </Group>
                  <Button
                    size="xs"
                    variant={hasPopulatedTls ? "light" : "outline"}
                    color="cyan"
                    leftSection={<IconAdjustments size={14} />}
                    onClick={() => setCertModalOpened(true)}
                  >
                    {hasPopulatedTls ? "Configure Security" : "Setup Certificates"}
                  </Button>
                </Group>

                {/* Status Badges & Summary */}
                <Group gap="xs" mt="xs" wrap="wrap">
                  {caCert ? (
                    <Badge size="xs" variant="filled" color="teal">
                      ✓ Custom Root CA
                    </Badge>
                  ) : (
                    <Badge size="xs" variant="light" color="gray">
                      System Root CA
                    </Badge>
                  )}

                  {tlsCryptKey ? (
                    <Badge size="xs" variant="filled" color="cyan">
                      ✓ TLS-Crypt Enabled
                    </Badge>
                  ) : tlsAuthKey ? (
                    <Badge size="xs" variant="filled" color="cyan">
                      ✓ TLS-Auth (Dir: {keyDirection})
                    </Badge>
                  ) : (
                    <Badge size="xs" variant="light" color="gray">
                      Standard TLS Handshake
                    </Badge>
                  )}

                  {clientCert || clientKey ? (
                    <Badge size="xs" variant="filled" color="indigo">
                      ✓ Client Cert & Key
                    </Badge>
                  ) : (
                    <Badge size="xs" variant="light" color="gray">
                      User/Pass Auth
                    </Badge>
                  )}

                  {remoteCertTlsServer && (
                    <Badge size="xs" variant="outline" color="teal">
                      Server Verify (Active)
                    </Badge>
                  )}
                </Group>
              </Box>
            </Stack>
          )}
        </Box>
      </Stack>

      <Group justify="flex-end" mt="xl" pt="sm" className={styles.modalFooter}>
        <Button variant="subtle" color="gray" onClick={onClose}>
          Cancel
        </Button>
        <Button color="cyan" onClick={handleSubmit}>
          {isEdit ? "Save Changes" : "Create Profile"}
        </Button>
      </Group>

      {/* Dedicated Certificate & Key Management Modal */}
      <CertificateManagerModal
        opened={certModalOpened}
        onClose={() => setCertModalOpened(false)}
        config={{
          caCert,
          tlsAuthKey,
          tlsCryptKey,
          keyDirection,
          clientCert,
          clientKey,
          remoteCertTlsServer,
          renegSec,
        }}
        onSave={(cfg) => {
          setCaCert(cfg.caCert || "");
          setTlsAuthKey(cfg.tlsAuthKey || "");
          setTlsCryptKey(cfg.tlsCryptKey || "");
          setKeyDirection(cfg.keyDirection || "none");
          setClientCert(cfg.clientCert || "");
          setClientKey(cfg.clientKey || "");
          setRemoteCertTlsServer(
            cfg.remoteCertTlsServer !== undefined ? cfg.remoteCertTlsServer : true
          );
          setRenegSec(cfg.renegSec);
        }}
      />
    </Modal>
  );
};
