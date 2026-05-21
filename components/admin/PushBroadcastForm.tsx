'use client';

import { useState, useTransition } from 'react';
import { sendAdminBroadcast } from '@/app/admin/push/actions';
import { Button } from '@/components/ui/button';

type Props = {
  subscriber_count: number;
};

export function PushBroadcastForm({ subscriber_count }: Props) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [requireInteraction, setRequireInteraction] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  function submit() {
    setFeedback(null);
    if (!title.trim() || !body.trim()) {
      setFeedback({ type: 'error', message: 'Titre et message requis' });
      return;
    }
    if (subscriber_count === 0) {
      setFeedback({
        type: 'error',
        message: 'Aucun abonné pour le moment',
      });
      return;
    }
    if (
      !confirm(
        `Envoyer ce push à ${subscriber_count} abonné(s) ? Cette action est irréversible.`,
      )
    )
      return;

    startTransition(async () => {
      const res = await sendAdminBroadcast({
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || undefined,
        requireInteraction,
      });
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: `✓ Envoyé : ${res.sent} OK, ${res.failed} échec, ${res.expired_removed} expirés nettoyés`,
        });
        setTitle('');
        setBody('');
        setUrl('');
        setRequireInteraction(false);
      } else {
        setFeedback({
          type: 'error',
          message: res.message ?? 'Erreur inconnue',
        });
      }
    });
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-muted-foreground text-xs">Titre</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          maxLength={80}
          className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm"
          placeholder="Ex : Coup d'envoi de la Coupe du Monde ⚽"
        />
        <p className="text-muted-foreground/70 mt-0.5 text-[10px]">
          {title.length}/80 caractères
        </p>
      </label>

      <label className="block">
        <span className="text-muted-foreground text-xs">Message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 200))}
          maxLength={200}
          rows={3}
          className="bg-background border-border mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          placeholder="Ex : L'analyse du premier match est en ligne !"
        />
        <p className="text-muted-foreground/70 mt-0.5 text-[10px]">
          {body.length}/200 caractères
        </p>
      </label>

      <label className="block">
        <span className="text-muted-foreground text-xs">
          URL au clic (optionnel)
        </span>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="bg-background border-border mt-1 h-9 w-full rounded-md border px-2 text-sm font-mono"
          placeholder="/ ou /matches/12345"
        />
      </label>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={requireInteraction}
          onChange={(e) => setRequireInteraction(e.target.checked)}
        />
        <span>
          Notification persistante (ne se ferme pas automatiquement)
        </span>
      </label>

      <div className="border-border/40 flex items-center gap-3 border-t pt-3">
        <Button onClick={submit} disabled={pending}>
          {pending
            ? 'Envoi…'
            : `Envoyer à ${subscriber_count} abonné(s)`}
        </Button>
        {feedback && (
          <span
            className={`text-xs ${feedback.type === 'success' ? 'text-primary' : 'text-destructive'}`}
          >
            {feedback.message}
          </span>
        )}
      </div>
    </div>
  );
}
