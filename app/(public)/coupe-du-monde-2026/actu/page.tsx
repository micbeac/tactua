import type { Metadata } from 'next';
import { Newspaper } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getPublishedWCNews } from '@/lib/data/wc-news';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 300;

const PAGE_SIZE = 18;

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});

export const metadata: Metadata = {
  title: 'Actualités Coupe du Monde 2026',
  description:
    "Toute l'actualité de la Coupe du Monde 2026 : sélections, préparation, format et organisation du tournoi. Articles rédigés et mis en perspective par Tactuo.",
  alternates: { canonical: '/coupe-du-monde-2026/actu' },
};

export default async function WCNewsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr } = await searchParams;
  const page = pageStr ? Math.max(1, Number(pageStr)) : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { articles, total } = await getPublishedWCNews(supabase, {
    limit: PAGE_SIZE,
    offset,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-muted-foreground mb-6 text-xs">
        <Link href="/coupe-du-monde-2026" className="hover:text-primary">
          Coupe du Monde 2026
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">Actualités</span>
      </nav>

      <header className="mb-8">
        <p className="text-primary mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase">
          <Newspaper className="size-3.5" aria-hidden />
          Actualités
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Actualités de la Coupe du Monde 2026
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Le fil d&apos;actu du tournoi : sélections, préparation, format et
          organisation. Chaque article est rédigé et mis en perspective par
          Tactuo.
        </p>
      </header>

      {articles.length === 0 ? (
        <section className="bg-card border-border rounded-2xl border p-10 text-center">
          <p className="text-muted-foreground text-sm">
            Les premières actualités arrivent très bientôt.
          </p>
        </section>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((n) => (
            <li key={n.id}>
              <Link
                href={`/coupe-du-monde-2026/actu/${n.slug ?? n.id}`}
                className="bg-card hover:border-primary/40 border-border group flex h-full flex-col gap-3 rounded-2xl border p-4 transition-colors"
              >
                <header className="flex items-center gap-2">
                  {n.team?.logo_url ? (
                    <div className="bg-muted relative size-8 shrink-0 overflow-hidden rounded-full">
                      <Image
                        src={n.team.logo_url}
                        alt=""
                        fill
                        sizes="32px"
                        className="object-contain p-1"
                      />
                    </div>
                  ) : (
                    <div className="bg-primary/15 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-sm">
                      🌍
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-primary truncate text-[10px] font-semibold tracking-widest uppercase">
                      {n.category === 'tournoi'
                        ? 'Tournoi'
                        : (n.team?.name ?? 'Sélection')}
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                      {DATE_FMT.format(
                        new Date(n.published_at ?? n.scraped_at),
                      )}
                    </p>
                  </div>
                  {n.video_youtube_id && (
                    <span className="text-xs" aria-hidden>
                      🎬
                    </span>
                  )}
                </header>
                <h2 className="group-hover:text-primary line-clamp-2 text-sm font-semibold leading-snug transition-colors">
                  {n.title}
                </h2>
                {n.ai_summary && (
                  <p className="text-muted-foreground mt-auto line-clamp-3 text-xs leading-relaxed">
                    {n.ai_summary}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-between text-xs">
          <p className="text-muted-foreground">
            Page {page} / {totalPages} · {total} articles
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/coupe-du-monde-2026/actu?page=${page - 1}`}
                className="border-border hover:bg-muted rounded-md border px-3 py-1.5"
              >
                ← Précédent
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/coupe-du-monde-2026/actu?page=${page + 1}`}
                className="border-border hover:bg-muted rounded-md border px-3 py-1.5"
              >
                Suivant →
              </Link>
            )}
          </div>
        </nav>
      )}
    </main>
  );
}
