import type { Metadata } from 'next';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { MatchCard } from '@/components/match/MatchCard';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Calendrier · Tous les matchs du jour',
  description:
    'Tous les matchs de foot du jour : Top 5, Champions League, Coupe du Monde, Jupiler League. Filtrable par date.',
};

export const revalidate = 60;

const DATE_LABEL_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});

const SHORT_LABEL_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Paris',
});

// Mapping compétition → emoji drapeau (cohérent avec la home)
const COMPETITION_FLAGS: Record<string, string> = {
  WC: '🌍',
  CL: '🇪🇺',
  PL: '🏴',
  PD: '🇪🇸',
  SA: '🇮🇹',
  BL1: '🇩🇪',
  FL1: '🇫🇷',
  BJL: '🇧🇪',
  EL: '🟠',
};

const COMPETITION_ORDER: Record<string, number> = {
  WC: 0,
  CL: 1,
  EL: 2,
  PL: 3,
  PD: 4,
  SA: 5,
  BL1: 6,
  FL1: 7,
  BJL: 8,
};

type TeamEmbed = {
  id: number;
  name: string;
  tla: string | null;
  logo_url: string | null;
} | null;

type CompetitionEmbed = {
  id: number;
  code: string | null;
  name: string;
} | null;

type MatchRow = {
  id: number;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  stage: string | null;
  matchday: number | null;
  score_home: number | null;
  score_away: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  competition: CompetitionEmbed;
  home_team: TeamEmbed;
  away_team: TeamEmbed;
};

const SELECT = `
  id, kickoff_at, status, stage, matchday, score_home, score_away,
  home_team_id, away_team_id,
  competition:competitions(id, code, name),
  home_team:teams!matches_home_team_id_fkey(id, name, tla, logo_url),
  away_team:teams!matches_away_team_id_fkey(id, name, tla, logo_url)
`;

/**
 * Renvoie [start, end] ISO UTC pour la journée Paris d'un YYYY-MM-DD.
 * Gère automatiquement DST (UTC+1 hiver, UTC+2 été).
 */
function parisDayRange(dateYmd: string): { start: string; end: string } {
  // On part de midi UTC du jour (loin des bornes DST) et on calcule
  // l'offset Paris à cet instant. Puis on remonte de (12h + offset) pour
  // tomber sur 00:00 Paris.
  const noonUtcMs = Date.parse(`${dateYmd}T12:00:00Z`);
  const parisHourAtNoonUtc = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Paris',
      hour: 'numeric',
      hour12: false,
    }).format(new Date(noonUtcMs)),
    10,
  );
  const offsetHours = parisHourAtNoonUtc - 12; // 1 ou 2
  const startMs = noonUtcMs - (12 + offsetHours) * 3_600_000;
  const endMs = startMs + 24 * 3_600_000;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  };
}

