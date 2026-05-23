'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { triggerGenerateAngles } from '@/app/admin/contenu/actions';
import { Button } from '@/components/ui/button';

export function ContentGenerateButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [matchIdInput, setMatchIdInput] = useState('');
  const [message, setMessage] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);

  async function run(matchId?: number) {
    setMessage(null);
    setRunning(true);
    try {
      const res = await triggerGenerateAngles(matchId ?? null);
      if (res.ok) {
        setMessage({ kind: 'ok', text: res.message ?? 'OK' });
        startTransition(() => router.refresh());
      } else {
        setMessage({ kind: 'err', text: res.message });
      }
    } finally {
      setRunning(false);
    }
  }

  function runSpecificMatch() {
    const id = Number(matchIdInput.trim());
    if (!Number.isFinite(id) || id <= 0) {
      setMessage({ kind: 'err', text: 'Saisis un identifiant de match valide.' });
      return;
    }
    void run(id);
  }

  return (
    <div className="bg-card border-border space-y-4 rounded-xl border p-4">
      {/* Auto-pick */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            Génération automatique
          </p>
          <p className="text-muted-foreground text-xs">
            Le système sélectionne tout seul jusqu&apos;à 3 matchs éligibles
            (post-match dans les 24 dernières heures + pré-match dans les 48
            heures à venir, sans angles déjà générés) et produit 3 angles +
            livrables pour chacun. ~30-90 s par match. À lancer en local de
            préférence.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void run()}
          disabled={running || pending}
        >
          {running ? 'Génération en cours…' : 'Lancer (auto)'}
        </Button>
      </div>

      {/* Force un match précis */}
      <div className="border-border border-t pt-3">
        <p className="text-sm font-semibold">
          Cibler un match précis (optionnel)
        </p>
        <p className="text-muted-foreground text-xs">
          Force la régénération pour un seul match — utile pour un gros
          événement à venir (ex : France-Brésil). L&apos;identifiant est dans
          l&apos;URL d&apos;une fiche match :{' '}
          <code className="bg-muted rounded px-1">/matches/12345</code> → ID
          12345.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={matchIdInput}
            onChange={(e) => setMatchIdInput(e.target.value)}
            placeholder="Match ID (ex : 489721)"
            inputMode="numeric"
            className="bg-background border-border min-w-0 flex-1 rounded-md border px-3 py-1.5 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => runSpecificMatch()}
            disabled={running || pending}
          >
            {running ? '…' : 'Générer pour ce match'}
          </Button>
        </div>
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
    </div>
  );
}
