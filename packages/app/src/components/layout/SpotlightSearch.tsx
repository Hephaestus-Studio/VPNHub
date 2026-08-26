import React, { useState, useEffect } from "react";
import { Modal, TextInput, Stack, Group, Text, Badge, UnstyledButton, Box } from "@mantine/core";
import { IconSearch, IconBolt, IconShield, IconTerminal2, IconFolder } from "@tabler/icons-react";

import { useVpnStore } from "../../state/useVpnStore";
import styles from "./SpotlightSearch.module.css";

export const SpotlightSearch: React.FC = () => {
  const {
    isSpotlightOpen,
    setSpotlightOpen,
    profiles,
    connect,
    setActiveTab,
    setKillSwitch,
    securitySettings,
  } = useVpnStore();

  const [query, setQuery] = useState("");

  // Handle Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSpotlightOpen(!isSpotlightOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSpotlightOpen, setSpotlightOpen]);

  const filteredProfiles = profiles.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.serverCountry.toLowerCase().includes(query.toLowerCase()) ||
      p.protocol.toLowerCase().includes(query.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );

  const actions = [
    {
      id: "nav-dash",
      title: "Go to Dashboard",
      subtitle: "Overview, hero connection & telemetry",
      icon: IconBolt,
      onSelect: () => {
        setActiveTab("dashboard");
        setSpotlightOpen(false);
      },
    },
    {
      id: "nav-profiles",
      title: "Open Profile Library",
      subtitle: "Manage WireGuard and OpenVPN configs",
      icon: IconFolder,
      onSelect: () => {
        setActiveTab("profiles");
        setSpotlightOpen(false);
      },
    },
    {
      id: "nav-security",
      title: "Open Security & Shield",
      subtitle: "Configure Kill Switch, DNS leak shield, IPv6",
      icon: IconShield,
      onSelect: () => {
        setActiveTab("security");
        setSpotlightOpen(false);
      },
    },
    {
      id: "toggle-ks",
      title: `Toggle Kill Switch (${securitySettings.killSwitch === "strict" ? "Turn Off" : "Turn On"})`,
      subtitle: "Firewall fail-closed enforcement",
      icon: IconShield,
      onSelect: () => {
        setKillSwitch(securitySettings.killSwitch === "strict" ? "off" : "strict");
        setSpotlightOpen(false);
      },
    },
    {
      id: "nav-logs",
      title: "Open Live Console",

      subtitle: "View real-time daemon logs & export diagnostics",
      icon: IconTerminal2,
      onSelect: () => {
        setActiveTab("logs");
        setSpotlightOpen(false);
      },
    },
  ];

  const filteredActions = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Modal
      opened={isSpotlightOpen}
      onClose={() => setSpotlightOpen(false)}
      withCloseButton={false}
      centered
      size="lg"
      padding={0}
      classNames={{
        content: styles.modalContent,
      }}
    >
      <Box className={styles.searchHeader}>
        <TextInput
          placeholder="Search profiles, commands, or settings..."
          leftSection={<IconSearch size={18} color="var(--vpn-cyan)" />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          autoFocus
          variant="unstyled"
          classNames={{
            input: styles.searchInput,
          }}
        />
      </Box>

      <Box className={styles.resultsList}>
        {filteredProfiles.length > 0 && (
          <Box mb="xs">
            <Text className={styles.sectionHeader}>VPN PROFILES ({filteredProfiles.length})</Text>
            <Stack gap={2}>
              {filteredProfiles.map((prof) => (
                <UnstyledButton
                  key={prof.id}
                  onClick={() => {
                    connect(prof.id);
                    setSpotlightOpen(false);
                  }}
                  className={styles.profileItem}
                >
                  <Group gap="sm">
                    <Text size="lg">{prof.serverFlag}</Text>
                    <Box>
                      <Text size="sm" className={styles.profileTitle}>
                        {prof.name}
                      </Text>
                      <Text size="11px" c="dimmed">
                        {prof.serverCity} • {prof.serverHost}
                      </Text>
                    </Box>
                  </Group>

                  <Group gap="xs">
                    <Badge size="xs" color="gray" variant="outline">
                      {prof.protocol.toUpperCase()}
                    </Badge>
                    <Badge size="xs" color="teal" variant="light">
                      ⚡ {prof.pingMs}ms
                    </Badge>
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          </Box>
        )}

        {filteredActions.length > 0 && (
          <Box>
            <Text className={styles.sectionHeader}>COMMANDS & VIEWS</Text>
            <Stack gap={2}>
              {filteredActions.map((action) => {
                const Icon = action.icon;
                return (
                  <UnstyledButton
                    key={action.id}
                    onClick={action.onSelect}
                    className={styles.actionItem}
                  >
                    <Box className={styles.actionIconBox}>
                      <Icon size={16} color="var(--vpn-cyan)" />
                    </Box>
                    <Box>
                      <Text size="sm" className={styles.actionTitle}>
                        {action.title}
                      </Text>
                      <Text size="11px" c="dimmed">
                        {action.subtitle}
                      </Text>
                    </Box>
                  </UnstyledButton>
                );
              })}
            </Stack>
          </Box>
        )}
      </Box>
    </Modal>
  );
};
