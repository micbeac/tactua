import Link from 'next/link';
import { PlayerPopup, type PlayerPopupData } from '@/components/match/PlayerPopup';
import type { ProbableLineup } from '@/lib/data/match-insights';
import { playerHref } from '@/lib/url';

type LineupPlayer = {
  player_id: number;
  player_name: string | null;
  position: string | null;
  shirt_number: number | null;
};

export type TeamLineup = {
  team_id: number;
  team_name: string;
  team_logo: string | null;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
};

export type MatchLineupSectionProps = {
  is_confirmed: boolean;
  home: TeamLineup | null;
  away: TeamLineup | null;
  /** Map player_id → PlayerPopupData pour ouvrir un popup au clic sur un joueur. */
  popup_map?: Map<number, PlayerPopupData>;
  /** XI probable (déduit des derniers matchs) — fallback si pas de compo. */
  home_probable?: ProbableLineup | null;
  away_probable?: ProbableLineup | null;
};

/** Couleur de la pastille de note (0-10). */
function ratingClass(r: number): string {
  if (r >= 7.5) return 'bg-primary/15 text-primary';
  if (r >= 6.8) return 'bg-emerald-500/15 text-emerald-300';
  if (r >= 6.0) return 'bg-amber-500/15 text-amber-300';
  return 'bg-destructive/15 text-destructive';
}

function PlayerRow({
  p,
  team_name,
  popup_data,
}: {
  p: LineupPlayer;
  team_name: string;
  popup_data?: PlayerPopupData;
}) {
  const rating = popup_data?.rating;
  const goals = popup_data?.goals ?? 0;
  const inner = (
    <div className="hover:bg-muted/40 -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors">
      <span className="text-muted-foreground w-6 shrink-0 text-right text-xs tabular-nums">
        {p.shirt_number ?? '—'}
      </span>
      <span className="flex-1 truncate text-sm">
        {p.player_name ?? `Joueur #${p.player_id}`}
        {goals > 0 && (
          <span className="ml-1.5 text-xs" aria-label={`${goals} but`}>
            {'⚽'.repeat(Math.min(goals, 3))}
          </span>
        )}
      </span>
      {p.position && (
        <span className="text-muted-foreground hidden text-xs sm:inline">
          {p.position}
        </span>
      )}
      {rating != null && (
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold tabular-nums ${ratingClass(rating)}`}
        >
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
  return (
    <li className="border-border/60 border-b last:border-b-0">
      {popup_data ? (
        <PlayerPopup player={popup_data} team_name={team_name}>
          {inner}
        </PlayerPopup>
      ) : (
        <Link href={playerHref(p.player_id, p.player_name)}>{inner}</Link>
      )}
    </li>
  );
}

function TeamLineupColumn({
  team,
  label,
  popup_map,
  probable,
}: {
  team: TeamLineup;
  label: string;
  popup_map?: Map<number, PlayerPopupData>;
  probable?: ProbableLineup | null;
}) {
  // Pas de compo officielle mais un XI probable dispo → on l'affiche
  const showProbable = team.starters.length === 0 && probable != null;

  return (
    <div>
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          <span className="text-muted-foreground mr-2 text-xs tracking-wide uppercase">
            {label}
          </span>
          {team.team_name}
        </h3>
      </header>

      {showProbable ? (
        <>
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            XI probable
            <span className="text-muted-foreground/60 ml-1.5 normal-case">
              · d&apos;après les {probable!.sample} derniers matchs
            </span>
          </p>
          <ul>
            {probable!.players.map((p) => (
              <PlayerRow
                key={`p-${p.player_id}`}
                p={{
                  player_id: p.player_id,
                  player_name: p.player_name,
                  position: p.position,
                  shirt_number: p.shirt_number,
                }}
                team_name={team.team_name}
                popup_data={popup_map?.get(p.player_id)}
              />
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Titulaires
          </p>
          {team.starters.length === 0 ? (
            <p className="text-muted-foreground py-2 text-xs italic">
              Composition non disponible.
            </p>
          ) : (
            <ul>
              {team.starters.map((p) => (
                <PlayerRow
                  key={`s-${p.player_id}`}
                  p={p}
                  team_name={team.team_name}
                  popup_data={popup_map?.get(p.player_id)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {team.bench.length > 0 && (
        <>
          <p className="text-muted-foreground mt-4 mb-2 text-xs font-medium tracking-wide uppercase">
            Remplaçants
          </p>
          <ul>
            {team.bench.map((p) => (
              <PlayerRow
                key={`b-${p.player_id}`}
                p={p}
                team_name={team.team_name}
                popup_data={popup_map?.get(p.player_id)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function MatchLineupSection({
  is_confirmed,
  home,
  away,
  popup_map,
  home_probable,
  away_probable,
}: MatchLineupSectionProps) {
  const hasAny =
    (home && (home.starters.length > 0 || home.bench.length > 0)) ||
    (away && (away.starters.length > 0 || away.bench.length > 0)) ||
    (home_probable != null && home_probable.players.length > 0) ||
    (away_probable != null && away_probable.players.length > 0);
  // "Officielle" seulement si une vraie compo est confirmée ; sinon le XI
  // probable est affiché et le badge dit "Probable".
  const officialShown = is_confirmed && (
    (home != null && home.starters.length > 0) ||
    (away != null && away.starters.length > 0)
  );

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold">Compositions</h2>
        {hasAny && (
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
              officialShown
                ? 'bg-primary/10 text-primary'
                : 'bg-yellow-500/15 text-yellow-500'
            }`}
          >
            {officialShown ? 'Officielle' : 'Probable'}
          </span>
        )}
      </header>

      {!hasAny ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Les compositions seront affichées dès qu&apos;elles seront publiées
          (compo probable la veille, officielle ~1h avant le coup d&apos;envoi).
        </p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2">
          {home ? (
            <TeamLineupColumn
              team={home}
              label="Domicile"
              popup_map={popup_map}
              probable={home_probable}
            />
          ) : (
            <div />
          )}
          {away ? (
            <TeamLineupColumn
              team={away}
              label="Extérieur"
              popup_map={popup_map}
              probable={away_probable}
            />
          ) : (
            <div />
          )}
        </div>
      )}
    </section>
  );
}
