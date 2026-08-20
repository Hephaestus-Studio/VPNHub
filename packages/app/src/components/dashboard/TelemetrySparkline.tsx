import { Box, Group, Text, Badge } from "@mantine/core";
import { IconArrowDownRight, IconArrowUpRight, IconActivity } from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import styles from "./TelemetrySparkline.module.css";

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
    <Box className={`glass-panel ${styles.card}`}>
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconActivity size={16} color="var(--vpn-cyan)" />
          <Text size="xs" fw={700} className={styles.title}>
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
            <Text size="10px" c="dimmed" fw={600} className={styles.speedLabel}>
              Download
            </Text>
          </Group>
          <Text
            size="lg"
            fw={800}
            className={`font-mono ${isConnected ? styles.downloadSpeedConnected : styles.downloadSpeedMuted}`}
          >
            {isConnected ? formatSpeed(telemetry.currentDownloadKbps) : "0.0 KB/s"}
          </Text>
        </Box>

        <Box style={{ textAlign: "right" }}>
          <Group gap={4} justify="flex-end">
            <IconArrowUpRight size={15} color="var(--vpn-emerald)" />
            <Text size="10px" c="dimmed" fw={600} className={styles.speedLabel}>
              Upload
            </Text>
          </Group>
          <Text
            size="lg"
            fw={800}
            className={`font-mono ${isConnected ? styles.uploadSpeedConnected : styles.uploadSpeedMuted}`}
          >
            {isConnected ? formatSpeed(telemetry.currentUploadKbps) : "0.0 KB/s"}
          </Text>
        </Box>
      </Group>

      {/* Dynamic SVG Wave Sparkline */}
      <Box className={styles.graphWrapper}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={styles.graphSvg}
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
      <Box className={styles.gaugesCard}>
        <Group justify="space-between" align="center">
          <Box>
            <Text size="10px" c="dimmed">
              RTT Ping
            </Text>
            <Text
              size="xs"
              fw={700}
              className={`font-mono ${isConnected ? styles.pingConnected : styles.metricMuted}`}
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
              className={`font-mono ${isConnected ? styles.jitterConnected : styles.metricMuted}`}
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
              className={`font-mono ${isConnected ? styles.lossConnected : styles.metricMuted}`}
            >
              {isConnected ? `${telemetry.packetLossPercent}%` : "—"}
            </Text>
          </Box>

          <Box style={{ textAlign: "right" }}>
            <Text size="10px" c="dimmed">
              Session Total
            </Text>
            <Text size="10px" fw={600} className={`font-mono ${styles.sessionTotal}`}>
              ⬇ {formatBytes(telemetry.totalDownloadedBytes)}
            </Text>
          </Box>
        </Group>
      </Box>
    </Box>
  );
};
