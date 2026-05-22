// Rafraîchit les matchs déjà joués mais restés en statut 'scheduled'/'live'
// faute de cron refresh-matchday actif (limite Vercel Hobby).
//
// Cible : matchs dont le coup d'envoi remonte à > 3 h et dont le statut
// n'est ni 'finished' ni 'cancelled' ni 'postponed'. Pour chacun :
// enrichMatchFromApiFootball (qui met désormais à jour statut + score +
// compos + events + stats).
//
// Lancer :
//   node --env-file=.env.local scripts/refresh-stale-results.ts            # toutes compétitions
//   node --env-file=.env.local scripts/refresh-stale-results.ts 9001       # une compétition (JPL)

import { enrichMatchFromApiFootball } from '../lib/api-football/enrich.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const supabase = createAdminClient();
const STALE_AFTER_MS = 3 * 60 * 60 * 1000; // 3 h après le coup d'envoi

async function main() {
  const competitionId = process.argv[2] ? Number(process.argv[2]) : null;
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();

  let query = supabase
    .from('matches')
    .select('id, kickoff_at, status, competition_id')
    .lt('kickoff_at', cutoff)
    .in('status', ['scheduled', 'live'])
    .order('kickoff_at', { ascending: true });
  if (competitionId != null) {
    query = query.eq('competition_id', competitionId);
  }

  const { data } = await query;
  const list = (data ?? []) as Array<{
    id: number;
    kickoff_at: string;
    status: string;
  }>;

  console.log(
    `▶ ${list.length} match(s) joué(s) mais non finalisé(s)${
      competitionId ? ` (compétition ${competitionId})` : ''
    }\n`,
  );
  if (list.length === 0) return;

  let updated = 0;
  let failed = 0;
  for (const m of list) {
    try {
      const r = await enrichMatchFromApiFootball(supabase, m.id);
      console.log(
        `  match ${m.id} (${m.kickoff_at.slice(0, 16)}) ✅ → ${r.live_status ?? '?'}` +
          ` · compos:${r.lineups_upserted} events:${r.events_upserted}` +
          (r.notes.length ? ` · ${r.notes.join(' / ')}` : ''),
      );
      updated += 1;
    } catch (e) {
      console.log(
        `  match ${m.id} ✗ ${e instanceof Error ? e.message : e}`,
      );
      failed += 1;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`\n✅ Terminé : ${updated} matchs rafraîchis, ${failed} échecs`);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
