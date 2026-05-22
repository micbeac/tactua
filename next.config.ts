import { withSentryConfig } from '@sentry/nextjs';
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

// Sentry wrapper : ne s'active réellement que si NEXT_PUBLIC_SENTRY_DSN est
// défini (les configs *.client/server/edge*.ts contiennent un guard).
// Si pas de DSN ni de SENTRY_AUTH_TOKEN, le plugin Webpack/Turbopack émet
// quelques warnings mais le build passe.
export default withSentryConfig(nextConfig, {
  silent: true,
  // Évite l'upload de source maps tant qu'on n'a pas configuré le token.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  disableLogger: true,
});
