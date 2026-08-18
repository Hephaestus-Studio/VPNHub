import React from "react";
import { Box, SimpleGrid, Stack } from "@mantine/core";
import { HeroConnectionCard } from "./HeroConnectionCard";
import { TelemetrySparkline } from "./TelemetrySparkline";
import { ProfileCarousel } from "./ProfileCarousel";
import { MiniActivityFeed } from "./MiniActivityFeed";

export const DashboardView: React.FC = () => {
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
      {/* Master 2-Column / Split Layout */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" style={{ alignItems: "stretch" }}>
        {/* Left Column: Hero Status Card & Quick Profile Switcher */}
        <Stack gap="md">
          <HeroConnectionCard />
          <ProfileCarousel />
        </Stack>

        {/* Right Column: Telemetry Sparkline & Mini Activity Logs */}
        <Stack gap="md">
          <TelemetrySparkline />
          <MiniActivityFeed />
        </Stack>
      </SimpleGrid>
    </Box>
  );
};
