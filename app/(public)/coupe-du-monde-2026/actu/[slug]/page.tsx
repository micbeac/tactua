import type { Metadata } from 'next';
import { Calendar, ExternalLink, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/seo/JsonLd';
import { getWCNewsBySlug, getLatestWCNews } from '@/lib/data/wc-news';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 600;

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const news = await getWCNewsBySlug(supabase, slug);
  if (!news) return { title: 'Article introuvable' };

  const summary = news.ai_summary ?? news.snippet ?? '';
  const url = `${SITE_URL}/coupe-du-monde-2026/actu/${news.slug ?? slug}`;
  return {
    title: news.title,
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
    },
    twitter: {
      card: 'summary_large_image',
      title: news.title,
      description: summary.slice(0, 200),
    },
  };
}

/** Rendu Markdown minimal (## titres, listes, gras/italique). */
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
    if (t.startsWith('## ') || t.startsWith('# ')) {
      flushParagraph();
      closeList();
      out.push(`<h2>${t.replace(/^#{1,2}\s+/, '')}</h2>`);
      continue;
    }
    if (t.startsWith('- ') || t.startsWith('* ')) {
      flushParagraph();
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(
        `<li>${t.slice(2).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</li>`,
      );
      continue;
    }
    closeList();
    buffer.push(t);
  }
  flushParagraph();
  closeList();
  return out.join('\n');
}

export default async function WCNewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const news = await getWCNewsBySlug(supabase, slug);
  if (!news) notFound();

  const url = `${SITE_URL}/coupe-du-monde-2026/actu/${news.slug ?? slug}`;
  const publishedAt = news.published_at ?? news.scraped_at;
  const modifiedAt = news.ai_generated_at ?? news.edited_at ?? news.scraped_at;
  const hasContent = Boolean(news.ai_content);
  const renderedHtml = hasContent ? renderMarkdown(news.ai_content!) : '';

  const latest = (await getLatestWCNews(supabase, 4)).filter(
    (a) => a.id !== news.id,
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: news.title,
          description: news.ai_summary ?? news.snippet ?? '',
          datePublished: publishedAt,
          dateModified: modifiedAt,
          inLanguage: 'fr-FR',
          author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
          publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
          },
          mainEntityOfPage: { '@type': 'WebPage', '@id': url },
          about: {
            '@type': 'SportsEvent',
            name: 'Coupe du Monde FIFA 2026',
          },
        }}
      />

      <nav className="text-muted-foreground mb-6 text-xs">
        <Link href="/coupe-du-monde-2026" className="hover:text-primary">
          Coupe du Monde 2026
        </Link>
        <span className="mx-1.5">/</span>
        <Link
          href="/coupe-du-monde-2026/actu"
          className="hover:text-primary"
        >
          Actualités
        </Link>
      </nav>

      <article>
        <header className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            {news.team?.logo_url ? (
              <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-full">
                <Image
                  src={news.team.logo_url}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-contain p-1.5"
                  priority
                />
              </div>
            ) : (
              <div className="bg-primary/15 text-primary flex size-14 shrink-0 items-center justify-center rounded-full text-xl">
                🌍
              </div>
            )}
            <span className="bg-primary/15 text-primary inline-block rounded-md px-2.5 py-1 text-[10px] font-semibold tracking-widest uppercase">
              {news.category === 'tournoi'
                ? 'Coupe du Monde 2026'
                : (news.team?.name ?? 'Sélection')}
            </span>
          </div>
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
          </div>
        </header>

        {/* Vidéo attachée */}
        {news.video_youtube_id && (
          <div className="mb-8 aspect-video w-full overflow-hidden rounded-xl">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${news.video_youtube_id}`}
              title={news.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="size-full"
            />
          </div>
        )}

        {/* Corps de l'article */}
        {hasContent ? (
          <div
            className="prose prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-p:leading-relaxed prose-p:text-foreground/90 prose-strong:text-primary max-w-none text-sm sm:text-base"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        ) : (
          news.snippet && (
            <p className="text-foreground/90 leading-relaxed">
              {news.snippet}
            </p>
          )
        )}

        {/* Perspective Tactuo */}
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

        {/* Attribution source */}
        {news.source_url && (
          <footer className="border-border mt-10 border-t pt-5 text-xs">
            <p className="text-muted-foreground">
              Article reformulé et enrichi par Tactuo à partir d&apos;une
              publication parue sur{' '}
              <a
                href={news.source_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-primary inline-flex items-center gap-1 hover:underline"
              >
                {news.source_name ?? 'la source originale'}
                <ExternalLink className="size-3" aria-hidden />
              </a>
              .
            </p>
          </footer>
        )}
      </article>

      {/* Autres actus CDM */}
      {latest.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Plus d&apos;actu Coupe du Monde
            </h2>
            <Link
              href="/coupe-du-monde-2026/actu"
              className="text-primary text-xs hover:underline"
            >
              Tout voir →
            </Link>
          </div>
          <ul className="space-y-2">
            {latest.slice(0, 3).map((r) => (
              <li key={r.id}>
                <Link
                  href={`/coupe-du-monde-2026/actu/${r.slug ?? r.id}`}
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
