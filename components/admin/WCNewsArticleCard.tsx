'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  deleteWCNewsArticle,
  setWCNewsStatus,
  updateWCNewsArticle,
} from '@/app/admin/wc-news/actions';
import type { WCNewsArticle } from '@/lib/data/wc-news';
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

export type WCNewsTeamOption = { id: number; name: string };

export function WCNewsArticleCard({
  article,
  teams,
}: {
  article: WCNewsArticle;
  teams: WCNewsTeamOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);

  const [title, setTitle] = useState(article.title);
  // Sélecteur unifié : 'tournoi' OU l'id (string) d'une sélection.
  const [pick, setPick] = useState<string>(
    article.category === 'tournoi'
      ? 'tournoi'
      : article.team_id != null
        ? String(article.team_id)
        : 'tournoi',
  );
  const [summary, setSummary] = useState(article.ai_summary ?? '');
  const [content, setContent] = useState(article.ai_content ?? '');
  const [perspective, setPerspective] = useState(article.ai_perspective ?? '');
  const [videoUrl, setVideoUrl] = useState(
    article.video_youtube_id
      ? `https://www.youtube.com/watch?v=${article.video_youtube_id}`
      : '',
  );

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const isTournament = pick === 'tournoi';
      const res = await updateWCNewsArticle({
        id: article.id,
        title,
        category: isTournament ? 'tournoi' : 'selection',
        team_id: isTournament ? null : Number(pick),
        ai_summary: summary,
        ai_content: content,
        ai_perspective: perspective,
        video_url: videoUrl,
      });
      if (res.ok) {
        setMessage({ kind: 'ok', text: res.message ?? 'Enregistré.' });
        router.refresh();
      } else {
        setMessage({ kind: 'err', text: res.message });
      }
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: 'draft' | 'published' | 'archived') {
    setBusy(true);
    setMessage(null);
    try {
      const res = await setWCNewsStatus(article.id, status);
      if (res.ok) router.refresh();
      else setMessage({ kind: 'err', text: res.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Supprimer définitivement cet article ?')) return;
    setBusy(true);
    try {
      const res = await deleteWCNewsArticle(article.id);
      if (res.ok) router.refresh();
      else setMessage({ kind: 'err', text: res.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="bg-card border-border rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px]">
            <span
              className={`rounded px-1.5 py-0.5 font-semibold uppercase ${
                STATUS_CLASS[article.status] ?? ''
              }`}
            >
              {STATUS_LABEL[article.status] ?? article.status}
            </span>
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 uppercase">
              {article.category === 'tournoi' ? 'Tournoi' : 'Sélection'}
            </span>
            {article.team && (
              <span className="text-muted-foreground">{article.team.name}</span>
            )}
            {article.video_youtube_id && (
              <span className="text-primary">🎬 vidéo</span>
            )}
            {!article.ai_content && (
              <span className="text-destructive">⚠ pas de contenu IA</span>
            )}
          </div>
          <p className="text-sm font-semibold">{article.title}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {article.source_name ?? 'source inconnue'} ·{' '}
            {new Date(article.scraped_at).toLocaleDateString('fr-FR')}
            {article.source_url && (
              <>
                {' · '}
                <a
                  href={article.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground underline"
                >
                  source
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing((v) => !v)}
            disabled={busy}
          >
            {editing ? 'Fermer' : 'Éditer'}
          </Button>
          {article.status !== 'published' ? (
            <Button
              type="button"
              size="sm"
              onClick={() => void changeStatus('published')}
              disabled={busy || !article.ai_content}
            >
              Publier
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void changeStatus('draft')}
              disabled={busy}
            >
              Dépublier
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void remove()}
            disabled={busy}
          >
            Suppr.
          </Button>
        </div>
      </div>

      {editing && (
        <div className="border-border mt-4 space-y-3 border-t pt-4">
          <Field label="Titre">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background border-border w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rattachement">
              <select
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className="bg-background border-border w-full rounded-md border px-3 py-1.5 text-sm"
              >
                <option value="tournoi">🌍 Tournoi (transversal)</option>
                <optgroup label="Sélections CDM">
                  {teams.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </Field>
            <Field label="Vidéo YouTube (optionnel)">
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                className="bg-background border-border w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </Field>
          </div>
          <Field label="Résumé (méta description, cards)">
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              className="bg-background border-border w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label="Contenu (Markdown)">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={14}
              className="bg-background border-border w-full rounded-md border px-3 py-1.5 font-mono text-xs"
            />
          </Field>
          <Field label="Perspective Tactuo">
            <textarea
              value={perspective}
              onChange={(e) => setPerspective(e.target.value)}
              rows={3}
              className="bg-background border-border w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </Field>
          {message && (
            <p
              className={`text-xs ${
                message.kind === 'ok' ? 'text-primary' : 'text-destructive'
              }`}
            >
              {message.text}
            </p>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => void save()}
            disabled={busy}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      )}
    </li>
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
    <div>
      <label className="text-muted-foreground mb-1 block text-xs">
        {label}
      </label>
      {children}
    </div>
  );
}
