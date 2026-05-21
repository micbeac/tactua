import type { Metadata } from 'next';
import { Calendar, ExternalLink, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NewsBreadcrumb } from '@/components/news/NewsBreadcrumb';
import { NewsContextCard } from '@/components/news/NewsContextCard';
import { JsonLd } from '@/components/seo/JsonLd';
import { autolinkHtml, type LinkableEntity } from '@/lib/autolink';
import { getNewsContext } from '@/lib/data/news-context';
import { parseNewsSlug } from '@/lib/openai/news-content';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import { playerHref, teamHref } from '@/lib/url';

export const revalidate = 3600; // 1h

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

type NewsRow = {
  id: number;
  title: string;
  slug: string | null;
  url: string | null;
  snippet: string | null;
  source: string;
  scraped_at: string;
  published_at: string | null;
  ai_summary: string | null;
  ai_content: string | null;
  ai_perspective: string | null;
  ai_generated_at: string | null;
  team: {
    id: number;
    name: string;
    logo_url: string | null;
  } | null;
};

async function getNews(slug: string): Promise<NewsRow | null> {
  const supabase = await createClient();
  const newsId = parseNewsSlug(slug);
  if (newsId == null) return null;

  const { data } = await supabase
    .from('team_narratives')
    .select(
      `id, title, slug, url, snippet, source, scraped_at, published_at,
       ai_summary, ai_content, ai_perspective, ai_generated_at,
       team:teams!team_narratives_team_id_fkey(id, name, logo_url)`,
    )
    .eq('id', newsId)
    .maybeSingle();

  if (!data) return null;
  return data as unknown as NewsRow;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const news = await getNews(slug);
  if (!news) return { title: 'Actualité introuvable' };

  const teamName = news.team?.name ?? 'Football';
  const summary = news.ai_summary ?? news.snippet ?? '';
  const url = `${SITE_URL}/news/${news.slug ?? slug}`;

  return {
    title: `${news.title} · ${teamName}`,
    description: summary.slice(0, 160),
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: news.title,
      description: summary.slice(0, 200),
      url,
      siteName: SITE_NAME,
      publishedTime: news.published_at ?? news.scraped_at,
      modifiedTime: news.ai_generated_at ?? news.scraped_at,
      authors: [SITE_NAME],
      images: news.team?.logo_url ? [{ url: news.team.logo_url }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: news.title,
      description: summary.slice(0, 200),
    },
  };
}

function renderMarkdown(md: string): string {
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const lines = escaped.split('\n');
  const out: string[] = [];
  let inList = false;
  let buffer: string[] = [];

  function flushParagraph() {
    if (buffer.length > 0) {
      const text = buffer
        .join(' ')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      out.push(`<p>${text}</p>`);
      buffer = [];
    }
  }
  function closeList() {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  }

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      flushParagraph();
      closeList();
      continue;
    }
    if (t.startsWith('## ')) {
      flushParagraph();
      closeList();
      out.push(`<h2>${t.slice(3)}</h2>`);
      continue;
    }
    if (t.startsWith('# ')) {
      flushParagraph();
      closeList();
      out.push(`<h2>${t.slice(2)}</h2>`);
      continue;
    }
    if (t.startsWith('- ') || t.startsWith('* ')) {
      flushParagraph();
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      const item = t
        .slice(2)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      out.push(`<li>${item}</li>`);
      continue;
    }
    closeList();
    buffer.push(t);
  }
  flushParagraph();
  closeList();
  return out.join('\n');
}

