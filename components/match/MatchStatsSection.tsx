type TeamSide = { team_id: number | null; team_name: string };

type Stats = {
  possession: number | null;
  shots: number | null;
  shots_on_target: number | null;
  corners: number | null;
  fouls: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  offsides: number | null;
};

export type MatchStatsSectionProps = {
  home: TeamSide;
  away: TeamSide;
  home_stats: Stats | null;
  away_stats: Stats | null;
};

type Row = {
  label: string;
  home: number | null;
  away: number | null;
  /** Affiche une barre proportionnelle (utile pour possession). */
  bar?: boolean;
  /** Suffixe à afficher après la valeur (ex: '%'). */
  unit?: string;
};

function PossessionBar({ home, away }: { home: number; away: number }) {
  const total = home + away;
  const homePct = total > 0 ? (home / total) * 100 : 50;
  return (
    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
      <div
        className="bg-primary h-full"
        style={{ width: `${homePct}%` }}
        aria-hidden
      />
    </div>
  );
}

function StatRow({ row }: { row: Row }) {
  const hasData = row.home != null || row.away != null;
  return (
    <li className="border-border/60 border-b py-2.5 last:border-b-0">
      <div className="grid grid-cols-3 items-center gap-3 text-sm tabular-nums">
        <span className="text-foreground text-left font-semibold">
          {row.home == null ? '—' : `${row.home}${row.unit ?? ''}`}
        </span>
        <span className="text-muted-foreground text-center text-xs tracking-wide uppercase">
          {row.label}
        </span>
        <span className="text-foreground text-right font-semibold">
          {row.away == null ? '—' : `${row.away}${row.unit ?? ''}`}
        </span>
      </div>
      {hasData && row.bar && row.home != null && row.away != null && (
        <div className="mt-2 px-1">
          <PossessionBar home={row.home} away={row.away} />
        </div>
      )}
    </li>
  );
}

export function MatchStatsSection({
  home,
  away,
  home_stats,
  away_stats,
}: MatchStatsSectionProps) {
  const hasAny = home_stats != null || away_stats != null;

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold">Stats du match</h2>
      </header>

      {!hasAny ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          Les statistiques détaillées ne sont pas encore disponibles pour ce
          match.
        </p>
      ) : (
        <>
          <div className="text-muted-foreground mb-3 grid grid-cols-3 gap-3 text-xs font-medium tracking-wide uppercase">
            <span className="text-left">{home.team_name || '—'}</span>
            <span />
            <span className="text-right">{away.team_name || '—'}</span>
          </div>
          <ul>
            <StatRow
              row={{
                label: 'Possession',
                home: home_stats?.possession ?? null,
                away: away_stats?.possession ?? null,
                bar: true,
                unit: '%',
              }}
            />
            <StatRow
              row={{
                label: 'Tirs',
                home: home_stats?.shots ?? null,
                away: away_stats?.shots ?? null,
              }}
            />
            <StatRow
              row={{
                label: 'Tirs cadrés',
                home: home_stats?.shots_on_target ?? null,
                away: away_stats?.shots_on_target ?? null,
              }}
            />
            <StatRow
              row={{
                label: 'Corners',
                home: home_stats?.corners ?? null,
                away: away_stats?.corners ?? null,
              }}
            />
            <StatRow
              row={{
                label: 'Fautes',
                home: home_stats?.fouls ?? null,
                away: away_stats?.fouls ?? null,
              }}
            />
            <StatRow
              row={{
                label: 'Cartons jaunes',
                home: home_stats?.yellow_cards ?? null,
                away: away_stats?.yellow_cards ?? null,
              }}
            />
            <StatRow
              row={{
                label: 'Cartons rouges',
                home: home_stats?.red_cards ?? null,
                away: away_stats?.red_cards ?? null,
              }}
            />
            <StatRow
              row={{
                label: 'Hors-jeu',
                home: home_stats?.offsides ?? null,
                away: away_stats?.offsides ?? null,
              }}
            />
          </ul>
        </>
      )}
    </section>
  );
}
