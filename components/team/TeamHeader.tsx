import Image from 'next/image';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';

export type TeamHeaderProps = {
  id: number;
  name: string;
  tla: string | null;
  logo_url: string | null;
  country: string | null;
  founded: number | null;
  venue: string | null;
  is_favorite: boolean;
  is_logged_in: boolean;
};

export function TeamHeader({
  id,
  name,
  tla,
  logo_url,
  country,
  founded,
  venue,
  is_favorite,
  is_logged_in,
}: TeamHeaderProps) {
  const meta: string[] = [];
  if (country) meta.push(country);
  if (founded) meta.push(`Fondé en ${founded}`);
  if (venue) meta.push(venue);

  return (
    <section className="bg-card border-border rounded-2xl border p-6 sm:p-8">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-center gap-5 sm:gap-6">
          <div className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-full sm:size-24">
            {logo_url ? (
              <Image
                src={logo_url}
                alt=""
                fill
                sizes="(min-width: 640px) 96px, 80px"
                className="object-contain p-3"
              />
            ) : (
              <span className="text-muted-foreground flex h-full w-full items-center justify-center text-base font-semibold">
                {tla ?? '?'}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {name}
            </h1>
            {meta.length > 0 && (
              <p className="text-muted-foreground mt-1 text-sm">
                {meta.join(' · ')}
              </p>
            )}
          </div>
        </div>

        <FavoriteButton
          entity_type="team"
          entity_id={id}
          is_favorite={is_favorite}
          is_logged_in={is_logged_in}
        />
      </div>
    </section>
  );
}
