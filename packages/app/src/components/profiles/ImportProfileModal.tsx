import React, { useState } from "react";
import { Modal, Stack, Text, Box, Alert, Group, Badge } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconFileTypeTxt, IconAlertCircle, IconBolt, IconShieldLock } from "@tabler/icons-react";
import { VpnProfile, ProtocolType } from "../../types/vpn";
import { useTranslation } from "../../i18n";
import styles from "./ImportProfileModal.module.css";

interface ImportProfileModalProps {
  opened: boolean;
  onClose: () => void;
  targetProtocol?: "wireguard" | "openvpn";
  onImportParsed?: (profile: VpnProfile) => void;
}

export const ImportProfileModal: React.FC<ImportProfileModalProps> = ({
  opened,
  onClose,
  targetProtocol = "openvpn",
  onImportParsed,
}) => {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  const isWireGuardExpected = targetProtocol === "wireguard";

  const handleDrop = (files: File[]) => {
    setError(null);
    const file = files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => {
      setError(t.modals.failedReadFile);
    };

    reader.onload = (e) => {
      try {
        const content = (e.target?.result as string) || "";
        const isWireGuardContent = content.includes("[Interface]") || content.includes("[Peer]");
        const isOpenVpnContent =
          content.includes("<ca>") ||
          content.includes("<cert>") ||
          content.includes("auth-user-pass") ||
          /^remote\s+/im.test(content) ||
          /^proto\s+/im.test(content) ||
          file.name.toLowerCase().endsWith(".ovpn");

        if (isWireGuardExpected && isOpenVpnContent && !isWireGuardContent) {
          setError(t.modals.errExpectedWg);
          return;
        }

        if (!isWireGuardExpected && isWireGuardContent && !isOpenVpnContent) {
          setError(t.modals.errExpectedOvpn);
          return;
        }

        let protocol: ProtocolType = isWireGuardExpected ? "wireguard" : "openvpn_udp";
        let serverHost = "";
        let serverPort = isWireGuardExpected ? 51820 : 1194;
        let privateKey: string | undefined = undefined;
        let presharedKey: string | undefined = undefined;
        let virtualIp = isWireGuardExpected ? "10.8.0.2/24" : "10.8.0.50/24";
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

        if (isWireGuardExpected || isWireGuardContent) {
          protocol = "wireguard";
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

          const remoteMatch = content.match(
            /^[ \t]*remote\s+([^\s]+)(?:\s+(\d+))?(?:\s+(tcp|udp))?/im
          );
          if (remoteMatch) {
            serverHost = remoteMatch[1].trim();
            if (remoteMatch[2]) {
              serverPort = parseInt(remoteMatch[2], 10);
            }
            if (remoteMatch[3]) {
              protocol = remoteMatch[3].toLowerCase().startsWith("tcp")
                ? "openvpn_tcp"
                : "openvpn_udp";
            }
          }

          const ifconfigMatch = content.match(/^[ \t]*ifconfig\s+([^\s]+)/im);
          if (ifconfigMatch) {
            virtualIp = `${ifconfigMatch[1].trim()}/24`;
          }

          hasAuthUserPass = /^[ \t]*auth-user-pass/im.test(content);
          // Only extract explicit username if defined in comment tag like # username: my_user
          const userCommentMatch = content.match(
            /^[ \t]*#\s*(?:username|user)\s*[:=]\s*([^\r\n]+)/im
          );
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

        const cleanName = file.name.replace(/\.(conf|ovpn)$/i, "");

        const newProf: VpnProfile = {
          id: crypto.randomUUID(),
          name: cleanName || (isWireGuardExpected ? "WireGuard Profile" : "OpenVPN Profile"),
          protocol,
          serverHost: serverHost || "127.0.0.1",
          serverPort: serverPort || (isWireGuardExpected ? 51820 : 1194),
          serverCountry: "Imported Gateway",
          serverCity: "Remote DC",
          serverFlag: "🌐",
          virtualIp,
          isFavorite: false,
          tags: ["Imported", isWireGuardExpected ? "WireGuard" : "OpenVPN"],
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

        if (onImportParsed) {
          onImportParsed(newProf);
        }
        onClose();
      } catch (err: any) {
        setError(err?.message || t.modals.failedParseFile);
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
          {isWireGuardExpected ? (
            <IconBolt size={20} color="var(--vpn-cyan)" />
          ) : (
            <IconShieldLock size={20} color="var(--vpn-emerald)" />
          )}
          <Text fw={700} size="md" className={styles.modalTitle}>
            {isWireGuardExpected ? t.modals.importWgTitle : t.modals.importOvpnTitle}
          </Text>
          <Badge size="xs" color={isWireGuardExpected ? "cyan" : "teal"} variant="light">
            {isWireGuardExpected ? "WireGuard" : "OpenVPN"}
          </Badge>
        </Group>
      }
      size="md"
      centered
      classNames={{
        content: styles.modalContent,
        header: styles.modalHeader,
      }}
    >
      <Stack gap="md">
        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            variant="light"
            classNames={{ root: styles.alertRoot }}
          >
            {error}
          </Alert>
        )}

        <Dropzone
          onDrop={handleDrop}
          maxSize={5 * 1024 * 1024}
          accept={
            isWireGuardExpected
              ? ["text/plain", ".conf"]
              : [
                  "text/plain",
                  "application/x-openvpn-profile",
                  "application/octet-stream",
                  ".ovpn",
                  ".conf",
                ]
          }
          className={isWireGuardExpected ? styles.dropzoneWireguard : styles.dropzoneOpenvpn}
        >
          <Stack align="center" gap="sm">
            <Box
              className={
                isWireGuardExpected
                  ? styles.dropzoneIconCircleWireguard
                  : styles.dropzoneIconCircleOpenvpn
              }
            >
              <IconFileTypeTxt
                size={30}
                color={isWireGuardExpected ? "var(--vpn-cyan)" : "var(--vpn-emerald)"}
              />
            </Box>
            <Text size="sm" fw={600} className={styles.dropzoneTitle}>
              {isWireGuardExpected ? t.modals.importWgDropzone : t.modals.importOvpnDropzone}
            </Text>
            <Text size="xs" c="dimmed">
              {isWireGuardExpected ? t.modals.importWgHelp : t.modals.importOvpnHelp}
            </Text>
            <Text
              size="11px"
              c={isWireGuardExpected ? "cyan" : "teal"}
              className={styles.browseLink}
            >
              {t.modals.importClickBrowse}
            </Text>
          </Stack>
        </Dropzone>
      </Stack>
    </Modal>
  );
};
