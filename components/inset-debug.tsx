"use client";

import { useEffect, useState } from "react";

// Diagnostic overlay for the installed iOS app. Open the app with ?insets to
// see the safe-area values the device reports and the inset the layout uses.
export function InsetDebug() {
  const [info, setInfo] = useState("");
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("insets")) return;
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);margin-top:var(--top-inset)";
    document.body.appendChild(probe);
    const update = () => {
      const cs = getComputedStyle(probe);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      setInfo(
        `top ${cs.paddingTop} bottom ${cs.paddingBottom} used ${cs.marginTop} standalone ${standalone} vh ${window.innerHeight} screen ${window.screen.height}`,
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      probe.remove();
    };
  }, []);
  if (!info) return null;
  return <div className="fixed bottom-24 left-2 right-2 z-50 bg-zot p-2 text-xs text-black">{info}</div>;
}
