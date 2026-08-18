import { Box, Group, Text, Badge, UnstyledButton, ActionIcon } from "@mantine/core";
import { IconStar, IconStarFilled, IconBolt, IconFolder } from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";

export const ProfileCarousel: React.FC = () => {
  const { profiles, activeProfileId, connect, toggleFavorite, setActiveTab } = useVpnStore();

  // Show favorites first, then remaining profiles
  const sortedProfiles = [...profiles].sort(
    (a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0)
  );

  return (
    <Box
      className="glass-panel"
      style={{
        padding: "16px",
        background: "rgba(17, 24, 39, 0.75)",
      }}
    >
      <Group justify="space-between" align="center" mb="xs">
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

        <Group gap="xs">
          <UnstyledButton
            onClick={() => setActiveTab("profiles")}
            style={{ fontSize: 11, color: "var(--vpn-cyan)", fontWeight: 500 }}
          >
            View All ({profiles.length}) →
          </UnstyledButton>
        </Group>
      </Group>

      {/* Profile Card List */}
      <Group gap="sm" wrap="nowrap" style={{ overflowX: "auto", paddingBottom: 4 }}>
        {sortedProfiles.map((prof) => {
          const isActive = prof.id === activeProfileId;

          return (
            <Box
              key={prof.id}
              className="glass-card"
              style={{
                minWidth: 200,
                flex: "1 0 200px",
                padding: "12px",
                borderRadius: 8,
                background: isActive
                  ? "linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(17, 24, 39, 0.9))"
                  : "rgba(31, 41, 55, 0.5)",
                border: isActive
                  ? "1px solid rgba(6, 182, 212, 0.4)"
                  : "1px solid var(--vpn-border)",
                cursor: "pointer",
                position: "relative",
              }}
              onClick={() => connect(prof.id)}
            >
              <Group justify="space-between" align="flex-start" mb={4}>
                <Group gap={6}>
                  <Text size="lg">{prof.serverFlag}</Text>
                  <Box>
                    <Text size="xs" fw={700} style={{ color: "#fff", maxWidth: 110 }} truncate>
                      {prof.name}
                    </Text>
                    <Text size="10px" c="dimmed" truncate>
                      {prof.serverCity}
                    </Text>
                  </Box>
                </Group>

                <ActionIcon
                  variant="transparent"
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(prof.id);
                  }}
                >
                  {prof.isFavorite ? (
                    <IconStarFilled size={14} color="#f59e0b" />
                  ) : (
                    <IconStar size={14} color="var(--vpn-text-muted)" />
                  )}
                </ActionIcon>
              </Group>

              <Group justify="space-between" align="center" mt="xs">
                <Badge
                  size="xs"
                  variant="outline"
                  color="gray"
                  style={{ fontSize: 9, padding: "0 4px", height: 16 }}
                >
                  {prof.protocol === "wireguard" ? "WireGuard" : "OpenVPN"}
                </Badge>

                <Group gap={3}>
                  <IconBolt size={12} color="var(--vpn-emerald)" />
                  <Text size="10px" fw={700} className="font-mono" style={{ color: "#34d399" }}>
                    {prof.pingMs}ms
                  </Text>
                </Group>
              </Group>

              {isActive && (
                <Box
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#06b6d4",
                    margin: 6,
                    boxShadow: "0 0 6px #06b6d4",
                  }}
                />
              )}
            </Box>
          );
        })}
      </Group>
    </Box>
  );
};
