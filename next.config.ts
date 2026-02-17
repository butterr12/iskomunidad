import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.storage.railway.app" },
      { protocol: "https", hostname: "*.storageapi.dev" },
      { protocol: "https", hostname: "maps.googleapis.com" },
      { protocol: "https", hostname: "places.googleapis.com" },
    ],
  },
};

export default nextConfig;
