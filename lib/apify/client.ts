// Wrapper minimal pour appeler les Actors Apify via leur API HTTP.
// Doc : https://docs.apify.com/api/v2#tag/Actors/operation/act_runSync
//
// On utilise principalement l'actor `apify/rag-web-browser` qui fait
// recherche Google + scraping markdown en un seul appel — robuste car
// indépendant de la structure HTML des sites cibles.

const APIFY_BASE = 'https://api.apify.com/v2';

function token(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) {
    throw new Error(
      'APIFY_TOKEN manquant. À ajouter dans .env.local et dans Vercel env vars.',
    );
  }
  return t;
}

/**
 * Lance un Actor Apify en mode synchrone et retourne directement les items
 * du dataset produit. Préfère ce mode pour les appels rapides (< 60s).
 *
 * @param actorId  Identifiant slug de l'actor (ex: "apify/rag-web-browser")
 * @param input    Payload d'entrée propre à l'actor
 * @param timeout  Timeout en secondes (max 300 pour sync)
 */
export async function runActorSync<TItem = unknown>(
  actorId: string,
  input: Record<string, unknown>,
  timeout = 60,
): Promise<TItem[]> {
  // Le slug doit être URL-encodé : "apify/rag-web-browser" → "apify~rag-web-browser"
  const slug = actorId.replace('/', '~');
  const url = `${APIFY_BASE}/acts/${slug}/run-sync-get-dataset-items?token=${token()}&timeout=${timeout}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Apify ${actorId} ${res.status} : ${body.slice(0, 200)}`,
    );
  }

  return (await res.json()) as TItem[];
}

// ============================================================================
// Helper spécifique : rag-web-browser (recherche Google + scraping markdown)
// ============================================================================

export type RagBrowserResult = {
  /** URL finale après redirection */
  crawl: {
    httpStatusCode: number;
    requestStatus: string;
    loadedUrl: string;
  };
  /** Métadonnées extraites */
  metadata: {
    title: string;
    description?: string;
    url: string;
  };
  /** Contenu de la page en markdown (peut être long) */
  markdown: string;
  /** Snippet court (les 200 premiers chars du markdown) */
  text?: string;
};

/**
 * Recherche Google + scraping. Renvoie les N premiers résultats organiques
 * en markdown propre.
 */
export async function ragWebSearch(
  query: string,
  maxResults = 3,
): Promise<RagBrowserResult[]> {
  return runActorSync<RagBrowserResult>(
    'apify/rag-web-browser',
    {
      query,
      maxResults,
      outputFormats: ['markdown'],
    },
    120,
  );
}
