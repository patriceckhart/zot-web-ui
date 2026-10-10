import type { MetadataRoute } from "next";

// A manifest makes iOS and Android run the installed app in real standalone
// mode. Without it iOS uses a legacy mode whose viewport is shorter than the
// screen, which leaves an empty band at the bottom.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "zot",
    short_name: "zot",
    description: "Browser client for zot continuous hosts.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
