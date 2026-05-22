import Image from 'next/image';
import Link from 'next/link';

export type TeamMatchItem = {
  id: number;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  score_home: number | null;
  score_away: number | null;
  team_id: number;
  home_team_id: number | null;
  away_team_id: number | null;
  competition_name: string | null;
  opponent: {
    id: number;
    name: string;
    tla: string | null;
    logo_url: string | null;
  } | null;
};

export type TeamMatchesListProps = {
  title: string;
  empty_label: string;
  matches: TeamMatchItem[];
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

function outcome(m: TeamMatchItem): 'W' | 'D' | 'L' | null {
  if (m.status !== 'finished' || m.score_home == null || m.score_away == null)
    return null;
  const isHome = m.home_team_id === m.team_id;
  const scoreFor = isHome ? m.score_home : m.score_away;
  const scoreAgainst = isHome ? m.score_away : m.score_home;
  if (scoreFor > scoreAgainst) return 'W';
  if (scoreFor < scoreAgainst) return 'L';
  return 'D';
}

function OutcomePill({ o }: { o: 'W' | 'D' | 'L' }) {
  const cfg = {
    W: 'bg-primary/20 text-primary',
    D: 'bg-muted text-muted-foreground',
    L: 'bg-destructive/15 text-destructive',
  }[o];
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-semibold ${cfg}`}
    >
      {o}
    </span>
  );
}

export function TeamMatchesList({
  title,
  empty_label,
  matches,
}: TeamMatchesListProps) {
  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {matches.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          {empty_label}
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {matches.map((m) => {
            const isHome = m.home_team_id === m.team_id;
            const o = outcome(m);
            const showScore = m.status === 'live' || m.status === 'finished';
            return (
              <li key={m.id}>
                <Link
                  href={`/matches/${m.id}`}
                  className="hover:bg-muted/40 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5"
                >
                  {o ? (
                    <OutcomePill o={o} />
                  ) : (
                    <span className="text-muted-foreground w-5 shrink-0 text-center text-[10px] uppercase">
                      {isHome ? 'D' : 'E'}
                    </span>
                  )}
                  <div className="bg-muted relative size-6 shrink-0 overflow-hidden rounded-full">
                    {m.opponent?.logo_url ? (
                      <Image
                        src={m.opponent.logo_url}
                        alt=""
                        fill
                        sizes="24px"
                        className="object-contain p-0.5"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="text-muted-foreground mr-1 text-xs">
                        {isHome ? 'vs' : '@'}
                      </span>
                      <span className="font-medium">
                        {m.opponent?.name ?? 'À déterminer'}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {DATE_FMT.format(new Date(m.kickoff_at))}
                      {m.competition_name && ` · ${m.competition_name}`}
                    </p>
                  </div>
                  {showScore && (
                    <div className="text-foreground text-sm font-semibold tabular-nums">
                      {(isHome ? m.score_home : m.score_away) ?? 0}
                      <span className="text-muted-foreground mx-1">–</span>
                      {(isHome ? m.score_away : m.score_home) ?? 0}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
