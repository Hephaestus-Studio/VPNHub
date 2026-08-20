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
import { NewProfileHubModal } from "./NewProfileHubModal";
import { QrCodeModal } from "./QrCodeModal";
import styles from "./ProfileLibraryView.module.css";

export const ProfileLibraryView: React.FC = () => {
  const { profiles, activeProfileId, connectionState, connect, disconnect, toggleFavorite } =
    useVpnStore();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modals state
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [isHubModalOpen, setHubModalOpen] = useState(false);
  const [isQrModalOpen, setQrModalOpen] = useState(false);
  const [chosenProtocol, setChosenProtocol] = useState<"wireguard" | "openvpn">("wireguard");
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
    setChosenProtocol(profile.protocol === "wireguard" ? "wireguard" : "openvpn");
    setProfileModalOpen(true);
  };

  const handleViewQr = (profile: VpnProfile) => {
    setSelectedProfile(profile);
    setQrModalOpen(true);
  };

  return (
    <Box className={styles.root}>
      {/* Header Bar */}
      <Group justify="space-between" align="center">
        <Box>
          <Text size="xl" fw={700} className={styles.title}>
            Profile Library
          </Text>
          <Text size="xs" c="dimmed">
            Manage WireGuard and OpenVPN server connection profiles ({profiles.length} total)
          </Text>
        </Box>

        <Button
          size="sm"
          color="cyan"
          leftSection={<IconPlus size={16} />}
          onClick={() => setHubModalOpen(true)}
        >
          Add / Import Profile
        </Button>
      </Group>

      {/* Controls Bar: Search & Filter Pills & Grid/Table Toggle */}
      <Box className={`glass-panel ${styles.controlsPanel}`}>
        <Group justify="space-between" align="center">
          <TextInput
            placeholder="Search by profile name, IP, country, or tags..."
            leftSection={<IconSearch size={16} color="var(--vpn-text-muted)" />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ minWidth: 280, flex: 1 }}
            size="xs"
            classNames={{
              input: styles.searchInput,
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
                    <Center className={styles.toggleCenter}>
                      <IconLayoutGrid size={15} />
                    </Center>
                  </Tooltip>
                ),
              },
              {
                value: "table",
                label: (
                  <Tooltip label="Table View" position="bottom" withArrow>
                    <Center className={styles.toggleCenter}>
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
              className={styles.filterPill}
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
        <Box className={`glass-panel ${styles.tablePanel}`}>
          <Table verticalSpacing="xs" highlightOnHover>
            <Table.Thead className={styles.tableHeader}>
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
                const isConnecting =
                  isActive &&
                  (connectionState === "connecting" || connectionState === "reconnecting");
                const isDisconnecting = isActive && connectionState === "disconnecting";
                const isError = isActive && connectionState === "error";
                const locationText =
                  [prof.serverCity, prof.serverCountry].filter(Boolean).join(", ") ||
                  "Remote Gateway";

                let rowClass = undefined;
                if (isConnected) rowClass = styles.rowConnected;
                else if (isConnecting) rowClass = styles.rowConnecting;
                else if (isError) rowClass = styles.rowError;
                else if (isActive) rowClass = styles.rowActive;

                return (
                  <Table.Tr key={prof.id} className={rowClass}>
                    <Table.Td style={{ width: 40 }}>
                      <ActionIcon
                        variant="subtle"
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
                          <Group gap="xs" align="center">
                            <Text size="sm" fw={600} className={styles.profileName}>
                              {prof.name}
                            </Text>
                            {isConnected && (
                              <Badge size="xs" color="teal" variant="filled">
                                ACTIVE
                              </Badge>
                            )}
                            {isConnecting && (
                              <Badge size="xs" color="yellow" variant="filled">
                                CONNECTING...
                              </Badge>
                            )}
                            {isError && (
                              <Badge size="xs" color="red" variant="filled">
                                FAILED
                              </Badge>
                            )}
                          </Group>
                          <Text size="10px" c="dimmed">
                            {locationText}
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
                        <Text size="xs" fw={700} className={`font-mono ${styles.pingText}`}>
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
                            className={styles.tagBadge}
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
                          color={
                            isConnected ? "red" : isConnecting ? "yellow" : isError ? "red" : "cyan"
                          }
                          variant={isConnected || isConnecting ? "filled" : "light"}
                          loading={isConnecting || isDisconnecting}
                          onClick={() => {
                            if (isConnected) disconnect();
                            else connect(prof.id);
                          }}
                        >
                          {isConnected
                            ? "Disconnect"
                            : isConnecting
                              ? "Connecting..."
                              : isError
                                ? "Retry"
                                : "Connect"}
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
      <NewProfileHubModal
        opened={isHubModalOpen}
        onClose={() => setHubModalOpen(false)}
        onSelectManualCreate={(protocol) => {
          setChosenProtocol(protocol);
          setSelectedProfile(null);
          setProfileModalOpen(true);
        }}
        onImportParsed={(parsedProfile) => {
          setSelectedProfile(parsedProfile);
          setChosenProtocol(parsedProfile.protocol === "wireguard" ? "wireguard" : "openvpn");
          setProfileModalOpen(true);
        }}
      />

      <ProfileModal
        opened={isProfileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        initialProfile={selectedProfile}
        defaultProtocol={chosenProtocol}
      />

      <QrCodeModal
        opened={isQrModalOpen}
        onClose={() => setQrModalOpen(false)}
        profile={selectedProfile}
      />
    </Box>
  );
};
