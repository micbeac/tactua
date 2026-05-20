import type { MetadataRoute } from 'next';

const BASE_URL = 'https://tactua.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/favoris',
          '/login',
          '/signup',
          '/reset-password',
          '/update-password',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
