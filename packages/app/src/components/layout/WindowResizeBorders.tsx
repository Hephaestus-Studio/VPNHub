import React from "react";
import { Box } from "@mantine/core";
import { IpcBridge } from "../../services/ipcBridge";

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const WindowResizeBorders: React.FC = () => {
  const handleMouseDown = (e: React.MouseEvent, direction: ResizeDirection) => {
    if (e.button !== 0) return; // only left click
    e.preventDefault();
    e.stopPropagation();

    // Call native OS-level window resize drag handler
    IpcBridge.startResizeDragging(direction);
  };

  const handleStyle = {
    position: "absolute" as const,
    zIndex: 99999,
    pointerEvents: "auto" as const,
  };

  return (
    <>
      {/* 4 Edges */}
      {/* Top Edge */}
      <Box
        onMouseDown={(e) => handleMouseDown(e, "n")}
        style={{
          ...handleStyle,
          top: 0,
          left: 10,
          right: 10,
          height: 6,
          cursor: "ns-resize",
        }}
      />
      {/* Bottom Edge */}
      <Box
        onMouseDown={(e) => handleMouseDown(e, "s")}
        style={{
          ...handleStyle,
          bottom: 0,
          left: 10,
          right: 10,
          height: 6,
          cursor: "ns-resize",
        }}
      />
      {/* Left Edge */}
      <Box
        onMouseDown={(e) => handleMouseDown(e, "w")}
        style={{
          ...handleStyle,
          left: 0,
          top: 10,
          bottom: 10,
          width: 6,
          cursor: "ew-resize",
        }}
      />
      {/* Right Edge */}
      <Box
        onMouseDown={(e) => handleMouseDown(e, "e")}
        style={{
          ...handleStyle,
          right: 0,
          top: 10,
          bottom: 10,
          width: 6,
          cursor: "ew-resize",
        }}
      />

      {/* 4 Corners */}
      {/* Top-Left Corner */}
      <Box
        onMouseDown={(e) => handleMouseDown(e, "nw")}
        style={{
          ...handleStyle,
          top: 0,
          left: 0,
          width: 12,
          height: 12,
          cursor: "nwse-resize",
        }}
      />
      {/* Top-Right Corner */}
      <Box
        onMouseDown={(e) => handleMouseDown(e, "ne")}
        style={{
          ...handleStyle,
          top: 0,
          right: 0,
          width: 12,
          height: 12,
          cursor: "nesw-resize",
        }}
      />
      {/* Bottom-Left Corner */}
      <Box
        onMouseDown={(e) => handleMouseDown(e, "sw")}
        style={{
          ...handleStyle,
          bottom: 0,
          left: 0,
          width: 12,
          height: 12,
          cursor: "nesw-resize",
        }}
      />
      {/* Bottom-Right Corner */}
      <Box
        onMouseDown={(e) => handleMouseDown(e, "se")}
        style={{
          ...handleStyle,
          bottom: 0,
          right: 0,
          width: 12,
          height: 12,
          cursor: "nwse-resize",
        }}
      />
    </>
  );
};
