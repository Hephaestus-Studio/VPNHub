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
      id: `app-rule-${Date.now()}`,
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
          <Text fw={700} size="md" style={{ color: "#fff" }}>
            Add Application Routing Rule
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
        {/* Quick Pick Running Apps */}
        <Box>
          <Text size="xs" fw={600} c="dimmed" mb={6}>
            DETECTED INSTALLED APPLICATIONS
          </Text>
          <Group gap={6}>
            {COMMON_APPS.map((app) => (
              <UnstyledButton
                key={app.path}
                onClick={() => handleSelectCommon(app)}
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: "rgba(31, 41, 55, 0.5)",
                  border: "1px solid var(--vpn-border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: "#fff",
                }}
              >
                <span>{app.icon}</span>
                <span>{app.name}</span>
              </UnstyledButton>
            ))}
          </Group>
        </Box>

        <TextInput
          label="Application Name"
          placeholder="e.g. Firefox Developer Edition"
          value={appName}
          onChange={(e) => setAppName(e.currentTarget.value)}
        />

        <TextInput
          label="Executable / Binary Path"
          placeholder="/usr/bin/... or C:\Program Files\..."
          value={appPath}
          onChange={(e) => setAppPath(e.currentTarget.value)}
          className="font-mono"
        />

        <Select
          label="Routing Policy"
          value={mode}
          onChange={(val) => setMode(val as SplitTunnelMode)}
          data={[
            { value: "bypass", label: "Bypass VPN (Direct Internet Connection)" },
            { value: "route_vpn", label: "Route via Encrypted VPN Tunnel" },
          ]}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="cyan"
            leftSection={<IconPlus size={16} />}
            onClick={handleAdd}
            disabled={!appName || !appPath}
          >
            Add Rule
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
