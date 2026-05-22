import Link from 'next/link';

type Team = { id: number | null; name: string };

export type H2HItem = {
  id: number;
  kickoff_at: string;
  competition_name: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  score_home: number | null;
  score_away: number | null;
};

export type MatchH2HSectionProps = {
  teamA: Team;
  teamB: Team;
  matches: H2HItem[];
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});

function outcomeForA(
  item: H2HItem,
  teamAId: number | null,
): 'W' | 'D' | 'L' | null {
  if (
    item.score_home == null ||
    item.score_away == null ||
    teamAId == null ||
    item.home_team_id == null ||
    item.away_team_id == null
  ) {
    return null;
  }
  const aIsHome = item.home_team_id === teamAId;
  const aIsAway = item.away_team_id === teamAId;
  if (!aIsHome && !aIsAway) return null;
  const scoreA = aIsHome ? item.score_home : item.score_away;
  const scoreB = aIsHome ? item.score_away : item.score_home;
  if (scoreA > scoreB) return 'W';
  if (scoreA < scoreB) return 'L';
  return 'D';
}

function outcomeChip(o: 'W' | 'D' | 'L' | null) {
  if (!o) return null;
  const cfg = {
    W: 'bg-primary/15 text-primary',
    D: 'bg-muted text-muted-foreground',
    L: 'bg-destructive/15 text-destructive',
  }[o];
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-semibold ${cfg}`}
      aria-label={`Résultat : ${o}`}
    >
      {o}
    </span>
  );
}

export function MatchH2HSection({
  teamA,
  teamB,
  matches,
}: MatchH2HSectionProps) {
  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Confrontations directes</h2>
        <p className="text-muted-foreground text-xs">
          du point de vue de {teamA.name || '—'}
        </p>
      </header>

      {matches.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          Aucune confrontation passée enregistrée entre ces deux équipes.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {matches.map((m) => {
            const o = outcomeForA(m, teamA.id);
            const date = DATE_FMT.format(new Date(m.kickoff_at));
            const aIsHome = m.home_team_id === teamA.id;
            const scoreA = aIsHome ? m.score_home : m.score_away;
            const scoreB = aIsHome ? m.score_away : m.score_home;
            return (
              <li key={m.id}>
                <Link
                  href={`/matches/${m.id}`}
                  className="hover:bg-muted/40 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2"
                >
                  {outcomeChip(o)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">
                        {teamA.name || '—'} {aIsHome ? '(dom.)' : '(ext.)'}
                      </span>
                      <span className="text-muted-foreground mx-2">vs</span>
                      <span className="font-medium">{teamB.name || '—'}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {date}
                      {m.competition_name && ` · ${m.competition_name}`}
                    </p>
                  </div>
                  <div className="text-foreground text-sm font-semibold tabular-nums">
                    {scoreA ?? 0}
                    <span className="text-muted-foreground mx-1">–</span>
                    {scoreB ?? 0}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
