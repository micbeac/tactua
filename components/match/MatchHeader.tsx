import Image from 'next/image';
import Link from 'next/link';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { teamHref } from '@/lib/url';

type Team = {
  id: number | null;
  name: string;
  tla: string | null;
  logo_url: string | null;
};

export type MatchHeaderProps = {
  id: number;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  stage: string | null;
  matchday: number | null;
  score_home: number | null;
  score_away: number | null;
  /** Minute en cours si live. Mis à jour par enrich.ts via fixture.status.elapsed */
  live_minute?: number | null;
  home: Team;
  away: Team;
  is_favorite: boolean;
  is_logged_in: boolean;
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatStage(stage: string | null): string | null {
  if (!stage) return null;
  return stage
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusLabel(status: MatchHeaderProps['status']): {
  text: string;
  tone: 'live' | 'finished' | 'scheduled' | 'warn' | 'danger';
} {
  switch (status) {
    case 'live':
      return { text: 'Live', tone: 'live' };
    case 'finished':
      return { text: 'Terminé', tone: 'finished' };
    case 'postponed':
      return { text: 'Reporté', tone: 'warn' };
    case 'cancelled':
      return { text: 'Annulé', tone: 'danger' };
    default:
      return { text: 'À venir', tone: 'scheduled' };
  }
}

function TeamBlock({ team }: { team: Team }) {
  const inner = (
    <>
      <div className="bg-muted relative size-16 overflow-hidden rounded-full sm:size-20">
        {team.logo_url ? (
          <Image
            src={team.logo_url}
            alt=""
            fill
            sizes="(min-width: 640px) 80px, 64px"
            className="object-contain p-2"
          />
        ) : (
          <span className="text-muted-foreground flex h-full w-full items-center justify-center text-sm font-semibold">
            {team.tla ?? '?'}
          </span>
        )}
      </div>
      <span className="line-clamp-2 max-w-[10rem] text-sm font-semibold sm:max-w-[14rem] sm:text-base">
        {team.name || 'À déterminer'}
      </span>
    </>
  );

  if (team.id != null) {
    return (
      <Link
        href={teamHref(team.id, team.name)}
        className="hover:text-primary group flex flex-col items-center gap-3 text-center transition-colors"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">{inner}</div>
  );
}

export function MatchHeader(props: MatchHeaderProps) {
  const {
    id,
    kickoff_at,
    status,
    stage,
    matchday,
    score_home,
    score_away,
    live_minute,
    home,
    away,
    is_favorite,
    is_logged_in,
  } = props;
  const dateLabel = DATE_FMT.format(new Date(kickoff_at));
  const stageLabel = formatStage(stage);
  const showScore = status === 'live' || status === 'finished';
  const { text: statusText, tone } = statusLabel(status);

  return (
    <section className="bg-primary/10 border-primary/20 relative overflow-hidden rounded-2xl border p-6 sm:p-8">
      {/* Halo décoratif (homogène avec PlayerHeader et TeamHeader) */}
      <div className="bg-primary/20 pointer-events-none absolute -top-16 -right-16 size-64 rounded-full blur-3xl" />
      <div className="bg-emerald-400/10 pointer-events-none absolute -bottom-20 -left-20 size-72 rounded-full blur-3xl" />

      <div className="relative mb-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
        <p className="text-muted-foreground text-xs tracking-widest uppercase">
          {dateLabel}
        </p>
        {(stageLabel || matchday != null) && (
          <>
            <span className="text-muted-foreground/40" aria-hidden>
              ·
            </span>
            <p className="text-muted-foreground text-xs">
              {stageLabel ?? `Journée ${matchday}`}
            </p>
          </>
        )}
        <span
          className={`ml-2 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
            tone === 'live'
              ? 'bg-primary/10 text-primary'
              : tone === 'finished'
                ? 'bg-muted text-muted-foreground'
                : tone === 'warn'
                  ? 'bg-yellow-500/15 text-yellow-500'
                  : tone === 'danger'
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-secondary text-secondary-foreground'
          }`}
        >
          {tone === 'live' && (
            <span className="bg-primary mr-1 inline-block size-1.5 animate-pulse rounded-full" />
          )}
          {statusText}
          {tone === 'live' && live_minute != null && (
            <span className="ml-1.5 tabular-nums">· {live_minute}&apos;</span>
          )}
        </span>
      </div>

      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
        <TeamBlock team={home} />
        <div className="text-foreground text-2xl font-bold tabular-nums sm:text-4xl">
          {showScore ? (
            <span>
              {score_home ?? 0}
              <span className="text-muted-foreground mx-2">–</span>
              {score_away ?? 0}
            </span>
          ) : (
            <span className="text-muted-foreground text-base font-medium sm:text-xl">
              vs
            </span>
          )}
        </div>
        <TeamBlock team={away} />
      </div>

      <div className="relative mt-6 flex justify-center">
        <FavoriteButton
          entity_type="match"
          entity_id={id}
          is_favorite={is_favorite}
          is_logged_in={is_logged_in}
          label_add="Suivre ce match"
          label_remove="Suivi"
        />
      </div>
    </section>
  );
}
