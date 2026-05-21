// Backfill complet : bio physique (taille, poids, naissance) + transfers_json
// pour TOUS les joueurs mappés AF qui ne l'ont pas encore.
//
// Strategy : 1 run = 1 batch d'au max DAILY_LIMIT joueurs. À relancer 3 fois
// pour couvrir les ~3 200 joueurs sans dépasser le quota AF Pro (7 500/jour).
//
// Reprise auto : on filtre sur transfers_json IS NULL → re-runs reprennent
// là où on s'est arrêté.
//
// Lancer :
//   node --env-file=.env.local --experimental-strip-types scripts/backfill-players-all.ts
//
// Variables d'env optionnelles :
//   BACKFILL_LIMIT=2000     # nombre max de joueurs traités (défaut 2000)
//   BACKFILL_CONCURRENCY=2  # appels parallèles (défaut 2, max 5 pour rester safe)
//   BACKFILL_OFFSET=0       # skip les N premiers (debug)

import {
  fetchPlayerProfile,
  fetchPlayerTransfers,
} from '../lib/api-football/deep-stats.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';
import type { Database } from '../types/database.ts';

type PlayerUpdate = Database['public']['Tables']['players']['Update'];

const DAILY_LIMIT = Number(process.env.BACKFILL_LIMIT ?? 2000);
const CONCURRENCY = Math.max(1, Math.min(5, Number(process.env.BACKFILL_CONCURRENCY ?? 2)));
const OFFSET = Number(process.env.BACKFILL_OFFSET ?? 0);

const supabase = createAdminClient();

type Target = {
  id: number;
  name: string;
  af_id: number;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processOne(t: Target): Promise<{ ok: boolean; error?: string }> {
  try {
    const [profile, transfers] = await Promise.all([
      fetchPlayerProfile(t.af_id),
      fetchPlayerTransfers(t.af_id),
    ]);

    const updates: PlayerUpdate = {
      // On stocke toujours quelque chose pour transfers_json (même tableau vide)
      // pour ne plus retomber sur ce joueur au prochain run.
      transfers_json: JSON.parse(JSON.stringify(transfers ?? [])),
    };
    if (profile) {
      updates.height = profile.height_cm;
      updates.weight = profile.weight_kg;
      updates.birth_place = profile.birth_place;
      updates.birth_country = profile.birth_country;
      if (profile.birth_date) updates.date_of_birth = profile.birth_date;
    }

    const { error } = await supabase
      .from('players')
      .update(updates)
      .eq('id', t.id);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function main() {
  console.log('▶ Sélection des joueurs à enrichir...');
  const { data, error } = await supabase
    .from('players')
    .select('id, name, api_football_id, transfers_json')
    .not('api_football_id', 'is', null)
    .is('transfers_json', null)
    .order('id', { ascending: true })
    .range(OFFSET, OFFSET + DAILY_LIMIT - 1);

  if (error) {
    console.error('❌ Erreur Supabase :', error.message);
    process.exit(1);
  }

  const targets: Target[] = (data ?? [])
    .filter((p) => p.api_football_id != null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      af_id: p.api_football_id as number,
    }));

  if (targets.length === 0) {
    console.log('✅ Aucun joueur à enrichir — tous backfillés !');
    return;
  }

  console.log(
    `  ${targets.length} joueurs à traiter (concurrency=${CONCURRENCY})\n`,
  );

  let ok = 0;
  let errors = 0;
  const startedAt = Date.now();

  // Worker pool simple : on lance CONCURRENCY workers qui consomment la queue
  let cursor = 0;
  async function worker(idx: number) {
    while (cursor < targets.length) {
      const i = cursor++;
      const t = targets[i]!;
      const res = await processOne(t);
      if (res.ok) {
        ok++;
        if (ok % 50 === 0) {
          const elapsed = Math.round((Date.now() - startedAt) / 1000);
          const rate = (ok / elapsed).toFixed(2);
          console.log(
            `  ${ok}/${targets.length} OK (${rate} joueurs/s, errors=${errors})`,
          );
        }
      } else {
        errors++;
        console.error(`  ✗ [w${idx}] ${t.name} (AF ${t.af_id}) :`, res.error);
      }
      // Petit délai pour éviter les bursts (AF Pro limite ~10 req/s)
      await sleep(150);
    }
  }

  await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => worker(i)),
  );

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `\n✅ Terminé : ${ok} OK / ${errors} erreurs en ${elapsed}s (~${(ok / Math.max(elapsed, 1)).toFixed(2)} joueurs/s)`,
  );

  // Combien il reste pour info
  const { count: remaining } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .not('api_football_id', 'is', null)
    .is('transfers_json', null);
  console.log(`  Reste à traiter : ${remaining ?? '?'} joueurs.`);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
