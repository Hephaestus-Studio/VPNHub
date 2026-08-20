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
import { useMediaQuery } from "@mantine/hooks";
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
  IconX,
  IconFilterOff,
  IconRotate,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import { LogLevel } from "../../types/vpn";
import styles from "./LogConsoleView.module.css";

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

  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(min-width: 641px) and (max-width: 1024px)");

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

  const levelFilterData = [
    { id: "ALL", label: `ALL (${stats.total})`, color: "cyan" },
    { id: "INFO", label: `INFO (${stats.info})`, color: "blue" },
    { id: "WARN", label: `WARN (${stats.warn})`, color: "yellow" },
    { id: "ERROR", label: `ERR (${stats.error})`, color: "red" },
    { id: "DEBUG", label: `DEBUG (${stats.debug})`, color: "grape" },
  ];

  return (
    <Box className={styles.root}>
      {/* Top Header Bar */}
      <Group justify="space-between" align="center" wrap="nowrap">
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Group gap="xs" align="center" wrap="nowrap">
            <IconTerminal2 size={isMobile ? 18 : 22} color="var(--vpn-cyan)" />
            <Text size={isMobile ? "md" : "xl"} fw={700} className={styles.title} truncate>
              {isMobile ? "System Console" : "Live Daemon & System Console"}
            </Text>
            <Badge size="xs" color="teal" variant="light" style={{ flexShrink: 0 }}>
              STREAM ACTIVE
            </Badge>
          </Group>
          {!isMobile && (
            <Text size="xs" c="dimmed" mt={2} truncate>
              Real-time IPC telemetry, kernel events, routing state transitions, and diagnostics
            </Text>
          )}
        </Box>

        {/* Action Controls */}
        {isMobile ? (
          <Box className={styles.mobileActionGroup}>
            <Tooltip label={isLogAutoScroll ? "Pause Auto-scroll" : "Resume Auto-scroll"}>
              <ActionIcon
                size="md"
                variant={isLogAutoScroll ? "light" : "subtle"}
                color={isLogAutoScroll ? "cyan" : "gray"}
                onClick={() => setLogAutoScroll(!isLogAutoScroll)}
                className={styles.mobileActionBtn}
              >
                {isLogAutoScroll ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
              </ActionIcon>
            </Tooltip>

            <CopyButton value={getFullFormattedLogs()} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? "Copied all!" : "Copy all visible logs"}>
                  <ActionIcon
                    size="md"
                    variant="subtle"
                    color={copied ? "teal" : "gray"}
                    onClick={copy}
                    className={styles.mobileActionBtn}
                  >
                    {copied ? <IconCheck size={16} color="#10b981" /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>

            <Tooltip label="Export logs (.txt)">
              <ActionIcon
                size="md"
                variant="subtle"
                color="gray"
                onClick={handleExportLogs}
                disabled={filteredLogs.length === 0}
                className={styles.mobileActionBtn}
              >
                <IconDownload size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Clear memory logs">
              <ActionIcon
                size="md"
                variant="subtle"
                color="red"
                onClick={clearLogs}
                disabled={logs.length === 0}
                className={styles.mobileActionBtn}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ) : (
          <Group gap="xs">
            {!isTablet && (
              <Tooltip label="Insert a test log event">
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
            )}

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
                {isLogAutoScroll ? "Auto-scroll ON" : "PAUSED"}
              </Button>
            </Tooltip>

            <CopyButton value={getFullFormattedLogs()} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? "Copied!" : "Copy visible logs"}>
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

            <Tooltip label="Export visible logs as .txt">
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

            <Tooltip label="Clear all console logs">
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
        )}
      </Group>

      {/* Controls Bar: Search & Level Filter Pills */}
      <Box className={`glass-panel ${styles.controlsPanel}`}>
        <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
          <TextInput
            placeholder={
              isMobile ? "Search logs..." : "Search logs by keyword, subsystem, error..."
            }
            size="xs"
            leftSection={<IconSearch size={14} color="var(--vpn-text-muted)" />}
            rightSection={
              logSearchQuery ? (
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => setLogSearchQuery("")}
                >
                  <IconX size={12} />
                </ActionIcon>
              ) : null
            }
            value={logSearchQuery}
            onChange={(e) => setLogSearchQuery(e.currentTarget.value)}
            className={styles.searchInput}
            classNames={{
              input: styles.searchInputField,
            }}
          />

          {!isMobile && (
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
              classNames={{
                root: styles.segmentedRoot,
              }}
            />
          )}
        </Group>

        {/* On Mobile: Horizontal Scrollable Level Pills */}
        {isMobile && (
          <Box className={styles.pillsScrollContainer}>
            {levelFilterData.map((lvl) => (
              <Button
                key={lvl.id}
                size="xs"
                variant={logFilterLevel === lvl.id ? "filled" : "subtle"}
                color={logFilterLevel === lvl.id ? lvl.color : "gray"}
                onClick={() => setLogFilterLevel(lvl.id)}
                className={styles.filterPill}
              >
                {lvl.label}
              </Button>
            ))}
          </Box>
        )}
      </Box>

      {/* Main Terminal Window Frame */}
      <Box className={styles.terminalFrame}>
        {/* Terminal Header Bar */}
        <Box className={styles.terminalHeader}>
          <Group gap={6}>
            <Box className={styles.dotRed} />
            <Box className={styles.dotYellow} />
            <Box className={styles.dotGreen} />
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
            <Badge size="xs" variant="dot" color="teal">
              {filteredLogs.length} of {logs.length}
            </Badge>
          </Group>
        </Box>

        {/* Terminal Body Scroll Area */}
        <Box ref={logContainerRef} className={styles.terminalBody}>
          {filteredLogs.length === 0 ? (
            <Box className={styles.emptyBox}>
              <Box className={styles.emptyIconWrapper}>
                {logs.length === 0 ? (
                  <IconTerminal2 size={26} stroke={1.8} />
                ) : (
                  <IconFilterOff size={26} stroke={1.8} />
                )}
              </Box>
              <Text className={styles.emptyTitle}>
                {logs.length === 0 ? "Console Stream Idle" : "No Matching Logs"}
              </Text>
              <Text className={styles.emptySubtitle}>
                {logs.length === 0
                  ? "System events, routing changes, and IPC telemetry will stream here automatically."
                  : "No log records match your active search query or level filter."}
              </Text>
              {logs.length > 0 ? (
                <Button
                  size="xs"
                  variant="light"
                  color="cyan"
                  leftSection={<IconRotate size={14} />}
                  onClick={() => {
                    setLogFilterLevel("ALL");
                    setLogSearchQuery("");
                  }}
                  className={styles.emptyActionBtn}
                >
                  Reset Filters
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="light"
                  color="cyan"
                  leftSection={<IconPlus size={14} />}
                  onClick={() =>
                    addLog(
                      "INFO",
                      "SYSTEM",
                      `Manual console trigger test event at ${new Date().toLocaleTimeString()}`
                    )
                  }
                  className={styles.emptyActionBtn}
                >
                  Trigger Test Event
                </Button>
              )}
            </Box>
          ) : (
            filteredLogs.map((log) => {
              const levelColor = getLevelColor(log.level);
              let msgClass = styles.messageInfo;
              if (log.level === "ERROR") msgClass = styles.messageError;
              else if (log.level === "WARN") msgClass = styles.messageWarn;

              if (isMobile) {
                // 2-Tier Layout on Mobile
                return (
                  <Box key={log.id} className={styles.mobileLogRow}>
                    <Box className={styles.mobileMetaRow}>
                      <Box className={styles.mobileMetaLeft}>
                        <Text component="span" className={`font-mono ${styles.timestamp}`}>
                          [{log.timestamp}]
                        </Text>
                        <Box
                          className={styles.levelPill}
                          style={{
                            color: levelColor,
                            background: `${levelColor}18`,
                            border: `1px solid ${levelColor}30`,
                          }}
                        >
                          {getLevelIcon(log.level)}
                          <span>{log.level}</span>
                        </Box>
                        <Text component="span" className={`font-mono ${styles.sourceTag}`}>
                          [{log.source}]
                        </Text>
                      </Box>

                      <CopyButton
                        value={`[${log.timestamp}] [${log.level}] [${log.source}]: ${log.message}`}
                        timeout={1500}
                      >
                        {({ copied, copy }) => (
                          <ActionIcon
                            size={18}
                            variant="subtle"
                            color="gray"
                            onClick={copy}
                            className={styles.copyRowBtn}
                          >
                            {copied ? (
                              <IconCheck size={12} color="#10b981" />
                            ) : (
                              <IconCopy size={12} />
                            )}
                          </ActionIcon>
                        )}
                      </CopyButton>
                    </Box>

                    <Text
                      component="div"
                      className={`font-mono ${styles.mobileMessageRow} ${msgClass}`}
                    >
                      {log.message}
                    </Text>
                  </Box>
                );
              }

              // Desktop & Tablet: Standard 1-Line Row
              return (
                <Box key={log.id} className={styles.logRow}>
                  {/* Timestamp */}
                  <Text component="span" className={`font-mono ${styles.timestamp}`}>
                    [{log.timestamp}]
                  </Text>

                  {/* Level Pill */}
                  <Box
                    className={styles.levelPill}
                    style={{
                      color: levelColor,
                      background: `${levelColor}18`,
                      border: `1px solid ${levelColor}30`,
                    }}
                  >
                    {getLevelIcon(log.level)}
                    <span>{log.level}</span>
                  </Box>

                  {/* Source Module */}
                  <Text component="span" className={`font-mono ${styles.sourceTag}`}>
                    [{log.source}]
                  </Text>

                  {/* Log Message Content */}
                  <Text component="span" className={`font-mono ${styles.logMessage} ${msgClass}`}>
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
                          className={styles.copyRowBtn}
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
            className={styles.scrollButton}
          >
            Scroll to Top
          </Button>
        )}
      </Box>
    </Box>
  );
};
