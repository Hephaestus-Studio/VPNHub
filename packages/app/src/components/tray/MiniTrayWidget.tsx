import { Box, Group, Text, Stack, ActionIcon, Tooltip } from "@mantine/core";
import { IconPower, IconArrowsMaximize, IconShieldLock } from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import styles from "./MiniTrayWidget.module.css";

export const MiniTrayWidget: React.FC = () => {
  const {
    connectionState,
    activeProfileId,
    profiles,
    uptimeSeconds,
    telemetry,
    connect,
    disconnect,
    setCompactWidget,
  } = useVpnStore();

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting";

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(
      secs
    ).padStart(2, "0")}`;
  };

  const handleToggle = () => {
    if (isConnected) disconnect();
    else connect(activeProfile?.id);
  };

  return (
    <Box className={styles.root}>
      {/* Header */}
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconShieldLock size={18} color="var(--vpn-cyan)" />
          <Text size="sm" fw={700} className={styles.title}>
            VPNHub Mini
          </Text>
        </Group>

        <Tooltip label="Expand to Full Application" position="left">
          <ActionIcon
            variant="subtle"
            size="sm"
            color="gray"
            onClick={() => setCompactWidget(false)}
          >
            <IconArrowsMaximize size={15} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Main Power Button */}
      <Stack align="center" gap="sm" my="xs">
        <Box
          onClick={handleToggle}
          className={`${styles.powerButtonBase} ${
            isConnected
              ? `glow-connected ${styles.powerButtonConnected}`
              : isConnecting
                ? `pulse-connecting ${styles.powerButtonConnecting}`
                : styles.powerButtonIdle
          }`}
        >
          <IconPower
            size={36}
            color={isConnected ? "#ffffff" : isConnecting ? "#fef08a" : "var(--vpn-text-muted)"}
          />
        </Box>

        <Box className={styles.profileLabelBox}>
          <Text size="sm" fw={700} className={styles.profileName}>
            {activeProfile?.serverFlag} {activeProfile?.name}
          </Text>
          <Text size="11px" c="dimmed">
            {isConnected ? `Connected • ${formatUptime(uptimeSeconds)}` : "Click button to connect"}
          </Text>
        </Box>
      </Stack>

      {/* Live Telemetry Pill */}
      {isConnected && (
        <Box className={styles.telemetryPill}>
          <Group justify="space-between">
            <Box>
              <Text size="10px" c="dimmed">
                DOWNLOAD
              </Text>
              <Text size="xs" fw={700} className={`font-mono ${styles.downloadSpeed}`}>
                {(telemetry.currentDownloadKbps / 1024).toFixed(1)} MB/s
              </Text>
            </Box>

            <Box className={styles.pingTextRight}>
              <Text size="10px" c="dimmed">
                PING
              </Text>
              <Text size="xs" fw={700} className={`font-mono ${styles.pingText}`}>
                {telemetry.currentPingMs} ms
              </Text>
            </Box>
          </Group>
        </Box>
      )}

      {/* 3 Quick Profiles */}
      <Box>
        <Text size="10px" fw={700} c="dimmed" mb={4} className={styles.recentNodesHeader}>
          Recent Nodes
        </Text>
        <Stack gap={4}>
          {profiles.slice(0, 3).map((p) => (
            <Box
              key={p.id}
              onClick={() => connect(p.id)}
              className={`${styles.nodeItemBase} ${
                p.id === activeProfileId ? styles.nodeItemActive : styles.nodeItemInactive
              }`}
            >
              <Group gap={6}>
                <Text size="sm">{p.serverFlag}</Text>
                <Text size="xs" fw={600} className={styles.nodeName} truncate>
                  {p.name}
                </Text>
              </Group>
              <Text size="10px" className={`font-mono ${styles.pingText}`}>
                {p.pingMs}ms
              </Text>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
};
