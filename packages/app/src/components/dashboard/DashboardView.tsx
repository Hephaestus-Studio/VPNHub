import React from "react";
import { Box } from "@mantine/core";
import { HeroCockpitBanner } from "./HeroCockpitBanner";
import { DashboardProfileDeck } from "./DashboardProfileDeck";
import { DashboardFullLogStream } from "./DashboardFullLogStream";

export const DashboardView: React.FC = () => {
  return (
    <Box
      style={{
        padding: "14px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* 1. TOP: Master Hero Cockpit (Power Trigger + Security Telemetry + Live Speed Graph) */}
      <HeroCockpitBanner />

      {/* 2. MIDDLE: Quick Switch Profiles (Horizontal Card Deck) */}
      <DashboardProfileDeck />

      {/* 3. BOTTOM: Full-Width & Full-Height Live Activity & Tunnel Log Stream */}
      <DashboardFullLogStream />
    </Box>
  );
};
