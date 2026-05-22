import { MatchCard, type MatchCardProps } from '@/components/match/MatchCard';
import type { CompetitionMatchRow } from '@/lib/data/competition';

export type CompetitionMatchListProps = {
  title: string;
  empty_label: string;
  matches: CompetitionMatchRow[];
};

const DAY_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Paris',
});

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function toCardProps(m: CompetitionMatchRow): MatchCardProps {
  return {
    id: m.id,
    kickoff_at: m.kickoff_at,
    status: m.status,
    stage: m.stage,
    matchday: m.matchday,
    score_home: m.score_home,
    score_away: m.score_away,
    home: {
      id: m.home_team?.id ?? m.home_team_id,
      name: m.home_team?.name ?? 'À déterminer',
      tla: m.home_team?.tla ?? null,
      logo_url: m.home_team?.logo_url ?? null,
    },
    away: {
      id: m.away_team?.id ?? m.away_team_id,
      name: m.away_team?.name ?? 'À déterminer',
      tla: m.away_team?.tla ?? null,
      logo_url: m.away_team?.logo_url ?? null,
    },
  };
}

export function CompetitionMatchList({
  title,
  empty_label,
  matches,
}: CompetitionMatchListProps) {
  if (matches.length === 0) {
    return (
      <section>
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        <div className="bg-card border-border text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {empty_label}
        </div>
      </section>
    );
  }

  // Group by day
  const groups = new Map<string, CompetitionMatchRow[]>();
  for (const m of matches) {
    const k = dayKey(m.kickoff_at);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(m);
  }
  const orderedDays = Array.from(groups.keys()).sort();

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="space-y-6">
        {orderedDays.map((day) => {
          const list = groups.get(day)!;
          const dayLabel = DAY_FMT.format(new Date(day));
          return (
            <div key={day}>
              <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                {dayLabel}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {list.map((m) => (
                  <MatchCard key={m.id} {...toCardProps(m)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