function isoPrevDay(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
function isoNextDay(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Date d'aujourd'hui en YYYY-MM-DD selon Paris */
function todayParis(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' });
  return fmt.format(new Date());
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

type SearchParams = Promise<{ date?: string }>;

export default async function CalendrierPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { date: dateParam } = await searchParams;
  const today = todayParis();
  const date =
    dateParam && isValidDate(dateParam) ? dateParam : today;

  const { start, end } = parisDayRange(date);
  const supabase = await createClient();

  const { data } = await supabase
    .from('matches')
    .select(SELECT)
    .gte('kickoff_at', start)
    .lt('kickoff_at', end)
    .order('kickoff_at', { ascending: true });

  const matches = (data ?? []) as unknown as MatchRow[];

  // Group by competition
  type Group = {
    code: string;
    name: string;
    flag: string;
    matches: MatchRow[];
  };
  const groupsMap = new Map<string, Group>();
  for (const m of matches) {
    const code = m.competition?.code ?? 'XX';
    const name = m.competition?.name ?? 'Autre';
    const g = groupsMap.get(code) ?? {
      code,
      name,
      flag: COMPETITION_FLAGS[code] ?? '⚽',
      matches: [],
    };
    g.matches.push(m);
    groupsMap.set(code, g);
  }
  const groups = Array.from(groupsMap.values()).sort((a, b) => {
    const oa = COMPETITION_ORDER[a.code] ?? 99;
    const ob = COMPETITION_ORDER[b.code] ?? 99;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });

  const prevDay = isoPrevDay(date);
  const nextDay = isoNextDay(date);
  const isToday = date === today;
  const labelDate = DATE_LABEL_FMT.format(new Date(`${date}T12:00:00Z`));
  const labelCapitalized = labelDate.charAt(0).toUpperCase() + labelDate.slice(1);

  // Quick nav : J-1, aujourd'hui, J+1, J+2, J+3
  const quickDates = [
    { ymd: prevDay, label: 'Hier' },
    { ymd: today, label: "Aujourd'hui" },
    { ymd: isoNextDay(today), label: 'Demain' },
    { ymd: isoNextDay(isoNextDay(today)), label: 'Après-demain' },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6">
        <p className="text-primary mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase">
          <CalendarDays className="size-3.5" aria-hidden />
          Calendrier
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {isToday ? "Les matchs d'aujourd'hui" : `Matchs du ${labelDate}`}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {matches.length} match{matches.length > 1 ? 's' : ''} programmé
          {matches.length > 1 ? 's' : ''} · toutes compétitions trackées
        </p>
      </header>

      {/* Navigation entre jours */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/calendrier?date=${prevDay}`}
            className="bg-card hover:border-primary/40 border-border inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
          >
            <ChevronLeft className="size-4" aria-hidden />
            <span>{SHORT_LABEL_FMT.format(new Date(`${prevDay}T12:00:00Z`))}</span>
          </Link>
          <div className="text-foreground text-center text-sm font-semibold">
            {labelCapitalized}
          </div>
          <Link
            href={`/calendrier?date=${nextDay}`}
            className="bg-card hover:border-primary/40 border-border inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
          >
            <span>{SHORT_LABEL_FMT.format(new Date(`${nextDay}T12:00:00Z`))}</span>
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        {/* Quick chips */}
        <div className="flex flex-wrap justify-center gap-2">
          {quickDates.map((d) => {
            const active = d.ymd === date;
            return (
              <Link
                key={d.ymd}
                href={`/calendrier?date=${d.ymd}`}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {d.label}
              </Link>
            );
          })}
          <form
            action="/calendrier"
            method="get"
            className="inline-flex items-center gap-1"
          >
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="bg-card border-border h-7 rounded-md border px-2 text-xs"
            />
            <button
              type="submit"
              className="text-muted-foreground hover:text-foreground text-xs underline"
            >
              Aller
            </button>
          </form>
        </div>
      </div>

      {/* Liste */}
      {groups.length === 0 ? (
        <section className="bg-card border-border rounded-2xl border p-10 text-center">
          <p className="text-muted-foreground text-sm">
            Aucun match programmé sur les compétitions trackées ce jour-là.
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.code}>
              <header className="mb-3 flex items-center gap-2.5">
                <span className="text-xl" aria-hidden>
                  {g.flag}
                </span>
                <h2 className="text-base font-semibold sm:text-lg">{g.name}</h2>
                <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums">
                  {g.matches.length}
                </span>
              </header>
              <div className="grid gap-3 sm:grid-cols-2">
                {g.matches.map((m) => (
                  <MatchCard
                    key={m.id}
                    id={m.id}
                    kickoff_at={m.kickoff_at}
                    status={m.status}
                    stage={m.stage}
                    matchday={m.matchday}
                    score_home={m.score_home}
                    score_away={m.score_away}
                    home={{
                      id: m.home_team?.id ?? m.home_team_id,
                      name: m.home_team?.name ?? 'À déterminer',
                      tla: m.home_team?.tla ?? null,
                      logo_url: m.home_team?.logo_url ?? null,
                    }}
                    away={{
                      id: m.away_team?.id ?? m.away_team_id,
                      name: m.away_team?.name ?? 'À déterminer',
                      tla: m.away_team?.tla ?? null,
                      logo_url: m.away_team?.logo_url ?? null,
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
