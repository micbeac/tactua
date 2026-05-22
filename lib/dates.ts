// Date/time formatters centralisés, tous configurés en `Europe/Paris`.
// Avant ce helper : les Intl.DateTimeFormat partout dans le projet ne
// précisaient pas le timezone. En SSR (Vercel = UTC), les heures
// s'affichaient en UTC, donc 2h de moins que l'heure réelle en France
// pendant l'été.

const TZ = 'Europe/Paris';

// Date complète avec heure : "jeudi 22 mai 2026, 21:00"
export const FR_DATETIME_LONG = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
});

// Date courte avec heure : "22 mai, 21:00"
export const FR_DATETIME_SHORT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
});

// Heure seule : "21:00"
export const FR_TIME = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
});

// Date courte sans heure : "22 mai"
export const FR_DATE_SHORT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: TZ,
});

// Date avec année sans heure : "22 mai 2026"
export const FR_DATE_LONG = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: TZ,
});

// Jour de la semaine + date : "jeudi 22 mai"
export const FR_WEEKDAY_DATE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
});

// Helper pour créer un formatter custom avec timezone Paris par défaut.
export function frDateFormat(
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...options });
}
