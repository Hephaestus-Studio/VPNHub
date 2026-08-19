import React, { useRef, useState } from "react";
import { Box, Group, Text, Badge, Button, ActionIcon, UnstyledButton } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconFolder,
  IconStar,
  IconStarFilled,
  IconArrowUpRight,
  IconPlus,
  IconPower,
  IconShieldCheck,
  IconServer,
  IconWifi,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";

export const DashboardProfileDeck: React.FC = () => {
  const {
    profiles,
    activeProfileId,
    connectionState,
    connect,
    disconnect,
    toggleFavorite,
    setActiveTab,
  } = useVpnStore();

  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(min-width: 641px) and (max-width: 1024px)");
  const isDesktop = !isMobile && !isTablet;

  const sortedProfiles = [...profiles].sort(
    (a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0)
  );

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Sync scroll position with activeSlideIndex
  const handleScroll = () => {
    if (!sliderRef.current) return;
    const scrollLeft = sliderRef.current.scrollLeft;
    const cardWidth = sliderRef.current.offsetWidth * 0.85;
    const newIndex = Math.round(scrollLeft / cardWidth);
    setActiveSlideIndex(Math.min(newIndex, sortedProfiles.length));
  };

  const scrollToSlide = (index: number) => {
    if (!sliderRef.current) return;
    const cardWidth = sliderRef.current.offsetWidth * 0.85 + 12;
    sliderRef.current.scrollTo({
      left: index * cardWidth,
      behavior: "smooth",
    });
    setActiveSlideIndex(index);
  };

  // -------------------------------------------------------------
  // MOBILE WALLET / BANK CARD SLIDE RENDERER (< 640px)
  // -------------------------------------------------------------
  const renderMobileWalletDeck = () => {
    const totalSlides = sortedProfiles.length;
    const isSingle = totalSlides === 1;

    return (
      <Box style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Slider Container with snap scroll */}
        <Box
          ref={sliderRef}
          onScroll={handleScroll}
          style={{
            display: "flex",
            gap: isSingle ? 0 : 12,
            justifyContent: isSingle ? "center" : "flex-start",
            overflowX: isSingle ? "hidden" : "auto",
            scrollSnapType: isSingle ? "none" : "x mandatory",
            padding: isSingle ? "2px 0" : "4px 6%",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
            width: "100%",
          }}
        >
          {sortedProfiles.map((prof) => {
            const isActive = prof.id === activeProfileId;
            const isConnected = isActive && connectionState === "connected";
            const isConnecting =
              isActive && (connectionState === "connecting" || connectionState === "reconnecting");

            return (
              <Box
                key={prof.id}
                onClick={() => connect(prof.id)}
                style={{
                  width: isSingle ? "100%" : "88%",
                  minWidth: isSingle ? "100%" : "88%",
                  scrollSnapAlign: "center",
                  flexShrink: 0,
                  height: 124,
                  borderRadius: 14,
                  padding: "12px 14px",
                  background: isActive
                    ? isConnected
                      ? "linear-gradient(135deg, rgba(16, 185, 129, 0.28) 0%, rgba(13, 23, 42, 0.96) 60%, rgba(6, 182, 212, 0.15) 100%)"
                      : isConnecting
                        ? "linear-gradient(135deg, rgba(245, 158, 11, 0.28) 0%, rgba(13, 23, 42, 0.96) 60%, rgba(217, 119, 6, 0.15) 100%)"
                        : "linear-gradient(135deg, rgba(6, 182, 212, 0.28) 0%, rgba(13, 23, 42, 0.96) 60%, rgba(14, 165, 233, 0.15) 100%)"
                    : "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)",
                  border: isActive
                    ? isConnected
                      ? "1.5px solid rgba(16, 185, 129, 0.75)"
                      : isConnecting
                        ? "1.5px solid rgba(245, 158, 11, 0.75)"
                        : "1.5px solid rgba(6, 182, 212, 0.75)"
                    : "1px solid rgba(255, 255, 255, 0.1)",
                  boxShadow: isActive
                    ? isConnected
                      ? "0 4px 20px rgba(16, 185, 129, 0.3)"
                      : "0 4px 20px rgba(6, 182, 212, 0.3)"
                    : "0 4px 14px rgba(0, 0, 0, 0.4)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  overflow: "hidden",
                  userSelect: "none",
                  margin: "0 auto",
                }}
              >
                {/* Subtle Holographic Grid Overlay */}
                <Box
                  style={{
                    position: "absolute",
                    right: -10,
                    top: -10,
                    width: 90,
                    height: 90,
                    borderRadius: "50%",
                    background: isActive
                      ? isConnected
                        ? "radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)"
                        : "radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, transparent 70%)"
                      : "none",
                    pointerEvents: "none",
                  }}
                />

                {/* Top Row: Smart Card Chip, Protocol, Favorite */}
                <Group justify="space-between" align="center">
                  <Group gap={8} align="center">
                    <Text size="20px">{prof.serverFlag || "🛡️"}</Text>
                    <IconWifi
                      size={14}
                      color={isActive ? "var(--vpn-cyan)" : "var(--vpn-text-muted)"}
                    />
                    <Badge
                      size="xs"
                      variant="outline"
                      color={prof.protocol === "wireguard" ? "violet" : "cyan"}
                      style={{ fontSize: 8.5, height: 16, padding: "0 4px", fontWeight: 700 }}
                    >
                      {prof.protocol === "wireguard" ? "WIREGUARD" : "OPENVPN"}
                    </Badge>
                  </Group>

                  <Group gap={6} align="center">
                    {isActive && (
                      <Badge
                        size="xs"
                        variant="filled"
                        color={isConnected ? "teal" : isConnecting ? "yellow" : "cyan"}
                        leftSection={isConnected ? <IconShieldCheck size={9} /> : undefined}
                        style={{ fontSize: 8, height: 16, padding: "0 4px", fontWeight: 700 }}
                      >
                        {isConnected ? "ACTIVE" : isConnecting ? "LINKING" : "SELECTED"}
                      </Badge>
                    )}

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
                        <IconStar size={14} color="#94a3b8" />
                      )}
                    </ActionIcon>
                  </Group>
                </Group>

                {/* Center / Bottom: Cardholder Title & Virtual Number / Host */}
                <Box>
                  <Text
                    size="sm"
                    fw={800}
                    style={{
                      color: "#ffffff",
                      fontSize: 13.5,
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                    }}
                    truncate
                  >
                    {prof.name}
                  </Text>

                  <Group justify="space-between" align="flex-end" mt={2}>
                    <Text size="10px" c="dimmed" className="font-mono">
                      {prof.serverHost}:{prof.serverPort}
                    </Text>
                    <Text size="10.5px" fw={700} className="font-mono" style={{ color: "#fbbf24" }}>
                      ⚡{prof.pingMs || 36}ms
                    </Text>
                  </Group>
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* E-Wallet Pagination Indicator Dots (if > 1 profile) */}
        {totalSlides > 1 && (
          <Group justify="center" align="center" gap={5} mt={2}>
            <ActionIcon
              size="xs"
              variant="transparent"
              color="gray"
              disabled={activeSlideIndex === 0}
              onClick={() => scrollToSlide(activeSlideIndex - 1)}
            >
              <IconChevronLeft size={13} />
            </ActionIcon>

            {Array.from({ length: totalSlides }).map((_, i) => (
              <Box
                key={i}
                onClick={() => scrollToSlide(i)}
                style={{
                  width: i === activeSlideIndex ? 16 : 5,
                  height: 5,
                  borderRadius: 999,
                  background:
                    i === activeSlideIndex ? "var(--vpn-cyan)" : "rgba(255, 255, 255, 0.2)",
                  cursor: "pointer",
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            ))}

            <ActionIcon
              size="xs"
              variant="transparent"
              color="gray"
              disabled={activeSlideIndex === totalSlides - 1}
              onClick={() => scrollToSlide(activeSlideIndex + 1)}
            >
              <IconChevronRight size={13} />
            </ActionIcon>
          </Group>
        )}
      </Box>
    );
  };

  // -------------------------------------------------------------
  // DESKTOP CARD RENDERER (> 1024px): Large & Rich like Profile Library
  // -------------------------------------------------------------
  const renderDesktopCard = (prof: (typeof profiles)[0]) => {
    const isActive = prof.id === activeProfileId;
    const isConnected = isActive && connectionState === "connected";
    const isConnecting =
      isActive && (connectionState === "connecting" || connectionState === "reconnecting");

    const locationSubtitle =
      [prof.serverCity, prof.serverCountry].filter(Boolean).join(", ") || "Remote Gateway";

    const handleConnectClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isConnected) {
        disconnect();
      } else {
        connect(prof.id);
      }
    };

    return (
      <Box
        key={prof.id}
        onClick={() => connect(prof.id)}
        style={{
          width: 290,
          minWidth: 290,
          flexShrink: 0,
          padding: "14px 16px",
          borderRadius: 12,
          background: isActive
            ? isConnected
              ? "linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(17, 24, 39, 0.95) 100%)"
              : isConnecting
                ? "linear-gradient(135deg, rgba(245, 158, 11, 0.16) 0%, rgba(17, 24, 39, 0.95) 100%)"
                : "linear-gradient(135deg, rgba(6, 182, 212, 0.16) 0%, rgba(17, 24, 39, 0.95) 100%)"
            : "rgba(22, 30, 49, 0.7)",
          border: isActive
            ? isConnected
              ? "1.5px solid rgba(16, 185, 129, 0.65)"
              : isConnecting
                ? "1.5px solid rgba(245, 158, 11, 0.65)"
                : "1.5px solid rgba(6, 182, 212, 0.65)"
            : "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: isActive
            ? isConnected
              ? "0 0 20px rgba(16, 185, 129, 0.25)"
              : "0 0 20px rgba(6, 182, 212, 0.25)"
            : "0 4px 12px rgba(0, 0, 0, 0.3)",
          cursor: "pointer",
          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minHeight: 146,
          position: "relative",
          userSelect: "none",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = "rgba(35, 48, 75, 0.85)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = "rgba(22, 30, 49, 0.7)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
            e.currentTarget.style.transform = "translateY(0)";
          }
        }}
      >
        {/* Header: Flag, Name, Location, Favorite */}
        <Box>
          <Group justify="space-between" align="flex-start" wrap="nowrap" mb={6}>
            <Group gap={10} wrap="nowrap" style={{ overflow: "hidden", flex: 1 }}>
              <Text size="24px">{prof.serverFlag || "🛡️"}</Text>
              <Box style={{ overflow: "hidden", flex: 1 }}>
                <Text size="sm" fw={700} style={{ color: "#ffffff", fontSize: 13.5 }} truncate>
                  {prof.name}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {locationSubtitle}
                </Text>
              </Box>
            </Group>

            <ActionIcon
              variant="transparent"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(prof.id);
              }}
              style={{ opacity: prof.isFavorite ? 1 : 0.4, transition: "opacity 0.15s" }}
            >
              {prof.isFavorite ? (
                <IconStarFilled size={16} color="#f59e0b" />
              ) : (
                <IconStar size={16} color="#cbd5e1" />
              )}
            </ActionIcon>
          </Group>

          {/* Endpoint details & Protocol */}
          <Group justify="space-between" align="center" mt={4}>
            <Text
              size="10.5px"
              className="font-mono"
              c="dimmed"
              style={{
                background: "rgba(0, 0, 0, 0.3)",
                padding: "2px 6px",
                borderRadius: 4,
              }}
              truncate
            >
              {prof.serverHost}:{prof.serverPort}
            </Text>

            <Group gap={6}>
              <Badge
                size="xs"
                variant="outline"
                color={prof.protocol === "wireguard" ? "violet" : "cyan"}
                style={{ fontSize: 9, fontWeight: 600 }}
              >
                {prof.protocol === "wireguard" ? "WireGuard" : "OpenVPN"}
              </Badge>

              <Text size="10.5px" fw={700} className="font-mono" style={{ color: "#fbbf24" }}>
                ⚡{prof.pingMs || 36}ms
              </Text>
            </Group>
          </Group>
        </Box>

        {/* Footer Action: Status Badge & Connect/Disconnect Button */}
        <Group
          justify="space-between"
          align="center"
          mt={10}
          pt={8}
          style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
        >
          {isConnected ? (
            <Badge
              size="xs"
              variant="filled"
              color="teal"
              leftSection={<IconShieldCheck size={11} />}
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
                fontWeight: 700,
                fontSize: 9,
              }}
            >
              CONNECTED
            </Badge>
          ) : isConnecting ? (
            <Badge
              size="xs"
              variant="filled"
              color="yellow"
              style={{
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                fontWeight: 700,
                fontSize: 9,
              }}
            >
              CONNECTING...
            </Badge>
          ) : (
            <Badge
              size="xs"
              variant="light"
              color={isActive ? "cyan" : "gray"}
              style={{ fontSize: 9 }}
            >
              {isActive ? "SELECTED" : "IDLE"}
            </Badge>
          )}

          <Button
            size="xs"
            variant={isConnected ? "filled" : isActive ? "filled" : "light"}
            color={isConnected ? "red" : "cyan"}
            leftSection={<IconPower size={12} />}
            onClick={handleConnectClick}
            style={{
              height: 26,
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              background: isConnected
                ? "linear-gradient(135deg, #ef4444, #dc2626)"
                : isActive
                  ? "linear-gradient(135deg, #06b6d4, #0891b2)"
                  : "rgba(255, 255, 255, 0.06)",
            }}
          >
            {isConnected ? "Disconnect" : "Connect"}
          </Button>
        </Group>
      </Box>
    );
  };

  // -------------------------------------------------------------
  // TABLET CARD RENDERER (Comfortable Horizontal Rail)
  // -------------------------------------------------------------
  const renderTabletCard = (prof: (typeof profiles)[0]) => {
    const isActive = prof.id === activeProfileId;
    const isConnected = isActive && connectionState === "connected";
    const isConnecting =
      isActive && (connectionState === "connecting" || connectionState === "reconnecting");

    const cardWidth = 250;
    const cardHeight = 104;

    return (
      <Box
        key={prof.id}
        onClick={() => connect(prof.id)}
        style={{
          width: cardWidth,
          minWidth: cardWidth,
          height: cardHeight,
          flexShrink: 0,
          padding: "12px 14px",
          borderRadius: 12,
          background: isActive
            ? isConnected
              ? "linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(17, 24, 39, 0.95) 100%)"
              : isConnecting
                ? "linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(17, 24, 39, 0.95) 100%)"
                : "linear-gradient(135deg, rgba(6, 182, 212, 0.18) 0%, rgba(17, 24, 39, 0.95) 100%)"
            : "rgba(22, 30, 49, 0.7)",
          border: isActive
            ? isConnected
              ? "1.5px solid rgba(16, 185, 129, 0.65)"
              : isConnecting
                ? "1.5px solid rgba(245, 158, 11, 0.65)"
                : "1.5px solid rgba(6, 182, 212, 0.65)"
            : "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: isActive
            ? isConnected
              ? "0 0 16px rgba(16, 185, 129, 0.25)"
              : "0 0 16px rgba(6, 182, 212, 0.25)"
            : "0 2px 8px rgba(0, 0, 0, 0.3)",
          cursor: "pointer",
          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          userSelect: "none",
        }}
      >
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap={8} wrap="nowrap" style={{ overflow: "hidden", minWidth: 0, flex: 1 }}>
            <Box
              style={{
                width: 32,
                height: 32,
                borderRadius: 7,
                background: isActive ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 17,
                flexShrink: 0,
              }}
            >
              {prof.serverFlag || <IconServer size={15} color="var(--vpn-cyan)" />}
            </Box>
            <Box style={{ overflow: "hidden", minWidth: 0, flex: 1 }}>
              <Text
                size="xs"
                fw={isActive ? 700 : 600}
                style={{ color: isActive ? "#ffffff" : "#e2e8f0", fontSize: 13 }}
                truncate
              >
                {prof.name}
              </Text>
              <Text size="10.5px" c="dimmed" truncate>
                {prof.serverHost || prof.serverCity}
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
            style={{ opacity: prof.isFavorite ? 1 : 0.4 }}
          >
            {prof.isFavorite ? (
              <IconStarFilled size={14} color="#f59e0b" />
            ) : (
              <IconStar size={14} color="#cbd5e1" />
            )}
          </ActionIcon>
        </Group>

        <Group justify="space-between" align="center" mt={3}>
          <Group gap={5} align="center">
            <Badge
              size="xs"
              variant="outline"
              color={prof.protocol === "wireguard" ? "violet" : "cyan"}
              style={{ fontSize: 9, height: 17, padding: "0 5px" }}
            >
              {prof.protocol === "wireguard" ? "WG" : "OVPN"}
            </Badge>

            {isActive && (
              <Badge
                size="xs"
                variant="filled"
                color={isConnected ? "teal" : isConnecting ? "yellow" : "cyan"}
                style={{ fontSize: 8.5, height: 17, padding: "0 5px", fontWeight: 700 }}
              >
                {isConnected ? "ACTIVE" : isConnecting ? "LINKING" : "SELECTED"}
              </Badge>
            )}
          </Group>

          <Text size="10px" fw={700} className="font-mono" style={{ color: "#fbbf24" }}>
            ⚡{prof.pingMs || 36}ms
          </Text>
        </Group>
      </Box>
    );
  };

  const renderAddCard = () => {
    const isBig = isDesktop;
    const cardWidth = isBig ? 290 : 250;
    const cardHeight = isBig ? 146 : 104;

    return (
      <UnstyledButton
        onClick={() => setActiveTab("profiles")}
        style={{
          width: cardWidth,
          minWidth: cardWidth,
          height: cardHeight,
          minHeight: cardHeight,
          flexShrink: 0,
          borderRadius: 12,
          border: "1.5px dashed rgba(255, 255, 255, 0.18)",
          background: "rgba(255, 255, 255, 0.02)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: isBig ? 10 : 6,
          padding: isBig ? "16px" : "10px",
          color: "var(--vpn-text-muted)",
          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          userSelect: "none",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--vpn-cyan)";
          e.currentTarget.style.color = "var(--vpn-cyan)";
          e.currentTarget.style.background = "rgba(6, 182, 212, 0.06)";
          e.currentTarget.style.boxShadow = "0 0 16px rgba(6, 182, 212, 0.15)";
          e.currentTarget.style.transform = isBig ? "translateY(-2px)" : "none";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.18)";
          e.currentTarget.style.color = "var(--vpn-text-muted)";
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        <Box
          style={{
            width: isBig ? 38 : 28,
            height: isBig ? 38 : 28,
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconPlus size={isBig ? 20 : 16} stroke={2.2} />
        </Box>

        <Box style={{ textAlign: "center" }}>
          <Text size={isBig ? "sm" : "xs"} fw={700} style={{ color: "#e2e8f0" }}>
            Add / Import Profile
          </Text>
          {isBig && (
            <Text size="10.5px" c="dimmed" mt={2}>
              OpenVPN (.ovpn) or WireGuard (.conf)
            </Text>
          )}
        </Box>
      </UnstyledButton>
    );
  };

  return (
    <Box
      className="glass-panel"
      style={{
        padding: isDesktop ? "14px 16px" : isMobile ? "10px 12px" : "12px 14px",
        background: "rgba(17, 24, 39, 0.75)",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        gap: isDesktop ? "10px" : "6px",
        flexShrink: 0,
      }}
    >
      {/* Header Bar */}
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconFolder size={16} color="var(--vpn-cyan)" />
          <Text
            size="xs"
            fw={700}
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#fff",
              fontSize: isDesktop ? 12 : 11,
            }}
          >
            Quick Switch Profiles
          </Text>
          <Badge size="xs" variant="light" color="cyan" style={{ fontSize: 9.5, height: 16 }}>
            {profiles.length} Total
          </Badge>
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
          Manage All Profiles <IconArrowUpRight size={13} />
        </UnstyledButton>
      </Group>

      {/* Render Mobile Wallet Slider on Mobile, or Flex Rail on Tablet / Desktop */}
      {isMobile ? (
        renderMobileWalletDeck()
      ) : (
        <Box
          className="slim-horizontal-scrollbar"
          style={{
            display: "flex",
            gap: isDesktop ? 12 : 10,
            overflowX: "auto",
            paddingBottom: 8,
            paddingTop: 4,
            width: "100%",
          }}
        >
          {sortedProfiles.map((p) => (isDesktop ? renderDesktopCard(p) : renderTabletCard(p)))}
          {renderAddCard()}
        </Box>
      )}
    </Box>
  );
};
