import { Box, Group, Text, Badge, Button, Stack, SimpleGrid } from "@mantine/core";
import {
  IconPower,
  IconShieldCheck,
  IconClock,
  IconWorld,
  IconArrowsExchange,
  IconLock,
  IconRouter,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";

export const HeroConnectionCard: React.FC = () => {
  const {
    connectionState,
    activeProfileId,
    profiles,
    uptimeSeconds,
    connect,
    disconnect,
    setActiveTab,
  } = useVpnStore();

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(
      secs
    ).padStart(2, "0")}`;
  };

  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting" || connectionState === "reconnecting";
  const isDisconnecting = connectionState === "disconnecting";

  // Toggle handler
  const handleToggle = () => {
    if (isConnected) {
      disconnect();
    } else if (connectionState === "disconnected" || connectionState === "error") {
      connect(activeProfile?.id);
    }
  };

  const getStatusBadge = () => {
    switch (connectionState) {
      case "connected":
        return (
          <Badge
            size="md"
            color="teal"
            variant="filled"
            leftSection={<IconShieldCheck size={14} />}
            style={{
              background: "linear-gradient(135deg, #10b981, #059669)",
              boxShadow: "0 0 15px rgba(16, 185, 129, 0.4)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Connected
          </Badge>
        );
      case "connecting":
        return (
          <Badge
            size="md"
            color="yellow"
            variant="filled"
            style={{
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            Connecting...
          </Badge>
        );
      case "reconnecting":
        return (
          <Badge size="md" color="yellow" variant="light">
            Reconnecting...
          </Badge>
        );
      case "disconnecting":
        return (
          <Badge size="md" color="gray" variant="light">
            Tearing Down...
          </Badge>
        );
      case "error":
        return (
          <Badge size="md" color="red" variant="filled">
            Handshake Failed
          </Badge>
        );
      case "disconnected":
      default:
        return (
          <Badge size="md" color="gray" variant="outline">
            Disconnected
          </Badge>
        );
    }
  };

  return (
    <Box
      style={{
        background: "var(--vpn-bg-card)",
        border: "1px solid var(--vpn-border)",
        borderRadius: 12,
        padding: "16px",
        position: "relative",
        overflow: "hidden",
        boxShadow: isConnected ? "0 0 35px rgba(16, 185, 129, 0.12)" : "rgba(17, 24, 39, 0.75)",
      }}
    >
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        {/* Connection Visual Node & State Details */}
        <Group gap="md" align="center" wrap="nowrap">
          {/* Main Power Button Node */}
          <Box style={{ position: "relative", flexShrink: 0 }}>
            <Box
              onClick={handleToggle}
              className={isConnected ? "glow-connected" : isConnecting ? "pulse-connecting" : ""}
              style={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                background: isConnected
                  ? "linear-gradient(135deg, #065f46, #10b981)"
                  : isConnecting
                    ? "linear-gradient(135deg, #78350f, #f59e0b)"
                    : "linear-gradient(135deg, #1f2937, #111827)",
                border: isConnected
                  ? "3px solid #34d399"
                  : isConnecting
                    ? "3px solid #fbbf24"
                    : "2px solid rgba(255, 255, 255, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isConnecting || isDisconnecting ? "wait" : "pointer",
                transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                boxShadow: isConnected
                  ? "0 0 25px rgba(16, 185, 129, 0.4)"
                  : "0 4px 15px rgba(0, 0, 0, 0.4)",
              }}
            >
              <IconPower
                size={34}
                color={isConnected ? "#ffffff" : isConnecting ? "#fef08a" : "var(--vpn-text-muted)"}
                stroke={2.5}
              />
            </Box>
          </Box>

          {/* Session Overview Info */}
          <Stack gap={4} style={{ minWidth: 0 }}>
            <Group gap="xs" wrap="wrap">
              {getStatusBadge()}
              {isConnected && (
                <Group gap={4}>
                  <IconClock size={14} color="var(--vpn-emerald)" />
                  <Text size="xs" fw={700} className="font-mono" style={{ color: "#34d399" }}>
                    {formatUptime(uptimeSeconds)}
                  </Text>
                </Group>
              )}
              <Badge
                size="xs"
                variant="outline"
                color="cyan"
                style={{ fontFamily: "JetBrains Mono", textTransform: "uppercase" }}
              >
                {activeProfile?.protocol.replace("_", " ").toUpperCase()}
              </Badge>
            </Group>

            <Group gap="xs" align="baseline" wrap="nowrap">
              <Text size="lg">{activeProfile?.serverFlag}</Text>
              <Text size="md" fw={700} style={{ color: "#fff", letterSpacing: "-0.02em" }} truncate>
                {activeProfile?.name}
              </Text>
            </Group>

            <Text size="xs" c="dimmed" truncate>
              <span className="font-mono" style={{ color: "#e5e7eb" }}>
                {activeProfile?.serverHost}:{activeProfile?.serverPort}
              </span>
              {" • "}
              <span style={{ color: "#34d399", fontWeight: 600 }}>
                ⚡ {activeProfile?.pingMs}ms
              </span>
            </Text>
          </Stack>
        </Group>

        {/* Action Controls */}
        <Group gap="xs" wrap="wrap" style={{ flexGrow: 1, justifyContent: "flex-end" }}>
          <Button
            size="xs"
            variant="default"
            leftSection={<IconArrowsExchange size={14} />}
            onClick={() => setActiveTab("profiles")}
            style={{
              background: "rgba(31, 41, 55, 0.6)",
              border: "1px solid var(--vpn-border)",
              color: "#f3f4f6",
            }}
          >
            Change Server
          </Button>

          <Button
            size="xs"
            color={isConnected ? "red" : "cyan"}
            variant="filled"
            leftSection={<IconPower size={14} />}
            onClick={handleToggle}
            loading={isConnecting || isDisconnecting}
            style={{
              fontWeight: 600,
              boxShadow: isConnected
                ? "0 0 15px rgba(239, 68, 68, 0.3)"
                : "0 0 15px rgba(6, 182, 212, 0.3)",
            }}
          >
            {isConnected ? "Disconnect" : "Quick Connect"}
          </Button>
        </Group>
      </Group>

      {/* Metadata Detail Bar */}
      <Box
        style={{
          marginTop: 14,
          padding: "10px 12px",
          background: "rgba(15, 23, 42, 0.6)",
          border: "1px solid var(--vpn-border)",
          borderRadius: 8,
        }}
      >
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs" style={{ alignItems: "center" }}>
          <Group gap="xs" wrap="nowrap">
            <IconRouter size={16} color="var(--vpn-cyan)" />
            <Box style={{ minWidth: 0 }}>
              <Text
                size="10px"
                c="dimmed"
                style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                Virtual IP
              </Text>
              <Text
                size="xs"
                fw={600}
                className="font-mono"
                style={{ color: isConnected ? "#67e8f9" : "var(--vpn-text-muted)" }}
                truncate
              >
                {isConnected ? activeProfile?.virtualIp : "— . — . — . —"}
              </Text>
            </Box>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <IconWorld size={16} color="var(--vpn-emerald)" />
            <Box style={{ minWidth: 0 }}>
              <Text
                size="10px"
                c="dimmed"
                style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                Public Exit IP
              </Text>
              <Text
                size="xs"
                fw={600}
                className="font-mono"
                style={{ color: isConnected ? "#a7f3d0" : "var(--vpn-text-muted)" }}
                truncate
              >
                {isConnected ? activeProfile?.serverHost : "Native Direct"}
              </Text>
            </Box>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <IconLock size={16} color="var(--vpn-amber)" />
            <Box style={{ minWidth: 0 }}>
              <Text
                size="10px"
                c="dimmed"
                style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                DNS Resolver
              </Text>
              <Text
                size="xs"
                fw={600}
                className="font-mono"
                style={{ color: isConnected ? "#fde68a" : "var(--vpn-text-muted)" }}
                truncate
              >
                1.1.1.1 (NRPT)
              </Text>
            </Box>
          </Group>
        </SimpleGrid>
      </Box>
    </Box>
  );
};
