import React, { useState } from "react";
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
  UnstyledButton,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
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
  IconFolderOff,
  IconX,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import { VpnProfile } from "../../types/vpn";
import { useTranslation } from "../../i18n";
import { ProfileCard } from "./ProfileCard";
import { ProfileModal } from "./ProfileModal";
import { NewProfileHubModal } from "./NewProfileHubModal";
import { QrCodeModal } from "./QrCodeModal";
import styles from "./ProfileLibraryView.module.css";

export const ProfileLibraryView: React.FC = () => {
  const { profiles, activeProfileId, connectionState, connect, disconnect, toggleFavorite } =
    useVpnStore();
  const { t } = useTranslation();

  const isMobile = useMediaQuery("(max-width: 640px)");

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
      p.serverHost.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === "favorites") return p.isFavorite;
    if (activeFilter === "wireguard") return p.protocol === "wireguard";
    if (activeFilter === "openvpn") return p.protocol.includes("openvpn");
    return true;
  });

  const favoritesCount = profiles.filter((p) => p.isFavorite).length;

  const handleEdit = (profile: VpnProfile) => {
    setSelectedProfile(profile);
    setChosenProtocol(profile.protocol === "wireguard" ? "wireguard" : "openvpn");
    setProfileModalOpen(true);
  };

  const handleViewQr = (profile: VpnProfile) => {
    setSelectedProfile(profile);
    setQrModalOpen(true);
  };

  const effectiveViewMode = isMobile ? "grid" : viewMode;

  const formatProtocolLabel = (proto: string) => {
    if (proto === "wireguard") return "WG";
    if (proto === "openvpn_tcp") return "OVPN TCP";
    if (proto === "openvpn_udp") return "OVPN UDP";
    if (proto === "openvpn") return "OVPN";
    return proto.toUpperCase();
  };

  return (
    <Box className={styles.root}>
      {/* Header Bar */}
      <Group justify="space-between" align="center" wrap="nowrap">
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Group gap="xs" align="center" wrap="nowrap">
            <Text size={isMobile ? "md" : "xl"} fw={700} className={styles.title} truncate>
              {t.profiles.title}
            </Text>
            {!isMobile && (
              <Group gap={6}>
                <Badge size="xs" variant="light" color="gray">
                  {profiles.length} {t.common.all}
                </Badge>
                {favoritesCount > 0 && (
                  <Badge size="xs" variant="light" color="yellow">
                    ★ {favoritesCount} {t.profiles.favoritesOnly}
                  </Badge>
                )}
              </Group>
            )}
          </Group>
          {!isMobile && (
            <Text size="xs" c="dimmed">
              {t.profiles.subtitle}
            </Text>
          )}
        </Box>

        {isMobile ? (
          <Tooltip label={t.profiles.addProfile} position="left">
            <UnstyledButton
              onClick={() => setHubModalOpen(true)}
              className={styles.headerAddBtnMobile}
            >
              <IconPlus size={18} stroke={2.5} />
            </UnstyledButton>
          </Tooltip>
        ) : (
          <Button
            size="sm"
            color="cyan"
            leftSection={<IconPlus size={16} />}
            onClick={() => setHubModalOpen(true)}
          >
            {t.profiles.addProfile}
          </Button>
        )}
      </Group>

      {/* Controls Bar: Search & Filter Pills & Grid/Table Toggle */}
      <Box className={`glass-panel ${styles.controlsPanel}`}>
        <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
          <TextInput
            placeholder={isMobile ? t.common.search : t.profiles.searchPlaceholder}
            leftSection={<IconSearch size={15} color="var(--vpn-text-muted)" />}
            rightSection={
              search ? (
                <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setSearch("")}>
                  <IconX size={12} />
                </ActionIcon>
              ) : null
            }
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 0 }}
            size="xs"
            classNames={{
              input: styles.searchInput,
            }}
          />

          {!isMobile && (
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
          )}
        </Group>

        {/* Horizontally Scrollable Filter Pills */}
        <Box className={styles.pillsScrollContainer}>
          {[
            { id: "all", label: `${t.common.all} (${profiles.length})` },
            { id: "favorites", label: `★ ${t.profiles.favoritesOnly} (${favoritesCount})` },
            { id: "wireguard", label: "WireGuard" },
            { id: "openvpn", label: "OpenVPN" },
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
        </Box>
      </Box>

      {/* Main Catalog View */}
      {filteredProfiles.length === 0 ? (
        <Box className={`glass-panel ${styles.emptyState}`}>
          <IconFolderOff size={36} color="var(--vpn-text-muted)" stroke={1.5} />
          <Box>
            <Text size="sm" fw={600} c="dimmed">
              {t.profiles.noProfilesFound}
            </Text>
            {search && (
              <Text size="xs" c="dimmed" mt={2}>
                {t.profiles.createPrompt}
              </Text>
            )}
          </Box>
          {search ? (
            <Button size="xs" variant="light" color="gray" onClick={() => setSearch("")}>
              {t.common.reset}
            </Button>
          ) : (
            <Button
              size="xs"
              variant="filled"
              color="cyan"
              leftSection={<IconPlus size={14} />}
              onClick={() => setHubModalOpen(true)}
            >
              {t.profiles.addProfile}
            </Button>
          )}
        </Box>
      ) : effectiveViewMode === "grid" ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={{ base: "xs", sm: "sm", md: "md" }}>
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
        <Box className={styles.tableWrapper}>
          <Table className={styles.tablePanel} verticalSpacing="sm" highlightOnHover>
            <Table.Thead className={styles.tableHeader}>
              <Table.Tr>
                <Table.Th style={{ width: 40, textAlign: "center" }}></Table.Th>
                <Table.Th style={{ minWidth: 200 }}>Profile / Location</Table.Th>
                <Table.Th style={{ width: 100 }}>Protocol</Table.Th>
                <Table.Th style={{ minWidth: 160 }}>Endpoint</Table.Th>
                <Table.Th style={{ width: 90 }}>Latency</Table.Th>
                <Table.Th style={{ width: 175, textAlign: "right" }}>Actions</Table.Th>
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

                let rowClass = styles.tableRow;
                if (isConnected) rowClass = styles.rowConnected;
                else if (isConnecting) rowClass = styles.rowConnecting;
                else if (isError) rowClass = styles.rowError;
                else if (isActive) rowClass = styles.rowActive;

                const pingColor =
                  prof.pingMs > 0 && prof.pingMs <= 50
                    ? "#34d399"
                    : prof.pingMs <= 100
                      ? "#fbbf24"
                      : "#f97316";

                return (
                  <Table.Tr key={prof.id} className={rowClass}>
                    <Table.Td style={{ width: 40, textAlign: "center" }}>
                      <ActionIcon
                        variant="subtle"
                        size="xs"
                        onClick={() => toggleFavorite(prof.id)}
                      >
                        {prof.isFavorite ? (
                          <IconStarFilled size={15} color="#f59e0b" />
                        ) : (
                          <IconStar size={15} color="var(--vpn-text-muted)" />
                        )}
                      </ActionIcon>
                    </Table.Td>

                    <Table.Td>
                      <Group gap="xs" wrap="nowrap" align="center">
                        <Text size="22px" style={{ flexShrink: 0, lineHeight: 1 }}>
                          {prof.serverFlag}
                        </Text>
                        <Box style={{ minWidth: 0, flex: 1 }}>
                          <Group gap={6} align="center" wrap="nowrap">
                            <Text size="sm" fw={600} className={styles.profileName} truncate>
                              {prof.name}
                            </Text>
                            {isConnected && (
                              <Badge
                                size="xs"
                                color="teal"
                                variant="filled"
                                style={{ flexShrink: 0 }}
                              >
                                ACTIVE
                              </Badge>
                            )}
                            {isConnecting && (
                              <Badge
                                size="xs"
                                color="yellow"
                                variant="filled"
                                style={{ flexShrink: 0 }}
                              >
                                CONNECTING...
                              </Badge>
                            )}
                            {isError && (
                              <Badge
                                size="xs"
                                color="red"
                                variant="filled"
                                style={{ flexShrink: 0 }}
                              >
                                FAILED
                              </Badge>
                            )}
                          </Group>
                          <Text size="11px" c="dimmed" truncate>
                            {locationText}
                          </Text>
                        </Box>
                      </Group>
                    </Table.Td>

                    <Table.Td>
                      <Badge
                        size="xs"
                        variant="outline"
                        color="cyan"
                        className={styles.protocolBadge}
                      >
                        {formatProtocolLabel(prof.protocol)}
                      </Badge>
                    </Table.Td>

                    <Table.Td>
                      <Text size="xs" className="font-mono" c="dimmed" truncate>
                        {prof.serverHost}:{prof.serverPort}
                      </Text>
                    </Table.Td>

                    <Table.Td>
                      <Group gap={4} wrap="nowrap" align="center">
                        <IconBolt size={14} color={pingColor} />
                        <Text
                          size="xs"
                          fw={700}
                          className={`font-mono ${styles.pingText}`}
                          style={{ color: pingColor }}
                        >
                          {prof.pingMs} ms
                        </Text>
                      </Group>
                    </Table.Td>

                    <Table.Td style={{ textAlign: "right" }}>
                      <Box className={styles.actionsGroup}>
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
                            if (isConnected || isConnecting) disconnect();
                            else connect(prof.id);
                          }}
                        >
                          {isConnected
                            ? "Disconnect"
                            : isConnecting
                              ? "Cancel"
                              : isError
                                ? "Retry"
                                : "Connect"}
                        </Button>
                      </Box>
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
