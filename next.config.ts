import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/rechizite-bancare",
        destination: "/rechizitele-bancare",
        permanent: true,
      },
      {
        source: "/servicii",
        destination: "/serviciile-noastre",
        permanent: true,
      },
      {
        source: "/servicii/:slug*",
        destination: "/serviciile-noastre/:slug*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
