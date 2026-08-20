import React from "react";
import { Modal, Stack, Text, Group, Box, Paper, Badge } from "@mantine/core";
import {
  IconBolt,
  IconShieldLock,
  IconFileUpload,
  IconPlus,
  IconChevronRight,
} from "@tabler/icons-react";
import styles from "./ProtocolSelectionModal.module.css";

interface ProtocolSelectionModalProps {
  opened: boolean;
  onClose: () => void;
  mode: "create" | "import";
  onSelect: (protocol: "wireguard" | "openvpn") => void;
}

export const ProtocolSelectionModal: React.FC<ProtocolSelectionModalProps> = ({
  opened,
  onClose,
  mode,
  onSelect,
}) => {
  const isImport = mode === "import";

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          {isImport ? (
            <IconFileUpload size={20} color="var(--vpn-cyan)" />
          ) : (
            <IconPlus size={20} color="var(--vpn-cyan)" />
          )}
          <Text fw={700} size="md" className={styles.modalTitle}>
            {isImport ? "Import Profile - Select Protocol" : "Add Profile - Select Protocol"}
          </Text>
        </Group>
      }
      size="md"
      centered
      classNames={{
        content: styles.modalContent,
        header: styles.modalHeader,
        body: styles.modalBody,
      }}
    >
      <Stack gap="md">
        <Text size="xs" c="dimmed">
          {isImport
            ? "Choose which type of configuration file you want to import:"
            : "Choose the VPN protocol engine to configure for this connection profile:"}
        </Text>

        {/* Option 1: WireGuard */}
        <Paper
          onClick={() => {
            onClose();
            onSelect("wireguard");
          }}
          className={styles.wireguardOption}
        >
          <Group justify="space-between" align="center">
            <Group gap="md">
              <Box className={styles.wireguardIconBox}>
                <IconBolt size={24} color="var(--vpn-cyan)" />
              </Box>
              <Box>
                <Group gap="xs" align="center" mb={2}>
                  <Text fw={700} size="sm" className={styles.optionTitle}>
                    WireGuard
                  </Text>
                  <Badge size="xs" color="cyan" variant="light">
                    {isImport ? ".conf file" : "UDP Peer-to-Peer"}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {isImport
                    ? "Import standard WireGuard configuration (.conf)"
                    : "Ultra-fast throughput, modern cryptography & lowest latency."}
                </Text>
              </Box>
            </Group>
            <IconChevronRight size={18} className={styles.chevronIcon} />
          </Group>
        </Paper>

        {/* Option 2: OpenVPN */}
        <Paper
          onClick={() => {
            onClose();
            onSelect("openvpn");
          }}
          className={styles.openvpnOption}
        >
          <Group justify="space-between" align="center">
            <Group gap="md">
              <Box className={styles.openvpnIconBox}>
                <IconShieldLock size={24} color="var(--vpn-emerald)" />
              </Box>
              <Box>
                <Group gap="xs" align="center" mb={2}>
                  <Text fw={700} size="sm" className={styles.optionTitle}>
                    OpenVPN
                  </Text>
                  <Badge size="xs" color="teal" variant="light">
                    {isImport ? ".ovpn / .conf" : "TCP / UDP + 2FA"}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {isImport
                    ? "Import OpenVPN client bundle (.ovpn / .conf)"
                    : "Enterprise protocol supporting TCP/UDP, 2FA OTP & TLS Certificates."}
                </Text>
              </Box>
            </Group>
            <IconChevronRight size={18} className={styles.chevronIcon} />
          </Group>
        </Paper>
      </Stack>
    </Modal>
  );
};
