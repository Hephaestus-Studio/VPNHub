import React from "react";
import { Box, Group, Text, Stack, Badge, UnstyledButton } from "@mantine/core";
import { IconTerminal2, IconArrowUpRight } from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";

export const DashboardLogStreamCard: React.FC = () => {
  const { logs, setActiveTab } = useVpnStore();
  const recentLogs = logs.slice(-5).reverse();

  const getLevelColor = (level: string) => {
    switch (level) {
      case "ERROR":
        return "#ef4444";
      case "WARN":
        return "#f59e0b";
      case "INFO":
        return "#38bdf8";
      default:
        return "#9ca3af";
    }
  };

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
          <IconTerminal2 size={16} color="var(--vpn-cyan)" />
          <Text
            size="xs"
            fw={700}
            style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "#fff" }}
          >
            Live Activity Stream
          </Text>
        </Group>

        <UnstyledButton
          onClick={() => setActiveTab("logs")}
          style={{
            fontSize: 11,
            color: "var(--vpn-cyan)",
            display: "flex",
            alignItems: "center",
            gap: 2,
            fontWeight: 500,
          }}
        >
          Full Console <IconArrowUpRight size={13} />
        </UnstyledButton>
      </Group>

      {/* Mini Log Stream */}
      <Stack gap={6} style={{ flex: 1, overflowY: "auto", maxHeight: 220 }}>
        {recentLogs.length === 0 ? (
          <Box
            style={{
              padding: "20px",
              textAlign: "center",
              color: "var(--vpn-text-muted)",
              fontSize: 11,
            }}
          >
            No events logged yet
          </Box>
        ) : (
          recentLogs.map((log) => (
            <Box
              key={log.id}
              style={{
                padding: "6px 8px",
                background: "rgba(0, 0, 0, 0.28)",
                borderRadius: 6,
                border: "1px solid var(--vpn-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Group gap={6} wrap="nowrap" style={{ overflow: "hidden" }}>
                <Text size="9px" className="font-mono" c="dimmed">
                  [{log.timestamp}]
                </Text>
                <Badge
                  size="xs"
                  variant="light"
                  style={{
                    color: getLevelColor(log.level),
                    background: `${getLevelColor(log.level)}15`,
                    fontSize: 8.5,
                    height: 15,
                    padding: "0 3px",
                    fontWeight: 700,
                  }}
                >
                  {log.level}
                </Badge>
                <Text size="xs" style={{ color: "#e5e7eb", fontSize: 10.5 }} truncate>
                  {log.message}
                </Text>
              </Group>

              <Text size="9px" c="dimmed" className="font-mono" style={{ flexShrink: 0 }}>
                {log.source}
              </Text>
            </Box>
          ))
        )}
      </Stack>
    </Box>
  );
};
