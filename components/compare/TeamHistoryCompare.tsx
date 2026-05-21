import type { TeamHistoryCompare } from '@/lib/data/team-history-compare';

type Props = {
  team_a_name: string;
  team_b_name: string;
  data: TeamHistoryCompare;
};

const FMT = new Intl.NumberFormat('fr-FR');

function positionLabel(pos: number | null): string {
  if (pos == null) return '—';
  if (pos === 1) return '1ᵉʳ';
  return `${pos}ᵉ`;
}

function positionClass(pos: number | null): string {
  if (pos == null) return 'text-muted-foreground';
  if (pos === 1) return 'text-amber-300 font-bold';
  if (pos <= 4) return 'text-primary font-semibold';
  if (pos <= 10) return 'text-foreground';
  return 'text-muted-foreground';
}

export function TeamHistoryCompareSection({
  team_a_name,
  team_b_name,
  data,
}: Props) {
  if (data.seasons.length === 0) {
    return (
      <section className="bg-card border-border rounded-2xl border p-6">
        <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
          Historique multi-saisons
        </h2>
        <p className="text-muted-foreground text-sm">
          Pas encore de données historiques disponibles pour ces équipes.
        </p>
      </section>
    );
  }

  // Affiche au max 6 saisons (les + récentes) pour rester lisible
  const seasonsToShow = data.seasons.slice(-6);

  // Calcul des points max pour barre relative
  let maxPoints = 0;
  for (const s of seasonsToShow) {
    const a = data.a_by_season[s];
    const b = data.b_by_season[s];
    if (a) maxPoints = Math.max(maxPoints, a.points);
    if (b) maxPoints = Math.max(maxPoints, b.points);
  }
  if (maxPoints === 0) maxPoints = 1;

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <h2 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
        Historique multi-saisons
      </h2>
      <p className="text-muted-foreground mb-4 text-xs">
        Évolution saison par saison · position finale et points
      </p>

      {/* Bar chart évolution points */}
      <div className="space-y-3">
        {seasonsToShow.map((season) => {
          const a = data.a_by_season[season];
          const b = data.b_by_season[season];
          const aPct = a ? (a.points / maxPoints) * 100 : 0;
          const bPct = b ? (b.points / maxPoints) * 100 : 0;
          return (
            <div key={season} className="grid grid-cols-[60px_1fr] gap-3">
              <div className="text-muted-foreground self-center text-xs font-semibold">
                {season}
              </div>
              <div className="space-y-1.5">
                <SeasonBar
                  team_name={team_a_name}
                  snap={a}
                  pct={aPct}
                  color="primary"
                />
                <SeasonBar
                  team_name={team_b_name}
                  snap={b}
                  pct={bPct}
                  color="emerald"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tableau récap */}
      <div className="border-border mt-6 overflow-hidden rounded-xl border">
        <div className="bg-muted/30 grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 border-b px-3 py-2 text-[10px] font-semibold tracking-wide uppercase">
          <span>Saison · Équipe</span>
          <span className="text-right">Position</span>
          <span className="text-right">Pts</span>
          <span className="text-right">V-N-D</span>
          <span className="text-right">+/-</span>
        </div>
        {seasonsToShow
          .slice()
          .reverse()
          .map((season) => {
            const a = data.a_by_season[season];
            const b = data.b_by_season[season];
            return (
              <div key={season}>
                {a && (
                  <Row
                    season={season}
                    team_name={team_a_name}
                    snap={a}
                    color="primary"
                  />
                )}
                {b && (
                  <Row
                    season={season}
                    team_name={team_b_name}
                    snap={b}
                    color="emerald"
                  />
                )}
              </div>
            );
          })}
      </div>
    </section>
  );
}

function SeasonBar({
  team_name,
  snap,
  pct,
  color,
}: {
  team_name: string;
  snap: import('@/lib/data/team-history-compare').SeasonSnapshot | undefined;
  pct: number;
  color: 'primary' | 'emerald';
}) {
  const colorClass =
    color === 'primary' ? 'bg-primary/70' : 'bg-emerald-400/70';
  return (
    <div className="flex items-center gap-2">
      <div className="text-muted-foreground w-24 truncate text-[11px]">
        {team_name}
      </div>
      <div className="bg-muted/20 relative h-5 flex-1 overflow-hidden rounded">
        <div
          className={`h-full ${colorClass} transition-all`}
          style={{ width: `${pct}%` }}
        />
        {snap && (
          <span className="absolute inset-y-0 right-2 flex items-center text-[11px] font-mono font-semibold tabular-nums">
            {snap.points} pts · {positionLabel(snap.position)}
          </span>
        )}
        {!snap && (
          <span className="text-muted-foreground absolute inset-y-0 right-2 flex items-center text-[11px]">
            pas de données
          </span>
        )}
      </div>
    </div>
  );
}

function Row({
  season,
  team_name,
  snap,
  color,
}: {
  season: string;
  team_name: string;
  snap: import('@/lib/data/team-history-compare').SeasonSnapshot;
  color: 'primary' | 'emerald';
}) {
  const dotClass = color === 'primary' ? 'bg-primary' : 'bg-emerald-400';
  return (
    <div className="border-border grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 border-b px-3 py-2 text-sm last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`inline-block size-2 shrink-0 rounded-full ${dotClass}`} />
        <span className="truncate">
          <span className="text-muted-foreground text-xs">{season}</span>{' '}
          <span className="text-xs">·</span>{' '}
          <span className="text-xs">{team_name}</span>
        </span>
      </div>
      <span
        className={`text-right text-sm tabular-nums ${positionClass(snap.position)}`}
      >
        {positionLabel(snap.position)}
      </span>
      <span className="text-right text-sm font-mono tabular-nums">
        {snap.points}
      </span>
      <span className="text-muted-foreground text-right text-xs tabular-nums">
        {snap.wins}-{snap.draws}-{snap.losses}
      </span>
      <span
        className={`text-right text-xs tabular-nums ${
          snap.goal_difference > 0
            ? 'text-emerald-400'
            : snap.goal_difference < 0
              ? 'text-rose-400'
              : 'text-muted-foreground'
        }`}
      >
        {snap.goal_difference > 0 ? '+' : ''}
        {FMT.format(snap.goal_difference)}
      </span>
    </div>
  );
}
