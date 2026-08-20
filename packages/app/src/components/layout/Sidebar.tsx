import { Box, Stack, UnstyledButton, Group, Text, Badge, Tooltip, ActionIcon } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconBolt,
  IconFolder,
  IconShieldLock,
  IconArrowsSplit,
  IconTerminal2,
  IconStethoscope,
  IconSettings,
  IconLifebuoy,
  IconShieldCheck,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from "@tabler/icons-react";
import { useVpnStore, NavigationTab } from "../../state/useVpnStore";
import styles from "./Sidebar.module.css";

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; stroke?: number }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: IconBolt },
  { id: "profiles", label: "Profile Library", icon: IconFolder },
  { id: "security", label: "Security & Shield", icon: IconShieldLock },
  { id: "split-tunneling", label: "Split Tunneling", icon: IconArrowsSplit },
  { id: "logs", label: "Live Console", icon: IconTerminal2 },
  { id: "diagnostics", label: "Diagnostics", icon: IconStethoscope },
  { id: "settings", label: "Settings", icon: IconSettings },
];

interface SidebarProps {
  isCompact?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCompact: propIsCompact, onToggleCollapse }) => {
  const { activeTab, setActiveTab, daemonHealth, daemonVersion, profiles } = useVpnStore();
  const isMediaCompact = useMediaQuery("(max-width: 768px)");
  const isCompact = propIsCompact !== undefined ? propIsCompact : isMediaCompact;

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
              Menu
            </Text>
          )}
          <Tooltip
            label={isCompact ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar (Ctrl+B)"}
            position="right"
            withArrow
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={onToggleCollapse}
              className={styles.collapseButton}
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
                    {item.label}
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
              <Tooltip key={item.id} label={item.label} position="right" withArrow>
                {buttonContent}
              </Tooltip>
            );
          }

          return buttonContent;
        })}
      </Stack>

      {/* Bottom Service Info & Support */}
      <Stack gap={8}>
        {!isCompact ? (
          <Box className={styles.coreCard}>
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <Box className={styles.coreIconBox}>
                  <IconShieldCheck size={14} color="var(--vpn-cyan)" />
                </Box>
                <Box>
                  <Text size="xs" fw={600} className={styles.coreTitle}>
                    VPNHub Core
                  </Text>
                  <Text size="10px" c="dimmed" style={{ lineHeight: 1 }}>
                    Daemon {daemonVersion.startsWith("v") ? daemonVersion : `v${daemonVersion}`}
                  </Text>
                </Box>
              </Group>
              <Badge size="xs" variant="dot" color={daemonHealth === "connected" ? "teal" : "red"}>
                {daemonHealth === "connected" ? "Ready" : "Offline"}
              </Badge>
            </Group>
          </Box>
        ) : (
          <Tooltip
            label={`Daemon ${daemonVersion.startsWith("v") ? daemonVersion : `v${daemonVersion}`} (${daemonHealth})`}
            position="right"
            withArrow
          >
            <Box style={{ display: "flex", justifyContent: "center" }}>
              <IconShieldCheck size={20} color="var(--vpn-cyan)" />
            </Box>
          </Tooltip>
        )}

        <UnstyledButton
          onClick={() => {
            window.open("https://github.com/hephaestus-studio/vpnhub", "_blank");
          }}
          className={isCompact ? styles.supportButtonCompact : styles.supportButton}
        >
          <IconLifebuoy size={16} />
          {!isCompact && (
            <Text size="xs" c="dimmed">
              Support & Docs
            </Text>
          )}
        </UnstyledButton>
      </Stack>
    </Box>
  );
};