export default async function NewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const news = await getNews(slug);
  if (!news) notFound();

  const team = news.team;
  const url = `${SITE_URL}/news/${news.slug ?? slug}`;
  const publishedAt = news.published_at ?? news.scraped_at;
  const modifiedAt = news.ai_generated_at ?? news.scraped_at;
  const hasAiContent = Boolean(news.ai_content);

  const supabase = await createClient();

  // Contexte équipe (logo, classement, forme, prochain match, joueurs)
  const ctx = team ? await getNewsContext(supabase, team.id) : null;

  // Related news (maillage interne)
  let related: {
    id: number;
    title: string;
    slug: string | null;
    ai_summary: string | null;
  }[] = [];
  if (team) {
    const { data } = await supabase
      .from('team_narratives')
      .select('id, title, slug, ai_summary')
      .eq('team_id', team.id)
      .neq('id', news.id)
      .not('ai_content', 'is', null)
      .order('scraped_at', { ascending: false })
      .limit(3);
    related = (data ?? []) as typeof related;
  }

  // Auto-link : transforme les noms d'équipes/joueurs/prochain match
  // mentionnés dans le contenu IA en liens internes.
  const entities: LinkableEntity[] = [];
  if (ctx) {
    // L'équipe elle-même (pour les variantes : "Inter", "Bologne", etc.)
    entities.push({
      type: 'team',
      name: ctx.team.name,
      href: teamHref(ctx.team.id, ctx.team.name),
    });
    // Prochain adversaire
    if (ctx.next_match?.opponent) {
      entities.push({
        type: 'team',
        name: ctx.next_match.opponent.name,
        href: teamHref(
          ctx.next_match.opponent.id,
          ctx.next_match.opponent.name,
        ),
      });
    }
    // Joueurs de l'équipe
    for (const p of ctx.players) {
      entities.push({
        type: 'player',
        name: p.name,
        href: playerHref(p.id, p.name),
      });
    }
  }

  const renderedHtml = hasAiContent ? renderMarkdown(news.ai_content!) : '';
  const linkedHtml = renderedHtml
    ? autolinkHtml(renderedHtml, entities)
    : '';

  // Crumbs : Accueil > Actualités > [Équipe] > [Titre]
  const crumbs = [
    { label: 'Accueil', href: '/' },
    { label: 'Actualités' },
    ...(team
      ? [
          {
            label: team.name,
            href: `/teams/${teamHref(team.id, team.name).split('/teams/')[1]}/actu`,
          },
        ]
      : []),
    { label: news.title },
  ];

  // Construit la liste des joueurs mentionnés (pour Schema.org `mentions`)
  const mentionedPlayers = entities.filter((e) => e.type === 'player');

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* JSON-LD NewsArticle enrichi */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: news.title,
          description: news.ai_summary ?? news.snippet ?? '',
          datePublished: publishedAt,
          dateModified: modifiedAt,
          inLanguage: 'fr-FR',
          author: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
          },
          publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
            logo: {
              '@type': 'ImageObject',
              url: `${SITE_URL}/logo.png`,
            },
          },
          mainEntityOfPage: { '@type': 'WebPage', '@id': url },
          image: team?.logo_url ? [team.logo_url] : undefined,
          about: team
            ? {
                '@type': 'SportsTeam',
                name: team.name,
                url: `${SITE_URL}${teamHref(team.id, team.name)}`,
                logo: team.logo_url ?? undefined,
              }
            : undefined,
          mentions:
            mentionedPlayers.length > 0
              ? mentionedPlayers.slice(0, 10).map((p) => ({
                  '@type': 'Person',
                  name: p.name,
                  url: `${SITE_URL}${p.href}`,
                }))
              : undefined,
          keywords: [
            team?.name,
            ctx?.competition?.name,
            'football',
            'analyse',
            'actualité',
          ]
            .filter(Boolean)
            .join(', '),
        }}
      />

      <NewsBreadcrumb crumbs={crumbs} />

      <article>
        {/* Hero avec logo équipe en grand */}
        <header className="mb-8">
          {team && (
            <div className="mb-5 flex items-center gap-4">
              {team.logo_url && (
                <div className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-full sm:size-20">
                  <Image
                    src={team.logo_url}
                    alt={`Logo ${team.name}`}
                    fill
                    sizes="80px"
                    className="object-contain p-2"
                    unoptimized
                    priority
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={teamHref(team.id, team.name)}
                  className="bg-primary/15 text-primary inline-block rounded-md px-2.5 py-1 text-[10px] font-semibold tracking-widest uppercase hover:underline"
                >
                  {team.name}
                </Link>
                {ctx?.competition && (
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    {ctx.competition.name}
                  </p>
                )}
              </div>
            </div>
          )}
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {news.title}
          </h1>
          {news.ai_summary && (
            <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
              {news.ai_summary}
            </p>
          )}
          <div className="text-muted-foreground mt-5 flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" aria-hidden />
              <time dateTime={publishedAt}>
                {DATE_FMT.format(new Date(publishedAt))}
              </time>
            </span>
            <span>·</span>
            <span>Par {SITE_NAME}</span>
            {news.ai_generated_at && (
              <>
                <span>·</span>
                <span className="text-primary inline-flex items-center gap-1">
                  <Sparkles className="size-3" aria-hidden />
                  Analyse IA
                </span>
              </>
            )}
          </div>
        </header>

        {/* Contexte club juste avant le corps (visuel + maillage) */}
        {ctx && <NewsContextCard ctx={ctx} />}

        {/* Corps de l'article */}
        {hasAiContent ? (
          <div
            className="prose prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-p:leading-relaxed prose-p:text-foreground/90 prose-strong:text-primary prose-a:text-primary max-w-none text-sm sm:text-base"
            dangerouslySetInnerHTML={{ __html: linkedHtml }}
          />
        ) : (
          <div className="bg-muted/40 rounded-lg p-6 text-sm">
            <p className="text-muted-foreground italic">
              Le résumé éditorial est en cours de génération. En attendant, voici
              l&apos;extrait de la source originale :
            </p>
            {news.snippet && (
              <p className="mt-3 leading-relaxed">{news.snippet}</p>
            )}
          </div>
        )}

        {/* Perspective éditoriale */}
        {news.ai_perspective && (
          <section className="bg-primary/5 border-primary/20 mt-8 rounded-xl border p-5">
            <h2 className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
              <Sparkles className="mr-1 inline size-3.5" aria-hidden />
              Pourquoi ça compte
            </h2>
            <p className="text-sm leading-relaxed sm:text-base">
              {news.ai_perspective}
            </p>
          </section>
        )}

        {/* Liens internes complémentaires sous le corps */}
        {team && (
          <section className="border-border mt-8 grid grid-cols-1 gap-3 border-t pt-6 sm:grid-cols-2">
            <Link
              href={teamHref(team.id, team.name)}
              className="bg-card hover:border-primary/40 border-border block rounded-lg border p-4 transition-colors"
            >
              <p className="text-muted-foreground text-[10px] tracking-widest uppercase">
                Découvrir
              </p>
              <p className="text-primary mt-1 text-sm font-semibold">
                Fiche complète {team.name} →
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Classement, calendrier, effectif et stats
              </p>
            </Link>
            <Link
              href={`/teams/${teamHref(team.id, team.name).split('/teams/')[1]}/actu`}
              className="bg-card hover:border-primary/40 border-border block rounded-lg border p-4 transition-colors"
            >
              <p className="text-muted-foreground text-[10px] tracking-widest uppercase">
                Plus d&apos;actu
              </p>
              <p className="text-primary mt-1 text-sm font-semibold">
                Toutes les news {team.name} →
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                L&apos;intégralité des actualités du club
              </p>
            </Link>
          </section>
        )}

        {/* Attribution source */}
        {news.url && (
          <footer className="border-border mt-10 border-t pt-5 text-xs">
            <p className="text-muted-foreground">
              Article inspiré d&apos;une publication parue sur{' '}
              <a
                href={news.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-primary inline-flex items-center gap-1 hover:underline"
              >
                la source originale
                <ExternalLink className="size-3" aria-hidden />
              </a>
              . Le contenu ci-dessus est un résumé reformulé et enrichi de
              contexte tactique propre à Tactuo.
            </p>
          </footer>
        )}
      </article>

      {/* Related news */}
      {related.length > 0 && team && (
        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Plus d&apos;actualités {team.name}
            </h2>
            <Link
              href={`/teams/${teamHref(team.id, team.name).split('/teams/')[1]}/actu`}
              className="text-primary text-xs hover:underline"
            >
              Toutes les news →
            </Link>
          </div>
          <ul className="space-y-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/news/${r.slug ?? `news-${r.id}`}`}
                  className="bg-card hover:border-primary/40 border-border block rounded-lg border p-3 transition-colors"
                >
                  <p className="line-clamp-2 text-sm font-semibold">
                    {r.title}
                  </p>
                  {r.ai_summary && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                      {r.ai_summary}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
