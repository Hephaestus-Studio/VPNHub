import React from "react";
import { Box } from "@mantine/core";
import { HeroCockpitBanner } from "./HeroCockpitBanner";
import { DashboardProfileDeck } from "./DashboardProfileDeck";
import { DashboardFullLogStream } from "./DashboardFullLogStream";
import styles from "./DashboardView.module.css";

export const DashboardView: React.FC = () => {
  return (
    <Box className={styles.root}>
      {/* 1. TOP: Master Hero Cockpit (Power Trigger + Security Telemetry + Live Speed Graph) */}
      <HeroCockpitBanner />

      {/* 2. MIDDLE: Quick Switch Profiles (Horizontal Card Deck) */}
      <DashboardProfileDeck />

      {/* 3. BOTTOM: Full-Width & Full-Height Live Activity & Tunnel Log Stream */}
      <DashboardFullLogStream />
    </Box>
  );
};
