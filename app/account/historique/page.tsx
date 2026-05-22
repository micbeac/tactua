import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Mon historique',
  description: 'Retrouve les analyses IA que tu as consultées ou générées.',
};

export const dynamic = 'force-dynamic';

type EventRow = {
  id: number;
  match_id: number;
  analysis_type: 'pre_match' | 'post_match';
  action: 'generated' | 'refreshed' | 'viewed';
  at: string;
};

type TeamEmbed = {
  id: number;
  name: string;
  tla: string | null;
  logo_url: string | null;
};

type MatchRow = {
  id: number;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  score_home: number | null;
  score_away: number | null;
  home_team: TeamEmbed | null;
  away_team: TeamEmbed | null;
  competition: { id: number; name: string } | null;
};

type Aggregated = {
  match: MatchRow;
  pre: EventRow[];
  post: EventRow[];
  lastAt: string;
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

function actionLabel(action: EventRow['action']): string {
  if (action === 'generated') return 'Génération';
  if (action === 'refreshed') return 'Actualisation';
  return 'Consultation';
}

function actionBadgeClass(action: EventRow['action']): string {
  if (action === 'generated')
    return 'bg-primary/15 text-primary border border-primary/30';
  if (action === 'refreshed')
    return 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
  return 'bg-muted text-muted-foreground border border-border';
}

export default async function HistoriquePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/account/historique');

  const { data: events, error: eventsError } = await supabase
    .from('user_match_analysis_events')
    .select('id, match_id, analysis_type, action, at')
    .eq('user_id', user.id)
    .order('at', { ascending: false })
    .limit(500);

  if (eventsError) {
    console.error('[historique] events error', eventsError);
  }

  const rows = (events ?? []) as EventRow[];

  if (rows.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Mon historique
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Retrouve ici toutes les analyses IA que tu as générées, actualisées
            ou consultées.
          </p>
        </header>
        <section className="bg-card border-border rounded-2xl border p-10 text-center">
          <p className="text-muted-foreground text-sm">
            Tu n&apos;as encore consulté aucune analyse. Ouvre la fiche d&apos;un
            match et lance ta première analyse IA pour la voir apparaître ici.
          </p>
          <Link
            href="/"
            className="text-primary mt-4 inline-block text-sm font-semibold hover:underline"
          >
            Voir les matchs à venir →
          </Link>
        </section>
      </main>
    );
  }

  const matchIds = Array.from(new Set(rows.map((r) => r.match_id)));
  const { data: matchData } = await supabase
    .from('matches')
    .select(
      `id, kickoff_at, status, score_home, score_away,
       competition:competitions(id, name),
       home_team:teams!matches_home_team_id_fkey(id, name, tla, logo_url),
       away_team:teams!matches_away_team_id_fkey(id, name, tla, logo_url)`,
    )
    .in('id', matchIds);

  const matches = new Map<number, MatchRow>();
  for (const m of (matchData ?? []) as unknown as MatchRow[]) {
    matches.set(m.id, m);
  }

  const aggregatedMap = new Map<number, Aggregated>();
  for (const ev of rows) {
    const match = matches.get(ev.match_id);
    if (!match) continue;
    const entry = aggregatedMap.get(ev.match_id) ?? {
      match,
      pre: [],
      post: [],
      lastAt: ev.at,
    };
    if (ev.analysis_type === 'pre_match') entry.pre.push(ev);
    else entry.post.push(ev);
    if (ev.at > entry.lastAt) entry.lastAt = ev.at;
    aggregatedMap.set(ev.match_id, entry);
  }

  const aggregated = Array.from(aggregatedMap.values()).sort((a, b) =>
    a.lastAt < b.lastAt ? 1 : -1,
  );

  const totalGenerated = rows.filter((r) => r.action === 'generated').length;
  const totalRefreshed = rows.filter((r) => r.action === 'refreshed').length;
  const totalViewed = rows.filter((r) => r.action === 'viewed').length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Mon historique
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {aggregated.length} match{aggregated.length > 1 ? 's' : ''} suivi
          {aggregated.length > 1 ? 's' : ''} · {totalGenerated} génération
          {totalGenerated > 1 ? 's' : ''} · {totalRefreshed} actualisation
          {totalRefreshed > 1 ? 's' : ''} · {totalViewed} consultation
          {totalViewed > 1 ? 's' : ''}
        </p>
      </header>

      <ul className="space-y-3">
        {aggregated.map((entry) => {
          const m = entry.match;
          const home = m.home_team?.name ?? 'À déterminer';
          const away = m.away_team?.name ?? 'À déterminer';
          const isFinished = m.status === 'finished';
          const score =
            m.score_home != null && m.score_away != null
              ? `${m.score_home} - ${m.score_away}`
              : '— · —';
          return (
            <li
              key={m.id}
              className="bg-card border-border hover:border-primary/40 rounded-2xl border p-4 transition-colors"
            >
              <Link href={`/matches/${m.id}`} className="block space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {home} <span className="text-muted-foreground">vs</span>{' '}
                      {away}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {m.competition?.name ?? 'Football'} ·{' '}
                      {DATE_FMT.format(new Date(m.kickoff_at))}
                    </p>
                  </div>
                  <div className="text-right">
                    {isFinished ? (
                      <span className="text-sm font-mono font-semibold">
                        {score}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs uppercase tracking-wide">
                        {m.status === 'live' ? 'Live' : 'À venir'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {entry.pre.length > 0 && (
                    <div className="border-border bg-background/40 flex items-center gap-1.5 rounded-md border px-2 py-1">
                      <span className="font-semibold">Pré-match</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${actionBadgeClass(entry.pre[0]!.action)}`}
                      >
                        {actionLabel(entry.pre[0]!.action)}
                      </span>
                      {entry.pre.length > 1 && (
                        <span className="text-muted-foreground">
                          +{entry.pre.length - 1}
                        </span>
                      )}
                    </div>
                  )}
                  {entry.post.length > 0 && (
                    <div className="border-border bg-background/40 flex items-center gap-1.5 rounded-md border px-2 py-1">
                      <span className="font-semibold">Post-match</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${actionBadgeClass(entry.post[0]!.action)}`}
                      >
                        {actionLabel(entry.post[0]!.action)}
                      </span>
                      {entry.post.length > 1 && (
                        <span className="text-muted-foreground">
                          +{entry.post.length - 1}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-muted-foreground ml-auto self-center">
                    Dernière activité :{' '}
                    {DATE_FMT.format(new Date(entry.lastAt))}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
