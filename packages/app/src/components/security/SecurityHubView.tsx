import { Box, Stack, Group, Text, Badge, Switch, SimpleGrid } from "@mantine/core";
import { IconShieldLock, IconNetwork, IconWorld, IconRadioactive } from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import styles from "./SecurityHubView.module.css";

export const SecurityHubView: React.FC = () => {
  const { securitySettings, setKillSwitch, updateSecuritySettings } = useVpnStore();

  const isKillSwitchActive = securitySettings.killSwitch !== "off";

  return (
    <Box className={styles.root}>
      {/* Header */}
      <Box>
        <Text size="xl" fw={700} className={styles.title}>
          Security & Shield Center
        </Text>
        <Text size="xs" c="dimmed">
          Configure firewall leak shields, fail-closed kill switches, and local network bypass
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
                  Internet Kill Switch (Firewall Enforcement)
                </Text>
                <Badge size="xs" color={isKillSwitchActive ? "teal" : "gray"} variant="light">
                  {isKillSwitchActive ? "ENFORCED" : "OFF"}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                Blocks unencrypted traffic if the VPN connection drops unexpectedly to prevent data
                leaks
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
                    IPv6 Blackhole Shield
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
                Null-routes native IPv6 traffic to guarantee no dual-stack traffic bypasses the VPN
                tunnel.
              </Text>
            </Stack>

            <Group justify="space-between" mt="md">
              <Text size="10px" c="dimmed">
                Status: {securitySettings.ipv6LeakProtection ? "blackhole default" : "Pass-through"}
              </Text>
              <Badge
                size="xs"
                color={securitySettings.ipv6LeakProtection ? "teal" : "gray"}
                variant="dot"
              >
                {securitySettings.ipv6LeakProtection ? "Protected" : "Off"}
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
                    WebRTC STUN Shield
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
                Prevents browsers (Chrome, Firefox) from leaking real IP addresses via outbound
                WebRTC STUN probes.
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
                {securitySettings.webRtcProtection ? "Protected" : "Pass-through"}
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
                    Smart LAN Bypass
                  </Text>
                </Group>
                <Switch
                  checked={securitySettings.lanBypass}
                  onChange={(e) => updateSecuritySettings({ lanBypass: e.currentTarget.checked })}
                  color="cyan"
                />
              </Group>

              <Text size="xs" c="dimmed">
                Allows access to local physical network devices (home/office printers, NAS, router
                in local subnet).
              </Text>
            </Stack>

            <Group justify="space-between" mt="md">
              <Text size="10px" c="dimmed">
                Physical Subnet Exemption
              </Text>
              <Badge size="xs" color={securitySettings.lanBypass ? "cyan" : "gray"} variant="light">
                {securitySettings.lanBypass ? "Active" : "Disabled"}
              </Badge>
            </Group>
          </Stack>
        </Box>
      </SimpleGrid>
    </Box>
  );
};
