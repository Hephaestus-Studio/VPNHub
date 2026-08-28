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
import { useTranslation } from "../../i18n";
import styles from "./DnsLeakTestModal.module.css";

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
  const { t } = useTranslation();
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
          <Text fw={700} size="md" className={styles.modalTitle}>
            {t.modals.dnsLeakTitle}
          </Text>
        </Group>
      }
      size="md"
      centered
      classNames={{
        content: styles.modalContent,
        header: styles.modalHeader,
      }}
    >
      <Stack gap="md">
        <Text size="xs" c="dimmed">
          {t.modals.dnsLeakDesc}
        </Text>

        {testing && (
          <Box>
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed">
                {t.modals.dnsLeakTesting}
              </Text>
              <Text size="xs" fw={700} className={`font-mono ${styles.progressText}`}>
                {progress}%
              </Text>
            </Group>
            <Progress value={progress} color="cyan" animated size="sm" />
          </Box>
        )}

        {results && (
          <Stack gap="sm">
            <Box className={isProtected ? styles.resultBoxProtected : styles.resultBoxLeaking}>
              <Group gap="sm">
                {isProtected ? (
                  <IconShieldCheck size={28} color="var(--vpn-emerald)" />
                ) : (
                  <IconAlertTriangle size={28} color="var(--vpn-crimson)" />
                )}
                <Box>
                  <Text size="sm" fw={700} className={styles.resultTitle}>
                    {isProtected ? t.modals.dnsLeakPassed : t.modals.dnsLeakFailed}
                  </Text>
                </Box>
              </Group>
            </Box>

            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t.modals.dnsPublicIp}</Table.Th>
                  <Table.Th>ISP</Table.Th>
                  <Table.Th>Location</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {results.map((r, i) => (
                  <Table.Tr key={i}>
                    <Table.Td className={`font-mono ${styles.tableCell}`}>{r.ip}</Table.Td>
                    <Table.Td className={styles.tableCell}>{r.isp}</Table.Td>
                    <Table.Td className={styles.tableCell}>
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
            {t.common.close}
          </Button>
          <Button
            color="cyan"
            leftSection={testing ? <IconRefresh size={16} /> : <IconPlayerPlay size={16} />}
            loading={testing}
            onClick={runTest}
          >
            {results ? t.security.runDnsTest : t.security.runDnsTest}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
