import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next's dev server 403s cross-origin requests to _next/static chunks by
  // default, which silently breaks React hydration (and every onClick) when
  // testing from a LAN IP instead of localhost — this is why client-side
  // interactivity looked broken during live testing on 192.168.1.23.
  allowedDevOrigins: ["192.168.1.23"],
  experimental: {
    // Default is 1MB, which a base64-encoded atestado/admissional photo
    // blows past immediately ("Body exceeded 1 MB limit"). Matches the
    // Nest API's own useBodyParser('json', { limit: '10mb' }) in main.ts.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
