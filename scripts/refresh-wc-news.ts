// Rafraîchit le fil d'actualité Coupe du Monde (table wc_news).
// Lancé en local → aucun timeout, contrairement aux fonctions Vercel.
//
//   node --env-file=.env.local scripts/refresh-wc-news.ts
//   node --env-file=.env.local scripts/refresh-wc-news.ts --force        # ignore l'anti-doublon
//   node --env-file=.env.local scripts/refresh-wc-news.ts --no-tournament # sélections uniquement
//
// Les articles arrivent en 'draft' : à relire/publier depuis /admin/wc-news.
// Coût : ~0,05 $ Apify + quelques cents OpenAI (gpt-4o) par requête.

import { runRefreshWCNews } from '../lib/news/refresh-wc-news.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

async function main() {
  if (!process.env.APIFY_TOKEN) {
    console.error('❌ APIFY_TOKEN manquant dans .env.local');
    process.exit(1);
  }
  const force = process.argv.includes('--force');
  const skipTournament = process.argv.includes('--no-tournament');
  const supabase = createAdminClient();

  console.log(
    `▶ Refresh actu Coupe du Monde${force ? ' (force)' : ''}${
      skipTournament ? ' (sélections uniquement)' : ''
    }\n`,
  );

  const stats = await runRefreshWCNews(supabase, {
    force,
    skipTournament,
    onProgress: (msg) => console.log(msg),
  });

  console.log('\n✅ Terminé');
  console.log(`   ${stats.queries_run} requêtes lancées`);
  console.log(`   ${stats.articles_inserted} articles insérés (draft)`);
  console.log(`   ${stats.ai_generated} articles rédigés par l'IA`);
  console.log(`   ${stats.ai_failed} échecs IA`);
  if (stats.errors.length > 0) {
    console.log(`\n⚠ ${stats.errors.length} erreurs :`);
    for (const e of stats.errors.slice(0, 20)) {
      console.log(`   ${e.query} : ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
