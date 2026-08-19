import { Box, Group, Text, Badge, Button, ActionIcon, Menu, Loader } from "@mantine/core";
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
  IconShieldCheck,
  IconAlertTriangle,
  IconRefresh,
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
  const isConnecting =
    isActive && (connectionState === "connecting" || connectionState === "reconnecting");
  const isDisconnecting = isActive && connectionState === "disconnecting";
  const isError = isActive && connectionState === "error";

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
      id: crypto.randomUUID(),
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

  let cardBg = "rgba(31, 41, 55, 0.5)";
  let cardBorder = "1px solid var(--vpn-border)";
  let cardShadow = "none";

  if (isConnected) {
    cardBg = "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(17, 24, 39, 0.95))";
    cardBorder = "1px solid rgba(16, 185, 129, 0.5)";
    cardShadow = "0 0 20px rgba(16, 185, 129, 0.2)";
  } else if (isConnecting) {
    cardBg = "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(17, 24, 39, 0.95))";
    cardBorder = "1px solid rgba(245, 158, 11, 0.5)";
    cardShadow = "0 0 20px rgba(245, 158, 11, 0.2)";
  } else if (isError) {
    cardBg = "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(17, 24, 39, 0.95))";
    cardBorder = "1px solid rgba(239, 68, 68, 0.5)";
    cardShadow = "0 0 20px rgba(239, 68, 68, 0.2)";
  } else if (isActive) {
    cardBg = "linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(17, 24, 39, 0.95))";
    cardBorder = "1px solid rgba(6, 182, 212, 0.35)";
  }

  const renderStatusBadge = () => {
    if (isConnected) {
      return (
        <Badge
          size="xs"
          color="teal"
          variant="filled"
          leftSection={<IconShieldCheck size={11} />}
          style={{
            background: "linear-gradient(135deg, #10b981, #059669)",
            boxShadow: "0 0 10px rgba(16, 185, 129, 0.4)",
            fontWeight: 700,
          }}
        >
          CONNECTED
        </Badge>
      );
    }
    if (isConnecting) {
      return (
        <Badge
          size="xs"
          color="yellow"
          variant="filled"
          leftSection={<Loader size={10} color="#fff" />}
          style={{
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            boxShadow: "0 0 10px rgba(245, 158, 11, 0.4)",
            fontWeight: 700,
          }}
        >
          CONNECTING...
        </Badge>
      );
    }
    if (isDisconnecting) {
      return (
        <Badge size="xs" color="gray" variant="light">
          TEARING DOWN...
        </Badge>
      );
    }
    if (isError) {
      return (
        <Badge
          size="xs"
          color="red"
          variant="filled"
          leftSection={<IconAlertTriangle size={11} />}
          style={{
            background: "linear-gradient(135deg, #ef4444, #dc2626)",
            boxShadow: "0 0 10px rgba(239, 68, 68, 0.4)",
            fontWeight: 700,
          }}
        >
          FAILED
        </Badge>
      );
    }
    return null;
  };

  const getButtonProps = () => {
    if (isConnected) {
      return {
        children: "Disconnect",
        color: "red",
        variant: "filled" as const,
        loading: false,
        leftSection: <IconPower size={13} />,
      };
    }
    if (isConnecting) {
      return {
        children: "Connecting...",
        color: "yellow",
        variant: "filled" as const,
        loading: true,
        leftSection: <IconPower size={13} />,
      };
    }
    if (isDisconnecting) {
      return {
        children: "Disconnecting...",
        color: "gray",
        variant: "light" as const,
        loading: true,
        leftSection: <IconPower size={13} />,
      };
    }
    if (isError) {
      return {
        children: "Retry",
        color: "red",
        variant: "light" as const,
        loading: false,
        leftSection: <IconRefresh size={13} />,
      };
    }
    return {
      children: "Connect",
      color: isActive ? "cyan" : "gray",
      variant: isActive ? ("filled" as const) : ("light" as const),
      loading: false,
      leftSection: <IconPower size={13} />,
    };
  };

  const locationSubtitle =
    [profile.serverCity, profile.serverCountry].filter(Boolean).join(", ") || "Remote Gateway";

  const buttonProps = getButtonProps();

  return (
    <Box
      className="glass-card"
      style={{
        padding: "16px",
        borderRadius: 10,
        background: cardBg,
        border: cardBorder,
        boxShadow: cardShadow,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 180,
        transition: "all 0.25s ease-in-out",
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
                {locationSubtitle}
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

        {/* Server & Tags & Status */}
        <Group gap="xs" mb="xs" wrap="wrap">
          <Badge
            size="xs"
            variant="outline"
            color="cyan"
            style={{ fontFamily: "JetBrains Mono", fontSize: 9 }}
          >
            {profile.protocol.toUpperCase()}
          </Badge>

          {renderStatusBadge()}

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
          variant={buttonProps.variant}
          color={buttonProps.color}
          leftSection={buttonProps.leftSection}
          onClick={handleConnectClick}
          loading={buttonProps.loading}
          style={{ fontWeight: 600 }}
        >
          {buttonProps.children}
        </Button>
      </Box>
    </Box>
  );
};
