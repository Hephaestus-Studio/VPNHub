import { Box, Group, Text, Badge, Button, ActionIcon, Menu, Loader } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconStar,
  IconStarFilled,
  IconDotsVertical,
  IconBolt,
  IconEdit,
  IconTrash,
  IconPower,
  IconShieldCheck,
  IconAlertTriangle,
  IconRefresh,
} from "@tabler/icons-react";
import { VpnProfile } from "../../types/vpn";
import { useVpnStore } from "../../state/useVpnStore";
import { useTranslation } from "../../i18n";
import styles from "./ProfileCard.module.css";

interface ProfileCardProps {
  profile: VpnProfile;
  onEdit: (profile: VpnProfile) => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ profile, onEdit }) => {
  const { activeProfileId, connectionState, connect, disconnect, toggleFavorite, deleteProfile } =
    useVpnStore();
  const { t } = useTranslation();

  const isMobile = useMediaQuery("(max-width: 640px)");

  const isActive = profile.id === activeProfileId;
  const isConnected = isActive && connectionState === "connected";
  const isConnecting =
    isActive && (connectionState === "connecting" || connectionState === "reconnecting");
  const isDisconnecting = isActive && connectionState === "disconnecting";
  const isError = isActive && connectionState === "error";

  const handleConnectClick = () => {
    if (isConnected || isConnecting) {
      disconnect();
    } else {
      connect(profile.id);
    }
  };

  let cardClass = styles.card;
  if (isConnected) {
    cardClass = styles.cardConnected;
  } else if (isConnecting) {
    cardClass = styles.cardConnecting;
  } else if (isError) {
    cardClass = styles.cardError;
  } else if (isActive) {
    cardClass = styles.cardActive;
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
          {t.common.connected.toUpperCase()}
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
          {t.common.connecting.toUpperCase()}...
        </Badge>
      );
    }
    if (isDisconnecting) {
      return (
        <Badge size="xs" color="gray" variant="light">
          {t.common.disconnecting.toUpperCase()}...
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
          {t.common.error.toUpperCase()}
        </Badge>
      );
    }
    return null;
  };

  const getButtonProps = () => {
    if (isConnected) {
      return {
        children: t.profiles.disconnect,
        color: "red",
        variant: "filled" as const,
        loading: false,
        leftSection: <IconPower size={13} />,
      };
    }
    if (isConnecting) {
      return {
        children: t.common.cancel,
        color: "yellow",
        variant: "filled" as const,
        loading: false,
        leftSection: <IconPower size={13} />,
      };
    }
    if (isDisconnecting) {
      return {
        children: `${t.common.disconnecting}...`,
        color: "gray",
        variant: "light" as const,
        loading: true,
        leftSection: <IconPower size={13} />,
      };
    }
    if (isError) {
      return {
        children: t.common.reset,
        color: "red",
        variant: "light" as const,
        loading: false,
        leftSection: <IconRefresh size={13} />,
      };
    }
    return {
      children: t.profiles.connect,
      color: isActive ? "cyan" : "gray",
      variant: isActive ? ("filled" as const) : ("light" as const),
      loading: false,
      leftSection: <IconPower size={13} />,
    };
  };

  const locationSubtitle =
    [profile.serverCity, profile.serverCountry].filter(Boolean).join(", ") || "Remote Gateway";

  const buttonProps = getButtonProps();

  const pingColor =
    profile.pingMs > 0 && profile.pingMs <= 50
      ? "#34d399"
      : profile.pingMs <= 100
        ? "#fbbf24"
        : "#f97316";

  return (
    <Box className={`glass-card ${cardClass}`}>
      {/* Header */}
      <Box>
        <Group justify="space-between" align="flex-start" mb="xs">
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
            <Text size={isMobile ? "22px" : "26px"} style={{ flexShrink: 0 }}>
              {profile.serverFlag}
            </Text>
            <Box style={{ minWidth: 0, flex: 1 }}>
              <Text size="sm" fw={700} className={styles.title} truncate>
                {profile.name}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {locationSubtitle}
              </Text>
            </Box>
          </Group>

          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
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

              <Menu.Dropdown className={styles.menuDropdown}>
                <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => onEdit(profile)}>
                  {t.common.edit}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => deleteProfile(profile.id)}
                >
                  {t.common.delete}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {/* Server & Status */}
        <Group gap="xs" mb="xs" wrap="wrap">
          <Badge size="xs" variant="outline" color="cyan" className={styles.protocolBadge}>
            {profile.protocol.toUpperCase()}
          </Badge>

          {renderStatusBadge()}
        </Group>

        <Text size="11px" c="dimmed" className="font-mono" mb="xs" truncate>
          Endpoint: {profile.serverHost}:{profile.serverPort}
        </Text>
      </Box>

      {/* Footer */}
      <Box className={styles.footer}>
        <Group gap={4}>
          <IconBolt size={14} color={pingColor} />
          <Text
            size="xs"
            fw={700}
            className={`font-mono ${styles.pingText}`}
            style={{ color: pingColor }}
          >
            {profile.pingMs} ms
          </Text>
        </Group>

        <Button
          size={isMobile ? "sm" : "xs"}
          variant={buttonProps.variant}
          color={buttonProps.color}
          leftSection={buttonProps.leftSection}
          onClick={handleConnectClick}
          loading={buttonProps.loading}
          className={styles.actionButton}
        >
          {buttonProps.children}
        </Button>
      </Box>
    </Box>
  );
};
