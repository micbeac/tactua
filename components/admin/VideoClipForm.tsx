'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  addVideoClip,
  searchEntities,
  type EntityResult,
} from '@/app/admin/videos/actions';
import { Button } from '@/components/ui/button';

const ENTITY_LABELS: Record<string, string> = {
  match: 'Match',
  player: 'Joueur',
  team: 'Club',
  news: 'Article',
};
const ENTITY_TYPES = ['match', 'player', 'team', 'news'] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

export function VideoClipForm() {
  const router = useRouter();
  const [entityType, setEntityType] = useState<EntityType>('match');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntityResult[]>([]);
  const [selected, setSelected] = useState<EntityResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);

  function changeType(t: EntityType) {
    setEntityType(t);
    setResults([]);
    setSelected(null);
    setQuery('');
  }

  async function runSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const r = await searchEntities(entityType, query);
      setResults(r);
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    setMessage(null);
    if (!selected) {
      setMessage({ kind: 'err', text: 'Sélectionne une entité.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await addVideoClip({
        entity_type: entityType,
        entity_id: selected.id,
        youtube_url: youtubeUrl,
        title,
      });
      if (res.ok) {
        setMessage({ kind: 'ok', text: 'Vidéo ajoutée.' });
        setYoutubeUrl('');
        setTitle('');
        setSelected(null);
        setResults([]);
        setQuery('');
        router.refresh();
      } else {
        setMessage({ kind: 'err', text: res.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-card border-border space-y-4 rounded-xl border p-5">
      <h2 className="text-sm font-semibold">Ajouter une vidéo</h2>

      {/* Type d'entité */}
      <div className="flex flex-wrap gap-1.5">
        {ENTITY_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => changeType(t)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              entityType === t
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {ENTITY_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Recherche d'entité */}
      <div>
        <label className="text-muted-foreground mb-1 block text-xs">
          Rechercher {ENTITY_LABELS[entityType].toLowerCase()}
        </label>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void runSearch();
              }
            }}
            placeholder={
              entityType === 'match'
                ? "Nom d'une des deux équipes…"
                : 'Nom…'
            }
            className="bg-background border-border flex-1 rounded-md border px-3 py-1.5 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void runSearch()}
            disabled={searching || query.trim().length < 2}
          >
            {searching ? '…' : 'Chercher'}
          </Button>
        </div>
      </div>

      {/* Résultats */}
      {results.length > 0 && (
        <ul className="border-border max-h-52 divide-y divide-border overflow-y-auto rounded-md border">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                  selected?.id === r.id
                    ? 'bg-primary/15 text-primary'
                    : 'hover:bg-muted'
                }`}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <p className="text-xs">
          Entité sélectionnée :{' '}
          <span className="text-primary font-semibold">{selected.label}</span>
        </p>
      )}

      {/* URL + titre */}
      <div>
        <label className="text-muted-foreground mb-1 block text-xs">
          URL YouTube
        </label>
        <input
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          className="bg-background border-border w-full rounded-md border px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="text-muted-foreground mb-1 block text-xs">
          Titre
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex : Résumé du match, Compilation des gestes…"
          className="bg-background border-border w-full rounded-md border px-3 py-1.5 text-sm"
        />
      </div>

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
        onClick={() => void submit()}
        disabled={submitting}
      >
        {submitting ? 'Ajout…' : 'Ajouter la vidéo'}
      </Button>
    </div>
  );
}
