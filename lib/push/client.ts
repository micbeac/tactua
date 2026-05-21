// Helper Web Push centralisé.
// Variables d'env requises (à ajouter dans Vercel + .env.local) :
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY = clé publique (utilisée côté client pour subscribe)
//   VAPID_PRIVATE_KEY = clé privée (signe les messages côté serveur)
//   VAPID_SUBJECT = "mailto:contact@tactuo.com" (contact technique pour push services)

import webpush from 'web-push';

let configured = false;

function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:contact@tactuo.com';

  if (!publicKey || !privateKey) {
    throw new Error(
      'VAPID keys manquantes (NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY)',
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  /** URL à ouvrir au clic. Défaut : '/' */
  url?: string;
  /** Icône (URL absolue). Défaut : favicon */
  icon?: string;
  /** Tag pour grouper / remplacer une notif existante */
  tag?: string;
  /** Force l'user à interagir (pas auto-dismiss) */
  requireInteraction?: boolean;
  /** Données arbitraires accessibles dans l'event click */
  data?: Record<string, unknown>;
};

/**
 * Envoie une push à un seul subscription.
 * Retourne { ok, statusCode, expired }. expired = true si le push service
 * a renvoyé 404/410 → on doit supprimer cette subscription de la DB.
 */
export async function sendPush(
  sub: PushSubscriptionRow,
  payload: PushPayload,
): Promise<{ ok: boolean; statusCode?: number; expired?: boolean; error?: string }> {
  configure();
  try {
    const res = await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 }, // 24h max de retention si user offline
    );
    return { ok: true, statusCode: res.statusCode };
  } catch (e) {
    const err = e as { statusCode?: number; message?: string };
    const expired =
      err.statusCode === 404 ||
      err.statusCode === 410 ||
      (err.message ?? '').toLowerCase().includes('gone');
    return {
      ok: false,
      statusCode: err.statusCode,
      expired,
      error: err.message,
    };
  }
}
