import { Box, Group, Text, Badge, Button, Table, SimpleGrid } from "@mantine/core";
import { IconCheck, IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import styles from "./DiagnosticsView.module.css";

export const DiagnosticsView: React.FC = () => {
  const { diagnostics, daemonVersion, daemonLatencyMs } = useVpnStore();

  return (
    <Box className={styles.root}>
      <Group justify="space-between" align="center">
        <Box>
          <Text size="xl" fw={700} className={styles.title}>
            System Diagnostics & Daemon Health
          </Text>
          <Text size="xs" c="dimmed">
            Kernel device status, IPC socket latency, routing checks, and security subsystem
            integrity
          </Text>
        </Box>

        <Button size="xs" color="cyan" leftSection={<IconRefresh size={14} />}>
          Run Full Self-Check
        </Button>
      </Group>

      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Box className={`glass-panel ${styles.summaryCard}`}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={600} className={styles.summaryHeader}>
              Daemon Health
            </Text>
            <Badge size="xs" color="teal" variant="dot">
              Online
            </Badge>
          </Group>
          <Text size="lg" fw={700} className={styles.daemonValue}>
            Active ({daemonVersion})
          </Text>
          <Text size="11px" c="dimmed" mt={2}>
            IPC Round-trip: {daemonLatencyMs}ms
          </Text>
        </Box>

        <Box className={`glass-panel ${styles.summaryCard}`}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={600} className={styles.summaryHeader}>
              Kernel Driver
            </Text>
            <Badge size="xs" color="teal" variant="light">
              WireGuard / TUN
            </Badge>
          </Group>
          <Text size="lg" fw={700} className={styles.kernelValue}>
            In-Tree Kernel Module
          </Text>
          <Text size="11px" c="dimmed" mt={2}>
            MTU: 1420 bytes • Offload: Active
          </Text>
        </Box>

        <Box className={`glass-panel ${styles.summaryCard}`}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={600} className={styles.summaryHeader}>
              Firewall Subsystem
            </Text>
            <Badge size="xs" color="teal" variant="light">
              nftables
            </Badge>
          </Group>
          <Text size="lg" fw={700} className={styles.firewallValue}>
            Fail-Closed Ready
          </Text>
          <Text size="11px" c="dimmed" mt={2}>
            Policy: Drop unrouted UDP/TCP
          </Text>
        </Box>
      </SimpleGrid>

      {/* Diagnostics Table */}
      <Box className={`glass-panel ${styles.tablePanel}`}>
        <Table verticalSpacing="sm">
          <Table.Thead className={styles.tableHeader}>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}></Table.Th>
              <Table.Th>Diagnostic Component</Table.Th>
              <Table.Th>Details & Verification</Table.Th>
              <Table.Th style={{ textAlign: "right" }}>Status Value</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {diagnostics.map((d, i) => (
              <Table.Tr key={i}>
                <Table.Td>
                  {d.status === "ok" ? (
                    <IconCheck size={16} color="var(--vpn-emerald)" />
                  ) : (
                    <IconAlertTriangle size={16} color="var(--vpn-amber)" />
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={600} className={styles.diagName}>
                    {d.name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {d.details}
                  </Text>
                </Table.Td>
                <Table.Td style={{ textAlign: "right" }}>
                  <Badge size="xs" color={d.status === "ok" ? "teal" : "yellow"} variant="light">
                    {d.value}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
    </Box>
  );
};
