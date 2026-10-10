"use client";

import { useEffect } from "react";

// In an installed iOS web app the CSS viewport can be shorter than the
// screen by the status bar height while the page is still drawn from the
// top, which leaves an empty band at the bottom. When the app runs
// standalone, size the shell from the larger of the window and the screen.
export function StandaloneViewport() {
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    const root = document.documentElement;
    const update = () => {
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      const screenHeight = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
      root.style.setProperty("--app-height", `${Math.max(window.innerHeight, screenHeight)}px`);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      root.style.removeProperty("--app-height");
    };
  }, []);
  return null;
}
