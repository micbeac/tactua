'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Status = 'unsupported' | 'denied' | 'unsubscribed' | 'subscribed' | 'loading';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushSubscribeButton({
  vapid_public_key,
}: {
  vapid_public_key: string;
}) {
  const [status, setStatus] = useState<Status>('loading');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    (async () => {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      setStatus(existing ? 'subscribed' : 'unsubscribed');
    })();
  }, []);

  async function subscribe() {
    setStatus('loading');
    setFeedback(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'unsubscribed');
        setFeedback('Permission refusée');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      // Cast nécessaire : TS strict ne reconnaît pas Uint8Array comme BufferSource
      // dans certains contextes même si c'est valide à runtime.
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapid_public_key,
        ) as unknown as BufferSource,
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? 'subscribe failed');
      }
      setStatus('subscribed');
      setFeedback('✓ Notifications activées');
    } catch (e) {
      setStatus('unsubscribed');
      setFeedback(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function unsubscribe() {
    setStatus('loading');
    setFeedback(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('unsubscribed');
      setFeedback('Notifications désactivées');
    } catch (e) {
      setStatus('subscribed');
      setFeedback(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (status === 'unsupported') {
    return (
      <div className="bg-muted/40 border-border rounded-lg border p-4 text-sm">
        <p className="text-muted-foreground">
          Ton navigateur ne supporte pas les notifications push. Sur iPhone, il
          faut d&apos;abord installer Tactuo sur l&apos;écran d&apos;accueil
          (depuis Safari → bouton partager).
        </p>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="bg-destructive/5 border-destructive/20 rounded-lg border p-4 text-sm">
        <p className="text-muted-foreground">
          Les notifications sont bloquées dans les paramètres du navigateur.
          Pour les activer, va dans les paramètres du site et autorise les
          notifications.
        </p>
      </div>
    );
  }

  const isSubscribed = status === 'subscribed';
  const loading = status === 'loading';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {isSubscribed ? (
          <Button
            type="button"
            variant="outline"
            onClick={unsubscribe}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <BellOff className="size-4" aria-hidden />
            )}
            Désactiver
          </Button>
        ) : (
          <Button type="button" onClick={subscribe} disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Bell className="size-4" aria-hidden />
            )}
            Activer les notifications
          </Button>
        )}
        {feedback && (
          <span
            className={`text-xs ${feedback.startsWith('✓') ? 'text-primary' : 'text-muted-foreground'}`}
          >
            {feedback}
          </span>
        )}
      </div>
      {isSubscribed && (
        <p className="text-muted-foreground text-xs">
          Tu recevras les buts de tes équipes/matchs favoris et la sortie des
          compositions officielles.
        </p>
      )}
    </div>
  );
}
