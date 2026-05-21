// Service worker minimal pour Tactuo.
// Responsabilités :
//   1. Receiver de push notifications (Web Push API)
//   2. Action au clic sur une notification (ouvre la page cible)
//   3. Cache léger (offline fallback — désactivé pour MVP, à revoir)
//
// Pas de cache offline pour l'instant : les données foot sont
// volatiles et le HTML est rendu côté serveur. Inutile de cacher.

const CACHE_VERSION = 'tactuo-v1';

self.addEventListener('install', (event) => {
  // Pas de pre-cache pour le MVP : on activate immédiatement.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// === Push handler ===
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Tactuo', body: event.data?.text() ?? '' };
  }

  const title = data.title || 'Tactuo';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.png',
    badge: data.badge || '/favicon.png',
    tag: data.tag, // unique tag = remplace une notification existante
    data: {
      url: data.url || '/',
      ...data.data,
    },
    requireInteraction: data.requireInteraction === true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// === Click handler ===
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      // Si Tactuo est déjà ouvert dans un onglet, focus dessus
      const clientsArr = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clientsArr) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            await client.navigate(url);
          }
          return;
        }
      }
      // Sinon ouvre une nouvelle fenêtre
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});

// === Subscription change ===
// Si l'endpoint expire, le browser peut nous renvoyer un nouveau.
self.addEventListener('pushsubscriptionchange', (event) => {
  // On notifie le serveur du changement (best-effort, non bloquant)
  event.waitUntil(
    (async () => {
      try {
        if (event.newSubscription) {
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event.newSubscription.toJSON()),
          });
        }
      } catch (e) {
        console.error('[sw] pushsubscriptionchange failed', e);
      }
    })(),
  );
});
