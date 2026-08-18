import { useState } from "react";
import {
  Box,
  Group,
  Text,
  TextInput,
  Button,
  SegmentedControl,
  SimpleGrid,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  Center,
} from "@mantine/core";
import {
  IconSearch,
  IconPlus,
  IconFileUpload,
  IconLayoutGrid,
  IconList,
  IconStar,
  IconStarFilled,
  IconBolt,
  IconEdit,
  IconQrcode,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import { VpnProfile } from "../../types/vpn";
import { ProfileCard } from "./ProfileCard";
import { ProfileModal } from "./ProfileModal";
import { ImportProfileModal } from "./ImportProfileModal";
import { QrCodeModal } from "./QrCodeModal";

export const ProfileLibraryView: React.FC = () => {
  const { profiles, activeProfileId, connectionState, connect, disconnect, toggleFavorite } =
    useVpnStore();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modals state
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isQrModalOpen, setQrModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<VpnProfile | null>(null);

  // Filter Logic
  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.serverCountry.toLowerCase().includes(search.toLowerCase()) ||
      p.serverHost.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeFilter === "favorites") return p.isFavorite;
    if (activeFilter === "wireguard") return p.protocol === "wireguard";
    if (activeFilter === "openvpn") return p.protocol.includes("openvpn");
    if (activeFilter === "production") return p.tags.includes("Production");
    if (activeFilter === "office") return p.tags.includes("Office");
    return true;
  });

  const handleEdit = (profile: VpnProfile) => {
    setSelectedProfile(profile);
    setProfileModalOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedProfile(null);
    setProfileModalOpen(true);
  };

  const handleViewQr = (profile: VpnProfile) => {
    setSelectedProfile(profile);
    setQrModalOpen(true);
  };

  return (
    <Box
      style={{
        padding: "16px",
        height: "100%",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Header Bar */}
      <Group justify="space-between" align="center">
        <Box>
          <Text size="xl" fw={700} style={{ color: "#fff", letterSpacing: "-0.02em" }}>
            Profile Library
          </Text>
          <Text size="xs" c="dimmed">
            Manage WireGuard and OpenVPN server connection profiles ({profiles.length} total)
          </Text>
        </Box>

        <Group gap="xs">
          <Button
            size="sm"
            variant="default"
            leftSection={<IconFileUpload size={16} />}
            onClick={() => setImportModalOpen(true)}
            style={{ background: "rgba(31, 41, 55, 0.6)", border: "1px solid var(--vpn-border)" }}
          >
            Import (.ovpn/.conf)
          </Button>

          <Button
            size="sm"
            color="cyan"
            leftSection={<IconPlus size={16} />}
            onClick={handleCreateNew}
          >
            Add Profile
          </Button>
        </Group>
      </Group>

      {/* Controls Bar: Search & Filter Pills & Grid/Table Toggle */}
      <Box
        className="glass-panel"
        style={{
          padding: "12px",
          background: "rgba(17, 24, 39, 0.75)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <Group justify="space-between" align="center">
          <TextInput
            placeholder="Search by profile name, IP, country, or tags..."
            leftSection={<IconSearch size={16} color="var(--vpn-text-muted)" />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ minWidth: 280, flex: 1 }}
            size="xs"
            styles={{
              input: {
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--vpn-border)",
                color: "#fff",
              },
            }}
          />

          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={(val) => setViewMode(val as "grid" | "table")}
            data={[
              {
                value: "grid",
                label: (
                  <Tooltip label="Grid View" position="bottom" withArrow>
                    <Center style={{ width: 22, height: 20 }}>
                      <IconLayoutGrid size={15} />
                    </Center>
                  </Tooltip>
                ),
              },
              {
                value: "table",
                label: (
                  <Tooltip label="Table View" position="bottom" withArrow>
                    <Center style={{ width: 22, height: 20 }}>
                      <IconList size={15} />
                    </Center>
                  </Tooltip>
                ),
              },
            ]}
          />
        </Group>

        {/* Filter Pills */}
        <Group gap={6}>
          {[
            { id: "all", label: "All Profiles" },
            { id: "favorites", label: "★ Favorites" },
            { id: "wireguard", label: "WireGuard" },
            { id: "openvpn", label: "OpenVPN" },
            { id: "production", label: "Production" },
            { id: "office", label: "Office" },
          ].map((f) => (
            <Button
              key={f.id}
              size="xs"
              variant={activeFilter === f.id ? "filled" : "subtle"}
              color={activeFilter === f.id ? "cyan" : "gray"}
              onClick={() => setActiveFilter(f.id)}
              style={{
                height: 24,
                padding: "0 10px",
                fontSize: 11,
                borderRadius: 20,
              }}
            >
              {f.label}
            </Button>
          ))}
        </Group>
      </Box>

      {/* Main Catalog View */}
      {viewMode === "grid" ? (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {filteredProfiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onEdit={handleEdit}
              onViewQr={handleViewQr}
            />
          ))}
        </SimpleGrid>
      ) : (
        <Box
          className="glass-panel"
          style={{
            background: "rgba(17, 24, 39, 0.75)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <Table verticalSpacing="xs" highlightOnHover>
            <Table.Thead style={{ background: "rgba(0, 0, 0, 0.3)" }}>
              <Table.Tr>
                <Table.Th style={{ width: 40 }}></Table.Th>
                <Table.Th>Profile / Location</Table.Th>
                <Table.Th>Protocol</Table.Th>
                <Table.Th>Endpoint</Table.Th>
                <Table.Th>Latency</Table.Th>
                <Table.Th>Tags</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredProfiles.map((prof) => {
                const isActive = prof.id === activeProfileId;
                const isConnected = isActive && connectionState === "connected";

                return (
                  <Table.Tr
                    key={prof.id}
                    style={{
                      background: isActive ? "rgba(6, 182, 212, 0.08)" : "transparent",
                    }}
                  >
                    <Table.Td>
                      <ActionIcon
                        variant="transparent"
                        size="xs"
                        onClick={() => toggleFavorite(prof.id)}
                      >
                        {prof.isFavorite ? (
                          <IconStarFilled size={14} color="#f59e0b" />
                        ) : (
                          <IconStar size={14} color="var(--vpn-text-muted)" />
                        )}
                      </ActionIcon>
                    </Table.Td>

                    <Table.Td>
                      <Group gap="xs">
                        <Text size="lg">{prof.serverFlag}</Text>
                        <Box>
                          <Text size="sm" fw={600} style={{ color: "#fff" }}>
                            {prof.name}
                          </Text>
                          <Text size="10px" c="dimmed">
                            {prof.serverCity}, {prof.serverCountry}
                          </Text>
                        </Box>
                      </Group>
                    </Table.Td>

                    <Table.Td>
                      <Badge size="xs" variant="outline" color="cyan">
                        {prof.protocol.toUpperCase()}
                      </Badge>
                    </Table.Td>

                    <Table.Td>
                      <Text size="xs" className="font-mono" c="dimmed">
                        {prof.serverHost}:{prof.serverPort}
                      </Text>
                    </Table.Td>

                    <Table.Td>
                      <Group gap={4}>
                        <IconBolt size={13} color="var(--vpn-emerald)" />
                        <Text size="xs" fw={700} className="font-mono" style={{ color: "#34d399" }}>
                          {prof.pingMs} ms
                        </Text>
                      </Group>
                    </Table.Td>

                    <Table.Td>
                      <Group gap={4}>
                        {prof.tags.map((t) => (
                          <Badge
                            key={t}
                            size="xs"
                            variant="light"
                            color="gray"
                            style={{ fontSize: 9 }}
                          >
                            {t}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>

                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap={6} justify="flex-end">
                        <Tooltip label="QR Code">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="gray"
                            onClick={() => handleViewQr(prof)}
                          >
                            <IconQrcode size={15} />
                          </ActionIcon>
                        </Tooltip>

                        <Tooltip label="Edit">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="gray"
                            onClick={() => handleEdit(prof)}
                          >
                            <IconEdit size={15} />
                          </ActionIcon>
                        </Tooltip>

                        <Button
                          size="xs"
                          color={isConnected ? "red" : "cyan"}
                          variant={isConnected ? "filled" : "light"}
                          onClick={() => {
                            if (isConnected) disconnect();
                            else connect(prof.id);
                          }}
                        >
                          {isConnected ? "Disconnect" : "Connect"}
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Box>
      )}

      {/* Modals */}
      <ProfileModal
        opened={isProfileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        initialProfile={selectedProfile}
      />

      <ImportProfileModal opened={isImportModalOpen} onClose={() => setImportModalOpen(false)} />

      <QrCodeModal
        opened={isQrModalOpen}
        onClose={() => setQrModalOpen(false)}
        profile={selectedProfile}
      />
    </Box>
  );
};
