import { useState } from "react";
import {
  Box,
  Stack,
  Group,
  Text,
  Badge,
  Switch,
  SegmentedControl,
  Select,
  Button,
  SimpleGrid,
} from "@mantine/core";
import {
  IconShieldLock,
  IconLock,
  IconNetwork,
  IconWorld,
  IconRadioactive,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import { DnsLeakTestModal } from "./DnsLeakTestModal";

export const SecurityHubView: React.FC = () => {
  const { securitySettings, setKillSwitch, updateSecuritySettings } = useVpnStore();
  const [isLeakModalOpen, setLeakModalOpen] = useState(false);

  return (
    <Box
      style={{
        padding: "16px",
        height: "100%",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Header */}
      <Box>
        <Text size="xl" fw={700} style={{ color: "#fff", letterSpacing: "-0.02em" }}>
          Security & Shield Center
        </Text>
        <Text size="xs" c="dimmed">
          Configure system firewall rules, fail-closed kill switches, and leak prevention mechanisms
        </Text>
      </Box>

      {/* Kill Switch Card */}
      <Box
        className="glass-panel"
        style={{
          padding: "20px",
          background: "rgba(17, 24, 39, 0.75)",
        }}
      >
        <Group justify="space-between" align="flex-start" mb="md">
          <Group gap="sm">
            <Box
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background:
                  securitySettings.killSwitch !== "off"
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(239, 68, 68, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconShieldLock
                size={20}
                color={
                  securitySettings.killSwitch !== "off"
                    ? "var(--vpn-emerald)"
                    : "var(--vpn-crimson)"
                }
              />
            </Box>
            <Box>
              <Text size="md" fw={700} style={{ color: "#fff" }}>
                Fail-Closed Kill Switch (Firewall Enforcement)
              </Text>
              <Text size="xs" c="dimmed">
                Prevents unencrypted traffic leaks when VPN connection drops unexpectedly
              </Text>
            </Box>
          </Group>

          <Badge
            size="sm"
            color={
              securitySettings.killSwitch === "strict"
                ? "teal"
                : securitySettings.killSwitch === "standard"
                  ? "cyan"
                  : "red"
            }
            variant="light"
          >
            {securitySettings.killSwitch.toUpperCase()}
          </Badge>
        </Group>

        {/* Mode Selector */}
        <SegmentedControl
          fullWidth
          value={securitySettings.killSwitch}
          onChange={(val) => setKillSwitch(val as any)}
          data={[
            {
              value: "off",
              label: (
                <Stack gap={2} align="center" py={4}>
                  <Text size="xs" fw={600}>
                    Disabled (Off)
                  </Text>
                  <Text size="10px" c="dimmed">
                    Traffic continues unprotected if VPN drops
                  </Text>
                </Stack>
              ),
            },
            {
              value: "standard",
              label: (
                <Stack gap={2} align="center" py={4}>
                  <Text size="xs" fw={600}>
                    Auto / Standard
                  </Text>
                  <Text size="10px" c="dimmed">
                    Blocks internet only upon sudden disconnect
                  </Text>
                </Stack>
              ),
            },
            {
              value: "strict",
              label: (
                <Stack gap={2} align="center" py={4}>
                  <Text size="xs" fw={600} style={{ color: "#34d399" }}>
                    Strict (Fail-Closed)
                  </Text>
                  <Text size="10px" c="dimmed">
                    Blocks ALL non-VPN internet traffic completely
                  </Text>
                </Stack>
              ),
            },
          ]}
          styles={{
            root: {
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid var(--vpn-border)",
            },
          }}
        />
      </Box>

      {/* Grid of Security Shields */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {/* DNS Shield */}
        <Box
          className="glass-panel"
          style={{
            padding: "16px",
            background: "rgba(17, 24, 39, 0.75)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <IconLock size={18} color="var(--vpn-cyan)" />
                <Text size="sm" fw={700} style={{ color: "#fff" }}>
                  DNS Leak Shield
                </Text>
              </Group>
              <Switch
                checked={securitySettings.dnsProtection}
                onChange={(e) => updateSecuritySettings({ dnsProtection: e.currentTarget.checked })}
                color="cyan"
              />
            </Group>

            <Text size="xs" c="dimmed">
              Forces all DNS requests through private encrypted recursive resolvers, preventing ISP
              inspection.
            </Text>

            <Select
              label="Custom DNS Resolver"
              size="xs"
              value={securitySettings.customDnsProvider}
              onChange={(val) => updateSecuritySettings({ customDnsProvider: val as any })}
              data={[
                { value: "cloudflare", label: "Cloudflare 1.1.1.1 (Encrypted NRPT)" },
                { value: "google", label: "Google Public DNS 8.8.8.8" },
                { value: "quad9", label: "Quad9 9.9.9.9 (Malware Block)" },
                { value: "custom", label: "Custom Corporate DNS" },
              ]}
              disabled={!securitySettings.dnsProtection}
            />
          </Stack>

          <Button
            size="xs"
            variant="light"
            color="cyan"
            leftSection={<IconPlayerPlay size={14} />}
            mt="md"
            onClick={() => setLeakModalOpen(true)}
          >
            Run DNS Leak Diagnostic Test
          </Button>
        </Box>

        {/* IPv6 Leak Shield */}
        <Box
          className="glass-panel"
          style={{
            padding: "16px",
            background: "rgba(17, 24, 39, 0.75)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <IconWorld size={18} color="var(--vpn-emerald)" />
                <Text size="sm" fw={700} style={{ color: "#fff" }}>
                  IPv6 Blackhole Leak Shield
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
              Null-routes all native IPv6 traffic to guarantee no dual-stack traffic bypasses the
              IPv4 VPN tunnel.
            </Text>

            <Box
              style={{
                padding: "8px 12px",
                background: "rgba(0, 0, 0, 0.25)",
                borderRadius: 6,
                border: "1px solid var(--vpn-border)",
              }}
            >
              <Text size="11px" className="font-mono" c="dimmed">
                Status:{" "}
                {securitySettings.ipv6LeakProtection
                  ? "ip -6 route add blackhole default"
                  : "Native Pass-through"}
              </Text>
            </Box>
          </Stack>

          <Group justify="space-between" mt="md">
            <Text size="10px" c="dimmed">
              Protection active on wg0/tun0
            </Text>
            <Badge
              size="xs"
              color={securitySettings.ipv6LeakProtection ? "teal" : "gray"}
              variant="dot"
            >
              {securitySettings.ipv6LeakProtection ? "Enforced" : "Disabled"}
            </Badge>
          </Group>
        </Box>

        {/* WebRTC Shield */}
        <Box
          className="glass-panel"
          style={{
            padding: "16px",
            background: "rgba(17, 24, 39, 0.75)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <Stack gap="xs">
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <IconRadioactive size={18} color="var(--vpn-amber)" />
                <Text size="sm" fw={700} style={{ color: "#fff" }}>
                  WebRTC STUN / TURN Shield
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
              Prevents web browsers (Chrome, Firefox, Brave) from leaking real public and local IP
              addresses via WebRTC STUN requests (blocks outbound UDP STUN probes).
            </Text>
          </Stack>

          <Group justify="space-between" mt="md">
            <Text size="10px" c="dimmed">
              STUN Port Filter (3478/5349/19302)
            </Text>
            <Badge
              size="xs"
              color={securitySettings.webRtcProtection ? "yellow" : "gray"}
              variant="light"
            >
              {securitySettings.webRtcProtection ? "Protected" : "Pass-through"}
            </Badge>
          </Group>
        </Box>

        {/* Smart LAN Access Bypass */}
        <Box
          className="glass-panel"
          style={{
            padding: "16px",
            background: "rgba(17, 24, 39, 0.75)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <Stack gap="xs">
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <IconNetwork size={18} color="var(--vpn-cyan)" />
                <Text size="sm" fw={700} style={{ color: "#fff" }}>
                  Smart Local Network (LAN) Bypass
                </Text>
              </Group>
              <Switch
                checked={securitySettings.lanBypass}
                onChange={(e) => updateSecuritySettings({ lanBypass: e.currentTarget.checked })}
                color="cyan"
              />
            </Group>

            <Text size="xs" c="dimmed">
              Allows access to local physical network devices (home/office printers, NAS, router in
              local subnet e.g. 192.168.1.0/24) directly without interfering with VPN subnets.
            </Text>
          </Stack>

          <Group justify="space-between" mt="md">
            <Text size="10px" c="dimmed">
              Dynamic Physical Subnet Exemption
            </Text>
            <Badge size="xs" color={securitySettings.lanBypass ? "cyan" : "gray"} variant="light">
              {securitySettings.lanBypass ? "Active (Smart LAN)" : "Full Tunneling"}
            </Badge>
          </Group>
        </Box>
      </SimpleGrid>

      {/* Leak Test Modal */}
      <DnsLeakTestModal opened={isLeakModalOpen} onClose={() => setLeakModalOpen(false)} />
    </Box>
  );
};
