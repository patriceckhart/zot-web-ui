import type { NextConfig } from "next";

// Static export: the app is a pure client that talks to a zot host through
// the WebSocket endpoint of `zot continuous serve --web`. Nothing runs server side, so it deploys to any static
// host, including Vercel.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
