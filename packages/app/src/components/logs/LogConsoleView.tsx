import React, { useMemo, useRef, useEffect } from "react";
import {
  Box,
  Group,
  Text,
  Badge,
  Button,
  ActionIcon,
  TextInput,
  SegmentedControl,
  Tooltip,
  CopyButton,
} from "@mantine/core";
import {
  IconTerminal2,
  IconTrash,
  IconCopy,
  IconCheck,
  IconDownload,
  IconSearch,
  IconPlayerPause,
  IconPlayerPlay,
  IconAlertTriangle,
  IconAlertCircle,
  IconInfoCircle,
  IconBug,
  IconArrowUp,
  IconPlus,
  IconSortDescending,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import { LogLevel } from "../../types/vpn";

export const LogConsoleView: React.FC = () => {
  const {
    logs,
    clearLogs,
    addLog,
    isLogAutoScroll,
    setLogAutoScroll,
    logFilterLevel,
    setLogFilterLevel,
    logSearchQuery,
    setLogSearchQuery,
  } = useVpnStore();

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Filtered logs sorted in descending order (newest logs at the top)
  const filteredLogs = useMemo(() => {
    const matched = logs.filter((log) => {
      // Level filter
      if (logFilterLevel !== "ALL" && log.level !== logFilterLevel) {
        return false;
      }
      // Search query filter
      if (logSearchQuery.trim()) {
        const query = logSearchQuery.toLowerCase();
        const matchesMsg = log.message.toLowerCase().includes(query);
        const matchesSource = log.source.toLowerCase().includes(query);
        const matchesLevel = log.level.toLowerCase().includes(query);
        const matchesTimestamp = log.timestamp.toLowerCase().includes(query);
        if (!matchesMsg && !matchesSource && !matchesLevel && !matchesTimestamp) {
          return false;
        }
      }
      return true;
    });

    // Return in descending order (newest log at index 0)
    return [...matched].reverse();
  }, [logs, logFilterLevel, logSearchQuery]);

  // Count stats
  const stats = useMemo(() => {
    let errorCount = 0;
    let warnCount = 0;
    let infoCount = 0;
    let debugCount = 0;

    for (const log of logs) {
      if (log.level === "ERROR") errorCount++;
      else if (log.level === "WARN") warnCount++;
      else if (log.level === "INFO") infoCount++;
      else if (log.level === "DEBUG") debugCount++;
    }

    return {
      total: logs.length,
      error: errorCount,
      warn: warnCount,
      info: infoCount,
      debug: debugCount,
    };
  }, [logs]);

  // Auto-scroll to top when new logs arrive (since newest logs are at the top)
  useEffect(() => {
    if (isLogAutoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs, isLogAutoScroll]);

  // Export logs to downloadable file
  const handleExportLogs = () => {
    const content = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level.padEnd(5)}] [${l.source}]: ${l.message}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vpnhub-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Copy full logs formatted string
  const getFullFormattedLogs = () => {
    return filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level.padEnd(5)}] [${l.source}]: ${l.message}`)
      .join("\n");
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case "ERROR":
        return "#ef4444";
      case "WARN":
        return "#f59e0b";
      case "INFO":
        return "#38bdf8";
      case "DEBUG":
        return "#a78bfa";
      default:
        return "#9ca3af";
    }
  };

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case "ERROR":
        return <IconAlertCircle size={12} color="#ef4444" />;
      case "WARN":
        return <IconAlertTriangle size={12} color="#f59e0b" />;
      case "INFO":
        return <IconInfoCircle size={12} color="#38bdf8" />;
      case "DEBUG":
        return <IconBug size={12} color="#a78bfa" />;
      default:
        return null;
    }
  };

  return (
    <Box
      style={{
        padding: "16px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        overflow: "hidden",
      }}
    >
      {/* Header Bar */}
      <Group justify="space-between" align="center" wrap="wrap" gap="xs">
        <Box>
          <Group gap="xs" align="center">
            <IconTerminal2 size={22} color="var(--vpn-cyan)" />
            <Text size="xl" fw={700} style={{ color: "#fff", letterSpacing: "-0.02em" }}>
              Live Daemon & System Console
            </Text>
            <Badge size="xs" color="teal" variant="light">
              STREAM ACTIVE
            </Badge>
          </Group>
          <Text size="xs" c="dimmed" mt={2}>
            Real-time IPC telemetry, kernel events, routing state transitions, and diagnostics
          </Text>
        </Box>

        {/* Global Toolbar Actions */}
        <Group gap="xs">
          <Tooltip label="Insert a test log event to verify stream responsiveness">
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              leftSection={<IconPlus size={14} />}
              onClick={() =>
                addLog(
                  "INFO",
                  "USER_EVENT",
                  `Manual trigger test event at ${new Date().toLocaleTimeString()}`
                )
              }
            >
              Test Event
            </Button>
          </Tooltip>

          <Tooltip label={isLogAutoScroll ? "Pause automatic scrolling" : "Resume auto scroll"}>
            <Button
              size="xs"
              variant={isLogAutoScroll ? "light" : "outline"}
              color={isLogAutoScroll ? "cyan" : "gray"}
              leftSection={
                isLogAutoScroll ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />
              }
              onClick={() => setLogAutoScroll(!isLogAutoScroll)}
            >
              {isLogAutoScroll ? "Auto-scroll ON" : "Auto-scroll PAUSED"}
            </Button>
          </Tooltip>

          <CopyButton value={getFullFormattedLogs()} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? "Copied to clipboard!" : "Copy all visible logs"}>
                <Button
                  size="xs"
                  variant="default"
                  leftSection={
                    copied ? <IconCheck size={14} color="#10b981" /> : <IconCopy size={14} />
                  }
                  onClick={copy}
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </Tooltip>
            )}
          </CopyButton>

          <Tooltip label="Export visible logs as a .txt file">
            <Button
              size="xs"
              variant="default"
              leftSection={<IconDownload size={14} />}
              onClick={handleExportLogs}
              disabled={filteredLogs.length === 0}
            >
              Export
            </Button>
          </Tooltip>

          <Tooltip label="Clear all console logs from memory">
            <Button
              size="xs"
              color="red"
              variant="light"
              leftSection={<IconTrash size={14} />}
              onClick={clearLogs}
              disabled={logs.length === 0}
            >
              Clear
            </Button>
          </Tooltip>
        </Group>
      </Group>

      {/* Filter and Stats Bar */}
      <Group justify="space-between" align="center" wrap="wrap" gap="xs">
        <Group gap="xs" style={{ flex: 1, minWidth: 260 }}>
          <TextInput
            placeholder="Search logs by keyword, subsystem, error..."
            size="xs"
            leftSection={<IconSearch size={14} />}
            value={logSearchQuery}
            onChange={(e) => setLogSearchQuery(e.currentTarget.value)}
            style={{ flex: 1, maxWidth: 360 }}
            styles={{
              input: {
                background: "rgba(17, 24, 39, 0.75)",
                borderColor: "var(--vpn-border)",
                color: "#fff",
              },
            }}
          />

          <SegmentedControl
            size="xs"
            value={logFilterLevel}
            onChange={(val) => setLogFilterLevel(val)}
            data={[
              {
                value: "ALL",
                label: (
                  <Group gap={4} justify="center" wrap="nowrap">
                    <IconTerminal2 size={12} color="var(--vpn-cyan)" />
                    <span>ALL ({stats.total})</span>
                  </Group>
                ),
              },
              {
                value: "INFO",
                label: (
                  <Group gap={4} justify="center" wrap="nowrap">
                    <IconInfoCircle size={12} color="#38bdf8" />
                    <span>INFO ({stats.info})</span>
                  </Group>
                ),
              },
              {
                value: "WARN",
                label: (
                  <Group gap={4} justify="center" wrap="nowrap">
                    <IconAlertTriangle size={12} color="#f59e0b" />
                    <span>WARN ({stats.warn})</span>
                  </Group>
                ),
              },
              {
                value: "ERROR",
                label: (
                  <Group gap={4} justify="center" wrap="nowrap">
                    <IconAlertCircle size={12} color="#ef4444" />
                    <span>ERR ({stats.error})</span>
                  </Group>
                ),
              },
              {
                value: "DEBUG",
                label: (
                  <Group gap={4} justify="center" wrap="nowrap">
                    <IconBug size={12} color="#a78bfa" />
                    <span>DEBUG ({stats.debug})</span>
                  </Group>
                ),
              },
            ]}
            styles={{
              root: {
                background: "rgba(17, 24, 39, 0.75)",
                border: "1px solid var(--vpn-border)",
              },
            }}
          />
        </Group>

        <Group gap="xs">
          <Badge size="xs" variant="dot" color="teal">
            Showing {filteredLogs.length} of {logs.length}
          </Badge>
        </Group>
      </Group>

      {/* Main Terminal Window Frame */}
      <Box
        className="glass-panel"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "rgba(8, 12, 20, 0.95)",
          border: "1px solid var(--vpn-border)",
          borderRadius: 8,
          overflow: "hidden",
          position: "relative",
          boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Terminal Header Bar */}
        <Box
          style={{
            padding: "8px 12px",
            background: "rgba(0, 0, 0, 0.45)",
            borderBottom: "1px solid var(--vpn-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            userSelect: "none",
          }}
        >
          <Group gap={6}>
            <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
            <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
            <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981" }} />
          </Group>

          <Group gap="xs">
            <Badge
              size="xs"
              color="cyan"
              variant="outline"
              leftSection={<IconSortDescending size={11} />}
            >
              NEWEST ON TOP
            </Badge>
            {!isLogAutoScroll && (
              <Badge size="xs" color="yellow" variant="light">
                Scroll Lock Active
              </Badge>
            )}
          </Group>
        </Box>

        {/* Terminal Body Scroll Area */}
        <Box
          ref={logContainerRef}
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            userSelect: "text",
            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {filteredLogs.length === 0 ? (
            <Box
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--vpn-text-muted)",
                gap: 8,
                userSelect: "none",
              }}
            >
              <IconTerminal2 size={36} stroke={1.5} color="rgba(255, 255, 255, 0.2)" />
              <Text size="sm" c="dimmed">
                {logs.length === 0
                  ? "No logs captured yet. System events will stream here automatically."
                  : "No logs match the current filter or search criteria."}
              </Text>
              {logs.length > 0 && (
                <Button
                  size="xs"
                  variant="subtle"
                  color="cyan"
                  onClick={() => {
                    setLogFilterLevel("ALL");
                    setLogSearchQuery("");
                  }}
                >
                  Reset Filters
                </Button>
              )}
            </Box>
          ) : (
            filteredLogs.map((log) => {
              const levelColor = getLevelColor(log.level);
              return (
                <Box
                  key={log.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "2px 6px",
                    borderRadius: 4,
                    transition: "background 0.1s ease",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Timestamp */}
                  <Text
                    component="span"
                    className="font-mono"
                    style={{
                      color: "rgba(255, 255, 255, 0.35)",
                      fontSize: 11,
                      flexShrink: 0,
                      userSelect: "text",
                    }}
                  >
                    [{log.timestamp}]
                  </Text>

                  {/* Level Pill */}
                  <Box
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      padding: "0 5px",
                      borderRadius: 3,
                      fontSize: 10,
                      fontWeight: 700,
                      color: levelColor,
                      background: `${levelColor}18`,
                      border: `1px solid ${levelColor}30`,
                      flexShrink: 0,
                      lineHeight: "16px",
                    }}
                  >
                    {getLevelIcon(log.level)}
                    <span>{log.level}</span>
                  </Box>

                  {/* Source Module */}
                  <Text
                    component="span"
                    className="font-mono"
                    style={{
                      color: "var(--vpn-cyan)",
                      fontSize: 11,
                      fontWeight: 600,
                      flexShrink: 0,
                      opacity: 0.9,
                    }}
                  >
                    [{log.source}]
                  </Text>

                  {/* Log Message Content */}
                  <Text
                    component="span"
                    className="font-mono"
                    style={{
                      color:
                        log.level === "ERROR"
                          ? "#fca5a5"
                          : log.level === "WARN"
                            ? "#fde68a"
                            : "#e5e7eb",
                      fontSize: 11.5,
                      wordBreak: "break-all",
                      flex: 1,
                    }}
                  >
                    {log.message}
                  </Text>

                  {/* Individual Row Copy Button */}
                  <CopyButton
                    value={`[${log.timestamp}] [${log.level}] [${log.source}]: ${log.message}`}
                    timeout={1500}
                  >
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? "Copied line" : "Copy line"} position="left">
                        <ActionIcon
                          size={18}
                          variant="subtle"
                          color="gray"
                          onClick={copy}
                          style={{
                            opacity: 0.3,
                            flexShrink: 0,
                            transition: "opacity 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.3")}
                        >
                          {copied ? (
                            <IconCheck size={12} color="#10b981" />
                          ) : (
                            <IconCopy size={12} />
                          )}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Box>
              );
            })
          )}
        </Box>

        {/* Floating Quick Scroll to Top button if auto-scroll is disabled */}
        {!isLogAutoScroll && filteredLogs.length > 0 && (
          <Button
            size="xs"
            variant="filled"
            color="cyan"
            leftSection={<IconArrowUp size={14} />}
            onClick={() => {
              if (logContainerRef.current) {
                logContainerRef.current.scrollTop = 0;
              }
            }}
            style={{
              position: "absolute",
              bottom: 12,
              right: 20,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
              zIndex: 10,
            }}
          >
            Scroll to Top
          </Button>
        )}
      </Box>
    </Box>
  );
};
