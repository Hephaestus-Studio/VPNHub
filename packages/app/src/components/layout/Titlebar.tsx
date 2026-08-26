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
import styles from "./Titlebar.module.css";

export const Titlebar: React.FC = () => {
  const {
    daemonHealth,
    daemonVersion,
    isCompactWidget,
    setCompactWidget,
    setSpotlightOpen,
    appSettings,
  } = useVpnStore();

  const isNarrow = useMediaQuery("(max-width: 640px)");
  const isMobile = useMediaQuery("(max-width: 480px)");

  const getDaemonBadge = () => {
    switch (daemonHealth) {
      case "connected":
        return (
          <Badge variant="dot" color="teal" size="sm" className={styles.badgeConnected}>
            {isMobile ? "Active" : `Active (${daemonVersion})`}
          </Badge>
        );
      case "reconnecting":
        return (
          <Badge variant="dot" color="yellow" size="sm" className={styles.badgeReconnecting}>
            {isMobile ? "Reconnecting" : "Daemon Reconnecting..."}
          </Badge>
        );
      case "offline":
        return (
          <Badge variant="dot" color="red" size="sm" className={styles.badgeOffline}>
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
      className={styles.root}
    >
      {/* Brand & Daemon Status */}
      <Group gap="xs" data-tauri-drag-region wrap="nowrap">
        <Group gap="xs" style={{ cursor: "pointer" }} data-tauri-drag-region wrap="nowrap">
          <Box className={styles.brandLogo}>
            <IconShieldLock size={14} color="#fff" stroke={2.5} />
          </Box>
          {!isMobile && (
            <Text fw={700} size="sm" className={styles.brandTitle}>
              VPNHub
            </Text>
          )}
        </Group>

        <Box className={styles.divider} />

        {getDaemonBadge()}
      </Group>

      {/* Center Search Shortcut */}
      {!isNarrow ? (
        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconSearch size={13} color="var(--vpn-text-muted)" />}
          rightSection={
            <Badge size="xs" variant="outline" color="gray" className={styles.searchBadge}>
              ⌘K
            </Badge>
          }
          onClick={() => setSpotlightOpen(true)}
          className={styles.searchButton}
        >
          Search profiles, commands...
        </Button>
      ) : (
        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={() => setSpotlightOpen(true)}
          className={styles.iconButton}
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
            className={isCompactWidget ? styles.activeIconButton : styles.iconButton}
          >
            {isCompactWidget ? (
              <IconDeviceDesktop size={14} />
            ) : (
              <IconLayoutSidebarLeftCollapse size={14} />
            )}
          </ActionIcon>
        </Tooltip>

        <Box className={styles.controlDivider} />

        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => IpcBridge.windowMinimize()}
          className={styles.iconButton}
        >
          <IconMinus size={13} />
        </ActionIcon>

        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => IpcBridge.windowMaximize()}
          className={styles.iconButton}
        >
          <IconSquare size={12} />
        </ActionIcon>

        <ActionIcon
          variant="subtle"
          color="red"
          size="sm"
          onClick={() => IpcBridge.windowClose(appSettings.minimizeToTray)}
          className={styles.iconButton}
        >
          <IconX size={13} />
        </ActionIcon>
      </Group>
    </Box>
  );
};
