import Link from 'next/link';
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
};

function PlayerRow({ p }: { p: LineupPlayer }) {
  return (
    <li className="border-border/60 border-b last:border-b-0">
      <Link
        href={playerHref(p.player_id, p.player_name)}
        className="hover:bg-muted/40 -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors"
      >
        <span className="text-muted-foreground w-6 shrink-0 text-right text-xs tabular-nums">
          {p.shirt_number ?? '—'}
        </span>
        <span className="flex-1 truncate text-sm">
          {p.player_name ?? `Joueur #${p.player_id}`}
        </span>
        {p.position && (
          <span className="text-muted-foreground hidden text-xs sm:inline">
            {p.position}
          </span>
        )}
      </Link>
    </li>
  );
}

function TeamLineupColumn({
  team,
  label,
}: {
  team: TeamLineup;
  label: string;
}) {
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
            <PlayerRow key={`s-${p.player_id}`} p={p} />
          ))}
        </ul>
      )}

      {team.bench.length > 0 && (
        <>
          <p className="text-muted-foreground mt-4 mb-2 text-xs font-medium tracking-wide uppercase">
            Remplaçants
          </p>
          <ul>
            {team.bench.map((p) => (
              <PlayerRow key={`b-${p.player_id}`} p={p} />
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
}: MatchLineupSectionProps) {
  const hasAny =
    (home && (home.starters.length > 0 || home.bench.length > 0)) ||
    (away && (away.starters.length > 0 || away.bench.length > 0));

  return (
    <section className="bg-card border-border rounded-2xl border p-6">
      <header className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold">Compositions</h2>
        {hasAny && (
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
              is_confirmed
                ? 'bg-primary/10 text-primary'
                : 'bg-yellow-500/15 text-yellow-500'
            }`}
          >
            {is_confirmed ? 'Officielle' : 'Probable'}
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
          {home ? <TeamLineupColumn team={home} label="Domicile" /> : <div />}
          {away ? <TeamLineupColumn team={away} label="Extérieur" /> : <div />}
        </div>
      )}
    </section>
  );
}
