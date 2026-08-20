import React from "react";
import { Box, Group, Text, Badge, SimpleGrid } from "@mantine/core";
import {
  IconShieldLock,
  IconRouter,
  IconWorld,
  IconLock,
  IconArrowsSplit,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import styles from "./SecurityTelemetryCard.module.css";

export const SecurityTelemetryCard: React.FC = () => {
  const { connectionState, securitySettings, appRules, ipRules } = useVpnStore();
  const isConnected = connectionState === "connected";
  const activeRulesCount =
    appRules.filter((r) => r.enabled).length + ipRules.filter((r) => r.enabled).length;

  return (
    <Box className={`glass-panel ${styles.card}`}>
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconShieldLock size={16} color="var(--vpn-cyan)" />
          <Text size="xs" fw={700} className={styles.title}>
            Security & Network Telemetry
          </Text>
        </Group>

        <Badge size="xs" variant="dot" color={isConnected ? "teal" : "gray"}>
          {isConnected ? "Encrypted Shield" : "Inactive"}
        </Badge>
      </Group>

      {/* Grid of Security Telemetry Badges */}
      <SimpleGrid cols={2} spacing="xs" style={{ flex: 1 }}>
        {/* Virtual IP */}
        <Box className={styles.metricBox}>
          <Group gap={4} align="center" mb={2}>
            <IconRouter size={13} color="var(--vpn-cyan)" />
            <Text size="10px" c="dimmed" fw={600} className={styles.metricLabel}>
              Virtual IP
            </Text>
          </Group>
          <Text
            size="xs"
            fw={700}
            className={`font-mono ${isConnected ? styles.virtualIpConnected : styles.metricMuted}`}
          >
            {isConnected ? "10.8.0.2 (tun0)" : "— . — . — . —"}
          </Text>
        </Box>

        {/* Public Exit IP */}
        <Box className={styles.metricBox}>
          <Group gap={4} align="center" mb={2}>
            <IconWorld size={13} color="#10b981" />
            <Text size="10px" c="dimmed" fw={600} className={styles.metricLabel}>
              Public Exit IP
            </Text>
          </Group>
          <Text
            size="xs"
            fw={700}
            className={`font-mono ${isConnected ? styles.publicIpConnected : styles.metricMuted}`}
            truncate
          >
            {isConnected ? "123.30.170.251" : "Native Direct"}
          </Text>
        </Box>

        {/* DNS Resolver */}
        <Box className={styles.metricBox}>
          <Group gap={4} align="center" mb={2}>
            <IconShieldCheck size={13} color="#fbbf24" />
            <Text size="10px" c="dimmed" fw={600} className={styles.metricLabel}>
              DNS Protection
            </Text>
          </Group>
          <Text
            size="xs"
            fw={700}
            className={`font-mono ${isConnected ? styles.dnsConnected : styles.metricMuted}`}
            truncate
          >
            1.1.1.1 (Zero Leak)
          </Text>
        </Box>

        {/* Kill Switch Shield */}
        <Box className={styles.metricBox}>
          <Group gap={4} align="center" mb={2}>
            <IconLock size={13} color="#f43f5e" />
            <Text size="10px" c="dimmed" fw={600} className={styles.metricLabel}>
              Kill Switch
            </Text>
          </Group>
          <Text
            size="xs"
            fw={700}
            className={
              securitySettings.killSwitch !== "off" ? styles.killSwitchActive : styles.metricMuted
            }
          >
            {securitySettings.killSwitch !== "off" ? "Active (Fail-Close)" : "Disabled"}
          </Text>
        </Box>
      </SimpleGrid>

      {/* Bottom Status Info Banner */}
      <Box className={isConnected ? styles.bottomBannerConnected : styles.bottomBanner}>
        <Group gap={6}>
          <IconArrowsSplit size={13} color="var(--vpn-cyan)" />
          <Text size="10px" c="dimmed">
            Split Tunneling:
          </Text>
          <Text
            size="10px"
            fw={600}
            className={activeRulesCount > 0 ? styles.splitActive : styles.metricMuted}
          >
            {activeRulesCount > 0 ? `Active (${activeRulesCount} rules)` : "No Rules Active"}
          </Text>
        </Group>

        <Badge
          size="xs"
          variant="outline"
          color={isConnected ? "teal" : "gray"}
          className={styles.badgeSmall}
        >
          {isConnected ? "IPSec/AES-GCM" : "Standby"}
        </Badge>
      </Box>
    </Box>
  );
};
