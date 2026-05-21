// Client API-Football v3 (api-football.com).
// - Auth : header x-apisports-key.
// - Quota free tier : 100 req/jour.
// - Pas de rate limit fine-grained (max 10 req/min sur le serveur), donc on
//   se contente du quota journalier global lu sur chaque réponse.
// - Logging préfixé [api-football].

const BASE_URL = 'https://v3.football.api-sports.io';

type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';
const LEVEL_RANK: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

function logLevel(): LogLevel {
  const env = (process.env.API_FOOTBALL_LOG_LEVEL ?? 'info').toLowerCase();
  return (env in LEVEL_RANK ? env : 'info') as LogLevel;
}

function log(level: LogLevel, ...args: unknown[]) {
  if (LEVEL_RANK[level] > LEVEL_RANK[logLevel()]) return;
  const fn =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : console.log;
  fn('[api-football]', ...args);
}

export type ApiFootballClientOptions = {
  apiKey?: string;
  maxRetries?: number;
  baseBackoffMs?: number;
};

export function createApiFootballClient(
  options: ApiFootballClientOptions = {},
) {
  const resolvedKey = options.apiKey ?? process.env.API_FOOTBALL_KEY;
  if (!resolvedKey) {
    throw new Error('API_FOOTBALL_KEY manquant.');
  }
  const apiKey: string = resolvedKey;
  const maxRetries = options.maxRetries ?? 3;
  const baseBackoffMs = options.baseBackoffMs ?? 1_000;

  async function request<T>(
    path: string,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const params = new URLSearchParams();
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
      }
    }
    const qs = params.toString();
    const url = `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;

    let attempt = 0;
    while (true) {
      const started = Date.now();
      log('debug', `GET ${path}${qs ? `?${qs}` : ''} (attempt ${attempt + 1})`);

      let res: Response;
      try {
        res = await fetch(url, {
          headers: { 'x-apisports-key': apiKey, Accept: 'application/json' },
        });
      } catch (e) {
        if (attempt >= maxRetries) {
          log('error', `network error on ${path}`, e);
          throw e;
        }
        const wait = baseBackoffMs * 2 ** attempt;
        log('warn', `network error on ${path}, retry in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        attempt += 1;
        continue;
      }

      const elapsed = Date.now() - started;

      // Quota info dans les headers
      const dailyLeft = res.headers.get('x-ratelimit-requests-remaining');
      if (dailyLeft != null) {
        log('debug', `daily quota left: ${dailyLeft}`);
      }

      if (res.ok) {
        log(
          'info',
          `GET ${path} ${res.status} (${elapsed}ms${dailyLeft != null ? `, quota left: ${dailyLeft}` : ''})`,
        );
        return (await res.json()) as T;
      }

      if (res.status === 429 || res.status >= 500) {
        if (attempt >= maxRetries) {
          const body = await res.text();
          log(
            'error',
            `GET ${path} ${res.status} after ${maxRetries} retries`,
            body.slice(0, 200),
          );
          throw new Error(
            `API-Football ${res.status} on ${path}: ${body.slice(0, 200)}`,
          );
        }
        const retryAfter = Number(res.headers.get('retry-after')) * 1000;
        const wait =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter
            : baseBackoffMs * 2 ** attempt;
        log('warn', `GET ${path} ${res.status}, retry in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        attempt += 1;
        continue;
      }

      const body = await res.text();
      log('error', `GET ${path} ${res.status} (no retry)`, body.slice(0, 200));
      throw new Error(
        `API-Football ${res.status} on ${path}: ${body.slice(0, 200)}`,
      );
    }
  }

  return {
    /** Recherche des fixtures par date YYYY-MM-DD. */
    searchFixturesByDate: (date: string) =>
      request<import('./types').AFFixtureSearch>('/fixtures', { date }),

    /** Recherche par team_id API-Football + date. */
    searchFixturesByTeam: (teamId: number, date: string) =>
      request<import('./types').AFFixtureSearch>('/fixtures', {
        team: teamId,
        date,
      }),

    getLineups: (fixtureId: number) =>
      request<import('./types').AFLineupsResponse>('/fixtures/lineups', {
        fixture: fixtureId,
      }),

    getTeamStats: (fixtureId: number) =>
      request<import('./types').AFTeamStatsResponse>('/fixtures/statistics', {
        fixture: fixtureId,
      }),

    getPlayerStats: (fixtureId: number) =>
      request<import('./types').AFPlayerStatsResponse>('/fixtures/players', {
        fixture: fixtureId,
      }),

    /** Timeline events : buts, cartons, subs, VAR. Pour le mode live. */
    getEvents: (fixtureId: number) =>
      request<import('./types').AFEventsResponse>('/fixtures/events', {
        fixture: fixtureId,
      }),

    /** Détail d'un fixture : status (live/ht/ft), elapsed, score. */
    getFixtureDetail: (fixtureId: number) =>
      request<import('./types').AFFixtureDetail>('/fixtures', {
        id: fixtureId,
      }),
  };
}

export type ApiFootballClient = ReturnType<typeof createApiFootballClient>;
