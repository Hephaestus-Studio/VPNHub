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

export const SecurityTelemetryCard: React.FC = () => {
  const { connectionState, securitySettings, appRules, ipRules } = useVpnStore();
  const isConnected = connectionState === "connected";
  const activeRulesCount =
    appRules.filter((r) => r.enabled).length + ipRules.filter((r) => r.enabled).length;

  return (
    <Box
      className="glass-panel"
      style={{
        padding: "16px",
        background: "rgba(17, 24, 39, 0.75)",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: "12px",
      }}
    >
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconShieldLock size={16} color="var(--vpn-cyan)" />
          <Text
            size="xs"
            fw={700}
            style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "#fff" }}
          >
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
        <Box
          style={{
            background: "rgba(31, 41, 55, 0.4)",
            borderRadius: 8,
            padding: "8px 10px",
            border: "1px solid var(--vpn-border)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Group gap={4} align="center" mb={2}>
            <IconRouter size={13} color="var(--vpn-cyan)" />
            <Text size="10px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
              Virtual IP
            </Text>
          </Group>
          <Text
            size="xs"
            fw={700}
            className="font-mono"
            style={{ color: isConnected ? "#22d3ee" : "var(--vpn-text-muted)" }}
          >
            {isConnected ? "10.8.0.2 (tun0)" : "— . — . — . —"}
          </Text>
        </Box>

        {/* Public Exit IP */}
        <Box
          style={{
            background: "rgba(31, 41, 55, 0.4)",
            borderRadius: 8,
            padding: "8px 10px",
            border: "1px solid var(--vpn-border)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Group gap={4} align="center" mb={2}>
            <IconWorld size={13} color="#10b981" />
            <Text size="10px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
              Public Exit IP
            </Text>
          </Group>
          <Text
            size="xs"
            fw={700}
            className="font-mono"
            style={{ color: isConnected ? "#10b981" : "var(--vpn-text-muted)" }}
            truncate
          >
            {isConnected ? "123.30.170.251" : "Native Direct"}
          </Text>
        </Box>

        {/* DNS Resolver */}
        <Box
          style={{
            background: "rgba(31, 41, 55, 0.4)",
            borderRadius: 8,
            padding: "8px 10px",
            border: "1px solid var(--vpn-border)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Group gap={4} align="center" mb={2}>
            <IconShieldCheck size={13} color="#fbbf24" />
            <Text size="10px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
              DNS Protection
            </Text>
          </Group>
          <Text
            size="xs"
            fw={700}
            className="font-mono"
            style={{ color: isConnected ? "#fbbf24" : "var(--vpn-text-muted)" }}
            truncate
          >
            1.1.1.1 (Zero Leak)
          </Text>
        </Box>

        {/* Kill Switch Shield */}
        <Box
          style={{
            background: "rgba(31, 41, 55, 0.4)",
            borderRadius: 8,
            padding: "8px 10px",
            border: "1px solid var(--vpn-border)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Group gap={4} align="center" mb={2}>
            <IconLock size={13} color="#f43f5e" />
            <Text size="10px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
              Kill Switch
            </Text>
          </Group>
          <Text
            size="xs"
            fw={700}
            style={{
              color: securitySettings.killSwitch !== "off" ? "#f43f5e" : "var(--vpn-text-muted)",
            }}
          >
            {securitySettings.killSwitch !== "off" ? "Active (Fail-Close)" : "Disabled"}
          </Text>
        </Box>
      </SimpleGrid>

      {/* Bottom Status Info Banner */}
      <Box
        style={{
          background: isConnected ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.02)",
          border: isConnected
            ? "1px solid rgba(16, 185, 129, 0.25)"
            : "1px solid var(--vpn-border)",
          borderRadius: 6,
          padding: "6px 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Group gap={6}>
          <IconArrowsSplit size={13} color="var(--vpn-cyan)" />
          <Text size="10px" c="dimmed">
            Split Tunneling:
          </Text>
          <Text
            size="10px"
            fw={600}
            style={{ color: activeRulesCount > 0 ? "#34d399" : "var(--vpn-text-muted)" }}
          >
            {activeRulesCount > 0 ? `Active (${activeRulesCount} rules)` : "No Rules Active"}
          </Text>
        </Group>

        <Badge
          size="xs"
          variant="outline"
          color={isConnected ? "teal" : "gray"}
          style={{ fontSize: 9 }}
        >
          {isConnected ? "IPSec/AES-GCM" : "Standby"}
        </Badge>
      </Box>
    </Box>
  );
};
