'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  CATEGORY_LABELS,
  NEWS_CATEGORIES,
  deleteNewsArticle,
  requeueNewsArticle,
  setNewsStatus,
  updateNewsArticle,
  type NewsCategory,
} from '@/app/admin/news/actions';
import { Button } from '@/components/ui/button';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon',
  published: 'Publié',
  archived: 'Archivé',
};

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-amber-500/15 text-amber-300',
  published: 'bg-primary/15 text-primary',
  archived: 'bg-muted text-muted-foreground',
};

export type AdminNewsArticle = {
  id: number;
  title: string;
  slug: string | null;
  category: string | null;
  status: string;
  meta_description: string | null;
  ai_summary: string | null;
  ai_content: string | null;
  ai_perspective: string | null;
  ai_generated_at: string | null;
  edited_at: string | null;
  scraped_at: string;
  url: string | null;
  video_youtube_id: string | null;
  team: { id: number; name: string } | null;
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

export function NewsArticleCard({ article }: { article: AdminNewsArticle }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);

  const [title, setTitle] = useState(article.title);
  const [slug, setSlug] = useState(article.slug ?? '');
  const [category, setCategory] = useState(article.category ?? '');
  const [metaDescription, setMetaDescription] = useState(
    article.meta_description ?? '',
  );
  const [summary, setSummary] = useState(article.ai_summary ?? '');
  const [content, setContent] = useState(article.ai_content ?? '');
  const [perspective, setPerspective] = useState(article.ai_perspective ?? '');
  const [videoUrl, setVideoUrl] = useState(
    article.video_youtube_id
      ? `https://www.youtube.com/watch?v=${article.video_youtube_id}`
      : '',
  );

  async function run(fn: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fn();
      setMessage({ kind: res.ok ? 'ok' : 'err', text: res.message });
      if (res.ok) router.refresh();
      return res.ok;
    } finally {
      setBusy(false);
    }
  }

  const hasContent = Boolean(article.ai_content);

  return (
    <article className="bg-card border-border space-y-3 rounded-xl border p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                STATUS_CLASS[article.status] ?? STATUS_CLASS.draft
              }`}
            >
              {STATUS_LABEL[article.status] ?? article.status}
            </span>
            {article.category ? (
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] uppercase">
                {CATEGORY_LABELS[article.category as NewsCategory] ??
                  article.category}
              </span>
            ) : (
              <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400 uppercase">
                sans catégorie
              </span>
            )}
            {!hasContent ? (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300 uppercase">
                à rédiger
              </span>
            ) : null}
          </div>
          <h3 className="truncate text-sm font-semibold">{article.title}</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {article.team?.name ?? 'Sans équipe'} ·{' '}
            {DATE_FMT.format(new Date(article.scraped_at))}
            {article.edited_at ? ' · retouché' : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing((v) => !v)}
            disabled={busy}
          >
            {editing ? 'Fermer' : 'Éditer'}
          </Button>
          {article.status === 'published' ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => run(() => setNewsStatus(article.id, 'archived'))}
            >
              Dépublier
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              disabled={busy}
              onClick={() => run(() => setNewsStatus(article.id, 'published'))}
            >
              Publier
            </Button>
          )}
        </div>
      </header>

      {message ? (
        <p
          className={`text-xs ${
            message.kind === 'ok' ? 'text-primary' : 'text-red-400'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {editing ? (
        <div className="space-y-3 border-t border-dashed pt-3">
          <Field label="Titre (H1)">
            <input
              className="bg-background border-border w-full rounded-md border px-2 py-1.5 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Slug (URL)">
              <input
                className="bg-background border-border w-full rounded-md border px-2 py-1.5 font-mono text-xs"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="laissé vide = dérivé du titre"
              />
            </Field>
            <Field label="Catégorie">
              <select
                className="bg-background border-border w-full rounded-md border px-2 py-1.5 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">— non classé —</option>
                {NEWS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Meta description (référencement)">
            <textarea
              className="bg-background border-border w-full rounded-md border px-2 py-1.5 text-sm"
              rows={2}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
            />
          </Field>

          <Field label="Vidéo YouTube (URL, optionnelle)">
            <input
              className="bg-background border-border w-full rounded-md border px-2 py-1.5 text-xs"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </Field>

          <Field label="Résumé">
            <textarea
              className="bg-background border-border w-full rounded-md border px-2 py-1.5 text-sm"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </Field>

          <Field label="Contenu (Markdown)">
            <textarea
              className="bg-background border-border w-full rounded-md border px-2 py-1.5 font-mono text-xs"
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </Field>

          <Field label="Perspective Tactuo">
            <textarea
              className="bg-background border-border w-full rounded-md border px-2 py-1.5 text-sm"
              rows={3}
              value={perspective}
              onChange={(e) => setPerspective(e.target.value)}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                const ok = await run(() =>
                  updateNewsArticle({
                    id: article.id,
                    title,
                    slug,
                    category,
                    meta_description: metaDescription,
                    ai_summary: summary,
                    ai_content: content,
                    ai_perspective: perspective,
                    video_url: videoUrl,
                  }),
                );
                if (ok) setEditing(false);
              }}
            >
              Enregistrer
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => run(() => requeueNewsArticle(article.id))}
            >
              Régénérer
            </Button>
            {article.url ? (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground text-xs underline"
              >
                Source
              </a>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto text-red-400"
              disabled={busy}
              onClick={() => {
                if (!confirm('Supprimer définitivement cet article ?')) return;
                run(() => deleteNewsArticle(article.id));
              }}
            >
              Supprimer
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-[10px] tracking-wide uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
