import React, { useState, useEffect } from "react";
import {
  Modal,
  Stack,
  Group,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Box,
  Badge,
} from "@mantine/core";
import { IconShieldLock, IconBolt, IconKey } from "@tabler/icons-react";
import { VpnProfile } from "../../types/vpn";
import styles from "./ConnectMfaModal.module.css";

interface ConnectMfaModalProps {
  opened: boolean;
  onClose: () => void;
  profile: VpnProfile | null;
  onConfirm: (dynamicPassword: string) => void;
}

export const ConnectMfaModal: React.FC<ConnectMfaModalProps> = ({
  opened,
  onClose,
  profile,
  onConfirm,
}) => {
  const [basePassword, setBasePassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (opened) {
      setBasePassword(profile?.credentials?.password || "");
      setTotpCode("");
      setIsSubmitting(false);
    }
  }, [opened, profile]);

  if (!profile) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);

    const format = profile.credentials?.totpFormat || "append";
    let combined = "";

    if (format === "append") {
      combined = `${basePassword}${totpCode.trim()}`;
    } else if (format === "prefix") {
      combined = `${totpCode.trim()}${basePassword}`;
    } else {
      combined = totpCode.trim() || basePassword;
    }

    onConfirm(combined);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconShieldLock size={20} color="var(--vpn-amber)" />
          <Text fw={700} size="md" className={styles.modalTitle}>
            2FA / Dynamic Authentication Required
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
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Box className={styles.profileBox}>
            <Group justify="space-between">
              <Group gap="xs">
                <Text size="lg">{profile.serverFlag}</Text>
                <Box>
                  <Text size="sm" fw={600} className={styles.profileName}>
                    {profile.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {profile.serverHost}:{profile.serverPort}
                  </Text>
                </Box>
              </Group>
              <Badge size="xs" color="yellow" variant="light">
                MFA / 2FA
              </Badge>
            </Group>
          </Box>

          <TextInput
            label="Username"
            value={profile.credentials?.username || "user"}
            disabled
            className="font-mono"
          />

          <PasswordInput
            label="Base Password"
            placeholder="Enter base account password"
            value={basePassword}
            onChange={(e) => setBasePassword(e.currentTarget.value)}
            leftSection={<IconKey size={16} />}
          />

          <TextInput
            label="TOTP / 2FA One-Time Code"
            placeholder="e.g. 6-digit code (123456)"
            value={totpCode}
            onChange={(e) => setTotpCode(e.currentTarget.value)}
            autoFocus
            required
            className="font-mono"
            description="Enter the dynamic code from your Authenticator app (Google Authenticator, YubiKey, etc.)"
            classNames={{
              input: styles.totpInput,
            }}
          />

          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="cyan"
              leftSection={<IconBolt size={16} />}
              loading={isSubmitting}
            >
              Authenticate & Connect
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};
