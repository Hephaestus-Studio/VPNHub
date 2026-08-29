import { Box, Stack, UnstyledButton, Group, Text, Badge, Tooltip, ActionIcon } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconBolt,
  IconFolder,
  IconShieldLock,
  IconTerminal2,
  IconSettings,
  IconShieldCheck,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from "@tabler/icons-react";
import { useVpnStore, NavigationTab } from "../../state/useVpnStore";
import { useTranslation } from "../../i18n";
import styles from "./Sidebar.module.css";

interface NavItemDef {
  id: NavigationTab;
  icon: React.ComponentType<{ size?: number; color?: string; stroke?: number }>;
  badge?: string;
}

const NAV_ITEMS: NavItemDef[] = [
  { id: "dashboard", icon: IconBolt },
  { id: "profiles", icon: IconFolder },
  { id: "security", icon: IconShieldLock },
  { id: "logs", icon: IconTerminal2 },
  { id: "settings", icon: IconSettings },
];

interface SidebarProps {
  isCompact?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCompact: propIsCompact, onToggleCollapse }) => {
  const { activeTab, setActiveTab, daemonHealth, daemonVersion, profiles } = useVpnStore();
  const { t } = useTranslation();
  const isMediaCompact = useMediaQuery("(max-width: 768px)");
  const isCompact = propIsCompact !== undefined ? propIsCompact : isMediaCompact;

  const getNavLabel = (id: NavigationTab): string => {
    switch (id) {
      case "dashboard":
        return t.nav.dashboard;
      case "profiles":
        return t.nav.profiles;
      case "security":
        return t.nav.security;
      case "logs":
        return t.nav.logs;
      case "settings":
        return t.nav.settings;
      default:
        return id;
    }
  };

  return (
    <Box className={isCompact ? styles.rootCompact : styles.root}>
      {/* Top Section: Toggle Button & Navigation List */}
      <Stack gap={3}>
        <Group
          justify={isCompact ? "center" : "space-between"}
          align="center"
          mb={4}
          pb={4}
          className={styles.headerGroup}
        >
          {!isCompact && (
            <Text size="sm" fw={700} className={styles.headerTitle}>
              {t.nav.menu}
            </Text>
          )}
          <Tooltip
            label={isCompact ? t.nav.expandSidebar : t.nav.collapseSidebar}
            position="right"
            withArrow
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={onToggleCollapse}
              className={isCompact ? styles.collapseButtonCompact : styles.collapseButton}
            >
              {isCompact ? (
                <IconLayoutSidebarLeftExpand size={16} />
              ) : (
                <IconLayoutSidebarLeftCollapse size={15} />
              )}
            </ActionIcon>
          </Tooltip>
        </Group>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const badgeText =
            item.id === "profiles"
              ? profiles.length > 0
                ? String(profiles.length)
                : undefined
              : item.badge;

          let btnClass = styles.navButton;
          if (isCompact) {
            btnClass = isActive ? styles.navButtonCompactActive : styles.navButtonCompact;
          } else if (isActive) {
            btnClass = styles.navButtonActive;
          }

          const buttonContent = (
            <UnstyledButton
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={btnClass}
            >
              <Group gap="xs" justify={isCompact ? "center" : "flex-start"}>
                <Icon
                  size={isCompact ? 19 : 17}
                  color={isActive ? "var(--vpn-cyan)" : "var(--vpn-text-secondary)"}
                  stroke={isActive ? 2.2 : 1.8}
                />
                {!isCompact && (
                  <Text size="sm" className={isActive ? styles.navLabelActive : styles.navLabel}>
                    {getNavLabel(item.id)}
                  </Text>
                )}
              </Group>

              {!isCompact && badgeText && (
                <Badge
                  size="xs"
                  variant={isActive ? "filled" : "outline"}
                  color={isActive ? "cyan" : "gray"}
                  className={styles.badge}
                >
                  {badgeText}
                </Badge>
              )}
            </UnstyledButton>
          );

          if (isCompact) {
            return (
              <Tooltip key={item.id} label={getNavLabel(item.id)} position="right" withArrow>
                {buttonContent}
              </Tooltip>
            );
          }

          return buttonContent;
        })}
      </Stack>

      {/* Bottom Service Info */}
      <Box>
        {!isCompact ? (
          <Box className={styles.coreCard}>
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <Box className={styles.coreIconBox}>
                  <IconShieldCheck size={14} color="var(--vpn-cyan)" />
                </Box>
                <Box>
                  <Text size="xs" fw={600} className={styles.coreTitle}>
                    {t.nav.coreTitle}
                  </Text>
                  <Text size="10px" c="dimmed" style={{ lineHeight: 1 }}>
                    {t.nav.daemonStatus}{" "}
                    {daemonVersion.startsWith("v") ? daemonVersion : `v${daemonVersion}`}
                  </Text>
                </Box>
              </Group>
              <Badge size="xs" variant="dot" color={daemonHealth === "connected" ? "teal" : "red"}>
                {daemonHealth === "connected" ? t.common.ready : t.common.offline}
              </Badge>
            </Group>
          </Box>
        ) : (
          <Tooltip
            label={`${t.nav.daemonStatus} ${daemonVersion.startsWith("v") ? daemonVersion : `v${daemonVersion}`} (${daemonHealth === "connected" ? t.common.ready : t.common.offline})`}
            position="right"
            withArrow
          >
            <Box style={{ display: "flex", justifyContent: "center" }}>
              <IconShieldCheck size={20} color="var(--vpn-cyan)" />
            </Box>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};
