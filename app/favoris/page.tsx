import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { MatchCard } from '@/components/match/MatchCard';
import { getUserFavorites, type FavoriteRow } from '@/lib/data/favorites';
import { createClient } from '@/lib/supabase/server';
import { playerHref, teamHref } from '@/lib/url';

export const metadata: Metadata = {
  title: 'Mes favoris',
  description: 'Suivez vos équipes, joueurs et matchs préférés.',
};

export const dynamic = 'force-dynamic';

type TeamRow = {
  id: number;
  name: string;
  tla: string | null;
  logo_url: string | null;
  country: string | null;
};

type PlayerRow = {
  id: number;
  name: string;
  position: string | null;
  current_team: { id: number; name: string; logo_url: string | null } | null;
};

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
  home_team: TeamRow | null;
  away_team: TeamRow | null;
};

function splitByType(favs: FavoriteRow[]) {
  return {
    teams: favs.filter((f) => f.entity_type === 'team').map((f) => f.entity_id),
    players: favs
      .filter((f) => f.entity_type === 'player')
      .map((f) => f.entity_id),
    matches: favs
      .filter((f) => f.entity_type === 'match')
      .map((f) => f.entity_id),
  };
}

export default async function FavorisPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?next=/favoris');
  }

  const favs = await getUserFavorites(supabase, user.id);
  const {
    teams: teamIds,
    players: playerIds,
    matches: matchIds,
  } = splitByType(favs);

  const [teamsRes, playersRes, matchesRes] = await Promise.all([
    teamIds.length
      ? supabase
          .from('teams')
          .select('id, name, tla, logo_url, country')
          .in('id', teamIds)
      : Promise.resolve({ data: [], error: null }),
    playerIds.length
      ? supabase
          .from('players')
          .select(
            'id, name, position, current_team:teams!players_current_team_id_fkey(id, name, logo_url)',
          )
          .in('id', playerIds)
      : Promise.resolve({ data: [], error: null }),
    matchIds.length
      ? supabase
          .from('matches')
          .select(
            `id, kickoff_at, status, stage, matchday, score_home, score_away,
             home_team_id, away_team_id,
             home_team:teams!matches_home_team_id_fkey(id, name, tla, logo_url, country),
             away_team:teams!matches_away_team_id_fkey(id, name, tla, logo_url, country)`,
          )
          .in('id', matchIds)
          .order('kickoff_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const teams = (teamsRes.data ?? []) as TeamRow[];
  const players = (playersRes.data ?? []) as unknown as PlayerRow[];
  const matches = (matchesRes.data ?? []) as unknown as MatchRow[];

  const hasAny = teams.length + players.length + matches.length > 0;

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Mes favoris</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Retrouve ici toutes les équipes, joueurs et matchs que tu suis.
        </p>
      </header>

      {!hasAny ? (
        <section className="bg-card border-border rounded-2xl border p-10 text-center">
          <p className="text-muted-foreground text-sm">
            Tu n&apos;as encore rien ajouté à tes favoris. Clique sur le bouton
            « Suivre » depuis une fiche équipe, joueur ou match pour commencer.
          </p>
        </section>
      ) : (
        <>
          {matches.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Matchs suivis</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {matches.map((m) => (
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
          )}

          {teams.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Équipes suivies</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {teams.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={teamHref(t.id, t.name)}
                      className="bg-card hover:border-primary/40 border-border flex items-center gap-3 rounded-xl border p-3 transition-colors"
                    >
                      <div className="bg-muted relative size-9 shrink-0 overflow-hidden rounded-full">
                        {t.logo_url ? (
                          <Image
                            src={t.logo_url}
                            alt=""
                            fill
                            sizes="36px"
                            className="object-contain p-1"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.name}</p>
                        {t.country && (
                          <p className="text-muted-foreground text-xs">
                            {t.country}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {players.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Joueurs suivis</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {players.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={playerHref(p.id, p.name)}
                      className="bg-card hover:border-primary/40 border-border flex items-center gap-3 rounded-xl border p-3 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {[p.position, p.current_team?.name]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
