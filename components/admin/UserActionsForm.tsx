'use client';

import { useState, useTransition } from 'react';
import {
  deleteUser,
  toggleAdminFlag,
  updateUserSubscription,
} from '@/app/admin/actions';

type Props = {
  user_id: string;
  initial_status: 'free' | 'trial' | 'paid' | 'admin_grant' | 'suspended';
  initial_expires_at: string | null;
  initial_notes: string | null;
  initial_is_admin: boolean;
};

function isoFromInput(value: string): string | null {
  if (!value) return null;
  // input type=date renvoie YYYY-MM-DD
  return new Date(`${value}T23:59:59Z`).toISOString();
}

function inputFromIso(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

const PRESETS: Array<{ label: string; days: number | null; status: Props['initial_status'] }> = [
  { label: '1 jour', days: 1, status: 'admin_grant' },
  { label: '7 jours', days: 7, status: 'trial' },
  { label: '30 jours', days: 30, status: 'admin_grant' },
  { label: 'Illimité', days: null, status: 'admin_grant' },
];

export function UserActionsForm({
  user_id,
  initial_status,
  initial_expires_at,
  initial_notes,
  initial_is_admin,
}: Props) {
  const [status, setStatus] = useState(initial_status);
  const [expiresInput, setExpiresInput] = useState(
    inputFromIso(initial_expires_at),
  );
  const [notes, setNotes] = useState(initial_notes ?? '');
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function applyPreset(days: number | null, presetStatus: Props['initial_status']) {
    setStatus(presetStatus);
    if (days == null) {
      setExpiresInput('');
    } else {
      const d = new Date();
      d.setDate(d.getDate() + days);
      setExpiresInput(d.toISOString().slice(0, 10));
    }
  }

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const res = await updateUserSubscription({
        user_id,
        status,
        expires_at: isoFromInput(expiresInput),
        notes: notes.trim() ? notes.trim() : null,
      });
      setFeedback(res.ok ? '✓ Enregistré' : `Erreur : ${res.message}`);
    });
  }

  function toggleAdmin() {
    if (
      !confirm(
        initial_is_admin
          ? 'Retirer les droits admin à cet utilisateur ?'
          : 'Promouvoir cet utilisateur en admin ?',
      )
    )
      return;
    startTransition(async () => {
      const res = await toggleAdminFlag(user_id, !initial_is_admin);
      setFeedback(res.ok ? '✓ Mis à jour' : `Erreur : ${res.message}`);
    });
  }

  function remove() {
    if (
      !confirm(
        '⚠️ Supprimer DÉFINITIVEMENT ce compte ? Tous ses favoris, analyses consultées et quiz seront perdus.',
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteUser(user_id);
      if (res.ok) {
        window.location.href = '/admin/users';
      } else {
        setFeedback(`Erreur : ${res.message}`);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Presets rapides */}
      <div>
        <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
          Accès rapide
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.days, p.status)}
              className="border-border bg-card hover:border-primary/40 rounded-md border px-3 py-1.5 text-xs font-semibold"
            >
              + {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-muted-foreground text-xs">Statut</span>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as Props['initial_status'])
            }
            className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm"
          >
            <option value="free">Free</option>
            <option value="trial">Trial</option>
            <option value="paid">Payant</option>
            <option value="admin_grant">Grant admin (accès gratuit)</option>
            <option value="suspended">Suspendu</option>
          </select>
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs">
            Date d&apos;expiration
          </span>
          <input
            type="date"
            value={expiresInput}
            onChange={(e) => setExpiresInput(e.target.value)}
            className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-muted-foreground text-xs">
          Notes (ex : « partenariat influenceur X, 30j gratuits »)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="bg-background border-border mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
        />
      </label>

      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="bg-primary text-primary-foreground hover:bg-primary/80 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {feedback && (
            <span
              className={`self-center text-xs ${feedback.startsWith('✓') ? 'text-primary' : 'text-destructive'}`}
            >
              {feedback}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleAdmin}
            disabled={pending}
            className="border-border hover:bg-muted rounded-md border px-3 py-2 text-xs"
          >
            {initial_is_admin ? 'Retirer admin' : 'Promouvoir admin'}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md border px-3 py-2 text-xs font-semibold"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
