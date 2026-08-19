import React from "react";
import ReactDOM from "react-dom/client";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dropzone/styles.css";
import "./styles/globals.css";
import App from "./App";

// Disable native web drag & drop and unwanted context menu
if (typeof window !== "undefined") {
  window.addEventListener("dragstart", (e) => e.preventDefault());

  // Prevent default browser context menu on non-input elements
  window.addEventListener("contextmenu", (e) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName !== "INPUT" &&
      target.tagName !== "TEXTAREA" &&
      !target.isContentEditable &&
      !target.closest(".selectable-text")
    ) {
      e.preventDefault();
    }
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
