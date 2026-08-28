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
import { useTranslation } from "../../i18n";
import styles from "./DashboardProfileDeck.module.css";

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
  const { t } = useTranslation();

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
          className={isSingle ? styles.mobileSliderContainerSingle : styles.mobileSliderContainer}
        >
          {sortedProfiles.map((prof) => {
            const isActive = prof.id === activeProfileId;
            const isConnected = isActive && connectionState === "connected";
            const isConnecting =
              isActive && (connectionState === "connecting" || connectionState === "reconnecting");

            let cardClass = isSingle ? styles.mobileCardSingle : styles.mobileCard;
            if (isActive) {
              if (isConnected) cardClass = styles.mobileCardActiveConnected;
              else if (isConnecting) cardClass = styles.mobileCardActiveConnecting;
              else cardClass = styles.mobileCardActiveSelected;
            }

            return (
              <Box key={prof.id} onClick={() => connect(prof.id)} className={cardClass}>
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
                  <Text size="sm" fw={800} className={styles.mobileCardTitle} truncate>
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
                className={
                  i === activeSlideIndex ? styles.mobileDotActive : styles.mobileDotInactive
                }
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

    let desktopCardClass = styles.desktopCard;
    if (isActive) {
      if (isConnected) desktopCardClass = styles.desktopCardActiveConnected;
      else if (isConnecting) desktopCardClass = styles.desktopCardActiveConnecting;
      else desktopCardClass = styles.desktopCardActiveSelected;
    }

    return (
      <Box key={prof.id} onClick={() => connect(prof.id)} className={desktopCardClass}>
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
            <Text size="10.5px" className={`font-mono ${styles.hostPill}`} c="dimmed" truncate>
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
            className={
              isConnected
                ? styles.desktopConnectBtnConnected
                : isActive
                  ? styles.desktopConnectBtnActive
                  : styles.desktopConnectBtn
            }
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

    let tabletClass = styles.tabletCard;
    if (isActive) {
      if (isConnected) tabletClass = styles.tabletCardActiveConnected;
      else if (isConnecting) tabletClass = styles.tabletCardActiveConnecting;
      else tabletClass = styles.tabletCardActiveSelected;
    }

    return (
      <Box key={prof.id} onClick={() => connect(prof.id)} className={tabletClass}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap={8} wrap="nowrap" style={{ overflow: "hidden", minWidth: 0, flex: 1 }}>
            <Box className={isActive ? styles.tabletIconBoxActive : styles.tabletIconBox}>
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

    return (
      <UnstyledButton
        onClick={() => setActiveTab("profiles")}
        className={isBig ? styles.addCardBtnDesktop : styles.addCardBtnTablet}
      >
        <Box
          className={styles.addIconCircle}
          style={{
            width: isBig ? 38 : 28,
            height: isBig ? 38 : 28,
          }}
        >
          <IconPlus size={isBig ? 20 : 16} stroke={2.2} />
        </Box>

        <Box style={{ textAlign: "center" }}>
          <Text size={isBig ? "sm" : "xs"} fw={700} style={{ color: "#e2e8f0" }}>
            {t.profiles.addProfile}
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

  let containerClass = styles.container;
  if (isMobile) containerClass = styles.containerMobile;
  else if (isTablet) containerClass = styles.containerTablet;

  return (
    <Box className={`glass-panel ${containerClass}`}>
      {/* Header Bar */}
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconFolder size={16} color="var(--vpn-cyan)" />
          <Text
            size="xs"
            fw={700}
            className={isDesktop ? styles.headerTitle : styles.headerTitleMobile}
          >
            {t.dashboard.quickSwitchTitle}
          </Text>
          <Badge size="xs" variant="light" color="cyan" style={{ fontSize: 9.5, height: 16 }}>
            {profiles.length} {t.common.all}
          </Badge>
        </Group>

        <UnstyledButton onClick={() => setActiveTab("profiles")} className={styles.manageButton}>
          {t.dashboard.manageAll} <IconArrowUpRight size={13} />
        </UnstyledButton>
      </Group>

      {/* Render Mobile Wallet Slider on Mobile, or Flex Rail on Tablet / Desktop */}
      {isMobile ? (
        renderMobileWalletDeck()
      ) : (
        <Box
          className={`slim-horizontal-scrollbar ${styles.scrollRail}`}
          style={{
            gap: isDesktop ? 12 : 10,
          }}
        >
          {sortedProfiles.map((p) => (isDesktop ? renderDesktopCard(p) : renderTabletCard(p)))}
          {renderAddCard()}
        </Box>
      )}
    </Box>
  );
};
