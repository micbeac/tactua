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
        : 'https://schema.org/EventScheduled';

  const homeName = home?.name ?? 'Domicile';
  const awayName = away?.name ?? 'Extérieur';
  const name = `${homeName} vs ${awayName}`;
  const url = `${SITE_URL}/matches/${args.match_id}`;
  const competitionName = args.competition_name ?? 'Football';

  // Durée estimée d'un match : 2 h. Sert d'endDate raisonnable pour Google.
  const startTs = new Date(args.kickoff_at_iso).getTime();
  const endDate = Number.isFinite(startTs)
    ? new Date(startTs + 2 * 60 * 60 * 1000).toISOString()
    : undefined;

  // Image principale : logo équipe domicile, puis extérieur, puis OG du site.
  const image = home?.logo_url ?? away?.logo_url ?? `${SITE_URL}/logo.png`;

  // performer : les deux équipes en SportsTeam (champ recommandé Google).
  const performer = [home, away]
    .filter((t): t is TeamRef => Boolean(t))
    .map((t) => ({
      '@type': 'SportsTeam',
      name: t.name,
      ...(t.logo_url && { logo: t.logo_url }),
    }));

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name,
    url,
    description: `${homeName} affronte ${awayName} en ${competitionName}. Compositions, score et analyse tactique sur Tactuo.`,
    startDate: args.kickoff_at_iso,
    ...(endDate && { endDate }),
    eventStatus,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    sport: 'Football',
    image,
    // location : toujours présent (champ critique pour Google). Fallback
    // sur un Place générique quand le stade n'est pas renseigné en base.
    location: {
      '@type': 'Place',
      name: args.venue ?? 'Stade à confirmer',
    },
    organizer: {
      '@type': 'SportsOrganization',
      name: args.competition_name ?? SITE_NAME,
    },
    ...(performer.length > 0 && { performer }),
    ...(args.competition_name && {
      superEvent: {
        '@type': 'SportsEvent',
        name: args.competition_name,
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
