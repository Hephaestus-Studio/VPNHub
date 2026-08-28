import { Box, Stack, Group, Text, Badge, Switch, SimpleGrid } from "@mantine/core";
import { IconShieldLock, IconNetwork, IconWorld, IconRadioactive } from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import { useTranslation } from "../../i18n";
import styles from "./SecurityHubView.module.css";

export const SecurityHubView: React.FC = () => {
  const { securitySettings, setKillSwitch, updateSecuritySettings } = useVpnStore();
  const { t } = useTranslation();

  const isKillSwitchActive = securitySettings.killSwitch !== "off";

  return (
    <Box className={styles.root}>
      {/* Header */}
      <Box>
        <Text size="xl" fw={700} className={styles.title}>
          {t.security.title}
        </Text>
        <Text size="xs" c="dimmed">
          {t.security.subtitle}
        </Text>
      </Box>

      {/* Kill Switch Card */}
      <Box className={`glass-panel ${styles.killSwitchPanel}`}>
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <Box
              className={
                isKillSwitchActive
                  ? styles.killSwitchIconBoxActive
                  : styles.killSwitchIconBoxInactive
              }
            >
              <IconShieldLock
                size={22}
                color={isKillSwitchActive ? "var(--vpn-emerald)" : "var(--vpn-crimson)"}
              />
            </Box>
            <Box>
              <Group gap="xs" align="center">
                <Text size="md" fw={700} className={styles.cardTitle}>
                  {t.security.killSwitchTitle}
                </Text>
                <Badge size="xs" color={isKillSwitchActive ? "teal" : "gray"} variant="light">
                  {isKillSwitchActive ? t.security.killSwitchEnforced : t.security.killSwitchOff}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                {t.security.killSwitchDesc}
              </Text>
            </Box>
          </Group>

          <Switch
            size="md"
            checked={isKillSwitchActive}
            onChange={(e) => setKillSwitch(e.currentTarget.checked ? "strict" : "off")}
            color="teal"
          />
        </Group>
      </Box>

      {/* Grid of Security Shields */}
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        {/* IPv6 Leak Shield */}
        <Box className={`glass-panel ${styles.shieldCard}`}>
          <Stack gap="sm" justify="space-between" style={{ height: "100%" }}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap="xs">
                  <IconWorld size={18} color="var(--vpn-emerald)" />
                  <Text size="sm" fw={700} className={styles.cardTitle}>
                    {t.security.ipv6Title}
                  </Text>
                </Group>
                <Switch
                  checked={securitySettings.ipv6LeakProtection}
                  onChange={(e) =>
                    updateSecuritySettings({ ipv6LeakProtection: e.currentTarget.checked })
                  }
                  color="teal"
                />
              </Group>

              <Text size="xs" c="dimmed">
                {t.security.ipv6Desc}
              </Text>
            </Stack>

            <Group justify="space-between" mt="md">
              <Text size="10px" c="dimmed">
                IPv6: {securitySettings.ipv6LeakProtection ? t.statusBar.ipv6Blocked : t.statusBar.ipv6Pass}
              </Text>
              <Badge
                size="xs"
                color={securitySettings.ipv6LeakProtection ? "teal" : "gray"}
                variant="dot"
              >
                {securitySettings.ipv6LeakProtection ? t.security.ipv6Protected : t.common.disable}
              </Badge>
            </Group>
          </Stack>
        </Box>

        {/* WebRTC Shield */}
        <Box className={`glass-panel ${styles.shieldCard}`}>
          <Stack gap="sm" justify="space-between" style={{ height: "100%" }}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap="xs">
                  <IconRadioactive size={18} color="var(--vpn-amber)" />
                  <Text size="sm" fw={700} className={styles.cardTitle}>
                    {t.security.webrtcTitle}
                  </Text>
                </Group>
                <Switch
                  checked={securitySettings.webRtcProtection}
                  onChange={(e) =>
                    updateSecuritySettings({ webRtcProtection: e.currentTarget.checked })
                  }
                  color="yellow"
                />
              </Group>

              <Text size="xs" c="dimmed">
                {t.security.webrtcDesc}
              </Text>
            </Stack>

            <Group justify="space-between" mt="md">
              <Text size="10px" c="dimmed">
                Filter: 3478, 5349, 19302
              </Text>
              <Badge
                size="xs"
                color={securitySettings.webRtcProtection ? "yellow" : "gray"}
                variant="light"
              >
                {securitySettings.webRtcProtection ? t.security.webrtcProtected : t.common.disable}
              </Badge>
            </Group>
          </Stack>
        </Box>

        {/* Smart LAN Access Bypass */}
        <Box className={`glass-panel ${styles.shieldCard}`}>
          <Stack gap="sm" justify="space-between" style={{ height: "100%" }}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap="xs">
                  <IconNetwork size={18} color="var(--vpn-cyan)" />
                  <Text size="sm" fw={700} className={styles.cardTitle}>
                    {t.security.lanBypassTitle}
                  </Text>
                </Group>
                <Switch
                  checked={securitySettings.lanBypass}
                  onChange={(e) => updateSecuritySettings({ lanBypass: e.currentTarget.checked })}
                  color="cyan"
                />
              </Group>

              <Text size="xs" c="dimmed">
                {t.security.lanBypassDesc}
              </Text>
            </Stack>

            <Group justify="space-between" mt="md">
              <Text size="10px" c="dimmed">
                {t.security.lanBypassTitle}
              </Text>
              <Badge size="xs" color={securitySettings.lanBypass ? "cyan" : "gray"} variant="light">
                {securitySettings.lanBypass ? t.security.lanBypassActive : t.common.disable}
              </Badge>
            </Group>
          </Stack>
        </Box>
      </SimpleGrid>
    </Box>
  );
};
