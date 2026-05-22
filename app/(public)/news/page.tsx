import type { Metadata } from 'next';
import { Newspaper, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import { teamHref } from '@/lib/url';

export const revalidate = 600; // 10 min

const PAGE_SIZE = 24;

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});

export const metadata: Metadata = {
  title: 'Actualités football · Tactuo',
  description:
    "Toutes les actualités football de Tactuo : transferts, blessures, compositions, analyses tactiques. Résumés en français avec mises en perspective éditoriales par club.",
  alternates: { canonical: `${SITE_URL}/news` },
};

type NewsRow = {
  id: number;
  title: string;
  slug: string | null;
  ai_summary: string | null;
  ai_content: string | null;
  scraped_at: string;
  team: {
    id: number;
    name: string;
    logo_url: string | null;
  } | null;
};

type SearchParams = Promise<{ page?: string; team?: string }>;

export default async function NewsIndexPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { page: pageStr, team: teamFilter } = await searchParams;
  const page = pageStr ? Math.max(1, Number(pageStr)) : 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from('team_narratives')
    .select(
      `id, title, slug, ai_summary, ai_content, scraped_at,
       team:teams!team_narratives_team_id_fkey(id, name, logo_url)`,
      { count: 'exact' },
    )
    .not('ai_content', 'is', null)
    .order('scraped_at', { ascending: false })
    .range(from, to);

  if (teamFilter) {
    const teamId = Number(teamFilter);
    if (Number.isFinite(teamId)) query = query.eq('team_id', teamId);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as NewsRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Récupère la liste des équipes ayant au moins une news (pour filtres rapides)
  const { data: teamsWithNews } = await supabase
    .from('team_narratives')
    .select('team_id, teams!team_narratives_team_id_fkey(id, name)')
    .not('ai_content', 'is', null)
    .limit(2000);

  const teamsAggregated = new Map<number, { name: string; count: number }>();
  for (const row of (teamsWithNews ?? []) as unknown as Array<{
    team_id: number;
    teams: { id: number; name: string } | null;
  }>) {
    if (!row.teams) continue;
    const entry = teamsAggregated.get(row.team_id) ?? {
      name: row.teams.name,
      count: 0,
    };
    entry.count += 1;
    teamsAggregated.set(row.team_id, entry);
  }
  const teamFilters = Array.from(teamsAggregated.entries())
    .map(([id, v]) => ({ id, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const currentTeamId = teamFilter ? Number(teamFilter) : null;
  const currentTeamName = currentTeamId
    ? teamsAggregated.get(currentTeamId)?.name ?? null
    : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-primary mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase">
          <Newspaper className="size-3.5" aria-hidden />
          Actualités
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {currentTeamName
            ? `Actualités ${currentTeamName}`
            : 'Toutes les actus football'}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Résumés et mises en perspective éditoriales par {SITE_NAME}. Chaque
          article croise l&apos;info originale avec le contexte tactique du
          club (forme, classement, prochain match).
        </p>
      </header>

      {/* Filtres équipes (top 12 par volume) */}
      {teamFilters.length > 0 && (
        <nav className="mb-8 flex flex-wrap gap-2">
          <Link
            href="/news"
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              !currentTeamId
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Toutes
          </Link>
          {teamFilters.map((t) => (
            <Link
              key={t.id}
              href={`/news?team=${t.id}`}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                currentTeamId === t.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.name}
              <span className="text-muted-foreground/70 ml-1.5">
                {t.count}
              </span>
            </Link>
          ))}
        </nav>
      )}

      {/* Liste */}
      {rows.length === 0 ? (
        <section className="bg-card border-border rounded-2xl border p-10 text-center">
          <p className="text-muted-foreground text-sm">
            Aucune actualité disponible
            {currentTeamName ? ` pour ${currentTeamName}` : ''}.
          </p>
        </section>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((n) => (
            <li key={n.id}>
              <Link
                href={`/news/${n.slug ?? `news-${n.id}`}`}
                className="bg-card hover:border-primary/40 border-border group flex h-full flex-col gap-3 rounded-2xl border p-4 transition-colors"
              >
                <header className="flex items-center gap-2">
                  {n.team?.logo_url && (
                    <div className="bg-muted relative size-8 shrink-0 overflow-hidden rounded-full">
                      <Image
                        src={n.team.logo_url}
                        alt=""
                        fill
                        sizes="32px"
                        className="object-contain p-1"
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-primary truncate text-[10px] font-semibold tracking-widest uppercase">
                      {n.team?.name ?? 'Football'}
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                      {DATE_FMT.format(new Date(n.scraped_at))}
                    </p>
                  </div>
                  <Sparkles
                    className="text-primary size-3.5 shrink-0"
                    aria-hidden
                  />
                </header>
                <h2 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary transition-colors">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-between text-xs">
          <p className="text-muted-foreground">
            Page {page} / {totalPages} · {total} articles
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/news?page=${page - 1}${currentTeamId ? `&team=${currentTeamId}` : ''}`}
                className="border-border hover:bg-muted rounded-md border px-3 py-1.5"
              >
                ← Précédent
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/news?page=${page + 1}${currentTeamId ? `&team=${currentTeamId}` : ''}`}
                className="border-border hover:bg-muted rounded-md border px-3 py-1.5"
              >
                Suivant →
              </Link>
            )}
          </div>
        </nav>
      )}

      {/* Hub équipe en cas de filtre actif */}
      {currentTeamId && currentTeamName && (
        <section className="bg-muted/30 border-border mt-10 rounded-xl border p-5 text-center">
          <p className="text-muted-foreground text-xs">
            Tu cherches plus que les news ?
          </p>
          <Link
            href={teamHref(currentTeamId, currentTeamName)}
            className="text-primary mt-1 inline-block text-sm font-semibold hover:underline"
          >
            Voir la fiche complète {currentTeamName} →
          </Link>
        </section>
      )}
    </main>
  );
}
