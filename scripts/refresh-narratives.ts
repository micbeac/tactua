// Rafraîchit les actus de TOUTES les équipes trackées (scraping Apify +
// génération IA des pages internes). Lancé en local → aucun timeout,
// contrairement au cron Vercel Hobby (fonctions ≤ 60 s).
//
// À lancer ~1×/semaine :
//   node --env-file=.env.local scripts/refresh-narratives.ts
//   node --env-file=.env.local scripts/refresh-narratives.ts --force   # ignore l'exclusion 7 j
//
// Coût : ~$0.05 Apify + quelques centimes OpenAI par équipe.

import { runRefreshNarratives } from '../lib/news/refresh-narratives.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

async function main() {
  if (!process.env.APIFY_TOKEN) {
    console.error('❌ APIFY_TOKEN manquant dans .env.local');
    process.exit(1);
  }
  const force = process.argv.includes('--force');
  const supabase = createAdminClient();

  console.log(
    `▶ Refresh narratives — toutes les équipes${force ? ' (force)' : ''}\n`,
  );

  const stats = await runRefreshNarratives(supabase, {
    limit: 9999, // pas de limite : on traite tout
    force,
    onProgress: (msg) => console.log(msg),
  });

  console.log('\n✅ Terminé');
  console.log(`   ${stats.teams_processed} équipes traitées`);
  console.log(`   ${stats.narratives_inserted} articles insérés/màj`);
  console.log(`   ${stats.ai_generated} pages IA générées`);
  console.log(`   ${stats.ai_failed} échecs IA`);
  console.log(`   ${stats.skipped_recent} équipes ignorées (< 7 j)`);
  if (stats.errors.length > 0) {
    console.log(`\n⚠ ${stats.errors.length} erreurs :`);
    for (const e of stats.errors.slice(0, 20)) {
      console.log(`   ${e.team} : ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
