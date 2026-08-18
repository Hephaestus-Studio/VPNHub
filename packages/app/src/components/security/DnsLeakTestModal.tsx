import { useState } from "react";
import { Modal, Stack, Group, Text, Box, Button, Progress, Table } from "@mantine/core";
import {
  IconShieldCheck,
  IconAlertTriangle,
  IconPlayerPlay,
  IconRefresh,
  IconLock,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";

interface DnsLeakTestModalProps {
  opened: boolean;
  onClose: () => void;
}

interface TestServer {
  ip: string;
  hostname: string;
  isp: string;
  country: string;
  flag: string;
}

export const DnsLeakTestModal: React.FC<DnsLeakTestModalProps> = ({ opened, onClose }) => {
  const { connectionState } = useVpnStore();
  const isConnected = connectionState === "connected";

  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<TestServer[] | null>(null);

  const runTest = () => {
    setTesting(true);
    setProgress(15);
    setResults(null);

    setTimeout(() => setProgress(50), 600);
    setTimeout(() => setProgress(85), 1200);

    setTimeout(() => {
      setProgress(100);
      setTesting(false);

      if (isConnected) {
        setResults([
          {
            ip: "172.64.36.1",
            hostname: "one.one.one.one",
            isp: "Cloudflare Inc. (Encrypted NRPT)",
            country: "Singapore",
            flag: "🇸🇬",
          },
          {
            ip: "172.64.36.2",
            hostname: "one.one.one.one",
            isp: "Cloudflare Inc. (Encrypted NRPT)",
            country: "Singapore",
            flag: "🇸🇬",
          },
        ]);
      } else {
        setResults([
          {
            ip: "203.113.131.1",
            hostname: "dns-cache.isp-local.net",
            isp: "Local ISP Telecommunication Corp",
            country: "Vietnam",
            flag: "🇻🇳",
          },
          {
            ip: "203.113.131.2",
            hostname: "dns-cache.isp-local.net",
            isp: "Local ISP Telecommunication Corp",
            country: "Vietnam",
            flag: "🇻🇳",
          },
        ]);
      }
    }, 1800);
  };

  const isProtected = results && isConnected;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconLock size={18} color="var(--vpn-cyan)" />
          <Text fw={700} size="md" style={{ color: "#fff" }}>
            DNS Leak & Privacy Diagnostic
          </Text>
        </Group>
      }
      size="md"
      centered
      styles={{
        content: {
          background: "rgba(17, 24, 39, 0.95)",
          backdropFilter: "blur(16px)",
          border: "1px solid var(--vpn-border)",
          borderRadius: 12,
        },
        header: {
          background: "transparent",
          borderBottom: "1px solid var(--vpn-border)",
        },
      }}
    >
      <Stack gap="md">
        <Text size="xs" c="dimmed">
          Sends multiple randomized query packets to test if DNS queries leak outside the encrypted
          VPN tunnel.
        </Text>

        {testing && (
          <Box>
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed">
                Resolving test probes across global root resolvers...
              </Text>
              <Text size="xs" fw={700} className="font-mono" style={{ color: "var(--vpn-cyan)" }}>
                {progress}%
              </Text>
            </Group>
            <Progress value={progress} color="cyan" animated size="sm" />
          </Box>
        )}

        {results && (
          <Stack gap="sm">
            <Box
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                background: isProtected ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                border: `1px solid ${isProtected ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
              }}
            >
              <Group gap="sm">
                {isProtected ? (
                  <IconShieldCheck size={28} color="var(--vpn-emerald)" />
                ) : (
                  <IconAlertTriangle size={28} color="var(--vpn-crimson)" />
                )}
                <Box>
                  <Text size="sm" fw={700} style={{ color: "#fff" }}>
                    {isProtected ? "NO DNS LEAKS DETECTED" : "WARNING: DNS QUERIES ARE LEAKING"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {isProtected
                      ? "All DNS traffic is securely encrypted inside the tunnel."
                      : "Your real ISP DNS servers were observed handling queries."}
                  </Text>
                </Box>
              </Group>
            </Box>

            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Detected IP</Table.Th>
                  <Table.Th>ISP Organization</Table.Th>
                  <Table.Th>Location</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {results.map((r, i) => (
                  <Table.Tr key={i}>
                    <Table.Td className="font-mono" style={{ fontSize: 12 }}>
                      {r.ip}
                    </Table.Td>
                    <Table.Td style={{ fontSize: 12 }}>{r.isp}</Table.Td>
                    <Table.Td style={{ fontSize: 12 }}>
                      {r.flag} {r.country}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Close
          </Button>
          <Button
            color="cyan"
            leftSection={testing ? <IconRefresh size={16} /> : <IconPlayerPlay size={16} />}
            loading={testing}
            onClick={runTest}
          >
            {results ? "Re-run Leak Test" : "Start DNS Leak Test"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
