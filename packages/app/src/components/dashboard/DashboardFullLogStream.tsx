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
import styles from "./DashboardFullLogStream.module.css";

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
    <Box className={`glass-panel ${isMobile ? styles.panelMobile : styles.panel}`}>
      {/* Header Bar */}
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          <IconTerminal2 size={isMobile ? 15 : 16} color="var(--vpn-cyan)" />
          <Text
            size="xs"
            fw={700}
            className={isMobile ? styles.titleMobile : styles.title}
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

          <Box className={styles.divider} />

          <UnstyledButton onClick={() => setActiveTab("logs")} className={styles.openButton}>
            {isMobile ? "Console" : "Open Full Console"} <IconArrowUpRight size={12} />
          </UnstyledButton>
        </Group>
      </Group>

      {/* Terminal View Body */}
      <Box
        ref={logContainerRef}
        className={isMobile ? styles.terminalBodyMobile : styles.terminalBody}
      >
        {recentLogs.length === 0 ? (
          <Box className={styles.emptyLogs}>No log activity captured yet.</Box>
        ) : (
          recentLogs.map((log) => {
            const badgeStyle = getLevelBadge(log.level);
            // Compact timestamp for mobile
            const displayTime = isSmallMobile
              ? log.timestamp.split(".")[0] || log.timestamp
              : log.timestamp;

            return (
              <Box key={log.id} className={isMobile ? styles.logRowMobile : styles.logRow}>
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
                    className={`font-mono ${styles.sourcePill}`}
                    style={{
                      maxWidth: isMobile ? 80 : "none",
                    }}
                  >
                    {log.source}
                  </Text>
                )}

                {/* Log Message */}
                <Text size={isMobile ? "10px" : "xs"} className={styles.logMessage}>
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
