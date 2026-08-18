import { Box, Group, Text, Stack, ActionIcon, Tooltip } from "@mantine/core";
import { IconPower, IconArrowsMaximize, IconShieldLock } from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";

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
    <Box
      style={{
        width: 320,
        height: 440,
        background: "rgba(11, 15, 25, 0.98)",
        border: "1px solid var(--vpn-border)",
        borderRadius: 14,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)",
        margin: "auto",
      }}
    >
      {/* Header */}
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconShieldLock size={18} color="var(--vpn-cyan)" />
          <Text size="sm" fw={700} style={{ color: "#fff" }}>
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
          className={isConnected ? "glow-connected" : isConnecting ? "pulse-connecting" : ""}
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: isConnected
              ? "linear-gradient(135deg, #065f46, #10b981)"
              : isConnecting
                ? "linear-gradient(135deg, #78350f, #f59e0b)"
                : "linear-gradient(135deg, #1f2937, #111827)",
            border: isConnected
              ? "3px solid #34d399"
              : isConnecting
                ? "3px solid #fbbf24"
                : "2px solid rgba(255, 255, 255, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <IconPower
            size={36}
            color={isConnected ? "#ffffff" : isConnecting ? "#fef08a" : "var(--vpn-text-muted)"}
          />
        </Box>

        <Box style={{ textAlign: "center" }}>
          <Text size="sm" fw={700} style={{ color: "#fff" }}>
            {activeProfile?.serverFlag} {activeProfile?.name}
          </Text>
          <Text size="11px" c="dimmed">
            {isConnected ? `Connected • ${formatUptime(uptimeSeconds)}` : "Click button to connect"}
          </Text>
        </Box>
      </Stack>

      {/* Live Telemetry Pill */}
      {isConnected && (
        <Box
          style={{
            padding: "8px 12px",
            background: "rgba(0, 0, 0, 0.3)",
            borderRadius: 8,
            border: "1px solid var(--vpn-border)",
          }}
        >
          <Group justify="space-between">
            <Box>
              <Text size="10px" c="dimmed">
                DOWNLOAD
              </Text>
              <Text size="xs" fw={700} className="font-mono" style={{ color: "#22d3ee" }}>
                {(telemetry.currentDownloadKbps / 1024).toFixed(1)} MB/s
              </Text>
            </Box>

            <Box style={{ textAlign: "right" }}>
              <Text size="10px" c="dimmed">
                PING
              </Text>
              <Text size="xs" fw={700} className="font-mono" style={{ color: "#34d399" }}>
                {telemetry.currentPingMs} ms
              </Text>
            </Box>
          </Group>
        </Box>
      )}

      {/* 3 Quick Profiles */}
      <Box>
        <Text size="10px" fw={700} c="dimmed" mb={4} style={{ textTransform: "uppercase" }}>
          Recent Nodes
        </Text>
        <Stack gap={4}>
          {profiles.slice(0, 3).map((p) => (
            <Box
              key={p.id}
              onClick={() => connect(p.id)}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                background:
                  p.id === activeProfileId ? "rgba(6, 182, 212, 0.12)" : "rgba(31, 41, 55, 0.4)",
                border:
                  p.id === activeProfileId
                    ? "1px solid rgba(6, 182, 212, 0.3)"
                    : "1px solid var(--vpn-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <Group gap={6}>
                <Text size="sm">{p.serverFlag}</Text>
                <Text size="xs" fw={600} style={{ color: "#fff", maxWidth: 160 }} truncate>
                  {p.name}
                </Text>
              </Group>
              <Text size="10px" className="font-mono" style={{ color: "#34d399" }}>
                {p.pingMs}ms
              </Text>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
};
