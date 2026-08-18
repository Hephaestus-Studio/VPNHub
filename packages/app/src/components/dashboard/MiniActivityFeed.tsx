import { Box, Group, Text, Stack, Badge, UnstyledButton } from "@mantine/core";
import { IconTerminal2, IconArrowUpRight } from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";

export const MiniActivityFeed: React.FC = () => {
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
        display: "flex",
        flexDirection: "column",
        gap: "10px",
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
            Quick Log Stream
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
          View Full Console <IconArrowUpRight size={13} />
        </UnstyledButton>
      </Group>

      {/* Mini Log Items */}
      <Stack gap={6}>
        {recentLogs.map((log) => (
          <Box
            key={log.id}
            style={{
              padding: "6px 8px",
              background: "rgba(0, 0, 0, 0.25)",
              borderRadius: 6,
              border: "1px solid var(--vpn-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Group gap={6} wrap="nowrap" style={{ overflow: "hidden" }}>
              <Text size="10px" className="font-mono" c="dimmed">
                [{log.timestamp}]
              </Text>
              <Badge
                size="xs"
                variant="light"
                style={{
                  color: getLevelColor(log.level),
                  background: `${getLevelColor(log.level)}15`,
                  fontSize: 9,
                  height: 16,
                  padding: "0 4px",
                }}
              >
                {log.level}
              </Badge>
              <Text size="xs" style={{ color: "#e5e7eb", fontSize: 11 }} truncate>
                {log.message}
              </Text>
            </Group>

            <Text size="10px" c="dimmed" className="font-mono" style={{ flexShrink: 0 }}>
              {log.source}
            </Text>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};
