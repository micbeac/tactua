import Image from 'next/image';
import Link from 'next/link';

export type MatchCardProps = {
  id: number;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  stage: string | null;
  matchday: number | null;
  score_home: number | null;
  score_away: number | null;
  home: {
    id: number | null;
    name: string;
    tla: string | null;
    logo_url: string | null;
  };
  away: {
    id: number | null;
    name: string;
    tla: string | null;
    logo_url: string | null;
  };
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
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

function StatusBadge({ status }: { status: MatchCardProps['status'] }) {
  if (status === 'live') {
    return (
      <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
        <span className="bg-primary size-1.5 animate-pulse rounded-full" />
        Live
      </span>
    );
  }
  if (status === 'finished') {
    return (
      <span className="text-muted-foreground bg-muted rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
        Terminé
      </span>
    );
  }
  if (status === 'postponed') {
    return (
      <span className="rounded-md bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-yellow-500 uppercase">
        Reporté
      </span>
    );
  }
  if (status === 'cancelled') {
    return (
      <span className="bg-destructive/15 text-destructive rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
        Annulé
      </span>
    );
  }
  return null;
}

function TeamSide({
  team,
  align,
}: {
  team: MatchCardProps['home'];
  align: 'left' | 'right';
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        align === 'right' ? 'flex-row-reverse text-right' : ''
      }`}
    >
      <div className="bg-muted relative size-8 shrink-0 overflow-hidden rounded-full">
        {team.logo_url ? (
          <Image
            src={team.logo_url}
            alt=""
            fill
            sizes="32px"
            className="object-contain p-1"
            unoptimized
          />
        ) : (
          <span className="text-muted-foreground flex h-full w-full items-center justify-center text-[10px] font-semibold">
            {team.tla ?? '?'}
          </span>
        )}
      </div>
      <span className="truncate text-sm font-medium">
        {team.name || team.tla || 'À déterminer'}
      </span>
    </div>
  );
}

export function MatchCard(props: MatchCardProps) {
  const {
    id,
    kickoff_at,
    status,
    stage,
    matchday,
    score_home,
    score_away,
    home,
    away,
  } = props;
  const kickoff = new Date(kickoff_at);
  const dateLabel = DATE_FMT.format(kickoff);
  const stageLabel = formatStage(stage);
  const showScore = status === 'live' || status === 'finished';

  return (
    <Link
      href={`/matches/${id}`}
      className="group bg-card hover:border-primary/40 focus-visible:border-primary border-border block rounded-xl border p-4 transition-colors focus-visible:outline-none"
    >
      <div className="text-muted-foreground mb-3 flex items-center justify-between text-xs">
        <span>{dateLabel}</span>
        <div className="flex items-center gap-2">
          {stageLabel && <span>{stageLabel}</span>}
          {matchday != null && stageLabel == null && <span>J. {matchday}</span>}
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <TeamSide team={home} align="left" />
        <div className="text-foreground shrink-0 text-sm font-semibold tabular-nums">
          {showScore ? (
            <span>
              {score_home ?? 0}
              <span className="text-muted-foreground mx-1">–</span>
              {score_away ?? 0}
            </span>
          ) : (
            <span className="text-muted-foreground">vs</span>
          )}
        </div>
        <TeamSide team={away} align="right" />
      </div>
    </Link>
  );
}
