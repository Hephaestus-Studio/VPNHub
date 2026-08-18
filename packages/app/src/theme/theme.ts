import { createTheme, MantineColorsTuple } from "@mantine/core";

const darkBgColors: MantineColorsTuple = [
  "#f3f4f6",
  "#e5e7eb",
  "#9ca3af",
  "#6b7280",
  "#374151",
  "#1f2937",
  "#161e2e",
  "#111827",
  "#0b0f19",
  "#050811",
];

const cyanColors: MantineColorsTuple = [
  "#ecfeff",
  "#cffafe",
  "#a5f3fc",
  "#67e8f9",
  "#22d3ee",
  "#06b6d4",
  "#0891b2",
  "#0e7490",
  "#155e75",
  "#164e63",
];

const emeraldColors: MantineColorsTuple = [
  "#ecfdf5",
  "#d1fae5",
  "#a7f3d0",
  "#6ee7b7",
  "#34d399",
  "#10b981",
  "#059669",
  "#047857",
  "#065f46",
  "#064e3b",
];

export const vpnTheme = createTheme({
  primaryColor: "cyan",
  primaryShade: 5,
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  fontFamilyMonospace: "JetBrains Mono, Menlo, Monaco, Consolas, monospace",
  headings: {
    fontFamily: "Inter, sans-serif",
    fontWeight: "600",
  },
  colors: {
    dark: darkBgColors,
    cyan: cyanColors,
    emerald: emeraldColors,
  },
  defaultRadius: "md",
  cursorType: "pointer",
});
