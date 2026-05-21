import { Swords } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { Button } from '@/components/ui/button';

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
    <section className="bg-primary/10 border-primary/20 relative overflow-hidden rounded-2xl border p-6 sm:p-8">
      {/* Halo décoratif (homogène avec PlayerHeader et PlayerPopup) */}
      <div className="bg-primary/20 pointer-events-none absolute -top-16 -right-16 size-64 rounded-full blur-3xl" />
      <div className="bg-emerald-400/10 pointer-events-none absolute -bottom-20 -left-20 size-72 rounded-full blur-3xl" />

      <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-center gap-5 sm:gap-6">
          <div className="border-primary/40 bg-muted relative size-20 shrink-0 overflow-hidden rounded-full border-2 sm:size-24">
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

        <div className="relative flex flex-wrap items-center gap-2">
          <Link href={`/compare/teams?a=${id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Swords className="size-3.5" aria-hidden />
              Comparer
            </Button>
          </Link>
          <FavoriteButton
            entity_type="team"
            entity_id={id}
            is_favorite={is_favorite}
            is_logged_in={is_logged_in}
          />
        </div>
      </div>
    </section>
  );
}
