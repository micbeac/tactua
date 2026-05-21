import { CalendarClock, TrendingUp, Trophy } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { NewsContextData } from '@/lib/data/news-context';
import { teamHref } from '@/lib/url';

type Props = {
  ctx: NewsContextData;
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function positionLabel(pos: number | null): string {
  if (pos == null) return '—';
  if (pos === 1) return '1ᵉʳ';
  return `${pos}ᵉ`;
}

const formColor = (r: 'W' | 'D' | 'L') =>
  r === 'W'
    ? 'bg-primary/20 text-primary'
    : r === 'D'
      ? 'bg-amber-500/20 text-amber-500'
      : 'bg-destructive/20 text-destructive';

export function NewsContextCard({ ctx }: Props) {
  const hasContent =
    ctx.position != null ||
    ctx.recent_form.length > 0 ||
    ctx.next_match != null;
  if (!hasContent) return null;

  const w = ctx.recent_form.filter((r) => r === 'W').length;
  const d = ctx.recent_form.filter((r) => r === 'D').length;
  const l = ctx.recent_form.filter((r) => r === 'L').length;

  return (
    <aside className="bg-muted/30 border-border my-8 overflow-hidden rounded-2xl border">
      <header className="bg-primary/5 border-border flex items-center gap-3 border-b px-5 py-3">
        {ctx.team.logo_url && (
          <div className="bg-background relative size-9 shrink-0 overflow-hidden rounded-full">
            <Image
              src={ctx.team.logo_url}
              alt=""
              fill
              sizes="36px"
              className="object-contain p-1"
              unoptimized
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[10px] tracking-widest uppercase">
            Le club en bref
          </p>
          <Link
            href={teamHref(ctx.team.id, ctx.team.name)}
            className="text-primary truncate text-sm font-semibold hover:underline"
          >
            {ctx.team.name}
          </Link>
        </div>
      </header>

      <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {/* Classement */}
        {ctx.position != null && (
          <div className="px-4 py-3">
            <p className="text-muted-foreground flex items-center gap-1 text-[10px] tracking-wide uppercase">
              <Trophy className="size-3" aria-hidden />
              Classement{ctx.competition ? ` · ${ctx.competition.name}` : ''}
            </p>
            <p className="text-foreground mt-1 text-2xl font-bold tabular-nums">
              {positionLabel(ctx.position)}
            </p>
          </div>
        )}

        {/* Forme récente */}
        {ctx.recent_form.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-muted-foreground flex items-center gap-1 text-[10px] tracking-wide uppercase">
              <TrendingUp className="size-3" aria-hidden />
              Forme · 5 derniers
            </p>
            <div className="mt-1.5 flex items-center gap-1">
              {ctx.recent_form.map((r, i) => (
                <span
                  key={i}
                  className={`flex size-6 items-center justify-center rounded-md text-[10px] font-bold ${formColor(r)}`}
                >
                  {r}
                </span>
              ))}
            </div>
            <p className="text-muted-foreground mt-1 text-[10px] tabular-nums">
              {w}V-{d}N-{l}D
            </p>
          </div>
        )}

        {/* Prochain match */}
        {ctx.next_match && (
          <Link
            href={`/matches/${ctx.next_match.id}`}
            className="hover:bg-primary/5 block px-4 py-3 transition-colors"
          >
            <p className="text-muted-foreground flex items-center gap-1 text-[10px] tracking-wide uppercase">
              <CalendarClock className="size-3" aria-hidden />
              Prochain match
            </p>
            <p className="mt-1 text-sm font-semibold">
              {ctx.next_match.is_home ? 'vs' : '@'}{' '}
              {ctx.next_match.opponent?.name ?? 'À déterminer'}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[10px] tabular-nums">
              {DATE_FMT.format(new Date(ctx.next_match.kickoff_at))}
            </p>
          </Link>
        )}
      </div>
    </aside>
  );
}
