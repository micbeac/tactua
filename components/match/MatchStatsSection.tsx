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
  expected_goals: number | null;
  goals_prevented: number | null;
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
  /** Si true : la barre représente un % (possession). Sinon proportionnel au max. */
  is_percentage?: boolean;
  /** Suffixe à afficher après la valeur (ex: '%'). */
  unit?: string;
  /** Pour les stats où le moins est mieux (fautes, hors-jeu, cartons). */
  lower_is_better?: boolean;
};

/**
 * Pour les % (possession) : 2 barres qui partagent 100%
 * - Home à gauche en primary
 * - Away à droite en emerald
 */
function PercentageBar({ home, away }: { home: number; away: number }) {
  const total = home + away;
  const homePct = total > 0 ? (home / total) * 100 : 50;
  return (
    <div className="bg-muted/40 flex h-2 overflow-hidden rounded-full">
      <div
        className="bg-primary h-full transition-all"
        style={{ width: `${homePct}%` }}
        aria-hidden
      />
      <div
        className="h-full bg-emerald-400 transition-all"
        style={{ width: `${100 - homePct}%` }}
        aria-hidden
      />
    </div>
  );
}

/**
 * Pour les stats numériques (tirs, corners, fautes, etc.) : 2 barres
 * indépendantes, chacune proportionnelle au max des deux. Le "gagnant"
 * a une barre pleine, l'autre est en proportion.
 *
 * Affichage : centre commun (= "ligne de séparation"), barre home vers
 * la gauche, barre away vers la droite.
 */
function ComparisonBar({
  home,
  away,
  lower_is_better,
}: {
  home: number;
  away: number;
  lower_is_better?: boolean;
}) {
  const max = Math.max(home, away, 1);
  const homePct = (home / max) * 100;
  const awayPct = (away / max) * 100;

  // Quelle barre est "meilleure" : utile pour la couleur d'accent
  const homeBest = lower_is_better ? home < away : home > away;
  const awayBest = lower_is_better ? away < home : away > home;
  const tie = home === away;

  return (
    <div className="flex items-center gap-1">
      {/* Home (à gauche, remplissage de droite à gauche) */}
      <div className="bg-muted/40 flex h-2 flex-1 justify-end overflow-hidden rounded-full">
        <div
          className={`h-full transition-all ${
            tie
              ? 'bg-muted-foreground/40'
              : homeBest
                ? 'bg-primary'
                : 'bg-primary/40'
          }`}
          style={{ width: `${homePct}%` }}
          aria-hidden
        />
      </div>
      {/* Away (à droite, remplissage de gauche à droite) */}
      <div className="bg-muted/40 flex h-2 flex-1 overflow-hidden rounded-full">
        <div
          className={`h-full transition-all ${
            tie
              ? 'bg-muted-foreground/40'
              : awayBest
                ? 'bg-emerald-400'
                : 'bg-emerald-400/40'
          }`}
          style={{ width: `${awayPct}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

function StatRow({ row }: { row: Row }) {
  const hasData = row.home != null && row.away != null;

  return (
    <li className="border-border/60 border-b py-3 last:border-b-0">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm tabular-nums">
        <span className="text-foreground text-right font-semibold">
          {row.home == null ? '—' : `${row.home}${row.unit ?? ''}`}
        </span>
        <span className="text-muted-foreground px-3 text-center text-[10px] font-medium tracking-wide uppercase">
          {row.label}
        </span>
        <span className="text-foreground text-left font-semibold">
          {row.away == null ? '—' : `${row.away}${row.unit ?? ''}`}
        </span>
      </div>
      {hasData && (
        <div className="mt-2 px-1">
          {row.is_percentage ? (
            <PercentageBar home={row.home!} away={row.away!} />
          ) : (
            <ComparisonBar
              home={row.home!}
              away={row.away!}
              lower_is_better={row.lower_is_better}
            />
          )}
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
          <div className="text-muted-foreground mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs font-medium tracking-wide uppercase">
            <span className="text-primary truncate text-right">
              {home.team_name || '—'}
            </span>
            <span className="px-3" />
            <span className="truncate text-left text-emerald-400">
              {away.team_name || '—'}
            </span>
          </div>
          <ul>
            {(home_stats?.expected_goals != null ||
              away_stats?.expected_goals != null) && (
              <StatRow
                row={{
                  label: 'xG (buts attendus)',
                  home: home_stats?.expected_goals ?? null,
                  away: away_stats?.expected_goals ?? null,
                }}
              />
            )}
            <StatRow
              row={{
                label: 'Possession',
                home: home_stats?.possession ?? null,
                away: away_stats?.possession ?? null,
                is_percentage: true,
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
                lower_is_better: true,
              }}
            />
            <StatRow
              row={{
                label: 'Cartons jaunes',
                home: home_stats?.yellow_cards ?? null,
                away: away_stats?.yellow_cards ?? null,
                lower_is_better: true,
              }}
            />
            <StatRow
              row={{
                label: 'Cartons rouges',
                home: home_stats?.red_cards ?? null,
                away: away_stats?.red_cards ?? null,
                lower_is_better: true,
              }}
            />
            <StatRow
              row={{
                label: 'Hors-jeu',
                home: home_stats?.offsides ?? null,
                away: away_stats?.offsides ?? null,
                lower_is_better: true,
              }}
            />
          </ul>
        </>
      )}
    </section>
  );
}
