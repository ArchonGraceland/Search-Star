import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/spec', destination: '/spec.html', permanent: false },
      { source: '/roadmap', destination: '/roadmap.html', permanent: false },
    ]
  },
};

export default nextConfig;
