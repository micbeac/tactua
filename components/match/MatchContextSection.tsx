import { CalendarClock, Clock, Target, Trophy } from 'lucide-react';
import type {
  StandingContext,
  TeamGoalTiming,
  TeamScheduleContext,
  TeamSeasonXG,
} from '@/lib/data/match-context';

export type MatchSideContext = {
  schedule: TeamScheduleContext;
  standing: StandingContext | null;
  xg: TeamSeasonXG | null;
  goal_timing: TeamGoalTiming | null;
};

export type MatchContextSectionProps = {
  home_team_name: string;
  away_team_name: string;
  home: MatchSideContext;
  away: MatchSideContext;
};

/** Ligne de comparaison : [valeur dom] [label] [valeur ext]. */
function CompareRow({
  label,
  home,
  away,
  lower_is_better,
  unit,
}: {
  label: string;
  home: string | number | null;
  away: string | number | null;
  lower_is_better?: boolean;
  /** Suffixe affiché derrière la valeur (ex. "%") quand home/away est un nombre. */
  unit?: string;
}) {
  const hn = typeof home === 'number' ? home : null;
  const an = typeof away === 'number' ? away : null;
  let homeBest = false;
  let awayBest = false;
  if (hn != null && an != null && hn !== an) {
    homeBest = lower_is_better ? hn < an : hn > an;
    awayBest = !homeBest;
  }
  const fmt = (v: string | number | null) =>
    v == null ? '—' : typeof v === 'number' && unit ? `${v}${unit}` : v;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1.5 text-sm tabular-nums">
      <span
        className={`text-right font-semibold ${homeBest ? 'text-primary' : 'text-foreground'}`}
      >
        {fmt(home)}
      </span>
      <span className="text-muted-foreground px-2 text-center text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <span
        className={`text-left font-semibold ${awayBest ? 'text-emerald-400' : 'text-foreground'}`}
      >
        {fmt(away)}
      </span>
    </div>
  );
}

function ModuleHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <p className="text-muted-foreground mb-1 flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase">
      {icon}
      {title}
    </p>
  );
}

export function MatchContextSection({
  home_team_name,
  away_team_name,
  home,
  away,
}: MatchContextSectionProps) {
  const hasStanding = home.standing != null || away.standing != null;
  const hasXg = home.xg != null || away.xg != null;
  const hasTiming =
    (home.goal_timing != null && home.goal_timing.goals_for > 0) ||
    (away.goal_timing != null && away.goal_timing.goals_for > 0);

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold">Contexte d&apos;avant-match</h2>
      </header>

      {/* Bandeau noms d'équipes */}
      <div className="text-muted-foreground mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs font-medium tracking-wide uppercase">
        <span className="text-primary truncate text-right">
          {home_team_name}
        </span>
        <span className="px-2" />
        <span className="truncate text-left text-emerald-400">
          {away_team_name}
        </span>
      </div>

      <div className="space-y-4">
        {/* Fraîcheur / calendrier */}
        <div>
          <ModuleHeader
            icon={<CalendarClock className="size-3" aria-hidden />}
            title="Fraîcheur"
          />
          <CompareRow
            label="Jours de repos"
            home={home.schedule.rest_days}
            away={away.schedule.rest_days}
          />
          <CompareRow
            label="Matchs sur 14 j"
            home={home.schedule.matches_last_14d}
            away={away.schedule.matches_last_14d}
            lower_is_better
          />
        </div>

        {/* Classement / enjeu */}
        {hasStanding && (
          <div className="border-border/60 border-t pt-3">
            <ModuleHeader
              icon={<Trophy className="size-3" aria-hidden />}
              title="Au classement"
            />
            <CompareRow
              label="Position"
              home={
                home.standing
                  ? `${home.standing.position}ᵉ/${home.standing.total_teams}`
                  : null
              }
              away={
                away.standing
                  ? `${away.standing.position}ᵉ/${away.standing.total_teams}`
                  : null
              }
            />
            <CompareRow
              label="Points"
              home={home.standing?.points ?? null}
              away={away.standing?.points ?? null}
            />
          </div>
        )}

        {/* xG saison */}
        {hasXg && (
          <div className="border-border/60 border-t pt-3">
            <ModuleHeader
              icon={<Target className="size-3" aria-hidden />}
              title="xG cette saison"
            />
            <CompareRow
              label="xG marqué / match"
              home={home.xg?.xg_for_avg ?? null}
              away={away.xg?.xg_for_avg ?? null}
            />
            <CompareRow
              label="xG concédé / match"
              home={home.xg?.xg_against_avg ?? null}
              away={away.xg?.xg_against_avg ?? null}
              lower_is_better
            />
          </div>
        )}

        {/* Tempo des buts — quand on marque / quand on encaisse */}
        {hasTiming && (
          <div className="border-border/60 border-t pt-3">
            <ModuleHeader
              icon={<Clock className="size-3" aria-hidden />}
              title="Tempo des buts"
            />
            <CompareRow
              label="Marqués 0-15'"
              home={home.goal_timing?.scored_early_pct ?? null}
              away={away.goal_timing?.scored_early_pct ?? null}
              unit="%"
            />
            <CompareRow
              label="Marqués 76'+"
              home={home.goal_timing?.scored_late_pct ?? null}
              away={away.goal_timing?.scored_late_pct ?? null}
              unit="%"
            />
            <CompareRow
              label="Encaissés 0-15'"
              home={home.goal_timing?.conceded_early_pct ?? null}
              away={away.goal_timing?.conceded_early_pct ?? null}
              unit="%"
              lower_is_better
            />
            <CompareRow
              label="Encaissés 76'+"
              home={home.goal_timing?.conceded_late_pct ?? null}
              away={away.goal_timing?.conceded_late_pct ?? null}
              unit="%"
              lower_is_better
            />
          </div>
        )}
      </div>
    </section>
  );
}
