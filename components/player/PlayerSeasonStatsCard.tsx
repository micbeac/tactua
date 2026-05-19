export type PlayerSeasonStats = {
  season: string;
  competition_name: string | null;
  appearances: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
};

export type PlayerSeasonStatsCardProps = {
  stats: PlayerSeasonStats[];
};

function Stat({
  label,
  value,
}: {
  label: string;
  value: number | string | null;
}) {
  return (
    <div className="text-center">
      <p className="text-2xl font-semibold tabular-nums sm:text-3xl">
        {value ?? '—'}
      </p>
      <p className="text-muted-foreground mt-0.5 text-[10px] tracking-wide uppercase">
        {label}
      </p>
    </div>
  );
}

export function PlayerSeasonStatsCard({ stats }: PlayerSeasonStatsCardProps) {
  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <h2 className="mb-5 text-base font-semibold">Stats par compétition</h2>
      {stats.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          Les statistiques détaillées du joueur ne sont pas encore disponibles.
        </p>
      ) : (
        <div className="space-y-6">
          {stats.map((s) => (
            <div key={`${s.competition_name}-${s.season}`}>
              <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
                Saison {s.season}
                {s.competition_name && ` · ${s.competition_name}`}
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                <Stat label="Matchs" value={s.appearances} />
                <Stat label="Minutes" value={s.minutes} />
                <Stat label="Buts" value={s.goals} />
                <Stat label="Assists" value={s.assists} />
                <Stat label="C. jaunes" value={s.yellow_cards} />
                <Stat label="C. rouges" value={s.red_cards} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
