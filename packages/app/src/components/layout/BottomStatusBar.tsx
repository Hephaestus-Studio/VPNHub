import { Box, Group, Text, Badge } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconShieldCheck, IconShieldX, IconNetwork, IconLock, IconCpu } from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import { useTranslation } from "../../i18n";
import styles from "./BottomStatusBar.module.css";

export const BottomStatusBar: React.FC = () => {
  const { securitySettings, connectionState, daemonLatencyMs, activeProfileId, profiles } =
    useVpnStore();
  const { t } = useTranslation();

  const isMobile = useMediaQuery("(max-width: 640px)");

  if (isMobile) return null;

  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  const interfaceName = activeProfile?.protocol === "wireguard" ? "wg0" : "tun0";

  const getKsDisplay = () => {
    switch (securitySettings.killSwitch) {
      case "strict":
        return {
          label: t.statusBar.killSwitchStrict,
          color: "teal",
          icon: IconShieldCheck,
        };
      case "standard":
        return {
          label: t.statusBar.killSwitchAuto,
          color: "blue",
          icon: IconShieldCheck,
        };
      case "off":
        return {
          label: t.statusBar.killSwitchOff,
          color: "red",
          icon: IconShieldX,
        };
    }
  };

  const ksInfo = getKsDisplay();
  const KsIcon = ksInfo.icon;

  return (
    <Box className={styles.root}>
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
            className={ksInfo.color === "teal" ? styles.ksTeal : styles.ksRed}
            truncate
          >
            {ksInfo.label}
          </Text>
        </Group>

        <Box className={styles.divider} />

        {/* IPv6 */}
        <Group gap={4} wrap="nowrap">
          <Text size="11px" c="dimmed">
            IPv6:
          </Text>
          <Text
            size="11px"
            fw={500}
            className={securitySettings.ipv6LeakProtection ? styles.ipv6Blocked : styles.ipv6Pass}
          >
            {securitySettings.ipv6LeakProtection ? t.statusBar.ipv6Blocked : t.statusBar.ipv6Pass}
          </Text>
        </Group>

        <Box className={styles.divider} />

        {/* DNS */}
        <Group gap={4} wrap="nowrap">
          <IconLock size={12} color="var(--vpn-cyan)" />
          <Text size="11px" c="dimmed">
            DNS:
          </Text>
          <Text size="11px" fw={500} className={styles.dnsSecured}>
            {t.statusBar.dnsSecured}
          </Text>
        </Group>

        {connectionState === "connected" && (
          <>
            <Box className={styles.divider} />
            <Group gap={4} wrap="nowrap">
              <IconNetwork size={12} color="var(--vpn-emerald)" />
              <Text size="11px" fw={600} className={`font-mono ${styles.interfaceText}`}>
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
          <Badge size="xs" variant="outline" color="gray" className={styles.versionBadge}>
            v0.1.0
          </Badge>
        )}
      </Group>
    </Box>
  );
};
