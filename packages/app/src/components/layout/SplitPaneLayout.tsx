import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

interface SplitPaneLayoutProps {
  sidebar: (props: {
    width: number;
    isCompact: boolean;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
  }) => React.ReactNode;
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  collapsedWidth?: number;
  storageWidthKey?: string;
  storageCollapsedKey?: string;
}

export const SplitPaneLayout: React.FC<SplitPaneLayoutProps> = ({
  sidebar,
  children,
  defaultWidth = 230,
  minWidth = 230,
  maxWidth = 380,
  collapsedWidth = 62,
  storageWidthKey = "vpnhub_sidebar_width",
  storageCollapsedKey = "vpnhub_sidebar_collapsed",
}) => {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(min-width: 641px) and (max-width: 920px)");

  // Persisted expanded width strictly clamped between minWidth and maxWidth
  const [expandedWidth, setExpandedWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageWidthKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) {
          return Math.min(Math.max(parsed, minWidth), maxWidth);
        }
      }
    } catch {
      // Fallback
    }
    return defaultWidth;
  });

  // Explicit collapsed state (toggled via button / hotkey)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageCollapsedKey) === "true";
    } catch {
      return false;
    }
  });

  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Responsive width calculation:
  // On Mobile (< 640px): width = 0 (completely hidden, uses MobileBottomNavBar instead)
  // On Tablet (641px - 920px): force compact icon mode (62px)
  // On Desktop (>= 921px): respect user expanded/collapsed preference
  const effectiveCollapsed = isTablet ? true : isCollapsed;
  const currentWidth = isMobile ? 0 : effectiveCollapsed ? collapsedWidth : expandedWidth;
  const isCompact = isMobile || effectiveCollapsed;

  const handleToggleCollapse = useCallback(() => {
    if (isMobile) return;
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageCollapsedKey, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [isMobile, storageCollapsedKey]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Disable dragging resize when on small tablet/mobile
      if (isMobile || isTablet) return;

      e.preventDefault();
      setIsDragging(true);
      if (isCollapsed) {
        setIsCollapsed(false);
        try {
          localStorage.setItem(storageCollapsedKey, "false");
        } catch {
          // ignore
        }
      }
    },
    [isMobile, isTablet, isCollapsed, storageCollapsedKey]
  );

  // Global shortcut Ctrl+B / Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleToggleCollapse();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleCollapse]);

  useEffect(() => {
    if (!isDragging) return;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const rawWidth = e.clientX - containerRect.left;

      // Strict clamping: NEVER resize smaller than minWidth (230px)
      const clampedWidth = Math.min(Math.max(rawWidth, minWidth), maxWidth);

      setExpandedWidth(clampedWidth);
      try {
        localStorage.setItem(storageWidthKey, String(clampedWidth));
      } catch {
        // ignore
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, minWidth, maxWidth, storageWidthKey]);

  return (
    <Box
      ref={containerRef}
      style={{
        display: "flex",
        flex: 1,
        overflow: "hidden",
        position: "relative",
        width: "100%",
        height: "100%",
      }}
    >
      {/* Sidebar Pane with Smooth Width Transition */}
      {!isMobile && (
        <Box
          style={{
            width: currentWidth,
            height: "100%",
            flexShrink: 0,
            position: "relative",
            transition: isDragging ? "none" : "width 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
            overflow: "hidden",
          }}
        >
          {sidebar({
            width: currentWidth,
            isCompact,
            isCollapsed: effectiveCollapsed,
            onToggleCollapse: handleToggleCollapse,
          })}
        </Box>
      )}

      {/* Splitter Resizer Handle (Gutter) - active on Desktop */}
      {!isMobile && !isTablet && (
        <Box
          onMouseDown={handleMouseDown}
          onDoubleClick={handleToggleCollapse}
          title={
            isCollapsed
              ? "Double click to expand sidebar"
              : "Drag to resize sidebar / Double click to collapse"
          }
          style={{
            width: 6,
            height: "100%",
            cursor: "col-resize",
            position: "relative",
            zIndex: 40,
            marginLeft: -3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none",
            flexShrink: 0,
          }}
        >
          {/* Visual Divider Line */}
          <Box
            style={{
              width: isDragging ? 2 : 1,
              height: "100%",
              background: isDragging ? "var(--vpn-cyan)" : "var(--vpn-border)",
              boxShadow: isDragging ? "0 0 10px rgba(6, 182, 212, 0.85)" : "none",
              transition: "all 0.15s ease",
            }}
          />
        </Box>
      )}

      {/* Main Workspace Pane */}
      <Box
        component="main"
        style={{
          flex: 1,
          height: "100%",
          overflow: "hidden",
          background: "var(--vpn-bg-base)",
          position: "relative",
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
