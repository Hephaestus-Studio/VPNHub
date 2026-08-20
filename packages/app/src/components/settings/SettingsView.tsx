import { useState } from "react";
import {
  Box,
  Stack,
  Group,
  Text,
  Switch,
  Select,
  NumberInput,
  TextInput,
  Button,
  SimpleGrid,
  Divider,
} from "@mantine/core";
import { IconDeviceDesktop, IconNetwork, IconDeviceFloppy } from "@tabler/icons-react";
import styles from "./SettingsView.module.css";

export const SettingsView: React.FC = () => {
  const [autoLaunch, setAutoLaunch] = useState(true);
  const [autoConnect, setAutoConnect] = useState(true);
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [hardwareAccel, setHardwareAccel] = useState(true);
  const [defaultProtocol, setDefaultProtocol] = useState("wireguard");
  const [mtuSize, setMtuSize] = useState<number>(1420);
  const [keepaliveSecs, setKeepaliveSecs] = useState<number>(25);
  const [socketPath, setSocketPath] = useState("/run/vpnhub/daemon.sock");
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <Box className={styles.root}>
      <Group justify="space-between" align="center">
        <Box>
          <Text size="xl" fw={700} className={styles.title}>
            Application & Protocol Settings
          </Text>
          <Text size="xs" c="dimmed">
            Customize desktop client behavior, protocol MTU, and background daemon IPC sockets
          </Text>
        </Box>

        <Button
          size="xs"
          color="cyan"
          leftSection={<IconDeviceFloppy size={14} />}
          onClick={handleSave}
        >
          {isSaved ? "Settings Saved!" : "Save Changes"}
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {/* App Startup & System */}
        <Box className={`glass-panel ${styles.panel}`}>
          <Group gap="xs" mb="sm">
            <IconDeviceDesktop size={18} color="var(--vpn-cyan)" />
            <Text size="sm" fw={700} className={styles.cardTitle}>
              Desktop Behavior & Tray
            </Text>
          </Group>

          <Stack gap="sm">
            <Group justify="space-between">
              <Box>
                <Text size="xs" fw={600} className={styles.itemTitle}>
                  Launch at System Startup
                </Text>
                <Text size="10px" c="dimmed">
                  Starts VPNHub automatically in background tray
                </Text>
              </Box>
              <Switch
                checked={autoLaunch}
                onChange={(e) => setAutoLaunch(e.currentTarget.checked)}
                color="cyan"
              />
            </Group>

            <Divider className={styles.divider} />

            <Group justify="space-between">
              <Box>
                <Text size="xs" fw={600} className={styles.itemTitle}>
                  Auto-Connect on Launch
                </Text>
                <Text size="10px" c="dimmed">
                  Connects to the last active profile immediately
                </Text>
              </Box>
              <Switch
                checked={autoConnect}
                onChange={(e) => setAutoConnect(e.currentTarget.checked)}
                color="cyan"
              />
            </Group>

            <Divider className={styles.divider} />

            <Group justify="space-between">
              <Box>
                <Text size="xs" fw={600} className={styles.itemTitle}>
                  Minimize to System Tray on Close
                </Text>
                <Text size="10px" c="dimmed">
                  Keeps active VPN tunnels running when window is closed
                </Text>
              </Box>
              <Switch
                checked={minimizeToTray}
                onChange={(e) => setMinimizeToTray(e.currentTarget.checked)}
                color="cyan"
              />
            </Group>

            <Divider className={styles.divider} />

            <Group justify="space-between">
              <Box>
                <Text size="xs" fw={600} className={styles.itemTitle}>
                  Hardware Acceleration
                </Text>
                <Text size="10px" c="dimmed">
                  Uses GPU rendering for live sparklines and smooth animations
                </Text>
              </Box>
              <Switch
                checked={hardwareAccel}
                onChange={(e) => setHardwareAccel(e.currentTarget.checked)}
                color="cyan"
              />
            </Group>
          </Stack>
        </Box>

        {/* Protocol Tuning */}
        <Box className={`glass-panel ${styles.panel}`}>
          <Group gap="xs" mb="sm">
            <IconNetwork size={18} color="var(--vpn-emerald)" />
            <Text size="sm" fw={700} className={styles.cardTitle}>
              Tunnel & MTU Optimization
            </Text>
          </Group>

          <Stack gap="sm">
            <Select
              size="xs"
              label="Default Tunnel Protocol"
              value={defaultProtocol}
              onChange={(val) => setDefaultProtocol(val || "wireguard")}
              data={[
                { value: "wireguard", label: "WireGuard (Recommended - Lowest Latency)" },
                { value: "openvpn_udp", label: "OpenVPN UDP (Enterprise Standard)" },
                { value: "openvpn_tcp", label: "OpenVPN TCP (Stealth Mode)" },
              ]}
            />

            <Group grow>
              <NumberInput
                size="xs"
                label="Maximum Transmission Unit (MTU)"
                value={mtuSize}
                onChange={(val) => setMtuSize(Number(val) || 1420)}
                className="font-mono"
              />
              <NumberInput
                size="xs"
                label="Persistent Keepalive (Seconds)"
                value={keepaliveSecs}
                onChange={(val) => setKeepaliveSecs(Number(val) || 25)}
                className="font-mono"
              />
            </Group>

            <TextInput
              size="xs"
              label="Daemon IPC Socket Path"
              value={socketPath}
              onChange={(e) => setSocketPath(e.currentTarget.value)}
              className="font-mono"
            />
          </Stack>
        </Box>
      </SimpleGrid>
    </Box>
  );
};
