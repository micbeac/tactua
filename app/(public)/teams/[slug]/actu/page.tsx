import type { Metadata } from 'next';
import { ArrowLeft, ExternalLink, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import { parseEntityId, teamHref } from '@/lib/url';

export const revalidate = 600; // 10 min

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

type TeamRow = {
  id: number;
  name: string;
  logo_url: string | null;
  country: string | null;
};

type NewsRow = {
  id: number;
  title: string;
  slug: string | null;
  url: string | null;
  snippet: string | null;
  scraped_at: string;
  published_at: string | null;
  ai_summary: string | null;
  ai_content: string | null;
  ai_generated_at: string | null;
};

async function getTeam(id: number): Promise<TeamRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('teams')
    .select('id, name, logo_url, country')
    .eq('id', id)
    .maybeSingle();
  return (data as TeamRow | null) ?? null;
}

async function getTeamNews(teamId: number): Promise<NewsRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('team_narratives')
    .select(
      'id, title, slug, url, snippet, scraped_at, published_at, ai_summary, ai_content, ai_generated_at',
    )
    .eq('team_id', teamId)
    .order('scraped_at', { ascending: false })
    .limit(50);
  return (data ?? []) as NewsRow[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const teamId = parseEntityId(slug);
  if (teamId == null) return { title: 'Équipe introuvable' };
  const team = await getTeam(teamId);
  if (!team) return { title: 'Équipe introuvable' };

  return {
    title: `Actualités ${team.name}`,
    description: `Toutes les actualités, transferts et infos du club ${team.name} — résumés, mises en contexte tactique et analyses Tactuo.`,
    alternates: {
      canonical: `${SITE_URL}/teams/${slug}/actu`,
    },
  };
}

export default async function TeamActuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const teamId = parseEntityId(slug);
  if (teamId == null) notFound();

  const [team, news] = await Promise.all([
    getTeam(teamId),
    getTeamNews(teamId),
  ]);
  if (!team) notFound();

  // Sépare news avec AI content vs sans (pour priorité d'affichage)
  const withAi = news.filter((n) => n.ai_content);
  const withoutAi = news.filter((n) => !n.ai_content);

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <header className="space-y-4">
        <Link
          href={teamHref(team.id, team.name)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
        >
          <ArrowLeft className="size-3" aria-hidden />
          Retour à la fiche {team.name}
        </Link>
        <div className="flex items-center gap-4">
          {team.logo_url && (
            <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-full">
              <Image
                src={team.logo_url}
                alt=""
                fill
                sizes="56px"
                className="object-contain p-1.5"
                unoptimized
              />
            </div>
          )}
          <div>
            <p className="text-primary text-xs font-semibold tracking-widest uppercase">
              Actualités
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {team.name}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {news.length} article{news.length > 1 ? 's' : ''} trackés ·
              Résumés et mises en contexte Tactuo
            </p>
          </div>
        </div>
      </header>

      {/* News avec contenu IA généré (priorité d'affichage) */}
      {withAi.length > 0 && (
        <section className="space-y-4">
          {withAi.map((n) => (
            <article
              key={n.id}
              className="bg-card border-border hover:border-primary/30 rounded-2xl border p-5 transition-colors"
            >
              <Link href={`/news/${n.slug ?? `news-${n.id}`}`} className="block">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-primary inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase">
                    <Sparkles className="size-3" aria-hidden />
                    Analyse Tactuo
                  </span>
                  <span className="text-muted-foreground text-[10px]">·</span>
                  <time
                    dateTime={n.published_at ?? n.scraped_at}
                    className="text-muted-foreground text-[10px]"
                  >
                    {DATE_FMT.format(new Date(n.published_at ?? n.scraped_at))}
                  </time>
                </div>
                <h2 className="text-lg font-semibold leading-tight sm:text-xl">
                  {n.title}
                </h2>
                {n.ai_summary && (
                  <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-relaxed">
                    {n.ai_summary}
                  </p>
                )}
                <p className="text-primary mt-3 text-xs font-semibold">
                  Lire l&apos;analyse complète →
                </p>
              </Link>
            </article>
          ))}
        </section>
      )}

      {/* News sans contenu IA (anciennes ou en cours de génération) */}
      {withoutAi.length > 0 && (
        <section>
          <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
            Autres actualités récentes
          </h2>
          <ul className="space-y-2">
            {withoutAi.map((n) => (
              <li key={n.id}>
                <a
                  href={n.url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="bg-card hover:border-primary/30 border-border block rounded-lg border p-3 text-sm transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium">{n.title}</p>
                      {n.snippet && (
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                          {n.snippet}
                        </p>
                      )}
                    </div>
                    <ExternalLink
                      className="text-muted-foreground mt-1 size-3.5 shrink-0"
                      aria-hidden
                    />
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {news.length === 0 && (
        <section className="bg-card border-border rounded-2xl border p-10 text-center">
          <p className="text-muted-foreground text-sm">
            Aucune actualité récente trackée pour {team.name}. Le scraping
            hebdomadaire repassera prochainement.
          </p>
        </section>
      )}
    </main>
  );
}
