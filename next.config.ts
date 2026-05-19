import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Logos d'équipes Football-Data.org
      { protocol: 'https', hostname: 'crests.football-data.org' },
    ],
  },
};

export default nextConfig;
