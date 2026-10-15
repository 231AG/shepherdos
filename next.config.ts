import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the demo is plain HTML/JS served from Vercel's CDN.
  output: "export",
  // Emit /members/index.html so clean URLs work on any static host.
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
