// Helper Plausible : trace des events custom typés.
// Le tag <Script> dans app/layout.tsx définit window.plausible et sa queue.
// Si le script est bloqué (adblock) la queue se remplit silencieusement.

type AnalyticsEvents = {
  'Analyse générée': { type: 'pre_match' | 'post_match'; was_cached: boolean };
  'What-if lancé': { excluded_count: number };
  'Quiz complété': { score: number; correct: number; total: number };
  'Favori ajouté': { entity_type: 'team' | 'player' | 'match' | 'competition' };
  'Favori retiré': { entity_type: 'team' | 'player' | 'match' | 'competition' };
};

type PlausibleFn = (
  event: string,
  options?: { props?: Record<string, string | number | boolean> },
) => void;

declare global {
  interface Window {
    plausible?: PlausibleFn & { q?: unknown[] };
  }
}

export function track<E extends keyof AnalyticsEvents>(
  event: E,
  props: AnalyticsEvents[E],
): void {
  if (typeof window === 'undefined') return;
  try {
    window.plausible?.(event, { props });
  } catch {
    // Échec silencieux : analytics ne doit jamais casser l'UX.
  }
}
