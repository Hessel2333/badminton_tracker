import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "public.blob.vercel-storage.com"
      },
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com"
      }
    ]
  }
};

export default nextConfig;
