// Composant universel pour injecter du JSON-LD Schema.org dans les pages.
// Lu par Google pour les rich snippets et par les LLMs (ChatGPT, Perplexity)
// pour les citations.

import { SITE_NAME, SITE_URL } from '@/lib/site';

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

type TeamRef = {
  id: number;
  name: string;
  logo_url?: string | null;
  country?: string | null;
};

/** Organization — identité de marque, site-wide (à mettre dans le layout). */
export function buildOrganizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description:
      "Tactuo — plateforme d'analyse de football augmentée par l'IA : " +
      'compositions, statistiques, analyses tactiques et prédictions. ' +
      "Ce n'est pas le médicament Tactuo (acné).",
  };
}

/** WebSite + SearchAction — active la recherche directe depuis Google. */
export function buildWebsiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: 'fr-FR',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** FAQPage — à partir de la FAQ de la landing. */
export function buildFaqPageJsonLd(
  items: Array<{ question: string; answer: string }>,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: it.answer,
      },
    })),
  };
}

export function buildSportsEventJsonLd(args: {
  match_id: number;
  home: TeamRef | null;
  away: TeamRef | null;
  competition_name: string | null;
  kickoff_at_iso: string;
  venue: string | null;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
}): Record<string, unknown> {
  const home = args.home;
  const away = args.away;
  const eventStatus =
    args.status === 'cancelled'
      ? 'https://schema.org/EventCancelled'
      : args.status === 'postponed'
        ? 'https://schema.org/EventPostponed'
        : args.status === 'finished'
          ? 'https://schema.org/EventScheduled'
          : 'https://schema.org/EventScheduled';

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${home?.name ?? 'Domicile'} vs ${away?.name ?? 'Extérieur'}`,
    url: `${SITE_URL}/matches/${args.match_id}`,
    startDate: args.kickoff_at_iso,
    eventStatus,
    sport: 'Football',
    ...(args.competition_name && {
      superEvent: {
        '@type': 'SportsEvent',
        name: args.competition_name,
      },
    }),
    ...(args.venue && {
      location: {
        '@type': 'Place',
        name: args.venue,
      },
    }),
    ...(home && {
      homeTeam: {
        '@type': 'SportsTeam',
        name: home.name,
        ...(home.logo_url && { logo: home.logo_url }),
      },
    }),
    ...(away && {
      awayTeam: {
        '@type': 'SportsTeam',
        name: away.name,
        ...(away.logo_url && { logo: away.logo_url }),
      },
    }),
  };
}

export function buildSportsTeamJsonLd(args: {
  team_id: number;
  name: string;
  logo_url?: string | null;
  country?: string | null;
  founded?: number | null;
  venue?: string | null;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: args.name,
    url: `${SITE_URL}/teams/${args.team_id}`,
    sport: 'Football',
    ...(args.logo_url && { logo: args.logo_url }),
    ...(args.country && {
      location: { '@type': 'Country', name: args.country },
    }),
    ...(args.founded && { foundingDate: String(args.founded) }),
    ...(args.venue && {
      memberOf: {
        '@type': 'Place',
        name: args.venue,
      },
    }),
  };
}

export function buildPersonJsonLd(args: {
  player_id: number;
  name: string;
  position?: string | null;
  nationality?: string | null;
  date_of_birth?: string | null;
  current_team_name?: string | null;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: args.name,
    url: `${SITE_URL}/players/${args.player_id}`,
    ...(args.position && { jobTitle: args.position }),
    ...(args.nationality && { nationality: args.nationality }),
    ...(args.date_of_birth && { birthDate: args.date_of_birth }),
    ...(args.current_team_name && {
      memberOf: {
        '@type': 'SportsTeam',
        name: args.current_team_name,
      },
    }),
  };
}
