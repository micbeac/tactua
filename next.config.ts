import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Logos d'équipes Football-Data.org
      { protocol: 'https', hostname: 'crests.football-data.org' },
      // Logos d'équipes + photos joueurs API-Football (utilisés pour JPL et squads)
      { protocol: 'https', hostname: 'media.api-sports.io' },
    ],
  },
  async redirects() {
    return [
      // /calendrier a été fusionné dans l'accueil (bloc "Matchs du jour")
      { source: '/calendrier', destination: '/', permanent: true },
    ];
  },
};

// NOTE Sentry : le wrapper `withSentryConfig` a été retiré — il cassait le
// build Vercel (Next 16 + Turbopack + étape "modifyConfig from Vercel" →
// TypeError "path undefined"). Le monitoring Sentry est optionnel et n'était
// pas réellement configuré (pas d'auth token). Pour le réactiver plus tard :
// re-wrapper ici via withSentryConfig + ajouter `instrumentation.ts`, avec
// une config compatible Turbopack (sans `disableLogger`, déprécié).
export default nextConfig;
