'use client';

import { useState, useTransition } from 'react';
import { deletePartner, upsertPartner } from '@/app/admin/actions';

type Props = {
  initial?: {
    id: number;
    name: string;
    slug: string;
    email: string | null;
    notes: string | null;
    commission_pct: number;
    is_active: boolean;
  };
  onDone?: () => void;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function PartnerForm({ initial, onDone }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [commission, setCommission] = useState(
    String(initial?.commission_pct ?? 20),
  );
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function autoSlug(value: string) {
    setName(value);
    if (!initial) setSlug(slugify(value));
  }

  function save() {
    setFeedback(null);
    if (!name.trim() || !slug.trim()) {
      setFeedback('Nom et slug requis');
      return;
    }
    startTransition(async () => {
      const res = await upsertPartner({
        id: initial?.id,
        name: name.trim(),
        slug: slug.trim(),
        email: email.trim() || null,
        notes: notes.trim() || null,
        commission_pct: Number(commission) || 0,
        is_active: isActive,
      });
      if (res.ok) {
        setFeedback('✓ Enregistré');
        if (!initial) {
          setName('');
          setSlug('');
          setEmail('');
          setNotes('');
          setCommission('20');
        }
        onDone?.();
      } else {
        setFeedback(`Erreur : ${res.message}`);
      }
    });
  }

  function remove() {
    if (!initial?.id) return;
    if (!confirm(`Supprimer le partenaire ${initial.name} ?`)) return;
    startTransition(async () => {
      const res = await deletePartner(initial.id);
      if (res.ok) onDone?.();
      else setFeedback(`Erreur : ${res.message}`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-muted-foreground text-xs">Nom</span>
          <input
            type="text"
            value={name}
            onChange={(e) => autoSlug(e.target.value)}
            className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm"
            placeholder="Ex : Pierre Ménès"
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs">
            Slug (URL ?ref=…)
          </span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm"
            placeholder="pierre-menes"
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs">Commission (%)</span>
          <input
            type="number"
            step="0.5"
            min="0"
            max="100"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-muted-foreground text-xs">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="bg-background border-border mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        <span>Actif</span>
      </label>
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="bg-primary text-primary-foreground hover:bg-primary/80 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {initial ? 'Mettre à jour' : 'Créer le partenaire'}
          </button>
          {feedback && (
            <span
              className={`self-center text-xs ${feedback.startsWith('✓') ? 'text-primary' : 'text-destructive'}`}
            >
              {feedback}
            </span>
          )}
        </div>
        {initial && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md border px-3 py-2 text-xs font-semibold"
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}
