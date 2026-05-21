import { Swords } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { Button } from '@/components/ui/button';
import { teamHref } from '@/lib/url';

export type PlayerHeaderProps = {
  id: number;
  name: string;
  photo_url: string | null;
  shirt_number: number | null;
  position: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  current_team: {
    id: number;
    name: string;
    logo_url: string | null;
    country: string | null;
  } | null;
  is_favorite: boolean;
  is_logged_in: boolean;
};

function computeAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

const DOB_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function PlayerHeader({
  id,
  name,
  photo_url,
  shirt_number,
  position,
  nationality,
  date_of_birth,
  current_team,
  is_favorite,
  is_logged_in,
}: PlayerHeaderProps) {
  const age = computeAge(date_of_birth);
  const meta: string[] = [];
  if (position) meta.push(position);
  if (nationality) meta.push(nationality);
  if (age != null) meta.push(`${age} ans`);

  return (
    <section className="bg-primary/10 border-primary/20 relative overflow-hidden rounded-2xl border p-6 sm:p-8">
      {/* Halo décoratif (même look que PlayerPopup) */}
      <div className="bg-primary/20 pointer-events-none absolute -top-16 -right-16 size-64 rounded-full blur-3xl" />
      <div className="bg-emerald-400/10 pointer-events-none absolute -bottom-20 -left-20 size-72 rounded-full blur-3xl" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <div className="border-primary/40 bg-muted relative size-20 shrink-0 overflow-hidden rounded-full border-2 sm:size-24">
            {photo_url ? (
              <Image
                src={photo_url}
                alt=""
                fill
                sizes="(min-width: 640px) 96px, 80px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="text-muted-foreground flex h-full w-full items-center justify-center text-2xl font-semibold">
                {shirt_number ?? name.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {shirt_number != null && (
                <span className="text-muted-foreground mr-2 tabular-nums">
                  #{shirt_number}
                </span>
              )}
              {name}
            </h1>
            {meta.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {position && (
                  <span className="bg-primary/15 text-primary inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                    {position}
                  </span>
                )}
                <p className="text-muted-foreground text-sm">
                  {[nationality, age != null ? `${age} ans` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            )}
            {date_of_birth && (
              <p className="text-muted-foreground/80 mt-1 text-xs">
                Né le {DOB_FMT.format(new Date(date_of_birth))}
              </p>
            )}
          </div>
        </div>

        {current_team && (
          <Link
            href={teamHref(current_team.id, current_team.name)}
            className="bg-card/60 hover:bg-card border-border flex items-center gap-3 self-start rounded-xl border px-4 py-2.5 backdrop-blur transition-colors sm:self-auto"
          >
            <div className="bg-background relative size-8 shrink-0 overflow-hidden rounded-full">
              {current_team.logo_url ? (
                <Image
                  src={current_team.logo_url}
                  alt=""
                  fill
                  sizes="32px"
                  className="object-contain p-1"
                />
              ) : null}
            </div>
            <div className="text-left">
              <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                Club actuel
              </p>
              <p className="text-sm font-medium">{current_team.name}</p>
            </div>
          </Link>
        )}
      </div>
      <div className="relative mt-4 flex flex-wrap items-center gap-2">
        <Link href={`/compare/players?a=${id}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Swords className="size-3.5" aria-hidden />
            Comparer
          </Button>
        </Link>
        <FavoriteButton
          entity_type="player"
          entity_id={id}
          is_favorite={is_favorite}
          is_logged_in={is_logged_in}
        />
      </div>
    </section>
  );
}
