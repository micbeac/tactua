// Backfill photo_url + shirt_number + position sur les joueurs des équipes
// ayant api_football_id mappé. Match propre via players.api_football_id
// (plus aucune création de doublon).
//
// Lancer :
//   node --env-file=.env.local scripts/backfill-squad-photos.ts            # toutes
//   node --env-file=.env.local scripts/backfill-squad-photos.ts <dbTeamId> # une seule
//
// Quota AF : 1 req par équipe (≈ 109 req).

import { fetchSquad } from '../lib/api-football/deep-stats.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const supabase = createAdminClient();

async function backfillTeam(
  dbTeamId: number,
  afTeamId: number,
  teamName: string,
) {
  console.log(`\n▶ ${teamName} (DB ${dbTeamId} → AF ${afTeamId})`);

  const squad = await fetchSquad(afTeamId);
  if (squad.length === 0) {
    console.log('  Squad AF vide');
    return { updated: 0, unmatched: 0 };
  }

  const afIds = squad.map((s) => s.player_id);
  const { data: dbPlayers } = await supabase
    .from('players')
    .select('id, api_football_id')
    .in('api_football_id', afIds);

  const afToDb = new Map<number, number>();
  for (const p of (dbPlayers ?? []) as Array<{
    id: number;
    api_football_id: number;
  }>) {
    afToDb.set(p.api_football_id, p.id);
  }

  let updated = 0;
  let unmatched = 0;

  for (const s of squad) {
    const dbId = afToDb.get(s.player_id);
    if (!dbId) {
      unmatched += 1;
      continue;
    }
    const { error } = await supabase
      .from('players')
      .update({
        photo_url: s.photo,
        shirt_number: s.number,
        position: s.position ?? null,
      })
      .eq('id', dbId);
    if (error) {
      console.error(`  ✗ ${s.name} → ${error.message}`);
    } else {
      updated += 1;
    }
  }

  console.log(`  ✅ ${updated} mis à jour, ${unmatched} non mappés`);
  return { updated, unmatched };
}

async function main() {
  const singleTeam = process.argv[2] ? Number(process.argv[2]) : null;

  let query = supabase
    .from('teams')
    .select('id, name, api_football_id')
    .not('api_football_id', 'is', null)
    .order('id', { ascending: true });
  if (singleTeam) query = query.eq('id', singleTeam);

  const { data: teams } = await query;
  type TeamRow = { id: number; name: string; api_football_id: number };
  const list = (teams ?? []) as TeamRow[];
  console.log(`▶ ${list.length} équipes à traiter`);

  let totalUpdated = 0;
  let totalUnmatched = 0;
  for (const t of list) {
    try {
      const r = await backfillTeam(t.id, t.api_football_id, t.name);
      totalUpdated += r.updated;
      totalUnmatched += r.unmatched;
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.error(`  ✗ ${t.name} :`, e instanceof Error ? e.message : e);
    }
  }
  console.log(
    `\n✅ Total : ${totalUpdated} joueurs mis à jour, ${totalUnmatched} non mappés`,
  );
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
