import Image from 'next/image';
import Link from 'next/link';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { teamHref } from '@/lib/url';

export type PlayerHeaderProps = {
  id: number;
  name: string;
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
    <section className="bg-card border-border rounded-2xl border p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {name}
          </h1>
          {meta.length > 0 && (
            <p className="text-muted-foreground mt-1 text-sm">
              {meta.join(' · ')}
            </p>
          )}
          {date_of_birth && (
            <p className="text-muted-foreground/80 mt-0.5 text-xs">
              Né le {DOB_FMT.format(new Date(date_of_birth))}
            </p>
          )}
        </div>

        {current_team && (
          <Link
            href={teamHref(current_team.id, current_team.name)}
            className="bg-muted/40 hover:bg-muted border-border flex items-center gap-3 self-start rounded-xl border px-4 py-2.5 transition-colors sm:self-auto"
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
      <div className="mt-4">
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
