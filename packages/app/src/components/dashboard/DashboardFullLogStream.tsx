import React, { useRef, useEffect } from "react";
import { Box, Group, Text, Badge, UnstyledButton, ActionIcon, Tooltip } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconTerminal2,
  IconArrowUpRight,
  IconClearAll,
  IconArrowsDownUp,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";

export const DashboardFullLogStream: React.FC = () => {
  const { logs, isLogAutoScroll, setLogAutoScroll, clearLogs, setActiveTab } = useVpnStore();
  const logContainerRef = useRef<HTMLDivElement>(null);

  const isMobile = useMediaQuery("(max-width: 640px)");
  const isSmallMobile = useMediaQuery("(max-width: 480px)");

  const recentLogs = logs.slice(-30);

  useEffect(() => {
    if (isLogAutoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isLogAutoScroll]);

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "ERROR":
        return {
          color: "#ef4444",
          bg: "rgba(239, 68, 68, 0.15)",
          border: "rgba(239, 68, 68, 0.3)",
        };
      case "WARN":
        return {
          color: "#f59e0b",
          bg: "rgba(245, 158, 11, 0.15)",
          border: "rgba(245, 158, 11, 0.3)",
        };
      case "INFO":
        return {
          color: "#38bdf8",
          bg: "rgba(56, 189, 248, 0.15)",
          border: "rgba(56, 189, 248, 0.3)",
        };
      default:
        return {
          color: "#94a3b8",
          bg: "rgba(148, 163, 184, 0.15)",
          border: "rgba(148, 163, 184, 0.3)",
        };
    }
  };

  return (
    <Box
      className="glass-panel"
      style={{
        padding: isMobile ? "10px 12px" : "14px 16px",
        background: "rgba(17, 24, 39, 0.75)",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: isMobile ? 200 : 180,
        gap: isMobile ? "6px" : "10px",
      }}
    >
      {/* Header Bar */}
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          <IconTerminal2 size={isMobile ? 15 : 16} color="var(--vpn-cyan)" />
          <Text
            size="xs"
            fw={700}
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#fff",
              fontSize: isMobile ? 11 : 12,
            }}
            truncate
          >
            {isMobile ? "Activity Stream" : "Live Activity Stream"}
          </Text>
          <Badge size="xs" variant="dot" color="cyan" style={{ fontSize: 9 }}>
            {logs.length}
          </Badge>
        </Group>

        <Group gap={6} wrap="nowrap">
          <Tooltip label={isLogAutoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}>
            <ActionIcon
              size="xs"
              variant={isLogAutoScroll ? "light" : "subtle"}
              color={isLogAutoScroll ? "cyan" : "gray"}
              onClick={() => setLogAutoScroll(!isLogAutoScroll)}
            >
              <IconArrowsDownUp size={13} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Clear stream">
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={clearLogs}>
              <IconClearAll size={13} />
            </ActionIcon>
          </Tooltip>

          <Box style={{ width: 1, height: 12, background: "var(--vpn-border)", margin: "0 1px" }} />

          <UnstyledButton
            onClick={() => setActiveTab("logs")}
            style={{
              fontSize: 10.5,
              color: "var(--vpn-cyan)",
              display: "flex",
              alignItems: "center",
              gap: 2,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            {isMobile ? "Console" : "Open Full Console"} <IconArrowUpRight size={12} />
          </UnstyledButton>
        </Group>
      </Group>

      {/* Terminal View Body */}
      <Box
        ref={logContainerRef}
        style={{
          background: "rgba(10, 15, 29, 0.88)",
          borderRadius: 8,
          border: "1px solid rgba(255, 255, 255, 0.06)",
          padding: isMobile ? "6px 8px" : "8px 12px",
          flex: 1,
          minHeight: 140,
          overflowY: "auto",
          overflowX: "hidden",
          fontFamily: "var(--font-mono, monospace)",
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? 3 : 4,
        }}
      >
        {recentLogs.length === 0 ? (
          <Box
            style={{
              padding: "20px",
              textAlign: "center",
              color: "var(--vpn-text-muted)",
              fontSize: 11,
            }}
          >
            No log activity captured yet.
          </Box>
        ) : (
          recentLogs.map((log) => {
            const badgeStyle = getLevelBadge(log.level);
            // Compact timestamp for mobile
            const displayTime = isSmallMobile
              ? log.timestamp.split(".")[0] || log.timestamp
              : log.timestamp;

            return (
              <Box
                key={log.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? 5 : 8,
                  padding: "2.5px 4px",
                  borderRadius: 4,
                  fontSize: isMobile ? 10.5 : 11.5,
                  lineHeight: 1.35,
                  transition: "background 0.1s ease",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {/* Monospace Timestamp */}
                <Text
                  size={isMobile ? "9px" : "10px"}
                  className="font-mono"
                  c="dimmed"
                  style={{
                    flexShrink: 0,
                    width: isSmallMobile ? 54 : isMobile ? 64 : 84,
                  }}
                >
                  [{displayTime}]
                </Text>

                {/* Level Badge */}
                <Box
                  style={{
                    color: badgeStyle.color,
                    background: badgeStyle.bg,
                    border: `1px solid ${badgeStyle.border}`,
                    fontSize: isMobile ? "8px" : "9px",
                    fontWeight: 700,
                    padding: isMobile ? "0px 3px" : "1px 5px",
                    borderRadius: 3,
                    flexShrink: 0,
                    minWidth: isMobile ? 32 : 42,
                    textAlign: "center",
                  }}
                >
                  {log.level}
                </Box>

                {/* Source Pill (Hidden on Small Mobile to give maximum room for message) */}
                {!isSmallMobile && (
                  <Text
                    size={isMobile ? "9px" : "10px"}
                    c="dimmed"
                    className="font-mono"
                    style={{
                      background: "rgba(255, 255, 255, 0.04)",
                      padding: "0.5px 4px",
                      borderRadius: 3,
                      flexShrink: 0,
                      maxWidth: isMobile ? 80 : "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {log.source}
                  </Text>
                )}

                {/* Log Message */}
                <Text
                  size={isMobile ? "10px" : "xs"}
                  style={{
                    color: "#f1f5f9",
                    flex: 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {log.message}
                </Text>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
};
