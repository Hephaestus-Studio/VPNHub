import React from "react";
import { Box, UnstyledButton, Text, Tooltip } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconBolt,
  IconFolder,
  IconShieldLock,
  IconArrowsSplit,
  IconTerminal2,
  IconSettings,
} from "@tabler/icons-react";
import { useVpnStore, NavigationTab } from "../../state/useVpnStore";

interface MobileNavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; stroke?: number }>;
}

const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: IconBolt },
  { id: "profiles", label: "Profiles", icon: IconFolder },
  { id: "security", label: "Security", icon: IconShieldLock },
  { id: "split-tunneling", label: "Split", icon: IconArrowsSplit },
  { id: "logs", label: "Logs", icon: IconTerminal2 },
  { id: "settings", label: "Settings", icon: IconSettings },
];

export const MobileBottomNavBar: React.FC = () => {
  const { activeTab, setActiveTab } = useVpnStore();
  const isMobile = useMediaQuery("(max-width: 640px)");

  if (!isMobile) return null;

  return (
    <Box
      style={{
        height: 48,
        background: "rgba(10, 15, 29, 0.96)",
        borderTop: "1px solid var(--vpn-border)",
        backdropFilter: "blur(16px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        padding: "0 4px",
        flexShrink: 0,
        zIndex: 50,
      }}
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <Tooltip key={item.id} label={item.label} position="top" withArrow>
            <UnstyledButton
              onClick={() => setActiveTab(item.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px 8px",
                borderRadius: 6,
                background: isActive ? "rgba(6, 182, 212, 0.12)" : "transparent",
                color: isActive ? "var(--vpn-cyan)" : "var(--vpn-text-muted)",
                transition: "all 0.15s ease",
                minWidth: 46,
              }}
            >
              <Icon
                size={20}
                stroke={isActive ? 2.3 : 1.7}
                color={isActive ? "var(--vpn-cyan)" : "var(--vpn-text-secondary)"}
              />
              <Text
                size="9px"
                fw={isActive ? 700 : 500}
                style={{
                  color: isActive ? "#ffffff" : "var(--vpn-text-muted)",
                  marginTop: 1,
                  lineHeight: 1,
                }}
              >
                {item.label}
              </Text>
            </UnstyledButton>
          </Tooltip>
        );
      })}
    </Box>
  );
};
