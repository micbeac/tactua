export type TeamSeasonStatsProps = {
  competition_name: string | null;
  season: string;
  position: number | null;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goals_for: number | null;
  goals_against: number | null;
  goal_difference: number | null;
  points: number | null;
};

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string | null;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <p
        className={`text-2xl font-semibold tabular-nums sm:text-3xl ${
          highlight ? 'text-primary' : 'text-foreground'
        }`}
      >
        {value ?? '—'}
      </p>
      <p className="text-muted-foreground mt-0.5 text-[10px] tracking-wide uppercase">
        {label}
      </p>
    </div>
  );
}

export function TeamSeasonStats(props: TeamSeasonStatsProps) {
  const {
    competition_name,
    season,
    position,
    played,
    wins,
    draws,
    losses,
    goals_for,
    goals_against,
    goal_difference,
    points,
  } = props;

  const gd =
    goal_difference != null && goal_difference > 0
      ? `+${goal_difference}`
      : goal_difference != null
        ? String(goal_difference)
        : null;

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">
          Saison {season}
          {competition_name && (
            <span className="text-muted-foreground font-normal">
              {' '}
              · {competition_name}
            </span>
          )}
        </h2>
        {position != null && (
          <p className="text-muted-foreground text-xs">
            <span className="text-primary text-base font-semibold">
              {position}
            </span>
            e du classement
          </p>
        )}
      </header>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        <Stat label="Points" value={points} highlight />
        <Stat label="Joués" value={played} />
        <Stat label="V" value={wins} />
        <Stat label="N" value={draws} />
        <Stat label="D" value={losses} />
        <Stat label="Diff." value={gd} />
      </div>
      <div className="text-muted-foreground mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs">
        {goals_for != null && (
          <span>
            <span className="text-foreground font-semibold">{goals_for}</span>{' '}
            buts marqués
          </span>
        )}
        {goals_against != null && (
          <span>
            <span className="text-foreground font-semibold">
              {goals_against}
            </span>{' '}
            buts encaissés
          </span>
        )}
      </div>
    </section>
  );
}
