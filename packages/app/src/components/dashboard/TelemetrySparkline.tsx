import { Box, Group, Text, Badge } from "@mantine/core";
import { IconArrowDownRight, IconArrowUpRight, IconActivity } from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";

export const TelemetrySparkline: React.FC = () => {
  const { telemetry, connectionState } = useVpnStore();
  const isConnected = connectionState === "connected";

  // Format KB/s to MB/s or KB/s
  const formatSpeed = (kbps: number) => {
    if (kbps >= 1024) {
      return `${(kbps / 1024).toFixed(1)} MB/s`;
    }
    return `${kbps} KB/s`;
  };

  // Format Total bytes
  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Generate SVG Path for Sparkline
  const points = telemetry.sparkline;
  const width = 280;
  const height = 64;

  const maxSpeed = Math.max(...points.map((p) => p.downloadSpeed), 50000);
  const minSpeed = 0;

  const getSvgPath = (key: "downloadSpeed" | "uploadSpeed") => {
    if (points.length === 0) return "";
    const step = width / (points.length - 1);
    return points
      .map((p, i) => {
        const x = i * step;
        const val = p[key];
        const y = height - ((val - minSpeed) / (maxSpeed - minSpeed)) * (height - 8) - 4;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const downloadPath = getSvgPath("downloadSpeed");
  const uploadPath = getSvgPath("uploadSpeed");

  const downloadAreaPath = `${downloadPath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <Box
      className="glass-panel"
      style={{
        padding: "16px",
        background: "rgba(17, 24, 39, 0.75)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconActivity size={16} color="var(--vpn-cyan)" />
          <Text
            size="xs"
            fw={700}
            style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "#fff" }}
          >
            Live Traffic & Metrics
          </Text>
        </Group>
        <Badge size="xs" color={isConnected ? "teal" : "gray"} variant="dot">
          {isConnected ? "60 FPS Stream" : "Idle"}
        </Badge>
      </Group>

      {/* Speed Readouts */}
      <Group justify="space-between" align="flex-end">
        <Box>
          <Group gap={4}>
            <IconArrowDownRight size={15} color="var(--vpn-cyan)" />
            <Text size="10px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
              Download
            </Text>
          </Group>
          <Text
            size="lg"
            fw={800}
            className="font-mono"
            style={{ color: isConnected ? "#22d3ee" : "var(--vpn-text-muted)" }}
          >
            {isConnected ? formatSpeed(telemetry.currentDownloadKbps) : "0.0 KB/s"}
          </Text>
        </Box>

        <Box style={{ textAlign: "right" }}>
          <Group gap={4} justify="flex-end">
            <IconArrowUpRight size={15} color="var(--vpn-emerald)" />
            <Text size="10px" c="dimmed" fw={600} style={{ textTransform: "uppercase" }}>
              Upload
            </Text>
          </Group>
          <Text
            size="lg"
            fw={800}
            className="font-mono"
            style={{ color: isConnected ? "#34d399" : "var(--vpn-text-muted)" }}
          >
            {isConnected ? formatSpeed(telemetry.currentUploadKbps) : "0.0 KB/s"}
          </Text>
        </Box>
      </Group>

      {/* Dynamic SVG Wave Sparkline */}
      <Box
        style={{
          height: 64,
          width: "100%",
          position: "relative",
          background: "rgba(0, 0, 0, 0.25)",
          borderRadius: 6,
          overflow: "hidden",
          border: "1px solid var(--vpn-border)",
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: "100%", display: "block" }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="downloadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          {isConnected && <path d={downloadAreaPath} fill="url(#downloadGradient)" />}

          {/* Lines */}
          <path
            d={downloadPath}
            fill="none"
            stroke={isConnected ? "#22d3ee" : "#4b5563"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={uploadPath}
            fill="none"
            stroke={isConnected ? "#34d399" : "#374151"}
            strokeWidth="1.5"
            strokeDasharray={isConnected ? "none" : "2,2"}
            strokeLinecap="round"
          />
        </svg>
      </Box>

      {/* Network Quality Gauges */}
      <Box
        style={{
          padding: "8px 10px",
          background: "rgba(0, 0, 0, 0.2)",
          borderRadius: 6,
          border: "1px solid var(--vpn-border)",
        }}
      >
        <Group justify="space-between" align="center">
          <Box>
            <Text size="10px" c="dimmed">
              RTT Ping
            </Text>
            <Text
              size="xs"
              fw={700}
              className="font-mono"
              style={{ color: isConnected ? "#34d399" : "var(--vpn-text-muted)" }}
            >
              {isConnected ? `${telemetry.currentPingMs} ms` : "—"}
            </Text>
          </Box>

          <Box>
            <Text size="10px" c="dimmed">
              Jitter
            </Text>
            <Text
              size="xs"
              fw={700}
              className="font-mono"
              style={{ color: isConnected ? "#38bdf8" : "var(--vpn-text-muted)" }}
            >
              {isConnected ? `${telemetry.jitterMs} ms` : "—"}
            </Text>
          </Box>

          <Box>
            <Text size="10px" c="dimmed">
              Loss Rate
            </Text>
            <Text
              size="xs"
              fw={700}
              className="font-mono"
              style={{ color: isConnected ? "#10b981" : "var(--vpn-text-muted)" }}
            >
              {isConnected ? `${telemetry.packetLossPercent}%` : "—"}
            </Text>
          </Box>

          <Box style={{ textAlign: "right" }}>
            <Text size="10px" c="dimmed">
              Session Total
            </Text>
            <Text size="10px" fw={600} className="font-mono" style={{ color: "#fff" }}>
              ⬇ {formatBytes(telemetry.totalDownloadedBytes)}
            </Text>
          </Box>
        </Group>
      </Box>
    </Box>
  );
};
