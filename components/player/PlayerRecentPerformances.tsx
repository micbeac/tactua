import Link from 'next/link';

export type PerformanceItem = {
  match_id: number;
  kickoff_at: string | null;
  competition_name: string | null;
  opponent_name: string | null;
  was_home: boolean | null;
  team_score: number | null;
  opponent_score: number | null;
  minutes_played: number | null;
  goals: number | null;
  assists: number | null;
  rating: number | null;
};

export type PlayerRecentPerformancesProps = {
  items: PerformanceItem[];
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Paris',
});

export function PlayerRecentPerformances({
  items,
}: PlayerRecentPerformancesProps) {
  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <h2 className="mb-4 text-base font-semibold">Dernières performances</h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          Aucune performance détaillée enregistrée pour le moment.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left text-[10px] tracking-wide uppercase">
                <th className="py-2 pr-2 font-medium">Date</th>
                <th className="py-2 pr-2 font-medium">Opposant</th>
                <th className="px-1 py-2 text-center font-medium">Score</th>
                <th className="px-1 py-2 text-center font-medium">Min</th>
                <th className="px-1 py-2 text-center font-medium">B</th>
                <th className="px-1 py-2 text-center font-medium">A</th>
                <th className="py-2 pl-1 text-right font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr
                  key={p.match_id}
                  className="border-border/60 border-b last:border-b-0"
                >
                  <td className="text-muted-foreground py-2 pr-2 tabular-nums">
                    {p.kickoff_at
                      ? DATE_FMT.format(new Date(p.kickoff_at))
                      : '—'}
                  </td>
                  <td className="py-2 pr-2">
                    <Link
                      href={`/matches/${p.match_id}`}
                      className="hover:underline"
                    >
                      <span className="text-muted-foreground mr-1 text-xs">
                        {p.was_home ? 'vs' : '@'}
                      </span>
                      <span className="font-medium">
                        {p.opponent_name ?? '—'}
                      </span>
                    </Link>
                  </td>
                  <td className="px-1 py-2 text-center tabular-nums">
                    {p.team_score != null && p.opponent_score != null
                      ? `${p.team_score}-${p.opponent_score}`
                      : '—'}
                  </td>
                  <td className="px-1 py-2 text-center tabular-nums">
                    {p.minutes_played ?? '—'}
                  </td>
                  <td className="px-1 py-2 text-center font-semibold tabular-nums">
                    {p.goals ?? '—'}
                  </td>
                  <td className="px-1 py-2 text-center tabular-nums">
                    {p.assists ?? '—'}
                  </td>
                  <td className="py-2 pl-1 text-right font-semibold tabular-nums">
                    {p.rating != null ? p.rating.toFixed(1) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
