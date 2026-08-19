import React from "react";
import { Box, Group, Text, Badge, UnstyledButton, ActionIcon, Stack } from "@mantine/core";
import {
  IconFolder,
  IconStar,
  IconStarFilled,
  IconArrowUpRight,
  IconPlus,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";

export const DashboardProfilesCard: React.FC = () => {
  const { profiles, activeProfileId, connect, toggleFavorite, setActiveTab } = useVpnStore();

  const sortedProfiles = [...profiles].sort(
    (a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0)
  );

  return (
    <Box
      className="glass-panel"
      style={{
        padding: "16px",
        background: "rgba(17, 24, 39, 0.75)",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: "12px",
      }}
    >
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconFolder size={16} color="var(--vpn-cyan)" />
          <Text
            size="xs"
            fw={700}
            style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "#fff" }}
          >
            Quick Switch Profiles
          </Text>
        </Group>

        <UnstyledButton
          onClick={() => setActiveTab("profiles")}
          style={{
            fontSize: 11,
            color: "var(--vpn-cyan)",
            display: "flex",
            alignItems: "center",
            gap: 2,
            fontWeight: 500,
          }}
        >
          Manage ({profiles.length}) <IconArrowUpRight size={13} />
        </UnstyledButton>
      </Group>

      {/* Profiles List */}
      <Stack gap={8} style={{ flex: 1, overflowY: "auto", maxHeight: 220 }}>
        {sortedProfiles.slice(0, 4).map((prof) => {
          const isActive = prof.id === activeProfileId;

          return (
            <Box
              key={prof.id}
              onClick={() => connect(prof.id)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                background: isActive
                  ? "linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(17, 24, 39, 0.8))"
                  : "rgba(31, 41, 55, 0.4)",
                border: isActive
                  ? "1px solid rgba(6, 182, 212, 0.45)"
                  : "1px solid var(--vpn-border)",
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Group gap="xs" wrap="nowrap" style={{ overflow: "hidden" }}>
                <Text size="md">{prof.serverFlag || "🛡️"}</Text>
                <Box style={{ overflow: "hidden" }}>
                  <Group gap={6} wrap="nowrap">
                    <Text
                      size="xs"
                      fw={isActive ? 700 : 500}
                      style={{ color: isActive ? "#ffffff" : "#e2e8f0" }}
                      truncate
                    >
                      {prof.name}
                    </Text>
                    {isActive && (
                      <Badge
                        size="xs"
                        variant="filled"
                        color="cyan"
                        style={{ fontSize: 9, height: 16, padding: "0 4px" }}
                      >
                        ACTIVE
                      </Badge>
                    )}
                  </Group>
                  <Text size="10px" c="dimmed" truncate>
                    {prof.serverHost}:{prof.serverPort}
                  </Text>
                </Box>
              </Group>

              <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
                <Text size="10px" fw={600} style={{ color: "#fbbf24" }}>
                  ⚡{prof.pingMs || 36}ms
                </Text>
                <ActionIcon
                  variant="transparent"
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(prof.id);
                  }}
                >
                  {prof.isFavorite ? (
                    <IconStarFilled size={13} color="#f59e0b" />
                  ) : (
                    <IconStar size={13} color="var(--vpn-text-muted)" />
                  )}
                </ActionIcon>
              </Group>
            </Box>
          );
        })}

        {/* Add Profile Fast Action */}
        <UnstyledButton
          onClick={() => setActiveTab("profiles")}
          style={{
            padding: "6px 8px",
            borderRadius: 6,
            border: "1px dashed var(--vpn-border)",
            background: "rgba(255, 255, 255, 0.02)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: "var(--vpn-text-muted)",
            fontSize: 11,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--vpn-cyan)";
            e.currentTarget.style.color = "var(--vpn-cyan)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--vpn-border)";
            e.currentTarget.style.color = "var(--vpn-text-muted)";
          }}
        >
          <IconPlus size={13} /> Add / Import New Profile
        </UnstyledButton>
      </Stack>
    </Box>
  );
};
