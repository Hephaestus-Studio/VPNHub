import { Modal, Stack, Text, Box, Group, Button, Badge } from "@mantine/core";
import { IconQrcode, IconCopy } from "@tabler/icons-react";
import { VpnProfile } from "../../types/vpn";
import { useTranslation } from "../../i18n";
import styles from "./QrCodeModal.module.css";

interface QrCodeModalProps {
  opened: boolean;
  onClose: () => void;
  profile: VpnProfile | null;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({ opened, onClose, profile }) => {
  const { t } = useTranslation();
  if (!profile) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconQrcode size={18} color="var(--vpn-cyan)" />
          <Text fw={700} size="md" className={styles.modalTitle}>
            {t.modals.qrTitle}
          </Text>
        </Group>
      }
      size="sm"
      centered
      classNames={{
        content: styles.modalContent,
        header: styles.modalHeader,
      }}
    >
      <Stack align="center" gap="md" py="sm">
        <Box className={styles.qrContainer}>
          {/* Simulated High-Res QR Matrix */}
          <svg viewBox="0 0 100 100" className={styles.qrSvg}>
            <rect width="100" height="100" fill="#fff" />
            <path d="M10 10 h25 v25 h-25 z M15 15 h15 v15 h-15 z M19 19 h7 v7 h-7 z" fill="#000" />
            <path d="M65 10 h25 v25 h-25 z M70 15 h15 v15 h-15 z M74 19 h7 v7 h-7 z" fill="#000" />
            <path d="M10 65 h25 v25 h-25 z M15 70 h15 v15 h-15 z M19 74 h7 v7 h-7 z" fill="#000" />
            <rect x="42" y="10" width="8" height="8" fill="#000" />
            <rect x="52" y="18" width="6" height="6" fill="#000" />
            <rect x="42" y="30" width="16" height="6" fill="#000" />
            <rect x="10" y="42" width="18" height="6" fill="#000" />
            <rect x="34" y="42" width="8" height="18" fill="#000" />
            <rect x="48" y="45" width="24" height="6" fill="#000" />
            <rect x="78" y="42" width="12" height="12" fill="#000" />
            <rect x="45" y="65" width="12" height="8" fill="#000" />
            <rect x="62" y="65" width="28" height="8" fill="#000" />
            <rect x="45" y="78" width="8" height="12" fill="#000" />
            <rect x="60" y="80" width="14" height="10" fill="#000" />
            <rect x="80" y="78" width="10" height="12" fill="#000" />
          </svg>
        </Box>

        <Box style={{ textAlign: "center" }}>
          <Group justify="center" gap={6}>
            <Text size="md" fw={700} className={styles.profileName}>
              {profile.name}
            </Text>
            <Badge size="xs" color="cyan" variant="light">
              {profile.protocol.toUpperCase()}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            {t.modals.qrSubtitle}
          </Text>
        </Box>

        <Button
          fullWidth
          variant="light"
          color="gray"
          leftSection={<IconCopy size={16} />}
          onClick={() => {
            navigator.clipboard.writeText(
              profile.rawConfig ||
                `vpn://${profile.protocol}/${profile.serverHost}:${profile.serverPort}`
            );
          }}
        >
          {t.modals.qrCopyBase64}
        </Button>
      </Stack>
    </Modal>
  );
};
