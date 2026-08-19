import React from "react";
import { Box, Group, Text, Badge, Stack, SimpleGrid, UnstyledButton } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconPower,
  IconShieldCheck,
  IconArrowDownRight,
  IconArrowUpRight,
  IconActivity,
  IconRouter,
  IconWorld,
  IconLock,
  IconArrowsSplit,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";

export const HeroCockpitBanner: React.FC = () => {
  const {
    connectionState,
    activeProfileId,
    profiles,
    uptimeSeconds,
    telemetry,
    securitySettings,
    appRules,
    ipRules,
    connect,
    disconnect,
  } = useVpnStore();

  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(min-width: 641px) and (max-width: 1180px)");

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting" || connectionState === "reconnecting";
  const isDisconnecting = connectionState === "disconnecting";

  const activeRulesCount =
    appRules.filter((r) => r.enabled).length + ipRules.filter((r) => r.enabled).length;

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
  const svgWidth = 240;
  const svgHeight = isMobile ? 34 : isTablet ? 38 : 40;
  const maxSpeed = Math.max(...points.map((p) => p.downloadSpeed), 50000);
  const minSpeed = 0;

  const getSvgPath = (key: "downloadSpeed" | "uploadSpeed") => {
    if (points.length === 0) return "";
    const step = svgWidth / Math.max(points.length - 1, 1);
    return points
      .map((p, i) => {
        const x = i * step;
        const val = p[key];
        const y = svgHeight - ((val - minSpeed) / (maxSpeed - minSpeed)) * (svgHeight - 6) - 3;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const downloadPath = getSvgPath("downloadSpeed");
  const uploadPath = getSvgPath("uploadSpeed");
  const downloadAreaPath = downloadPath
    ? `${downloadPath} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`
    : "";

  const livePing =
    (isConnected && telemetry.currentPingMs > 0
      ? telemetry.currentPingMs
      : activeProfile?.pingMs) ||
    activeProfile?.pingMs ||
    24;

  // -------------------------------------------------------------
  // RENDER: MOBILE LAYOUT (< 640px)
  // -------------------------------------------------------------
  if (isMobile) {
    return (
      <Box style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* 1. Main Hero Connection & Wave Card */}
        <Box
          className="glass-panel"
          style={{
            padding: "14px 16px",
            background: isConnected
              ? "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(17, 24, 39, 0.94) 50%, rgba(6, 182, 212, 0.06) 100%)"
              : "linear-gradient(135deg, rgba(17, 24, 39, 0.94) 0%, rgba(15, 23, 42, 0.96) 100%)",
            border: isConnected
              ? "1px solid rgba(16, 185, 129, 0.35)"
              : isConnecting
                ? "1px solid rgba(245, 158, 11, 0.35)"
                : "1px solid var(--vpn-border)",
            borderRadius: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {/* Top: Power Button & Profile Header */}
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
              <UnstyledButton
                onClick={handleToggle}
                disabled={isConnecting || isDisconnecting}
                style={{
                  width: 52,
                  height: 52,
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
                      : "2px solid rgba(255, 255, 255, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: isConnected ? "0 0 18px rgba(16, 185, 129, 0.45)" : "none",
                }}
              >
                <IconPower size={25} color="#ffffff" stroke={2.4} />
              </UnstyledButton>

              <Box style={{ overflow: "hidden", minWidth: 0 }}>
                <Group gap={5} align="center" wrap="nowrap">
                  <Badge
                    size="xs"
                    variant={isConnected ? "filled" : isConnecting ? "filled" : "outline"}
                    color={isConnected ? "teal" : isConnecting ? "yellow" : "gray"}
                    style={{ fontSize: 9, height: 17, padding: "0 5px", fontWeight: 700 }}
                  >
                    {isConnected ? "CONNECTED" : isConnecting ? "CONNECTING..." : "DISCONNECTED"}
                  </Badge>
                  <Badge
                    size="xs"
                    variant="light"
                    color="cyan"
                    style={{ fontSize: 9, height: 17, padding: "0 5px" }}
                  >
                    {activeProfile?.protocol === "wireguard" ? "WG" : "OVPN"}
                  </Badge>
                </Group>
                <Text
                  size="sm"
                  fw={700}
                  style={{ color: "#ffffff", marginTop: 3, fontSize: 13.5 }}
                  truncate
                >
                  {activeProfile?.name || "No Profile"}
                </Text>
              </Box>
            </Group>

            <Box style={{ textAlign: "right", flexShrink: 0 }}>
              <Text size="11px" fw={700} style={{ color: "#fbbf24" }}>
                ⚡{livePing}ms
              </Text>
              {isConnected && (
                <Text
                  size="10px"
                  fw={600}
                  className="font-mono"
                  style={{ color: "#34d399", marginTop: 2 }}
                >
                  {formatUptime(uptimeSeconds)}
                </Text>
              )}
            </Box>
          </Group>

          {/* Realtime Sparkline Wave */}
          <Box style={{ width: "100%", height: svgHeight, position: "relative" }}>
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="cockpitHeroGradMob" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="#06b6d4"
                    stopOpacity={isConnected ? "0.35" : "0.08"}
                  />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </linearGradient>
              </defs>
              {downloadAreaPath && <path d={downloadAreaPath} fill="url(#cockpitHeroGradMob)" />}
              {downloadPath && (
                <path
                  d={downloadPath}
                  fill="none"
                  stroke={isConnected ? "#22d3ee" : "rgba(255, 255, 255, 0.15)"}
                  strokeWidth="1.8"
                />
              )}
            </svg>
          </Box>
        </Box>

        {/* 2. Dedicated 2x2 Network & Security Metrics Block */}
        <Box
          className="glass-panel"
          style={{
            padding: "12px 14px",
            background: "rgba(17, 24, 39, 0.75)",
            border: "1px solid var(--vpn-border)",
            borderRadius: "12px",
          }}
        >
          <SimpleGrid cols={2} spacing={8}>
            {/* Virtual IP */}
            <Box
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                padding: "8px 10px",
                borderRadius: 8,
                height: 52,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <Group gap={4} align="center">
                <IconRouter size={12} color="var(--vpn-cyan)" />
                <Text size="9px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
                  Virtual IP
                </Text>
              </Group>
              <Text
                size="11.5px"
                fw={700}
                className="font-mono"
                style={{ color: isConnected ? "#22d3ee" : "var(--vpn-text-muted)", marginTop: 2 }}
                truncate
              >
                {isConnected ? "10.8.0.2" : "— . — . — . —"}
              </Text>
            </Box>

            {/* Public Exit IP */}
            <Box
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                padding: "8px 10px",
                borderRadius: 8,
                height: 52,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <Group gap={4} align="center">
                <IconWorld size={12} color="#10b981" />
                <Text size="9px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
                  Exit IP
                </Text>
              </Group>
              <Text
                size="11.5px"
                fw={700}
                className="font-mono"
                style={{ color: isConnected ? "#10b981" : "var(--vpn-text-muted)", marginTop: 2 }}
                truncate
              >
                {isConnected ? "123.30.170.251" : "Native Direct"}
              </Text>
            </Box>

            {/* Download Speed */}
            <Box
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                padding: "8px 10px",
                borderRadius: 8,
                height: 52,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <Group gap={4} align="center">
                <IconArrowDownRight size={12} color="#22d3ee" />
                <Text size="9px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
                  Download
                </Text>
              </Group>
              <Text
                size="12px"
                fw={800}
                className="font-mono"
                style={{ color: isConnected ? "#22d3ee" : "var(--vpn-text-muted)", marginTop: 2 }}
                truncate
              >
                {isConnected ? formatSpeed(telemetry.currentDownloadKbps) : "0 KB/s"}
              </Text>
            </Box>

            {/* Upload Speed */}
            <Box
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                padding: "8px 10px",
                borderRadius: 8,
                height: 52,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <Group gap={4} align="center">
                <IconArrowUpRight size={12} color="#34d399" />
                <Text size="9px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
                  Upload
                </Text>
              </Group>
              <Text
                size="12px"
                fw={800}
                className="font-mono"
                style={{ color: isConnected ? "#34d399" : "var(--vpn-text-muted)", marginTop: 2 }}
                truncate
              >
                {isConnected ? formatSpeed(telemetry.currentUploadKbps) : "0 KB/s"}
              </Text>
            </Box>
          </SimpleGrid>
        </Box>
      </Box>
    );
  }

  // -------------------------------------------------------------
  // RENDER: TABLET & COMPACT DESKTOP (641px - 1180px) -> 2 COLUMNS
  // -------------------------------------------------------------
  if (isTablet) {
    return (
      <Box
        className="glass-panel"
        style={{
          padding: "16px 18px",
          background: isConnected
            ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(17, 24, 39, 0.92) 50%, rgba(6, 182, 212, 0.05) 100%)"
            : "linear-gradient(135deg, rgba(17, 24, 39, 0.92) 0%, rgba(15, 23, 42, 0.95) 100%)",
          border: isConnected
            ? "1px solid rgba(16, 185, 129, 0.35)"
            : isConnecting
              ? "1px solid rgba(245, 158, 11, 0.35)"
              : "1px solid var(--vpn-border)",
          borderRadius: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <SimpleGrid cols={2} spacing="md" style={{ alignItems: "center" }}>
          {/* Left Column: Power Button + Details + IP chips */}
          <Group gap="md" wrap="nowrap">
            <UnstyledButton
              onClick={handleToggle}
              disabled={isConnecting || isDisconnecting}
              style={{
                width: 60,
                height: 60,
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
                boxShadow: isConnected ? "0 0 20px rgba(16, 185, 129, 0.45)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconPower size={26} color="#ffffff" stroke={2.4} />
            </UnstyledButton>

            <Stack gap={3} style={{ overflow: "hidden", minWidth: 0, flex: 1 }}>
              <Group gap={6} align="center" wrap="wrap">
                <Badge
                  size="xs"
                  variant="filled"
                  color={isConnected ? "teal" : isConnecting ? "yellow" : "gray"}
                  style={{ fontSize: 9.5, height: 17, padding: "0 5px", fontWeight: 700 }}
                >
                  {isConnected ? "CONNECTED" : isConnecting ? "CONNECTING..." : "DISCONNECTED"}
                </Badge>
                <Badge
                  size="xs"
                  variant="light"
                  color="cyan"
                  style={{ fontSize: 9.5, height: 17, padding: "0 5px" }}
                >
                  {activeProfile?.protocol === "wireguard" ? "WireGuard" : "OpenVPN"}
                </Badge>
                {isConnected && (
                  <Text size="11px" fw={700} className="font-mono" style={{ color: "#34d399" }}>
                    {formatUptime(uptimeSeconds)}
                  </Text>
                )}
              </Group>

              <Text size="sm" fw={800} style={{ color: "#ffffff", fontSize: 14 }} truncate>
                {activeProfile?.name || "No Profile"}
              </Text>

              <Group gap="sm">
                <Text size="11px" c="dimmed" truncate>
                  {activeProfile?.serverHost}:{activeProfile?.serverPort}
                </Text>
                <Text size="11px" fw={600} style={{ color: "#fbbf24" }}>
                  ⚡ {livePing}ms
                </Text>
              </Group>
            </Stack>
          </Group>

          {/* Right Column: Speed Counters + Sparkline + Security Badges */}
          <Box
            style={{
              background: "rgba(0, 0, 0, 0.3)",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            <Group justify="space-between" align="center" mb={3}>
              <Group gap={5}>
                <IconActivity size={14} color="var(--vpn-cyan)" />
                <Text size="10.5px" fw={700} style={{ color: "#fff", textTransform: "uppercase" }}>
                  Live Speed
                </Text>
              </Group>
              <Group gap={8} wrap="nowrap" align="center">
                <Box
                  style={{
                    width: 88,
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    justifyContent: "flex-end",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <IconArrowDownRight size={13} color="#22d3ee" style={{ flexShrink: 0 }} />
                  <Text
                    size="10.5px"
                    fw={700}
                    className="font-mono"
                    style={{ color: "#22d3ee", whiteSpace: "nowrap" }}
                  >
                    {isConnected ? formatSpeed(telemetry.currentDownloadKbps) : "0 KB/s"}
                  </Text>
                </Box>
                <Box
                  style={{
                    width: 88,
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    justifyContent: "flex-end",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <IconArrowUpRight size={13} color="#34d399" style={{ flexShrink: 0 }} />
                  <Text
                    size="10.5px"
                    fw={700}
                    className="font-mono"
                    style={{ color: "#34d399", whiteSpace: "nowrap" }}
                  >
                    {isConnected ? formatSpeed(telemetry.currentUploadKbps) : "0 KB/s"}
                  </Text>
                </Box>
              </Group>
            </Group>

            <Box style={{ width: "100%", height: 38, position: "relative" }}>
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${svgWidth} 38`}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="cockpitHeroGradTab" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="#06b6d4"
                      stopOpacity={isConnected ? "0.35" : "0.08"}
                    />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {downloadAreaPath && <path d={downloadAreaPath} fill="url(#cockpitHeroGradTab)" />}
                {downloadPath && (
                  <path
                    d={downloadPath}
                    fill="none"
                    stroke={isConnected ? "#22d3ee" : "rgba(255, 255, 255, 0.15)"}
                    strokeWidth="1.8"
                  />
                )}
              </svg>
            </Box>

            <Group
              justify="space-between"
              align="center"
              mt={6}
              pt={6}
              style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
            >
              <Text size="9.5px" c="dimmed">
                Virtual IP:{" "}
                <span style={{ color: isConnected ? "#22d3ee" : "inherit", fontWeight: 600 }}>
                  {isConnected ? "10.8.0.2" : "— . —"}
                </span>
              </Text>
              <Text size="9.5px" c="dimmed">
                Exit IP:{" "}
                <span style={{ color: isConnected ? "#10b981" : "inherit", fontWeight: 600 }}>
                  {isConnected ? "123.30.170.251" : "Direct"}
                </span>
              </Text>
              <Text size="9.5px" c="dimmed">
                DNS: <span style={{ color: "#fbbf24", fontWeight: 600 }}>1.1.1.1</span>
              </Text>
            </Group>
          </Box>
        </SimpleGrid>
      </Box>
    );
  }

  // -------------------------------------------------------------
  // RENDER: WIDE DESKTOP COCKPIT LAYOUT (> 1180px) -> 3 COLUMNS
  // -------------------------------------------------------------
  return (
    <Box
      className="glass-panel"
      style={{
        padding: "16px 20px",
        background: isConnected
          ? "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(17, 24, 39, 0.94) 45%, rgba(6, 182, 212, 0.07) 100%)"
          : "linear-gradient(135deg, rgba(17, 24, 39, 0.94) 0%, rgba(15, 23, 42, 0.96) 100%)",
        border: isConnected
          ? "1.5px solid rgba(16, 185, 129, 0.45)"
          : isConnecting
            ? "1.5px solid rgba(245, 158, 11, 0.45)"
            : "1px solid var(--vpn-border)",
        boxShadow: isConnected
          ? "0 10px 30px -10px rgba(16, 185, 129, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
          : "0 10px 25px -10px rgba(0, 0, 0, 0.5)",
        borderRadius: "14px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          width: "100%",
        }}
      >
        {/* ========================================================= */}
        {/* ZONE 1 (Left): Connection Power Button & Profile Details  */}
        {/* ========================================================= */}
        <Group
          gap={12}
          wrap="nowrap"
          style={{ flex: "1 1 30%", minWidth: 260, overflow: "hidden" }}
        >
          <Box style={{ position: "relative", flexShrink: 0 }}>
            <UnstyledButton
              onClick={handleToggle}
              disabled={isConnecting || isDisconnecting}
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: isConnected
                  ? "linear-gradient(135deg, #10b981, #059669)"
                  : isConnecting
                    ? "linear-gradient(135deg, #f59e0b, #d97706)"
                    : "linear-gradient(135deg, rgba(31, 41, 55, 0.8), rgba(17, 24, 39, 0.95))",
                border: isConnected
                  ? "2.5px solid #34d399"
                  : isConnecting
                    ? "2.5px solid #fbbf24"
                    : "2px solid rgba(255, 255, 255, 0.15)",
                boxShadow: isConnected
                  ? "0 0 25px rgba(16, 185, 129, 0.55), inset 0 2px 4px rgba(255, 255, 255, 0.3)"
                  : isConnecting
                    ? "0 0 25px rgba(245, 158, 11, 0.55)"
                    : "0 4px 15px rgba(0, 0, 0, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isConnecting || isDisconnecting ? "wait" : "pointer",
                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                transform: "scale(1)",
              }}
            >
              <IconPower
                size={26}
                color={isConnected ? "#ffffff" : isConnecting ? "#ffffff" : "var(--vpn-text-muted)"}
                stroke={2.5}
              />
            </UnstyledButton>
          </Box>

          <Stack gap={2} style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
            {/* Top Badges Bar: Wrap enabled to prevent truncation */}
            <Group gap={5} align="center" wrap="wrap">
              <Badge
                size="xs"
                variant="filled"
                color={isConnected ? "teal" : isConnecting ? "yellow" : "gray"}
                leftSection={isConnected ? <IconShieldCheck size={10} /> : undefined}
                style={{
                  background: isConnected
                    ? "linear-gradient(135deg, #10b981, #059669)"
                    : isConnecting
                      ? "linear-gradient(135deg, #f59e0b, #d97706)"
                      : undefined,
                  fontWeight: 700,
                  fontSize: 8.5,
                  height: 16,
                  padding: "0 4px",
                }}
              >
                {isConnected ? "CONNECTED" : isConnecting ? "CONNECTING" : "DISCONNECTED"}
              </Badge>

              <Badge
                size="xs"
                variant="light"
                color={activeProfile?.protocol === "wireguard" ? "violet" : "cyan"}
                style={{ fontSize: 8.5, height: 16, padding: "0 4px", fontWeight: 600 }}
              >
                {activeProfile?.protocol === "wireguard"
                  ? "WG"
                  : activeProfile?.protocol === "openvpn_tcp"
                    ? "OVPN TCP"
                    : "OVPN UDP"}
              </Badge>

              {isConnected && (
                <Text size="10px" fw={700} className="font-mono" style={{ color: "#34d399" }}>
                  {formatUptime(uptimeSeconds)}
                </Text>
              )}
            </Group>

            {/* Profile Full Name */}
            <Text size="sm" fw={800} style={{ color: "#ffffff", fontSize: 14.5 }} truncate>
              {activeProfile?.name || "No Profile Selected"}
            </Text>

            {/* Server Endpoint & Ping */}
            <Group gap={6} align="center" wrap="nowrap">
              <Text size="10.5px" c="dimmed" truncate>
                {activeProfile?.serverHost}:{activeProfile?.serverPort}
              </Text>
              <Text size="10.5px" fw={700} style={{ color: "#fbbf24", flexShrink: 0 }}>
                ⚡{livePing}ms
              </Text>
            </Group>
          </Stack>
        </Group>

        {/* Subtle Vertical Divider */}
        <Box
          style={{ width: 1, height: 68, background: "rgba(255, 255, 255, 0.08)", flexShrink: 0 }}
        />

        {/* ========================================================= */}
        {/* ZONE 2 (Middle): Security & Network Telemetry Grid        */}
        {/* ========================================================= */}
        <Box
          style={{
            flex: "1 1 38%",
            minWidth: 280,
            background: "rgba(0, 0, 0, 0.28)",
            borderRadius: 10,
            padding: "8px 12px",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <SimpleGrid cols={2} spacing={8}>
            {/* Virtual IP */}
            <Box>
              <Group gap={3} align="center">
                <IconRouter size={11} color="var(--vpn-cyan)" />
                <Text size="9px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
                  Virtual IP
                </Text>
              </Group>
              <Text
                size="xs"
                fw={700}
                className="font-mono"
                style={{ color: isConnected ? "#22d3ee" : "var(--vpn-text-muted)", fontSize: 11.5 }}
                truncate
              >
                {isConnected ? "10.8.0.2" : "— . — . — . —"}
              </Text>
            </Box>

            {/* Public Exit IP */}
            <Box>
              <Group gap={3} align="center">
                <IconWorld size={11} color="#10b981" />
                <Text size="9px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
                  Public Exit IP
                </Text>
              </Group>
              <Text
                size="xs"
                fw={700}
                className="font-mono"
                style={{ color: isConnected ? "#10b981" : "var(--vpn-text-muted)", fontSize: 11.5 }}
                truncate
              >
                {isConnected ? "123.30.170.251" : "Native Direct"}
              </Text>
            </Box>

            {/* DNS Resolver */}
            <Box>
              <Group gap={3} align="center">
                <IconShieldCheck size={11} color="#fbbf24" />
                <Text size="9px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
                  DNS Resolver
                </Text>
              </Group>
              <Text
                size="xs"
                fw={700}
                className="font-mono"
                style={{ color: "#fbbf24", fontSize: 11 }}
                truncate
              >
                1.1.1.1 (NRPT)
              </Text>
            </Box>

            {/* Kill Switch */}
            <Box>
              <Group gap={3} align="center">
                <IconLock size={11} color="#f43f5e" />
                <Text size="9px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
                  Kill Switch
                </Text>
              </Group>
              <Text
                size="xs"
                fw={700}
                style={{
                  color:
                    securitySettings.killSwitch !== "off" ? "#f43f5e" : "var(--vpn-text-muted)",
                  fontSize: 11,
                }}
                truncate
              >
                {securitySettings.killSwitch !== "off" ? "Strict Lock" : "Disabled"}
              </Text>
            </Box>
          </SimpleGrid>

          {/* Micro Footer: Split Tunnel & Security Status */}
          <Group
            justify="space-between"
            align="center"
            mt={4}
            pt={4}
            style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}
          >
            <Group gap={4}>
              <IconArrowsSplit size={10} color="var(--vpn-cyan)" />
              <Text size="8.5px" c="dimmed">
                Split Tunnel:
              </Text>
              <Text
                size="8.5px"
                fw={600}
                style={{ color: activeRulesCount > 0 ? "#34d399" : "var(--vpn-text-muted)" }}
              >
                {activeRulesCount > 0 ? `${activeRulesCount} active` : "Off"}
              </Text>
            </Group>

            <Badge
              size="xs"
              variant="dot"
              color={isConnected ? "teal" : "gray"}
              style={{ fontSize: 8 }}
            >
              {isConnected ? "Encrypted" : "Idle"}
            </Badge>
          </Group>
        </Box>

        {/* Subtle Vertical Divider */}
        <Box
          style={{ width: 1, height: 68, background: "rgba(255, 255, 255, 0.08)", flexShrink: 0 }}
        />

        {/* ========================================================= */}
        {/* ZONE 3 (Right): Live Throughput & Wide Sparkline Wave     */}
        {/* ========================================================= */}
        <Box
          style={{
            flex: "1 1 32%",
            minWidth: 240,
            background: "rgba(0, 0, 0, 0.28)",
            borderRadius: 10,
            padding: "8px 12px",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <Group justify="space-between" align="center" mb={2}>
            <Group gap={4}>
              <IconActivity size={12} color="var(--vpn-cyan)" />
              <Text
                size="9.5px"
                fw={700}
                style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "#fff" }}
              >
                Live Throughput
              </Text>
            </Group>
            <Text size="9.5px" fw={600} className="font-mono" style={{ color: "#cbd5e1" }}>
              Total:{" "}
              {isConnected
                ? formatBytes(telemetry.totalDownloadedBytes + telemetry.totalUploadedBytes)
                : "0 MB"}
            </Text>
          </Group>

          <Group justify="space-between" align="flex-end" mb={2}>
            <Box style={{ width: 95, flexShrink: 0 }}>
              <Group gap={2}>
                <IconArrowDownRight size={11} color="#22d3ee" />
                <Text size="9px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
                  Down
                </Text>
              </Group>
              <Text
                size="xs"
                fw={800}
                className="font-mono"
                style={{
                  color: isConnected ? "#22d3ee" : "var(--vpn-text-muted)",
                  fontSize: 12.5,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {isConnected ? formatSpeed(telemetry.currentDownloadKbps) : "0 KB/s"}
              </Text>
            </Box>

            <Box style={{ width: 95, flexShrink: 0, textAlign: "right" }}>
              <Group gap={2} justify="flex-end">
                <IconArrowUpRight size={11} color="#34d399" />
                <Text size="9px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
                  Up
                </Text>
              </Group>
              <Text
                size="xs"
                fw={800}
                className="font-mono"
                style={{
                  color: isConnected ? "#34d399" : "var(--vpn-text-muted)",
                  fontSize: 12.5,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {isConnected ? formatSpeed(telemetry.currentUploadKbps) : "0 KB/s"}
              </Text>
            </Box>
          </Group>

          <Box style={{ width: "100%", height: svgHeight, position: "relative" }}>
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="none"
              style={{ overflow: "visible" }}
            >
              <defs>
                <linearGradient id="cockpitHeroGradDesk" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="#06b6d4"
                    stopOpacity={isConnected ? "0.35" : "0.08"}
                  />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </linearGradient>
              </defs>

              {downloadAreaPath && <path d={downloadAreaPath} fill="url(#cockpitHeroGradDesk)" />}
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
      </Box>
    </Box>
  );
};
