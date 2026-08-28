import React, { useEffect } from "react";
import {
  Box,
  Stack,
  Group,
  Text,
  Badge,
  Switch,
  Divider,
  SimpleGrid,
  Button,
  UnstyledButton,
} from "@mantine/core";
import {
  IconDeviceDesktop,
  IconWifi,
  IconCpu,
  IconRotateClockwise,
  IconExternalLink,
  IconCommand,
  IconShieldCheck,
  IconLock,
  IconLanguage,
} from "@tabler/icons-react";
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { notifications } from "@mantine/notifications";
import { useVpnStore } from "../../state/useVpnStore";
import { useTranslation, AppLanguage } from "../../i18n";
import styles from "./SettingsView.module.css";

export const SettingsView: React.FC = () => {
  const {
    appSettings,
    updateAppSettings,
    daemonHealth,
    daemonVersion,
    daemonLatencyMs,
    setSpotlightOpen,
  } = useVpnStore();

  const { t, language, setLanguage, supportedLanguages } = useTranslation();

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

  const handleResetDefaults = () => {
    updateAppSettings({
      autoLaunch: false,
      startMinimized: true,
      autoConnect: false,
      minimizeToTray: true,
      notificationsEnabled: true,
      autoReconnect: true,
      language: "en",
    });
    notifications.show({
      title: t.settings.settingsRestoredTitle,
      message: t.settings.settingsRestoredMsg,
      color: "cyan",
    });
  };

  return (
    <Box className={styles.root}>
      {/* Header Section with Live Status Badges */}
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
        <Box>
          <Text size="xl" fw={700} className={styles.title}>
            {t.settings.title}
          </Text>
          <Text size="xs" c="dimmed">
            {t.settings.subtitle}
          </Text>
        </Box>

        <Group gap="xs" wrap="wrap">
          <Badge
            size="sm"
            variant="dot"
            color={daemonHealth === "connected" ? "teal" : "red"}
            className={styles.statusBadge}
          >
            Core: {daemonHealth === "connected" ? t.settings.coreReady.replace("{version}", daemonVersion) : t.settings.coreOffline}
          </Badge>
          <Badge size="sm" variant="outline" color="cyan" className={styles.statusBadge}>
            {t.settings.vaultAes}
          </Badge>
        </Group>
      </Group>

      {/* Language & Regional Preferences Card */}
      <Box className={`glass-panel ${styles.panel}`}>
        <Stack gap="sm">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="xs">
              <IconLanguage size={18} color="var(--vpn-cyan)" />
              <Text size="sm" fw={700} className={styles.cardTitle}>
                {t.settings.languageCardTitle}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              {t.settings.languageSelectDesc}
            </Text>
          </Group>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm" mt={4}>
            {supportedLanguages.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <UnstyledButton
                  key={lang.code}
                  onClick={() => setLanguage(lang.code as AppLanguage)}
                  className={isSelected ? styles.langButtonActive : styles.langButton}
                >
                  <Group gap="xs" justify="center" wrap="nowrap">
                    <Text size="lg">{lang.flag}</Text>
                    <Box>
                      <Text
                        size="xs"
                        fw={isSelected ? 700 : 500}
                        c={isSelected ? "var(--vpn-cyan)" : "white"}
                      >
                        {lang.nativeName}
                      </Text>
                      <Text size="10px" c="dimmed">
                        {lang.name}
                      </Text>
                    </Box>
                  </Group>
                </UnstyledButton>
              );
            })}
          </SimpleGrid>
        </Stack>
      </Box>

      {/* Main Settings Grid (Responsive: 1 col on Mobile/Tablet, 2 cols on Desktop) */}
      <SimpleGrid cols={{ base: 1, md: 1, lg: 2 }} spacing="md">
        {/* Card 1: Desktop & Window Behavior */}
        <Box className={`glass-panel ${styles.panel}`}>
          <Stack gap="md">
            <Group gap="xs">
              <IconDeviceDesktop size={18} color="var(--vpn-cyan)" />
              <Text size="sm" fw={700} className={styles.cardTitle}>
                {t.settings.desktopBehaviorTitle}
              </Text>
            </Group>

            <Stack gap="md">
              {/* 1. Launch at System Startup */}
              <Group justify="space-between" align="center" wrap="nowrap">
                <Box style={{ flex: 1, paddingRight: 12 }}>
                  <Text size="xs" fw={600} className={styles.itemTitle}>
                    {t.settings.launchAtStartup}
                  </Text>
                  <Text className={styles.itemDesc}>
                    {t.settings.launchAtStartupDesc}
                  </Text>
                </Box>
                <Switch
                  checked={appSettings.autoLaunch}
                  onChange={(e) => handleToggleAutoLaunch(e.currentTarget.checked)}
                  color="cyan"
                  size="md"
                />
              </Group>

              {/* 2. Start Minimized to System Tray (shown when autostart is on) */}
              {appSettings.autoLaunch && (
                <>
                  <Divider className={styles.divider} />
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Box style={{ flex: 1, paddingRight: 12 }}>
                      <Text size="xs" fw={600} className={styles.itemTitle}>
                        {t.settings.startMinimized}
                      </Text>
                      <Text className={styles.itemDesc}>
                        {t.settings.startMinimizedDesc}
                      </Text>
                    </Box>
                    <Switch
                      checked={appSettings.startMinimized}
                      onChange={(e) =>
                        updateAppSettings({ startMinimized: e.currentTarget.checked })
                      }
                      color="cyan"
                      size="md"
                    />
                  </Group>
                </>
              )}

              <Divider className={styles.divider} />

              {/* 3. Auto-Connect on Launch */}
              <Group justify="space-between" align="center" wrap="nowrap">
                <Box style={{ flex: 1, paddingRight: 12 }}>
                  <Text size="xs" fw={600} className={styles.itemTitle}>
                    {t.settings.autoConnectOnLaunch}
                  </Text>
                  <Text className={styles.itemDesc}>
                    {t.settings.autoConnectOnLaunchDesc}
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

              {/* 4. Minimize to System Tray on Close */}
              <Group justify="space-between" align="center" wrap="nowrap">
                <Box style={{ flex: 1, paddingRight: 12 }}>
                  <Text size="xs" fw={600} className={styles.itemTitle}>
                    {t.settings.minimizeToTrayOnClose}
                  </Text>
                  <Text className={styles.itemDesc}>
                    {t.settings.minimizeToTrayOnCloseDesc}
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
          </Stack>
        </Box>

        {/* Card 2: Network & Notification Preferences */}
        <Box className={`glass-panel ${styles.panel}`}>
          <Stack gap="md">
            <Group gap="xs">
              <IconWifi size={18} color="var(--vpn-emerald)" />
              <Text size="sm" fw={700} className={styles.cardTitle}>
                {t.settings.networkIntegrationTitle}
              </Text>
            </Group>

            <Stack gap="md">
              {/* 1. Auto-Reconnect */}
              <Group justify="space-between" align="center" wrap="nowrap">
                <Box style={{ flex: 1, paddingRight: 12 }}>
                  <Text size="xs" fw={600} className={styles.itemTitle}>
                    {t.settings.autoReconnect}
                  </Text>
                  <Text className={styles.itemDesc}>
                    {t.settings.autoReconnectDesc}
                  </Text>
                </Box>
                <Switch
                  checked={appSettings.autoReconnect ?? true}
                  onChange={(e) => updateAppSettings({ autoReconnect: e.currentTarget.checked })}
                  color="teal"
                  size="md"
                />
              </Group>

              <Divider className={styles.divider} />

              {/* 2. Desktop Notifications */}
              <Group justify="space-between" align="center" wrap="nowrap">
                <Box style={{ flex: 1, paddingRight: 12 }}>
                  <Text size="xs" fw={600} className={styles.itemTitle}>
                    {t.settings.desktopNotifications}
                  </Text>
                  <Text className={styles.itemDesc}>
                    {t.settings.desktopNotificationsDesc}
                  </Text>
                </Box>
                <Switch
                  checked={appSettings.notificationsEnabled ?? true}
                  onChange={(e) =>
                    updateAppSettings({ notificationsEnabled: e.currentTarget.checked })
                  }
                  color="teal"
                  size="md"
                />
              </Group>

              <Divider className={styles.divider} />

              {/* 3. Global Spotlight Shortcut */}
              <Group justify="space-between" align="center" wrap="nowrap">
                <Box style={{ flex: 1, paddingRight: 12 }}>
                  <Text size="xs" fw={600} className={styles.itemTitle}>
                    {t.settings.spotlightTitle}
                  </Text>
                  <Text className={styles.itemDesc}>
                    {t.settings.spotlightDesc}
                  </Text>
                </Box>
                <Button
                  variant="light"
                  color="cyan"
                  size="xs"
                  leftSection={<IconCommand size={14} />}
                  onClick={() => setSpotlightOpen(true)}
                >
                  {t.settings.spotlightButton}
                </Button>
              </Group>
            </Stack>
          </Stack>
        </Box>
      </SimpleGrid>

      {/* Card 3: Core Diagnostics & Encrypted Vault Information */}
      <Box className={`glass-panel ${styles.panel}`}>
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="xs">
              <IconCpu size={18} color="var(--vpn-cyan)" />
              <Text size="sm" fw={700} className={styles.cardTitle}>
                {t.settings.diagnosticsTitle}
              </Text>
            </Group>
            <Badge size="xs" variant="outline" color="gray">
              {t.settings.engineStatus}
            </Badge>
          </Group>

          {/* 3 Diagnostics Tiles */}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <Box className={styles.diagTile}>
              <Group gap="xs">
                <IconShieldCheck size={16} color="var(--vpn-emerald)" />
                <Text size="xs" fw={600} c="white">
                  {t.settings.cipherSuiteTitle}
                </Text>
              </Group>
              <Text size="11px" c="dimmed">
                {t.settings.cipherSuiteDesc}
              </Text>
            </Box>

            <Box className={styles.diagTile}>
              <Group gap="xs">
                <IconCpu size={16} color="var(--vpn-cyan)" />
                <Text size="xs" fw={600} c="white">
                  {t.settings.ipcDaemonTitle}
                </Text>
              </Group>
              <Text size="11px" c="dimmed">
                {t.settings.ipcDaemonDesc.replace("{latency}", daemonLatencyMs.toFixed(2))}
              </Text>
            </Box>

            <Box className={styles.diagTile}>
              <Group gap="xs">
                <IconLock size={16} color="var(--vpn-amber)" />
                <Text size="xs" fw={600} c="white">
                  {t.settings.encryptedVaultTitle}
                </Text>
              </Group>
              <Text size="11px" c="dimmed">
                {t.settings.encryptedVaultDesc}
              </Text>
            </Box>
          </SimpleGrid>

          <Divider className={styles.divider} />

          {/* Footer Actions */}
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <Text size="11px" c="dimmed">
              {t.settings.clientVersionText}
            </Text>

            <Group gap="xs">
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                leftSection={<IconRotateClockwise size={14} />}
                onClick={handleResetDefaults}
              >
                {t.settings.resetDefaults}
              </Button>
              <Button
                variant="light"
                color="cyan"
                size="xs"
                leftSection={<IconExternalLink size={14} />}
                onClick={() => {
                  window.open("https://github.com/hephaestus-studio/vpnhub", "_blank");
                }}
              >
                {t.settings.docsAndGithub}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Box>
    </Box>
  );
};


