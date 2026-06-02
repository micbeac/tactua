import Link from 'next/link';
import type { IntlScorer } from '@/lib/data/team-intl-scorers';
import { playerHref } from '@/lib/url';

export type MatchIntlScorersSectionProps = {
  home_team_name: string;
  away_team_name: string;
  home_scorers: IntlScorer[];
  away_scorers: IntlScorer[];
};

/**
 * Section « Meilleurs scoreurs en sélection » sur la fiche d'un match
 * impliquant au moins une équipe nationale (amical / qualif / CDM).
 * Renvoie null si aucun des deux côtés n'a de données — n'affiche rien
 * pour les clubs.
 */
export function MatchIntlScorersSection({
  home_team_name,
  away_team_name,
  home_scorers,
  away_scorers,
}: MatchIntlScorersSectionProps) {
  if (home_scorers.length === 0 && away_scorers.length === 0) return null;

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold">
          Meilleurs scoreurs en sélection
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Cumul carrière en équipe nationale (sélections + buts).
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <TeamColumn
          team_name={home_team_name}
          scorers={home_scorers}
          accent="primary"
        />
        <TeamColumn
          team_name={away_team_name}
          scorers={away_scorers}
          accent="emerald"
        />
      </div>
    </section>
  );
}

function TeamColumn({
  team_name,
  scorers,
  accent,
}: {
  team_name: string;
  scorers: IntlScorer[];
  accent: 'primary' | 'emerald';
}) {
  if (scorers.length === 0) {
    return (
      <div>
        <p
          className={`mb-3 text-xs font-semibold tracking-wide uppercase ${
            accent === 'primary' ? 'text-primary' : 'text-emerald-400'
          }`}
        >
          {team_name}
        </p>
        <p className="text-muted-foreground text-xs italic">
          Données non disponibles
        </p>
      </div>
    );
  }

  return (
    <div>
      <p
        className={`mb-3 text-xs font-semibold tracking-wide uppercase ${
          accent === 'primary' ? 'text-primary' : 'text-emerald-400'
        }`}
      >
        {team_name}
      </p>
      <ol className="space-y-1.5">
        {scorers.map((p, i) => (
          <li key={p.player_id} className="flex items-baseline gap-2 text-sm">
            <span className="text-muted-foreground w-4 shrink-0 text-right text-xs tabular-nums">
              {i + 1}.
            </span>
            <Link
              href={playerHref(p.player_id, p.name)}
              className="hover:text-primary min-w-0 flex-1 truncate font-medium transition-colors"
            >
              {p.name}
            </Link>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {p.intl_caps} sél
            </span>
            <span
              className={`shrink-0 font-bold tabular-nums ${
                accent === 'primary' ? 'text-primary' : 'text-emerald-400'
              }`}
            >
              {p.intl_goals} buts
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
