'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { triggerWCNewsScrape } from '@/app/admin/wc-news/actions';
import { Button } from '@/components/ui/button';

export function WCNewsScrapeButton() {
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
      const res = await triggerWCNewsScrape();
      if (res.ok) {
        setMessage({ kind: 'ok', text: res.message ?? 'Scraping terminé.' });
        startTransition(() => router.refresh());
      } else {
        setMessage({ kind: 'err', text: res.message });
      }
    } catch (e) {
      setMessage({
        kind: 'err',
        text: e instanceof Error ? e.message : 'Échec',
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="bg-card border-border space-y-2 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Récupérer de nouvelles news</p>
          <p className="text-muted-foreground text-xs">
            Scrape les actus CDM (sélections + tournoi) et les rédige en
            brouillon. Long : à lancer de préférence en local.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void run()}
          disabled={running || pending}
        >
          {running ? 'Scraping en cours…' : 'Lancer le scraping'}
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
