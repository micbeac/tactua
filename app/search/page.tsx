import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { searchAll } from '@/lib/data/search';
import { createClient } from '@/lib/supabase/server';
import { playerHref, teamHref } from '@/lib/url';

export const dynamic = 'force-dynamic';

type SearchPageParams = {
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({
  searchParams,
}: SearchPageParams): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Recherche : ${q}` : 'Recherche',
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: SearchPageParams) {
  const { q = '' } = await searchParams;
  const supabase = await createClient();
  const results = q ? await searchAll(supabase, q) : { teams: [], players: [] };

  const totalCount = results.teams.length + results.players.length;

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Recherche</h1>
        {q ? (
          <p className="text-muted-foreground mt-2 text-sm">
            {totalCount > 0 ? (
              <>
                <span className="text-foreground font-medium">
                  {totalCount}
                </span>{' '}
                résultat{totalCount > 1 ? 's' : ''} pour
                <span className="text-foreground font-medium"> « {q} »</span>
              </>
            ) : (
              <>
                Aucun résultat pour{' '}
                <span className="text-foreground"> « {q} »</span>.
              </>
            )}
          </p>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            Tape le nom d&apos;une équipe ou d&apos;un joueur dans la barre du
            header.
          </p>
        )}
      </header>

      {results.teams.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Équipes</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {results.teams.map((t) => (
              <li key={t.id}>
                <Link
                  href={teamHref(t.id, t.name)}
                  className="bg-card hover:border-primary/40 border-border flex items-center gap-3 rounded-xl border p-3 transition-colors"
                >
                  <div className="bg-muted relative size-9 shrink-0 overflow-hidden rounded-full">
                    {t.logo_url ? (
                      <Image
                        src={t.logo_url}
                        alt=""
                        fill
                        sizes="36px"
                        className="object-contain p-1"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    {t.country && (
                      <p className="text-muted-foreground text-xs">
                        {t.country}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.players.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Joueurs</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {results.players.map((p) => (
              <li key={p.id}>
                <Link
                  href={playerHref(p.id, p.name)}
                  className="bg-card hover:border-primary/40 border-border flex items-center gap-3 rounded-xl border p-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {[p.position, p.current_team_name]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
