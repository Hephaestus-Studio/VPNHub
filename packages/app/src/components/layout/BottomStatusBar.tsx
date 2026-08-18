import { Box, Group, Text, Badge } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconShieldCheck, IconShieldX, IconNetwork, IconLock, IconCpu } from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";

export const BottomStatusBar: React.FC = () => {
  const { securitySettings, connectionState, daemonLatencyMs, activeProfileId, profiles } =
    useVpnStore();

  const isSmall = useMediaQuery("(max-width: 640px)");
  const isMobile = useMediaQuery("(max-width: 480px)");

  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  const interfaceName = activeProfile?.protocol === "wireguard" ? "wg0" : "tun0";

  const getKsDisplay = () => {
    switch (securitySettings.killSwitch) {
      case "strict":
        return {
          label: isSmall ? "KS: STRICT" : "Kill Switch: STRICT FAIL-CLOSED",
          color: "teal",
          icon: IconShieldCheck,
        };
      case "standard":
        return {
          label: isSmall ? "KS: AUTO" : "Kill Switch: AUTO DROPOUT",
          color: "blue",
          icon: IconShieldCheck,
        };
      case "off":
        return {
          label: isSmall ? "KS: OFF" : "Kill Switch: DISABLED",
          color: "red",
          icon: IconShieldX,
        };
    }
  };

  const ksInfo = getKsDisplay();
  const KsIcon = ksInfo.icon;

  return (
    <Box
      style={{
        height: "28px",
        background: "#090d16",
        borderTop: "1px solid var(--vpn-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 10px",
        fontSize: "11px",
        color: "var(--vpn-text-secondary)",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      <Group gap="sm" wrap="nowrap">
        {/* Kill Switch */}
        <Group gap={4} wrap="nowrap">
          <KsIcon
            size={13}
            color={
              securitySettings.killSwitch !== "off" ? "var(--vpn-emerald)" : "var(--vpn-crimson)"
            }
          />
          <Text
            size="11px"
            fw={600}
            style={{ color: ksInfo.color === "teal" ? "#34d399" : "#f87171" }}
            truncate
          >
            {ksInfo.label}
          </Text>
        </Group>

        {!isMobile && (
          <>
            <Box style={{ width: 1, height: 12, background: "var(--vpn-border)" }} />

            {/* IPv6 */}
            <Group gap={4} wrap="nowrap">
              <Text size="11px" c="dimmed">
                IPv6:
              </Text>
              <Text
                size="11px"
                fw={500}
                style={{ color: securitySettings.ipv6LeakProtection ? "#38bdf8" : "#f59e0b" }}
              >
                {securitySettings.ipv6LeakProtection ? "BLOCKED" : "PASS"}
              </Text>
            </Group>
          </>
        )}

        {!isSmall && (
          <>
            <Box style={{ width: 1, height: 12, background: "var(--vpn-border)" }} />

            {/* DNS */}
            <Group gap={4} wrap="nowrap">
              <IconLock size={12} color="var(--vpn-cyan)" />
              <Text size="11px" c="dimmed">
                DNS:
              </Text>
              <Text size="11px" fw={500} style={{ color: "#67e8f9" }}>
                SECURED
              </Text>
            </Group>
          </>
        )}

        {connectionState === "connected" && !isMobile && (
          <>
            <Box style={{ width: 1, height: 12, background: "var(--vpn-border)" }} />
            <Group gap={4} wrap="nowrap">
              <IconNetwork size={12} color="var(--vpn-emerald)" />
              <Text size="11px" fw={600} className="font-mono" style={{ color: "#fff" }}>
                {interfaceName}
              </Text>
            </Group>
          </>
        )}
      </Group>

      <Group gap="sm" wrap="nowrap">
        <Group gap={4} wrap="nowrap">
          <IconCpu size={12} color="var(--vpn-text-muted)" />
          <Text size="11px" c="dimmed">
            {daemonLatencyMs}ms
          </Text>
        </Group>

        {!isMobile && (
          <Badge
            size="xs"
            variant="outline"
            color="gray"
            style={{
              fontSize: 9,
              height: 16,
              padding: "0 4px",
              border: "1px solid var(--vpn-border)",
            }}
          >
            v0.1.0
          </Badge>
        )}
      </Group>
    </Box>
  );
};
