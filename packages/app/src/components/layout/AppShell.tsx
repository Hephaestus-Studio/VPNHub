import React, { useEffect } from "react";
import { Box } from "@mantine/core";
import { Titlebar } from "./Titlebar";
import { Sidebar } from "./Sidebar";
import { SplitPaneLayout } from "./SplitPaneLayout";
import { BottomStatusBar } from "./BottomStatusBar";
import { MobileBottomNavBar } from "./MobileBottomNavBar";
import { SpotlightSearch } from "./SpotlightSearch";
import { DashboardView } from "../dashboard/DashboardView";
import { ProfileLibraryView } from "../profiles/ProfileLibraryView";
import { SecurityHubView } from "../security/SecurityHubView";
import { LogConsoleView } from "../logs/LogConsoleView";
import { SettingsView } from "../settings/SettingsView";
import { MiniTrayWidget } from "../tray/MiniTrayWidget";
import { WindowResizeBorders } from "./WindowResizeBorders";
import { ConnectMfaModal } from "../profiles/ConnectMfaModal";
import { useVpnStore } from "../../state/useVpnStore";
import styles from "./AppShell.module.css";

export const AppShell: React.FC = () => {
  const { activeTab, isCompactWidget, mfaPromptProfile, setMfaPromptProfile, connect } =
    useVpnStore();

  useEffect(() => {
    let resizeTimer: number;
    const handleResize = () => {
      document.body.classList.add("is-resizing");
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        document.body.classList.remove("is-resizing");
      }, 100);
    };

    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  // Handle Auto-Reconnect when network adapter connectivity is restored
  useEffect(() => {
    const handleOnline = () => {
      const state = useVpnStore.getState();
      if (
        state.appSettings.autoReconnect &&
        state.activeProfileId &&
        state.connectionState !== "connected" &&
        state.connectionState !== "connecting"
      ) {
        state.addLog(
          "INFO",
          "NETWORK_ADAPTER",
          "Network connectivity restored. Auto-reconnecting VPN tunnel..."
        );
        state.connect(state.activeProfileId);
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const renderActiveView = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardView />;
      case "profiles":
        return <ProfileLibraryView />;
      case "security":
        return <SecurityHubView />;
      case "logs":
        return <LogConsoleView />;
      case "settings":
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  if (isCompactWidget) {
    return (
      <Box className={styles.compactWrapper}>
        <MiniTrayWidget />
      </Box>
    );
  }

  return (
    <Box className={styles.root}>
      {/* Top Custom Frameless Titlebar */}
      <Titlebar />

      {/* Main Center Area: SplitPane Sidebar + Workspace */}
      <SplitPaneLayout
        sidebar={({ isCompact, onToggleCollapse }) => (
          <Sidebar isCompact={isCompact} onToggleCollapse={onToggleCollapse} />
        )}
      >
        {renderActiveView()}
      </SplitPaneLayout>

      {/* Mobile Responsive Bottom Navigation Bar */}
      <MobileBottomNavBar />

      {/* Bottom Persistent Statusbar */}
      <BottomStatusBar />

      {/* Global Spotlight Search Palette */}
      <SpotlightSearch />

      {/* Dynamic 2FA / TOTP Prompt Modal */}
      <ConnectMfaModal
        opened={Boolean(mfaPromptProfile)}
        onClose={() => setMfaPromptProfile(null)}
        profile={mfaPromptProfile}
        onConfirm={(dynamicPass) => {
          if (mfaPromptProfile) {
            connect(mfaPromptProfile.id, dynamicPass);
          }
        }}
      />

      {/* 8-Direction Frameless Window Resize Handles */}
      <WindowResizeBorders />
    </Box>
  );
};
