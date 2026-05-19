// Client Football-Data.org v4.
// - Rate limit : sliding window 10 req / 60s (free tier).
// - Retry : 3 tentatives avec backoff exponentiel sur 429 / 5xx.
//   Respect du header Retry-After si présent.
// - Logging : préfixe [football-api], niveau ajustable via FOOTBALL_API_LOG_LEVEL.

import type {
  FdCompetition,
  FdMatch,
  FdMatchesResponse,
  FdPerson,
  FdStandingsResponse,
  FdTeam,
  FdTeamsResponse,
} from './types';

const BASE_URL = 'https://api.football-data.org/v4';
const DEFAULT_MAX_REQUESTS = 10;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_BACKOFF_MS = 1_000;

type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';
const LEVEL_RANK: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

function getLogLevel(): LogLevel {
  const env = (process.env.FOOTBALL_API_LOG_LEVEL ?? 'info').toLowerCase();
  return (env in LEVEL_RANK ? env : 'info') as LogLevel;
}

function log(level: LogLevel, ...args: unknown[]) {
  if (LEVEL_RANK[level] > LEVEL_RANK[getLogLevel()]) return;
  const fn =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : console.log;
  fn('[football-api]', ...args);
}

// ----------------------------------------------------------------------------
// Sliding-window rate limiter (in-memory, durée de vie = process serverless).
// ----------------------------------------------------------------------------
class SlidingWindowLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0];
      const wait = this.windowMs - (now - oldest) + 50; // 50 ms buffer
      log('debug', `rate limit hit, sleeping ${wait}ms`);
      await delay(wait);
      return this.acquire();
    }

    this.timestamps.push(Date.now());
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ----------------------------------------------------------------------------
// Factory
// ----------------------------------------------------------------------------
export type FootballClientOptions = {
  apiKey?: string;
  maxRequests?: number;
  windowMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
};

export function createFootballClient(options: FootballClientOptions = {}) {
  const resolvedKey = options.apiKey ?? process.env.FOOTBALL_DATA_API_KEY;
  if (!resolvedKey) {
    throw new Error(
      'FOOTBALL_DATA_API_KEY manquant (env). Impossible de créer le client Football-Data.',
    );
  }
  const apiKey: string = resolvedKey;

  const limiter = new SlidingWindowLimiter(
    options.maxRequests ?? DEFAULT_MAX_REQUESTS,
    options.windowMs ?? DEFAULT_WINDOW_MS,
  );
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseBackoffMs = options.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;

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
      await limiter.acquire();
      const started = Date.now();
      log('debug', `GET ${path}${qs ? `?${qs}` : ''} (attempt ${attempt + 1})`);

      let res: Response;
      try {
        res = await fetch(url, {
          headers: { 'X-Auth-Token': apiKey, Accept: 'application/json' },
        });
      } catch (e) {
        // Erreur réseau : on retry si on a encore des tentatives.
        if (attempt >= maxRetries) {
          log('error', `network error on ${path}`, e);
          throw e;
        }
        const wait = baseBackoffMs * 2 ** attempt;
        log('warn', `network error on ${path}, retry in ${wait}ms`);
        await delay(wait);
        attempt += 1;
        continue;
      }

      const elapsed = Date.now() - started;

      if (res.ok) {
        log('info', `GET ${path} ${res.status} (${elapsed}ms)`);
        return (await res.json()) as T;
      }

      // 429 ou 5xx → retry
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= maxRetries) {
          const body = await res.text();
          log(
            'error',
            `GET ${path} ${res.status} after ${maxRetries} retries`,
            body.slice(0, 200),
          );
          throw new Error(
            `Football-Data ${res.status} on ${path}: ${body.slice(0, 200)}`,
          );
        }
        const retryAfter = parseRetryAfter(res.headers.get('retry-after'));
        const wait = retryAfter ?? baseBackoffMs * 2 ** attempt;
        log(
          'warn',
          `GET ${path} ${res.status}, retry in ${wait}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await delay(wait);
        attempt += 1;
        continue;
      }

      // 4xx non-retryable
      const body = await res.text();
      log('error', `GET ${path} ${res.status} (no retry)`, body.slice(0, 200));
      throw new Error(
        `Football-Data ${res.status} on ${path}: ${body.slice(0, 200)}`,
      );
    }
  }

  return {
    getCompetition: (idOrCode: string | number) =>
      request<FdCompetition>(`/competitions/${idOrCode}`),

    getCompetitionTeams: (idOrCode: string | number, season?: string) =>
      request<FdTeamsResponse>(`/competitions/${idOrCode}/teams`, { season }),

    getCompetitionMatches: (
      idOrCode: string | number,
      opts: {
        dateFrom?: string;
        dateTo?: string;
        matchday?: number;
        stage?: string;
        status?: string;
      } = {},
    ) => request<FdMatchesResponse>(`/competitions/${idOrCode}/matches`, opts),

    getCompetitionStandings: (idOrCode: string | number, season?: string) =>
      request<FdStandingsResponse>(`/competitions/${idOrCode}/standings`, {
        season,
      }),

    getTeam: (id: number) => request<FdTeam>(`/teams/${id}`),

    getTeamMatches: (
      id: number,
      opts: {
        dateFrom?: string;
        dateTo?: string;
        status?: string;
        limit?: number;
      } = {},
    ) => request<FdMatchesResponse>(`/teams/${id}/matches`, opts),

    getPlayer: (id: number) => request<FdPerson>(`/persons/${id}`),

    getMatch: (id: number) => request<FdMatch>(`/matches/${id}`),
  };
}

export type FootballClient = ReturnType<typeof createFootballClient>;

// ----------------------------------------------------------------------------
// Helpers internes
// ----------------------------------------------------------------------------
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds) * 1000;
  // Le standard accepte aussi une date HTTP, mais Football-Data envoie des secondes.
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    const delta = date - Date.now();
    return delta > 0 ? delta : 0;
  }
  return undefined;
}
