import React, { useState } from "react";
import {
  Modal,
  Stack,
  TextInput,
  Select,
  Group,
  Button,
  Text,
  UnstyledButton,
  Box,
} from "@mantine/core";
import { IconApps, IconPlus } from "@tabler/icons-react";
import { AppRule, SplitTunnelMode } from "../../types/vpn";
import { useVpnStore } from "../../state/useVpnStore";
import { useTranslation } from "../../i18n";
import styles from "./AddAppRuleModal.module.css";

interface AddAppRuleModalProps {
  opened: boolean;
  onClose: () => void;
}

const COMMON_APPS = [
  { name: "Google Chrome", path: "/usr/bin/google-chrome-stable", icon: "🌐" },
  { name: "Discord Client", path: "/usr/bin/discord", icon: "💬" },
  { name: "Visual Studio Code", path: "/usr/bin/code", icon: "💻" },
  { name: "Spotify Music", path: "/usr/bin/spotify", icon: "🎵" },
  { name: "Postman API Tool", path: "/usr/bin/postman", icon: "🚀" },
  { name: "Telegram Messenger", path: "/usr/bin/telegram-desktop", icon: "✈️" },
];

export const AddAppRuleModal: React.FC<AddAppRuleModalProps> = ({ opened, onClose }) => {
  const { t } = useTranslation();
  const { addAppRule } = useVpnStore();
  const [appName, setAppName] = useState("");
  const [appPath, setAppPath] = useState("");
  const [appIcon, setAppIcon] = useState("📦");
  const [mode, setMode] = useState<SplitTunnelMode>("bypass");

  const handleSelectCommon = (app: { name: string; path: string; icon: string }) => {
    setAppName(app.name);
    setAppPath(app.path);
    setAppIcon(app.icon);
  };

  const handleAdd = () => {
    if (!appName || !appPath) return;

    const newRule: AppRule = {
      id: crypto.randomUUID(),
      name: appName,
      path: appPath,
      icon: appIcon,
      mode,
      enabled: true,
    };

    addAppRule(newRule);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconApps size={18} color="var(--vpn-cyan)" />
          <Text fw={700} size="md" className={styles.modalTitle}>
            {t.modals.addAppTitle}
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
        {/* Quick Pick Running Apps */}
        <Box>
          <Text size="xs" fw={600} c="dimmed" mb={6}>
            {t.modals.addAppDetected}
          </Text>
          <Group gap={6}>
            {COMMON_APPS.map((app) => (
              <UnstyledButton
                key={app.path}
                onClick={() => handleSelectCommon(app)}
                className={styles.appQuickButton}
              >
                <span>{app.icon}</span>
                <span>{app.name}</span>
              </UnstyledButton>
            ))}
          </Group>
        </Box>

        <TextInput
          label={t.modals.addAppNameLabel}
          placeholder={t.modals.addAppNamePlaceholder}
          value={appName}
          onChange={(e) => setAppName(e.currentTarget.value)}
        />

        <TextInput
          label={t.modals.addAppPathLabel}
          placeholder={t.modals.addAppPathPlaceholder}
          value={appPath}
          onChange={(e) => setAppPath(e.currentTarget.value)}
          className="font-mono"
        />

        <Select
          label={t.modals.addAppPolicyLabel}
          value={mode}
          onChange={(val) => setMode(val as SplitTunnelMode)}
          data={[
            { value: "bypass", label: t.modals.addAppBypassLabel },
            { value: "route_vpn", label: t.modals.addAppRouteLabel },
          ]}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" color="gray" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            color="cyan"
            leftSection={<IconPlus size={16} />}
            onClick={handleAdd}
            disabled={!appName || !appPath}
          >
            {t.modals.addAppSubmitBtn}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
