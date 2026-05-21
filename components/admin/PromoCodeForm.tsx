'use client';

import { useState, useTransition } from 'react';
import { deletePromoCode, upsertPromoCode } from '@/app/admin/actions';

type Partner = { id: number; name: string };

type Props = {
  initial?: {
    id: number;
    code: string;
    discount_type: 'percent' | 'fixed_eur';
    discount_value: number;
    partner_id: number | null;
    max_uses: number | null;
    expires_at: string | null;
    is_active: boolean;
    notes: string | null;
  };
  partners: Partner[];
};

function isoFromInput(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T23:59:59Z`).toISOString();
}

function inputFromIso(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export function PromoCodeForm({ initial, partners }: Props) {
  const [code, setCode] = useState(initial?.code ?? '');
  const [type, setType] = useState<'percent' | 'fixed_eur'>(
    initial?.discount_type ?? 'percent',
  );
  const [value, setValue] = useState(String(initial?.discount_value ?? 10));
  const [partnerId, setPartnerId] = useState<string>(
    initial?.partner_id ? String(initial.partner_id) : '',
  );
  const [maxUses, setMaxUses] = useState(
    initial?.max_uses ? String(initial.max_uses) : '',
  );
  const [expires, setExpires] = useState(inputFromIso(initial?.expires_at ?? null));
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function save() {
    if (!code.trim()) {
      setFeedback('Code requis');
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const res = await upsertPromoCode({
        id: initial?.id,
        code: code.trim(),
        discount_type: type,
        discount_value: Number(value) || 0,
        partner_id: partnerId ? Number(partnerId) : null,
        max_uses: maxUses ? Number(maxUses) : null,
        expires_at: isoFromInput(expires),
        is_active: isActive,
        notes: notes.trim() || null,
      });
      if (res.ok) {
        setFeedback('✓ Enregistré');
        if (!initial) {
          setCode('');
          setValue('10');
          setPartnerId('');
          setMaxUses('');
          setExpires('');
          setNotes('');
        }
      } else {
        setFeedback(`Erreur : ${res.message}`);
      }
    });
  }

  function remove() {
    if (!initial?.id) return;
    if (!confirm(`Supprimer le code ${initial.code} ?`)) return;
    startTransition(async () => {
      const res = await deletePromoCode(initial.id);
      if (!res.ok) setFeedback(`Erreur : ${res.message}`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-muted-foreground text-xs">Code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm font-mono"
            placeholder="INFLUX10"
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs">Type</span>
          <select
            value={type}
            onChange={(e) =>
              setType(e.target.value as 'percent' | 'fixed_eur')
            }
            className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm"
          >
            <option value="percent">% de réduction</option>
            <option value="fixed_eur">€ de réduction</option>
          </select>
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs">
            Valeur ({type === 'percent' ? '%' : '€'})
          </span>
          <input
            type="number"
            step="0.5"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-muted-foreground text-xs">
            Partenaire associé
          </span>
          <select
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm"
          >
            <option value="">Aucun</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs">
            Usages max (vide = ∞)
          </span>
          <input
            type="number"
            min="1"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs">Expire le</span>
          <input
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-muted-foreground text-xs">Notes</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm"
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
            {initial ? 'Mettre à jour' : 'Créer le code'}
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
