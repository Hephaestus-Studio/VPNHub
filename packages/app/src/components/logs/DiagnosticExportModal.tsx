import React, { useState } from "react";
import { Modal, Stack, Text, Group, Button, Box, Checkbox, Progress } from "@mantine/core";
import { IconFileZip, IconDownload } from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import { useTranslation } from "../../i18n";
import styles from "./DiagnosticExportModal.module.css";

interface DiagnosticExportModalProps {
  opened: boolean;
  onClose: () => void;
}

export const DiagnosticExportModal: React.FC<DiagnosticExportModalProps> = ({
  opened,
  onClose,
}) => {
  const { logs } = useVpnStore();
  const { t } = useTranslation();
  const [includeLogs, setIncludeLogs] = useState(true);
  const [includeRoutes, setIncludeRoutes] = useState(true);
  const [includeDns, setIncludeDns] = useState(true);
  const [sanitizeIps, setSanitizeIps] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);

      // Trigger download
      const bundleData = {
        exportedAt: new Date().toISOString(),
        vpnhubVersion: "0.1.0",
        platform: "Linux x86_64 (Kernel 6.8.0)",
        sanitized: sanitizeIps,
        logs: includeLogs ? logs.slice(-200) : [],
        routeTable: includeRoutes
          ? [
              "default via 10.8.0.1 dev wg0 proto static metric 50",
              "103.21.244.18 via 192.168.1.1 dev eno1 proto static metric 100",
              "192.168.1.0/24 dev eno1 proto kernel scope link src 192.168.1.105",
            ]
          : [],
        dnsConfig: includeDns
          ? { nameservers: ["1.1.1.1", "1.0.0.1"], resolvedDomain: "vpnhub.internal" }
          : {},
      };

      const blob = new Blob([JSON.stringify(bundleData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vpnhub-diagnostic-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, 1200);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconFileZip size={18} color="var(--vpn-cyan)" />
          <Text fw={700} size="md" className={styles.modalTitle}>
            {t.modals.exportDiagTitle}
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
          {t.modals.exportDiagSubtitle}
        </Text>

        <Box className={styles.checkboxContainer}>
          <Stack gap="xs">
            <Checkbox
              label={t.modals.exportIncludeLogs}
              checked={includeLogs}
              onChange={(e) => setIncludeLogs(e.currentTarget.checked)}
              color="cyan"
            />
            <Checkbox
              label={t.modals.exportIncludeRoutes}
              checked={includeRoutes}
              onChange={(e) => setIncludeRoutes(e.currentTarget.checked)}
              color="cyan"
            />
            <Checkbox
              label={t.modals.exportIncludeDns}
              checked={includeDns}
              onChange={(e) => setIncludeDns(e.currentTarget.checked)}
              color="cyan"
            />
            <Checkbox
              label={t.modals.exportSanitizePrivate}
              checked={sanitizeIps}
              onChange={(e) => setSanitizeIps(e.currentTarget.checked)}
              color="teal"
            />
          </Stack>
        </Box>

        {exporting && (
          <Box>
            <Text size="xs" c="dimmed" mb={4}>
              {t.modals.exportCompiling}
            </Text>
            <Progress value={75} animated color="cyan" size="sm" />
          </Box>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" color="gray" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            color="cyan"
            leftSection={<IconDownload size={16} />}
            loading={exporting}
            onClick={handleExport}
          >
            {t.modals.exportDownloadJson}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
