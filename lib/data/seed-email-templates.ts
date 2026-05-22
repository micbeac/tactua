// Seed automatique des templates email standards.
// Appelé au chargement de /admin/emails : crée les templates manquants
// si la migration SQL de seed n'a pas été appliquée.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supa = SupabaseClient<Database>;

type StandardTemplate = {
  key: string;
  subject: string;
  body_md: string;
  description: string;
};

const STANDARD_TEMPLATES: StandardTemplate[] = [
  {
    key: 'welcome',
    subject: 'Bienvenue sur Tactuo ⚽',
    body_md: `Salut {{user_name}},

Merci d'avoir rejoint Tactuo ! Pour bien démarrer :

- Ajoute tes équipes favorites pour personnaliser ton dashboard
- Découvre l'analyse IA d'un match à venir
- Tente le quiz du jour

À très vite,
L'équipe Tactuo`,
    description:
      'Email envoyé automatiquement après la création d\'un compte.',
  },
  {
    key: 'daily_digest',
    subject: '☕ Ton foot du jour — Tactuo',
    body_md: `## {{greeting}}

Voici ton foot du jour :

{{items}}

À tout de suite sur Tactuo !`,
    description:
      'Digest matinal envoyé chaque jour à 7h. Variables disponibles : {{greeting}} (salutation personnalisée), {{items}} (la liste de matchs/news/résultats générée automatiquement). Le HTML autour (header coloré, CTA, footer) reste géré par le code pour rester compatible Gmail/Outlook.',
  },
  {
    key: 'partner_promo',
    subject: '{{partner_name}} te recommande Tactuo',
    body_md: `Salut,

{{partner_name}} t'a recommandé Tactuo. Avec le code **{{promo_code}}** tu bénéficies de {{discount}} sur ton abonnement.

Profite de l'offre →

À bientôt,
L'équipe Tactuo`,
    description:
      'Template d\'email pour campagnes partenaires. Édite avant chaque envoi.',
  },
];

/**
 * Crée les templates standards s'ils n'existent pas en DB.
 * Idempotent : ne touche pas aux templates déjà présents.
 */
export async function seedMissingTemplates(supabase: Supa): Promise<number> {
  const { data: existing } = await supabase
    .from('email_templates')
    .select('key')
    .in(
      'key',
      STANDARD_TEMPLATES.map((t) => t.key),
    );
  const existingKeys = new Set(
    (existing ?? []).map((r) => r.key),
  );

  const toInsert = STANDARD_TEMPLATES.filter(
    (t) => !existingKeys.has(t.key),
  );
  if (toInsert.length === 0) return 0;

  const { error } = await supabase.from('email_templates').insert(toInsert);
  if (error) {
    console.error('[seed templates] insert failed', error);
    return 0;
  }
  return toInsert.length;
}
