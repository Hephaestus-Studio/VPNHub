import React, { useEffect } from "react";
import { Box, Stack, Group, Text, Switch, Divider } from "@mantine/core";
import { IconDeviceDesktop } from "@tabler/icons-react";
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { useVpnStore } from "../../state/useVpnStore";
import styles from "./SettingsView.module.css";

export const SettingsView: React.FC = () => {
  const { appSettings, updateAppSettings } = useVpnStore();

  useEffect(() => {
    isAutostartEnabled()
      .then((enabled) => {
        if (enabled !== appSettings.autoLaunch) {
          updateAppSettings({ autoLaunch: enabled });
        }
      })
      .catch((err) => {
        console.debug("Autostart query not available in browser mode:", err);
      });
  }, []);

  const handleToggleAutoLaunch = async (checked: boolean) => {
    updateAppSettings({ autoLaunch: checked });
    try {
      if (checked) {
        await enableAutostart();
      } else {
        await disableAutostart();
      }
    } catch (err) {
      console.warn("Failed to set OS autostart state:", err);
    }
  };

  return (
    <Box className={styles.root}>
      <Box mb="xs">
        <Text size="xl" fw={700} className={styles.title}>
          Application Settings
        </Text>
        <Text size="xs" c="dimmed">
          Configure desktop client behavior, startup preferences, and system tray integration
        </Text>
      </Box>

      {/* Desktop Behavior & Tray Card */}
      <Box className={`glass-panel ${styles.panel}`} style={{ maxWidth: 640 }}>
        <Group gap="xs" mb="md">
          <IconDeviceDesktop size={18} color="var(--vpn-cyan)" />
          <Text size="sm" fw={700} className={styles.cardTitle}>
            Desktop & Window Behavior
          </Text>
        </Group>

        <Stack gap="md">
          {/* 1. Launch at System Startup */}
          <Group justify="space-between" align="center">
            <Box style={{ flex: 1, paddingRight: 16 }}>
              <Text size="xs" fw={600} className={styles.itemTitle}>
                Launch at System Startup
              </Text>
              <Text size="11px" c="dimmed" mt={2}>
                Starts VPNHub automatically in background tray when your operating system boots
              </Text>
            </Box>
            <Switch
              checked={appSettings.autoLaunch}
              onChange={(e) => handleToggleAutoLaunch(e.currentTarget.checked)}
              color="cyan"
              size="md"
            />
          </Group>

          <Divider className={styles.divider} />

          {/* 2. Auto-Connect on Launch */}
          <Group justify="space-between" align="center">
            <Box style={{ flex: 1, paddingRight: 16 }}>
              <Text size="xs" fw={600} className={styles.itemTitle}>
                Auto-Connect on Launch
              </Text>
              <Text size="11px" c="dimmed" mt={2}>
                Automatically establishes secure connection to your favorite or last active profile
              </Text>
            </Box>
            <Switch
              checked={appSettings.autoConnect}
              onChange={(e) => updateAppSettings({ autoConnect: e.currentTarget.checked })}
              color="cyan"
              size="md"
            />
          </Group>

          <Divider className={styles.divider} />

          {/* 3. Minimize to System Tray on Close */}
          <Group justify="space-between" align="center">
            <Box style={{ flex: 1, paddingRight: 16 }}>
              <Text size="xs" fw={600} className={styles.itemTitle}>
                Minimize to System Tray on Close
              </Text>
              <Text size="11px" c="dimmed" mt={2}>
                Closing the window hides it to the system tray so VPN tunnels stay active and
                uninterrupted
              </Text>
            </Box>
            <Switch
              checked={appSettings.minimizeToTray}
              onChange={(e) => updateAppSettings({ minimizeToTray: e.currentTarget.checked })}
              color="cyan"
              size="md"
            />
          </Group>
        </Stack>
      </Box>
    </Box>
  );
};
