import Image from 'next/image';

export type TeamHeaderProps = {
  name: string;
  tla: string | null;
  logo_url: string | null;
  country: string | null;
  founded: number | null;
  venue: string | null;
};

export function TeamHeader({
  name,
  tla,
  logo_url,
  country,
  founded,
  venue,
}: TeamHeaderProps) {
  const meta: string[] = [];
  if (country) meta.push(country);
  if (founded) meta.push(`Fondé en ${founded}`);
  if (venue) meta.push(venue);

  return (
    <section className="bg-card border-border flex items-center gap-5 rounded-2xl border p-6 sm:gap-6 sm:p-8">
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
    </section>
  );
}
