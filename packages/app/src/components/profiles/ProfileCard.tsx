import { Box, Group, Text, Badge, Button, ActionIcon, Menu } from "@mantine/core";
import {
  IconStar,
  IconStarFilled,
  IconDotsVertical,
  IconBolt,
  IconEdit,
  IconQrcode,
  IconDownload,
  IconCopy,
  IconTrash,
  IconPower,
} from "@tabler/icons-react";
import { VpnProfile } from "../../types/vpn";
import { useVpnStore } from "../../state/useVpnStore";

interface ProfileCardProps {
  profile: VpnProfile;
  onEdit: (profile: VpnProfile) => void;
  onViewQr: (profile: VpnProfile) => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ profile, onEdit, onViewQr }) => {
  const {
    activeProfileId,
    connectionState,
    connect,
    disconnect,
    toggleFavorite,
    deleteProfile,
    addProfile,
  } = useVpnStore();

  const isActive = profile.id === activeProfileId;
  const isConnected = isActive && connectionState === "connected";
  const isConnecting = isActive && connectionState === "connecting";

  const handleConnectClick = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect(profile.id);
    }
  };

  const handleDuplicate = () => {
    const duplicated: VpnProfile = {
      ...profile,
      id: `prof-${Date.now()}`,
      name: `${profile.name} (Copy)`,
      isFavorite: false,
    };
    addProfile(duplicated);
  };

  const handleExport = () => {
    const element = document.createElement("a");
    const file = new Blob(
      [
        profile.rawConfig ||
          `# VPNHub Config for ${profile.name}\nendpoint = ${profile.serverHost}:${profile.serverPort}`,
      ],
      {
        type: "text/plain",
      }
    );
    element.href = URL.createObjectURL(file);
    element.download = `${profile.id}.${profile.protocol === "wireguard" ? "conf" : "ovpn"}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <Box
      className="glass-card"
      style={{
        padding: "16px",
        borderRadius: 10,
        background: isActive
          ? "linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(17, 24, 39, 0.95))"
          : "rgba(31, 41, 55, 0.5)",
        border: isActive ? "1px solid rgba(6, 182, 212, 0.4)" : "1px solid var(--vpn-border)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 180,
      }}
    >
      {/* Header */}
      <Box>
        <Group justify="space-between" align="flex-start" mb="xs">
          <Group gap="xs">
            <Text size="24px">{profile.serverFlag}</Text>
            <Box>
              <Text size="sm" fw={700} style={{ color: "#fff" }}>
                {profile.name}
              </Text>
              <Text size="xs" c="dimmed">
                {profile.serverCity}, {profile.serverCountry}
              </Text>
            </Box>
          </Group>

          <Group gap={4}>
            <ActionIcon variant="subtle" size="sm" onClick={() => toggleFavorite(profile.id)}>
              {profile.isFavorite ? (
                <IconStarFilled size={16} color="#f59e0b" />
              ) : (
                <IconStar size={16} color="var(--vpn-text-muted)" />
              )}
            </ActionIcon>

            <Menu position="bottom-end" shadow="md" width={180}>
              <Menu.Target>
                <ActionIcon variant="subtle" size="sm" color="gray">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown
                style={{
                  background: "rgba(17, 24, 39, 0.95)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid var(--vpn-border)",
                }}
              >
                <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => onEdit(profile)}>
                  Edit Configuration
                </Menu.Item>
                <Menu.Item leftSection={<IconQrcode size={14} />} onClick={() => onViewQr(profile)}>
                  View QR Code
                </Menu.Item>
                <Menu.Item leftSection={<IconDownload size={14} />} onClick={handleExport}>
                  Export Config File
                </Menu.Item>
                <Menu.Item leftSection={<IconCopy size={14} />} onClick={handleDuplicate}>
                  Duplicate Profile
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => deleteProfile(profile.id)}
                >
                  Delete Profile
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {/* Server & Tags */}
        <Group gap="xs" mb="xs">
          <Badge
            size="xs"
            variant="outline"
            color="cyan"
            style={{ fontFamily: "JetBrains Mono", fontSize: 9 }}
          >
            {profile.protocol.toUpperCase()}
          </Badge>

          {profile.tags.map((t) => (
            <Badge key={t} size="xs" variant="light" color="gray" style={{ fontSize: 9 }}>
              {t}
            </Badge>
          ))}
        </Group>

        <Text size="11px" c="dimmed" className="font-mono" mb="xs">
          Endpoint: {profile.serverHost}:{profile.serverPort}
        </Text>
      </Box>

      {/* Footer */}
      <Box
        style={{
          borderTop: "1px solid var(--vpn-border-subtle)",
          paddingTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Group gap={4}>
          <IconBolt size={14} color="var(--vpn-emerald)" />
          <Text size="xs" fw={700} className="font-mono" style={{ color: "#34d399" }}>
            {profile.pingMs} ms
          </Text>
        </Group>

        <Button
          size="xs"
          variant={isConnected ? "filled" : "light"}
          color={isConnected ? "red" : isActive ? "cyan" : "gray"}
          leftSection={<IconPower size={13} />}
          onClick={handleConnectClick}
          loading={isConnecting}
          style={{ fontWeight: 600 }}
        >
          {isConnected ? "Disconnect" : "Connect"}
        </Button>
      </Box>
    </Box>
  );
};
