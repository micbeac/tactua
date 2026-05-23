'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { triggerGenerateAngles } from '@/app/admin/contenu/actions';
import { Button } from '@/components/ui/button';

export function ContentGenerateButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);

  async function run() {
    setMessage(null);
    setRunning(true);
    try {
      const res = await triggerGenerateAngles();
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

  return (
    <div className="bg-card border-border space-y-2 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Générer de nouveaux angles</p>
          <p className="text-muted-foreground text-xs">
            Sélectionne jusqu&apos;à 3 matchs éligibles (post-match récents +
            pré-match dans les 48h sans angles) et génère 3 angles +
            livrables pour chaque. Long : 30-90 s par match. À lancer en local
            de préférence.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void run()}
          disabled={running || pending}
        >
          {running ? 'Génération en cours…' : 'Lancer la génération'}
        </Button>
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
