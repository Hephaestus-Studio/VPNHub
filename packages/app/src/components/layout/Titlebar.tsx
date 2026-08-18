import { Group, Text, Badge, Button, ActionIcon, Tooltip, Box } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconSearch,
  IconMinus,
  IconSquare,
  IconX,
  IconShieldLock,
  IconLayoutSidebarLeftCollapse,
  IconDeviceDesktop,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import { IpcBridge } from "../../services/ipcBridge";

export const Titlebar: React.FC = () => {
  const { daemonHealth, daemonVersion, isCompactWidget, setCompactWidget, setSpotlightOpen } =
    useVpnStore();

  const isNarrow = useMediaQuery("(max-width: 640px)");
  const isMobile = useMediaQuery("(max-width: 480px)");

  const getDaemonBadge = () => {
    switch (daemonHealth) {
      case "connected":
        return (
          <Badge
            variant="dot"
            color="teal"
            size="sm"
            style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              cursor: "default",
              textTransform: "none",
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
            }}
          >
            {isMobile ? "Active" : `Active (${daemonVersion})`}
          </Badge>
        );
      case "reconnecting":
        return (
          <Badge
            variant="dot"
            color="yellow"
            size="sm"
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              cursor: "default",
              textTransform: "none",
            }}
          >
            {isMobile ? "Reconnecting" : "Daemon Reconnecting..."}
          </Badge>
        );
      case "offline":
        return (
          <Badge
            variant="dot"
            color="red"
            size="sm"
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              cursor: "default",
              textTransform: "none",
            }}
          >
            Offline
          </Badge>
        );
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('button, input, a, [role="button"]')) {
      IpcBridge.startDragging();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('button, input, a, [role="button"]')) {
      IpcBridge.windowMaximize();
    }
  };

  return (
    <Box
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      style={{
        height: "42px",
        background: "rgba(11, 15, 25, 0.95)",
        borderBottom: "1px solid var(--vpn-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 10px",
        userSelect: "none",
        zIndex: 100,
        cursor: "default",
        flexShrink: 0,
      }}
    >
      {/* Brand & Daemon Status */}
      <Group gap="xs" data-tauri-drag-region wrap="nowrap">
        <Group gap="xs" style={{ cursor: "pointer" }} data-tauri-drag-region wrap="nowrap">
          <Box
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 10px rgba(6, 182, 212, 0.4)",
              flexShrink: 0,
            }}
          >
            <IconShieldLock size={14} color="#fff" stroke={2.5} />
          </Box>
          {!isMobile && (
            <Text fw={700} size="sm" style={{ letterSpacing: "-0.02em", color: "#f3f4f6" }}>
              VPNHub
            </Text>
          )}
        </Group>

        <Box style={{ width: 1, height: 16, background: "var(--vpn-border)" }} />

        {getDaemonBadge()}
      </Group>

      {/* Center Search Shortcut */}
      {!isNarrow ? (
        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconSearch size={13} color="var(--vpn-text-muted)" />}
          rightSection={
            <Badge
              size="xs"
              variant="outline"
              color="gray"
              style={{ fontSize: 9, padding: "0 4px", height: 16 }}
            >
              ⌘K
            </Badge>
          }
          onClick={() => setSpotlightOpen(true)}
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--vpn-border)",
            color: "var(--vpn-text-secondary)",
            fontWeight: 400,
            borderRadius: 6,
            height: 26,
            padding: "0 10px",
          }}
        >
          Search profiles, commands...
        </Button>
      ) : (
        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={() => setSpotlightOpen(true)}
          style={{ color: "var(--vpn-text-secondary)" }}
        >
          <IconSearch size={16} />
        </ActionIcon>
      )}

      {/* Window Controls & Compact Mode Switcher */}
      <Group gap={4} wrap="nowrap">
        <Tooltip label={isCompactWidget ? "Full Application" : "Mini Tray Mode"} position="bottom">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => setCompactWidget(!isCompactWidget)}
            style={{ color: isCompactWidget ? "var(--vpn-cyan)" : "var(--vpn-text-secondary)" }}
          >
            {isCompactWidget ? (
              <IconDeviceDesktop size={14} />
            ) : (
              <IconLayoutSidebarLeftCollapse size={14} />
            )}
          </ActionIcon>
        </Tooltip>

        <Box style={{ width: 1, height: 14, background: "var(--vpn-border)", margin: "0 2px" }} />

        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => IpcBridge.windowMinimize()}
          style={{ color: "var(--vpn-text-secondary)" }}
        >
          <IconMinus size={13} />
        </ActionIcon>

        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => IpcBridge.windowMaximize()}
          style={{ color: "var(--vpn-text-secondary)" }}
        >
          <IconSquare size={12} />
        </ActionIcon>

        <ActionIcon
          variant="subtle"
          color="red"
          size="sm"
          onClick={() => IpcBridge.windowClose()}
          style={{ color: "var(--vpn-text-secondary)" }}
        >
          <IconX size={13} />
        </ActionIcon>
      </Group>
    </Box>
  );
};
