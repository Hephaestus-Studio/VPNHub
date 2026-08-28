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
import { useTranslation } from "../../i18n";
import styles from "./MobileBottomNavBar.module.css";

interface MobileNavItemDef {
  id: NavigationTab;
  icon: React.ComponentType<{ size?: number; color?: string; stroke?: number }>;
}

const MOBILE_NAV_ITEMS: MobileNavItemDef[] = [
  { id: "dashboard", icon: IconBolt },
  { id: "profiles", icon: IconFolder },
  { id: "security", icon: IconShieldLock },
  { id: "logs", icon: IconTerminal2 },
  { id: "settings", icon: IconSettings },
];

export const MobileBottomNavBar: React.FC = () => {
  const { activeTab, setActiveTab } = useVpnStore();
  const { t } = useTranslation();
  const isMobile = useMediaQuery("(max-width: 640px)");

  if (!isMobile) return null;

  const getLabel = (id: NavigationTab): string => {
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
    <Box className={styles.root}>
      {MOBILE_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const label = getLabel(item.id);

        return (
          <Tooltip key={item.id} label={label} position="top" withArrow>
            <UnstyledButton
              onClick={() => setActiveTab(item.id)}
              className={isActive ? styles.navButtonActive : styles.navButton}
            >
              <Icon
                size={20}
                stroke={isActive ? 2.3 : 1.7}
                color={isActive ? "var(--vpn-cyan)" : "var(--vpn-text-secondary)"}
              />
              <Text className={isActive ? styles.navTextActive : styles.navText}>{label}</Text>
            </UnstyledButton>
          </Tooltip>
        );
      })}
    </Box>
  );
};
