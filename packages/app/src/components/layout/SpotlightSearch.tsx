import React, { useState, useEffect } from "react";
import { Modal, TextInput, Stack, Group, Text, Badge, UnstyledButton, Box } from "@mantine/core";
import {
  IconSearch,
  IconBolt,
  IconShield,
  IconTerminal2,
  IconFolder,
  IconArrowsSplit,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";

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
      title: `Toggle Kill Switch (${securitySettings.killSwitch === "strict" ? "Set to Auto" : "Set to Strict"})`,
      subtitle: "Firewall fail-closed enforcement",
      icon: IconShield,
      onSelect: () => {
        setKillSwitch(securitySettings.killSwitch === "strict" ? "standard" : "strict");
        setSpotlightOpen(false);
      },
    },
    {
      id: "nav-split",
      title: "Configure Split Tunneling",
      subtitle: "App rules, CIDR blocks, bypass list",
      icon: IconArrowsSplit,
      onSelect: () => {
        setActiveTab("split-tunneling");
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
      styles={{
        content: {
          background: "rgba(17, 24, 39, 0.95)",
          backdropFilter: "blur(16px)",
          border: "1px solid var(--vpn-border)",
          borderRadius: 12,
          overflow: "hidden",
        },
      }}
    >
      <Box style={{ padding: "12px 16px", borderBottom: "1px solid var(--vpn-border)" }}>
        <TextInput
          placeholder="Search profiles, commands, or settings..."
          leftSection={<IconSearch size={18} color="var(--vpn-cyan)" />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          autoFocus
          variant="unstyled"
          styles={{
            input: {
              color: "#fff",
              fontSize: "15px",
            },
          }}
        />
      </Box>

      <Box style={{ maxHeight: 360, overflowY: "auto", padding: "8px" }}>
        {filteredProfiles.length > 0 && (
          <Box mb="xs">
            <Text
              size="10px"
              fw={700}
              c="dimmed"
              px="xs"
              mb={4}
              style={{ letterSpacing: "0.08em" }}
            >
              VPN PROFILES ({filteredProfiles.length})
            </Text>
            <Stack gap={2}>
              {filteredProfiles.map((prof) => (
                <UnstyledButton
                  key={prof.id}
                  onClick={() => {
                    connect(prof.id);
                    setSpotlightOpen(false);
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "background 0.15s",
                  }}
                  styles={{
                    root: {
                      "&:hover": {
                        background: "rgba(6, 182, 212, 0.12)",
                      },
                    },
                  }}
                >
                  <Group gap="sm">
                    <Text size="lg">{prof.serverFlag}</Text>
                    <Box>
                      <Text size="sm" fw={600} style={{ color: "#fff" }}>
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
            <Text
              size="10px"
              fw={700}
              c="dimmed"
              px="xs"
              mb={4}
              style={{ letterSpacing: "0.08em" }}
            >
              COMMANDS & VIEWS
            </Text>
            <Stack gap={2}>
              {filteredActions.map((action) => {
                const Icon = action.icon;
                return (
                  <UnstyledButton
                    key={action.id}
                    onClick={action.onSelect}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      transition: "background 0.15s",
                    }}
                  >
                    <Box
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: "rgba(255, 255, 255, 0.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={16} color="var(--vpn-cyan)" />
                    </Box>
                    <Box>
                      <Text size="sm" fw={500} style={{ color: "#fff" }}>
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
