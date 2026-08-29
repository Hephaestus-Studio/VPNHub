import React from "react";
import { Modal, Stack, Text, Group, Box, Paper, Badge, Tooltip } from "@mantine/core";
import {
  IconBolt,
  IconShieldLock,
  IconFileUpload,
  IconPlus,
  IconChevronRight,
} from "@tabler/icons-react";
import { useTranslation } from "../../i18n";
import styles from "./ProtocolSelectionModal.module.css";

interface ProtocolSelectionModalProps {
  opened: boolean;
  onClose: () => void;
  mode: "create" | "import";
  onSelect: (protocol: "wireguard" | "openvpn") => void;
}

export const ProtocolSelectionModal: React.FC<ProtocolSelectionModalProps> = ({
  opened,
  onClose,
  mode,
  onSelect,
}) => {
  const { t } = useTranslation();
  const isImport = mode === "import";

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          {isImport ? (
            <IconFileUpload size={20} color="var(--vpn-cyan)" />
          ) : (
            <IconPlus size={20} color="var(--vpn-cyan)" />
          )}
          <Text fw={700} size="md" className={styles.modalTitle}>
            {isImport ? t.modals.protoSelectImportTitle : t.modals.protoSelectAddTitle}
          </Text>
        </Group>
      }
      size="md"
      centered
      classNames={{
        content: styles.modalContent,
        header: styles.modalHeader,
        body: styles.modalBody,
      }}
    >
      <Stack gap="md">
        <Text size="xs" c="dimmed">
          {isImport ? t.modals.protoSelectImportDesc : t.modals.protoSelectAddDesc}
        </Text>

        {/* Option 1: WireGuard (Disabled - Coming Soon) */}
        <Tooltip label={t.modals.wireguardComingSoonError} position="top" withArrow>
          <Paper className={styles.wireguardOptionDisabled}>
            <Group justify="space-between" align="center">
              <Group gap="md">
                <Box className={styles.wireguardIconBox}>
                  <IconBolt size={24} color="var(--vpn-cyan)" />
                </Box>
                <Box>
                  <Group gap="xs" align="center" mb={2}>
                    <Text fw={700} size="sm" className={styles.optionTitle}>
                      {t.modals.protoWgTitle}
                    </Text>
                    <Badge size="xs" color="yellow" variant="light">
                      {t.common.comingSoon}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {isImport ? t.modals.protoWgDescImport : t.modals.protoWgDescAdd}
                  </Text>
                </Box>
              </Group>
            </Group>
          </Paper>
        </Tooltip>

        {/* Option 2: OpenVPN */}
        <Paper
          onClick={() => {
            onClose();
            onSelect("openvpn");
          }}
          className={styles.openvpnOption}
        >
          <Group justify="space-between" align="center">
            <Group gap="md">
              <Box className={styles.openvpnIconBox}>
                <IconShieldLock size={24} color="var(--vpn-emerald)" />
              </Box>
              <Box>
                <Group gap="xs" align="center" mb={2}>
                  <Text fw={700} size="sm" className={styles.optionTitle}>
                    {t.modals.protoOvpnTitle}
                  </Text>
                  <Badge size="xs" color="teal" variant="light">
                    {isImport ? t.modals.protoOvpnBadgeImport : t.modals.protoOvpnBadgeAdd}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {isImport ? t.modals.protoOvpnDescImport : t.modals.protoOvpnDescAdd}
                </Text>
              </Box>
            </Group>
            <IconChevronRight size={18} className={styles.chevronIcon} />
          </Group>
        </Paper>
      </Stack>
    </Modal>
  );
};
