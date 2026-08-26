import React from "react";
import { Box, UnstyledButton, Text, Tooltip } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconBolt,
  IconFolder,
  IconShieldLock,
  IconTerminal2,
  IconSettings,
} from "@tabler/icons-react";
import { useVpnStore, NavigationTab } from "../../state/useVpnStore";
import styles from "./MobileBottomNavBar.module.css";

interface MobileNavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; stroke?: number }>;
}

const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: IconBolt },
  { id: "profiles", label: "Profiles", icon: IconFolder },
  { id: "security", label: "Security", icon: IconShieldLock },
  { id: "logs", label: "Logs", icon: IconTerminal2 },
  { id: "settings", label: "Settings", icon: IconSettings },
];

export const MobileBottomNavBar: React.FC = () => {
  const { activeTab, setActiveTab } = useVpnStore();
  const isMobile = useMediaQuery("(max-width: 640px)");

  if (!isMobile) return null;

  return (
    <Box className={styles.root}>
      {MOBILE_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <Tooltip key={item.id} label={item.label} position="top" withArrow>
            <UnstyledButton
              onClick={() => setActiveTab(item.id)}
              className={isActive ? styles.navButtonActive : styles.navButton}
            >
              <Icon
                size={20}
                stroke={isActive ? 2.3 : 1.7}
                color={isActive ? "var(--vpn-cyan)" : "var(--vpn-text-secondary)"}
              />
              <Text className={isActive ? styles.navTextActive : styles.navText}>{item.label}</Text>
            </UnstyledButton>
          </Tooltip>
        );
      })}
    </Box>
  );
};
