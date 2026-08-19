import React from "react";
import { Box, Group, Text, Badge, Button, Stack, UnstyledButton } from "@mantine/core";
import {
  IconPower,
  IconShieldCheck,
  IconClock,
  IconArrowDownRight,
  IconArrowUpRight,
  IconArrowsExchange,
  IconActivity,
  IconBolt,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";

export const HeroCommandBanner: React.FC = () => {
  const {
    connectionState,
    activeProfileId,
    profiles,
    uptimeSeconds,
    telemetry,
    connect,
    disconnect,
    setActiveTab,
  } = useVpnStore();

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting" || connectionState === "reconnecting";
  const isDisconnecting = connectionState === "disconnecting";

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(
      secs
    ).padStart(2, "0")}`;
  };

  const formatSpeed = (kbps: number) => {
    if (kbps >= 1024) {
      return `${(kbps / 1024).toFixed(1)} MB/s`;
    }
    return `${kbps.toFixed(0)} KB/s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleToggle = () => {
    if (isConnected) {
      disconnect();
    } else if (connectionState === "disconnected" || connectionState === "error") {
      connect(activeProfile?.id);
    }
  };

  // Sparkline generator
  const points = telemetry.sparkline || [];
  const svgWidth = 260;
  const svgHeight = 54;
  const maxSpeed = Math.max(...points.map((p) => p.downloadSpeed), 50000);
  const minSpeed = 0;

  const getSvgPath = (key: "downloadSpeed" | "uploadSpeed") => {
    if (points.length === 0) return "";
    const step = svgWidth / Math.max(points.length - 1, 1);
    return points
      .map((p, i) => {
        const x = i * step;
        const val = p[key];
        const y = svgHeight - ((val - minSpeed) / (maxSpeed - minSpeed)) * (svgHeight - 8) - 4;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const downloadPath = getSvgPath("downloadSpeed");
  const uploadPath = getSvgPath("uploadSpeed");
  const downloadAreaPath = downloadPath
    ? `${downloadPath} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`
    : "";

  return (
    <Box
      className="glass-panel"
      style={{
        padding: "20px 24px",
        background: isConnected
          ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(17, 24, 39, 0.92) 50%, rgba(6, 182, 212, 0.05) 100%)"
          : "linear-gradient(135deg, rgba(17, 24, 39, 0.92) 0%, rgba(15, 23, 42, 0.95) 100%)",
        border: isConnected
          ? "1px solid rgba(16, 185, 129, 0.35)"
          : isConnecting
            ? "1px solid rgba(245, 158, 11, 0.35)"
            : "1px solid var(--vpn-border)",
        boxShadow: isConnected
          ? "0 10px 30px -10px rgba(16, 185, 129, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)"
          : "0 10px 25px -10px rgba(0, 0, 0, 0.5)",
        borderRadius: "14px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background ambient glow */}
      {isConnected && (
        <Box
          style={{
            position: "absolute",
            top: -40,
            left: 20,
            width: 200,
            height: 200,
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)",
            filter: "blur(30px)",
            pointerEvents: "none",
          }}
        />
      )}

      <Group justify="space-between" align="center" wrap="wrap" gap="xl">
        {/* Left Side: Big Power Trigger + Profile Connection Overview */}
        <Group gap="lg" wrap="nowrap" style={{ flex: "1 1 400px" }}>
          {/* Main Power Circle Button */}
          <Box style={{ position: "relative" }}>
            <UnstyledButton
              onClick={handleToggle}
              disabled={isConnecting || isDisconnecting}
              style={{
                width: 68,
                height: 68,
                borderRadius: "50%",
                background: isConnected
                  ? "linear-gradient(135deg, #10b981, #059669)"
                  : isConnecting
                    ? "linear-gradient(135deg, #f59e0b, #d97706)"
                    : "linear-gradient(135deg, rgba(31, 41, 55, 0.8), rgba(17, 24, 39, 0.95))",
                border: isConnected
                  ? "2px solid #34d399"
                  : isConnecting
                    ? "2px solid #fbbf24"
                    : "2px solid rgba(255, 255, 255, 0.12)",
                boxShadow: isConnected
                  ? "0 0 25px rgba(16, 185, 129, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.3)"
                  : isConnecting
                    ? "0 0 25px rgba(245, 158, 11, 0.5)"
                    : "0 4px 15px rgba(0, 0, 0, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isConnecting || isDisconnecting ? "wait" : "pointer",
                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                transform: "scale(1)",
              }}
              onMouseEnter={(e) => {
                if (!isConnecting && !isDisconnecting) {
                  e.currentTarget.style.transform = "scale(1.05)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <IconPower
                size={30}
                color={isConnected ? "#ffffff" : isConnecting ? "#ffffff" : "var(--vpn-text-muted)"}
                stroke={2.4}
              />
            </UnstyledButton>

            {/* Pulsing Outer Ring when Connecting */}
            {isConnecting && (
              <Box
                style={{
                  position: "absolute",
                  inset: -6,
                  borderRadius: "50%",
                  border: "2px solid #f59e0b",
                  opacity: 0.7,
                  animation: "pulse 1.5s infinite cubic-bezier(0.4, 0, 0.6, 1)",
                  pointerEvents: "none",
                }}
              />
            )}
          </Box>

          {/* Connection Status & Profile Details */}
          <Stack gap={5}>
            <Group gap="xs" align="center">
              {isConnected ? (
                <Badge
                  size="sm"
                  variant="filled"
                  color="teal"
                  leftSection={<IconShieldCheck size={13} />}
                  style={{
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    boxShadow: "0 0 10px rgba(16, 185, 129, 0.35)",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  PROTECTED & CONNECTED
                </Badge>
              ) : isConnecting ? (
                <Badge
                  size="sm"
                  variant="filled"
                  color="yellow"
                  style={{
                    background: "linear-gradient(135deg, #f59e0b, #d97706)",
                    fontWeight: 700,
                  }}
                >
                  HANDSHAKE IN PROGRESS...
                </Badge>
              ) : (
                <Badge
                  size="sm"
                  variant="outline"
                  color="gray"
                  style={{ color: "var(--vpn-text-secondary)", borderColor: "var(--vpn-border)" }}
                >
                  DISCONNECTED
                </Badge>
              )}

              <Badge
                size="sm"
                variant="light"
                color={activeProfile?.protocol === "wireguard" ? "violet" : "cyan"}
                style={{ fontSize: 10, fontWeight: 600 }}
              >
                {activeProfile?.protocol === "wireguard"
                  ? "WIREGUARD"
                  : activeProfile?.protocol === "openvpn_tcp"
                    ? "OPENVPN TCP"
                    : "OPENVPN UDP"}
              </Badge>

              {isConnected && (
                <Group gap={4} align="center">
                  <IconClock size={13} color="var(--vpn-text-muted)" />
                  <Text size="xs" fw={600} className="font-mono" style={{ color: "#34d399" }}>
                    {formatUptime(uptimeSeconds)}
                  </Text>
                </Group>
              )}
            </Group>

            <Group gap="xs" align="center">
              <Text size="lg" fw={800} style={{ color: "#ffffff", letterSpacing: "-0.01em" }}>
                {activeProfile?.name || "No Profile Selected"}
              </Text>
            </Group>

            <Group gap="md" align="center">
              <Text size="xs" c="dimmed">
                {activeProfile?.serverHost}:{activeProfile?.serverPort}
              </Text>
              <Text size="xs" fw={600} style={{ color: "#fbbf24" }}>
                ⚡ {activeProfile?.pingMs || 36}ms
              </Text>
            </Group>

            {/* Quick Action Buttons */}
            <Group gap="xs" mt={4}>
              <Button
                size="xs"
                variant={isConnected ? "light" : "filled"}
                color={isConnected ? "red" : "cyan"}
                leftSection={isConnected ? <IconPower size={13} /> : <IconBolt size={13} />}
                loading={isConnecting || isDisconnecting}
                onClick={handleToggle}
                style={{
                  fontWeight: 600,
                  borderRadius: 6,
                  background: isConnected
                    ? "rgba(239, 68, 68, 0.15)"
                    : "linear-gradient(135deg, #06b6d4, #0891b2)",
                  boxShadow: isConnected ? "none" : "0 0 15px rgba(6, 182, 212, 0.35)",
                }}
              >
                {isConnected ? "Disconnect Tunnel" : "Quick Connect"}
              </Button>

              <Button
                size="xs"
                variant="subtle"
                color="gray"
                leftSection={<IconArrowsExchange size={13} />}
                onClick={() => setActiveTab("profiles")}
                style={{
                  color: "var(--vpn-text-secondary)",
                  background: "rgba(255, 255, 255, 0.04)",
                  borderRadius: 6,
                }}
              >
                Switch Profile
              </Button>
            </Group>
          </Stack>
        </Group>

        {/* Right Side: Live Traffic Throughput & Real-time Sparkline */}
        <Box
          style={{
            flex: "1 1 320px",
            minWidth: 280,
            background: "rgba(0, 0, 0, 0.3)",
            borderRadius: 10,
            padding: "12px 16px",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <Group justify="space-between" align="center" mb={6}>
            <Group gap={6}>
              <IconActivity size={15} color="var(--vpn-cyan)" />
              <Text
                size="xs"
                fw={700}
                style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "#fff" }}
              >
                Live Throughput
              </Text>
            </Group>
            <Badge size="xs" variant="dot" color={isConnected ? "teal" : "gray"}>
              {isConnected ? "60 FPS Active" : "Standby"}
            </Badge>
          </Group>

          {/* Download / Upload Speed Metrics */}
          <Group justify="space-between" align="flex-end" mb={6}>
            <Box>
              <Group gap={4}>
                <IconArrowDownRight size={14} color="#22d3ee" />
                <Text size="10px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
                  Download
                </Text>
              </Group>
              <Text
                size="md"
                fw={800}
                className="font-mono"
                style={{ color: isConnected ? "#22d3ee" : "var(--vpn-text-muted)" }}
              >
                {isConnected ? formatSpeed(telemetry.currentDownloadKbps) : "0.0 KB/s"}
              </Text>
            </Box>

            <Box style={{ textAlign: "center" }}>
              <Text size="10px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
                Session Data
              </Text>
              <Text size="xs" fw={700} className="font-mono" style={{ color: "#e2e8f0" }}>
                {isConnected
                  ? formatBytes(telemetry.totalDownloadedBytes + telemetry.totalUploadedBytes)
                  : "0.0 MB"}
              </Text>
            </Box>

            <Box style={{ textAlign: "right" }}>
              <Group gap={4} justify="flex-end">
                <IconArrowUpRight size={14} color="#34d399" />
                <Text size="10px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
                  Upload
                </Text>
              </Group>
              <Text
                size="md"
                fw={800}
                className="font-mono"
                style={{ color: isConnected ? "#34d399" : "var(--vpn-text-muted)" }}
              >
                {isConnected ? formatSpeed(telemetry.currentUploadKbps) : "0.0 KB/s"}
              </Text>
            </Box>
          </Group>

          {/* SVG Sparkline Graph */}
          <Box style={{ width: "100%", height: svgHeight, position: "relative" }}>
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="none"
              style={{ overflow: "visible" }}
            >
              <defs>
                <linearGradient id="commandHeroGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="#06b6d4"
                    stopOpacity={isConnected ? "0.35" : "0.08"}
                  />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </linearGradient>
              </defs>

              {downloadAreaPath && <path d={downloadAreaPath} fill="url(#commandHeroGrad)" />}
              {downloadPath && (
                <path
                  d={downloadPath}
                  fill="none"
                  stroke={isConnected ? "#22d3ee" : "rgba(255, 255, 255, 0.15)"}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {uploadPath && (
                <path
                  d={uploadPath}
                  fill="none"
                  stroke={isConnected ? "#34d399" : "rgba(255, 255, 255, 0.1)"}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </Box>
        </Box>
      </Group>
    </Box>
  );
};
