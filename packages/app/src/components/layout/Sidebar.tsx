import { Box, Stack, UnstyledButton, Group, Text, Badge, Tooltip } from "@mantine/core";
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
} from "@tabler/icons-react";
import { useVpnStore, NavigationTab } from "../../state/useVpnStore";

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

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, daemonHealth, daemonVersion, profiles } = useVpnStore();
  const isCompact = useMediaQuery("(max-width: 768px)");

  return (
    <Box
      style={{
        width: isCompact ? 62 : 210,
        height: "100%",
        background: "var(--vpn-bg-surface)",
        borderRight: "1px solid var(--vpn-border)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: isCompact ? "12px 6px" : "12px 8px",
        transition: "width 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        flexShrink: 0,
      }}
    >
      {/* Navigation List */}
      <Stack gap={4}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const badgeText =
            item.id === "profiles"
              ? profiles.length > 0
                ? String(profiles.length)
                : undefined
              : item.badge;

          const buttonContent = (
            <UnstyledButton
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: isCompact ? "center" : "space-between",
                padding: isCompact ? "10px 0" : "8px 10px",
                borderRadius: 8,
                background: isActive ? "rgba(6, 182, 212, 0.12)" : "transparent",
                border: isActive ? "1px solid rgba(6, 182, 212, 0.25)" : "1px solid transparent",
                transition: "all 0.15s ease",
                width: "100%",
              }}
            >
              <Group gap="xs" justify={isCompact ? "center" : "flex-start"}>
                <Icon
                  size={isCompact ? 19 : 17}
                  color={isActive ? "var(--vpn-cyan)" : "var(--vpn-text-secondary)"}
                  stroke={isActive ? 2.2 : 1.8}
                />
                {!isCompact && (
                  <Text
                    size="sm"
                    fw={isActive ? 600 : 400}
                    style={{
                      color: isActive ? "#fff" : "var(--vpn-text-secondary)",
                      fontSize: 13,
                    }}
                  >
                    {item.label}
                  </Text>
                )}
              </Group>

              {!isCompact && badgeText && (
                <Badge
                  size="xs"
                  variant={isActive ? "filled" : "outline"}
                  color={isActive ? "cyan" : "gray"}
                  style={{ fontSize: 10, padding: "0 5px" }}
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
          <Box
            style={{
              background: "rgba(31, 41, 55, 0.4)",
              border: "1px solid var(--vpn-border)",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          >
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <Box
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    background: "rgba(6, 182, 212, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconShieldCheck size={14} color="var(--vpn-cyan)" />
                </Box>
                <Box>
                  <Text size="xs" fw={600} style={{ color: "#fff", lineHeight: 1.2 }}>
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
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isCompact ? "center" : "flex-start",
            gap: 8,
            padding: "6px 8px",
            borderRadius: 6,
            color: "var(--vpn-text-muted)",
            fontSize: 12,
          }}
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
