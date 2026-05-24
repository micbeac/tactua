import { Star } from 'lucide-react';
import type { MatchPerformer } from '@/lib/data/match-performance';

export type MatchPlayerRatingsSectionProps = {
  home_team_name: string;
  away_team_name: string;
  /** Liste complète des joueurs notés équipe domicile, triés par note DESC */
  home_performers: MatchPerformer[];
  /** Idem extérieur */
  away_performers: MatchPerformer[];
};

const TOP_DISPLAY = 5;

/**
 * Panneau post-match : notes individuelles des joueurs (sur 10) côté
 * domicile et extérieur, top 5 visibles + détail complet déplié.
 *
 * Affiché seulement quand au moins un joueur a une note enregistrée.
 * Pas de JS : la zone « voir tous les joueurs » utilise un <details> natif.
 */
export function MatchPlayerRatingsSection({
  home_team_name,
  away_team_name,
  home_performers,
  away_performers,
}: MatchPlayerRatingsSectionProps) {
  const hasAny =
    home_performers.some((p) => p.rating != null) ||
    away_performers.some((p) => p.rating != null);
  if (!hasAny) return null;

  // Identifie l'homme du match (meilleure note tous joueurs confondus, > 7)
  const all = [
    ...home_performers.map((p) => ({ ...p, side: 'home' as const })),
    ...away_performers.map((p) => ({ ...p, side: 'away' as const })),
  ];
  const motm = all
    .filter((p) => p.rating != null && p.rating >= 7)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Notes du match</h2>
        {motm && motm.rating != null && (
          <div className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase">
            <Star className="size-3" aria-hidden />
            Homme du match : {motm.name} ({motm.rating.toFixed(1)})
          </div>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <TeamColumn
          team_name={home_team_name}
          performers={home_performers}
          accent="primary"
        />
        <TeamColumn
          team_name={away_team_name}
          performers={away_performers}
          accent="emerald"
        />
      </div>
    </section>
  );
}

function TeamColumn({
  team_name,
  performers,
  accent,
}: {
  team_name: string;
  performers: MatchPerformer[];
  accent: 'primary' | 'emerald';
}) {
  if (performers.length === 0) {
    return (
      <div>
        <p
          className={`mb-2 text-xs font-semibold tracking-wide uppercase ${
            accent === 'primary' ? 'text-primary' : 'text-emerald-400'
          }`}
        >
          {team_name}
        </p>
        <p className="text-muted-foreground text-xs italic">
          Notes non disponibles
        </p>
      </div>
    );
  }

  const top = performers.slice(0, TOP_DISPLAY);
  const rest = performers.slice(TOP_DISPLAY);

  return (
    <div>
      <p
        className={`mb-3 text-xs font-semibold tracking-wide uppercase ${
          accent === 'primary' ? 'text-primary' : 'text-emerald-400'
        }`}
      >
        {team_name}
      </p>
      <ul className="space-y-1.5">
        {top.map((p, i) => (
          <RatingRow key={`top-${i}`} player={p} accent={accent} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="group mt-2">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs select-none">
            Voir les {rest.length} autre{rest.length > 1 ? 's' : ''} joueur
            {rest.length > 1 ? 's' : ''}
            <span className="ml-1 transition-transform group-open:rotate-90 inline-block">
              ›
            </span>
          </summary>
          <ul className="mt-2 space-y-1.5">
            {rest.map((p, i) => (
              <RatingRow key={`rest-${i}`} player={p} accent={accent} muted />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function RatingRow({
  player,
  accent,
  muted,
}: {
  player: MatchPerformer;
  accent: 'primary' | 'emerald';
  muted?: boolean;
}) {
  const rating = player.rating;
  const ratingClass =
    rating == null
      ? 'text-muted-foreground'
      : rating >= 8
        ? accent === 'primary'
          ? 'text-primary'
          : 'text-emerald-400'
        : rating >= 7
          ? 'text-foreground'
          : rating >= 6
            ? 'text-muted-foreground'
            : 'text-destructive/80';

  return (
    <li
      className={`flex items-center gap-2 text-sm ${muted ? 'opacity-80' : ''}`}
    >
      <span className="min-w-0 flex-1 truncate">
        {player.name}
        {player.goals > 0 && (
          <span className="ml-1.5" title={`${player.goals} but(s)`}>
            {'⚽'.repeat(Math.min(player.goals, 3))}
          </span>
        )}
        {player.assists > 0 && (
          <span className="ml-1" title={`${player.assists} passe(s) décisive(s)`}>
            🅰️
          </span>
        )}
      </span>
      <span
        className={`shrink-0 font-bold tabular-nums ${ratingClass}`}
        aria-label="note"
      >
        {rating == null ? '—' : rating.toFixed(1)}
      </span>
    </li>
  );
}
