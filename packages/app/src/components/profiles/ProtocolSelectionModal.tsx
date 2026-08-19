import React from "react";
import { Modal, Stack, Text, Group, Box, Paper, Badge } from "@mantine/core";
import {
  IconBolt,
  IconShieldLock,
  IconFileUpload,
  IconPlus,
  IconChevronRight,
} from "@tabler/icons-react";

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
          <Text fw={700} size="md" style={{ color: "#fff" }}>
            {isImport ? "Import Profile - Select Protocol" : "Add Profile - Select Protocol"}
          </Text>
        </Group>
      }
      size="md"
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
      <Stack gap="md">
        <Text size="xs" c="dimmed">
          {isImport
            ? "Choose which type of configuration file you want to import:"
            : "Choose the VPN protocol engine to configure for this connection profile:"}
        </Text>

        {/* Option 1: WireGuard */}
        <Paper
          p="md"
          onClick={() => {
            onClose();
            onSelect("wireguard");
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
          <Group justify="space-between" align="center">
            <Group gap="md">
              <Box
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "rgba(6, 182, 212, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconBolt size={24} color="var(--vpn-cyan)" />
              </Box>
              <Box>
                <Group gap="xs" align="center" mb={2}>
                  <Text fw={700} size="sm" style={{ color: "#fff" }}>
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
            <IconChevronRight size={18} color="rgba(255, 255, 255, 0.4)" />
          </Group>
        </Paper>

        {/* Option 2: OpenVPN */}
        <Paper
          p="md"
          onClick={() => {
            onClose();
            onSelect("openvpn");
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
          <Group justify="space-between" align="center">
            <Group gap="md">
              <Box
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "rgba(16, 185, 129, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconShieldLock size={24} color="var(--vpn-emerald)" />
              </Box>
              <Box>
                <Group gap="xs" align="center" mb={2}>
                  <Text fw={700} size="sm" style={{ color: "#fff" }}>
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
            <IconChevronRight size={18} color="rgba(255, 255, 255, 0.4)" />
          </Group>
        </Paper>
      </Stack>
    </Modal>
  );
};
