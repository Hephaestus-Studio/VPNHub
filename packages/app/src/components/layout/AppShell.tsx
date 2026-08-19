import React, { useEffect } from "react";
import { Box } from "@mantine/core";
import { Titlebar } from "./Titlebar";
import { Sidebar } from "./Sidebar";
import { BottomStatusBar } from "./BottomStatusBar";
import { SpotlightSearch } from "./SpotlightSearch";
import { DashboardView } from "../dashboard/DashboardView";
import { ProfileLibraryView } from "../profiles/ProfileLibraryView";
import { SecurityHubView } from "../security/SecurityHubView";
import { SplitTunnelingView } from "../split_tunnel/SplitTunnelingView";
import { LogConsoleView } from "../logs/LogConsoleView";
import { DiagnosticsView } from "../diagnostics/DiagnosticsView";
import { SettingsView } from "../settings/SettingsView";
import { MiniTrayWidget } from "../tray/MiniTrayWidget";
import { WindowResizeBorders } from "./WindowResizeBorders";
import { ConnectMfaModal } from "../profiles/ConnectMfaModal";
import { useVpnStore } from "../../state/useVpnStore";

export const AppShell: React.FC = () => {
  const {
    activeTab,
    isCompactWidget,
    mfaPromptProfile,
    setMfaPromptProfile,
    connect,
    loadStorage,
  } = useVpnStore();

  useEffect(() => {
    loadStorage();
  }, [loadStorage]);

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

  const renderActiveView = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardView />;
      case "profiles":
        return <ProfileLibraryView />;
      case "security":
        return <SecurityHubView />;
      case "split-tunneling":
        return <SplitTunnelingView />;
      case "logs":
        return <LogConsoleView />;
      case "diagnostics":
        return <DiagnosticsView />;
      case "settings":
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  if (isCompactWidget) {
    return (
      <Box
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0, 0, 0, 0.7)",
        }}
      >
        <MiniTrayWidget />
      </Box>
    );
  }

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "var(--vpn-bg-base)",
      }}
    >
      {/* Top Custom Frameless Titlebar */}
      <Titlebar />

      {/* Main Center Area: Sidebar + Workspace */}
      <Box
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <Sidebar />

        <Box
          component="main"
          style={{
            flex: 1,
            overflow: "hidden",
            background: "var(--vpn-bg-base)",
          }}
        >
          {renderActiveView()}
        </Box>
      </Box>

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
