// Backfill des photos + numéros de maillot pour une équipe donnée via le
// squad endpoint d'API-Football.
//
// Stratégie : on récupère le squad complet (avec player_id API-Football,
// photo, number, position), puis on essaie de matcher avec les players déjà
// en DB par nom + current_team_id. Si match : on met à jour photo_url et
// shirt_number sur la ligne existante. Sinon on insert un nouveau row avec
// l'ID API-Football.
//
// Lancer : node --env-file=.env.local scripts/backfill-squad-photos.ts <dbTeamId> <apiFootballTeamId>
// Exemple Bologna : node --env-file=.env.local scripts/backfill-squad-photos.ts 103 500

import { fetchSquad } from '../lib/api-football/deep-stats.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const dbTeamId = Number(process.argv[2]);
const apiFootballTeamId = Number(process.argv[3]);

if (!Number.isFinite(dbTeamId) || !Number.isFinite(apiFootballTeamId)) {
  console.error(
    'Usage: node --env-file=.env.local scripts/backfill-squad-photos.ts <dbTeamId> <apiFootballTeamId>',
  );
  process.exit(1);
}

const supabase = createAdminClient();

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function main() {
  console.log(`▶ Fetch squad API-Football team ${apiFootballTeamId}…`);
  const squad = await fetchSquad(apiFootballTeamId);
  console.log(`  ${squad.length} joueurs récupérés`);

  console.log(`▶ Charger les joueurs déjà en DB pour team ${dbTeamId}…`);
  const { data: dbPlayers, error } = await supabase
    .from('players')
    .select('id, name')
    .eq('current_team_id', dbTeamId);
  if (error) throw error;
  console.log(`  ${dbPlayers?.length ?? 0} joueurs déjà en DB`);

  type DbPlayer = { id: number; name: string };
  const byNorm = new Map<string, DbPlayer>();
  for (const p of (dbPlayers ?? []) as DbPlayer[]) {
    byNorm.set(normalize(p.name), p);
  }

  let updated = 0;
  let inserted = 0;
  let conflictsResolved = 0;

  for (const s of squad) {
    const norm = normalize(s.name);
    const existing = byNorm.get(norm);

    if (existing) {
      // Update photo + shirt sur ligne existante
      const { error: upErr } = await supabase
        .from('players')
        .update({
          photo_url: s.photo,
          shirt_number: s.number,
          position: s.position ?? null,
        })
        .eq('id', existing.id);
      if (upErr) {
        console.error(`  ⚠ update ${s.name} :`, upErr.message);
      } else {
        updated += 1;
      }
    } else {
      // Insert nouveau row avec l'ID API-Football
      const { error: insErr } = await supabase.from('players').upsert(
        {
          id: s.player_id,
          name: s.name,
          position: s.position,
          photo_url: s.photo,
          shirt_number: s.number,
          current_team_id: dbTeamId,
        },
        { onConflict: 'id' },
      );
      if (insErr) {
        console.error(`  ⚠ insert ${s.name} :`, insErr.message);
      } else {
        inserted += 1;
      }
    }
  }

  // Bonus : pour les rows insérés, vérifier qu'on n'a pas de doublons
  // (même joueur en DB avec ID Football-Data ET ID API-Football). Ce n'est
  // pas critique mais utile à logger.
  const { data: allPlayers } = await supabase
    .from('players')
    .select('id, name')
    .eq('current_team_id', dbTeamId);
  const dupes = new Map<string, number[]>();
  for (const p of (allPlayers ?? []) as DbPlayer[]) {
    const k = normalize(p.name);
    if (!dupes.has(k)) dupes.set(k, []);
    dupes.get(k)!.push(p.id);
  }
  for (const [k, ids] of dupes) {
    if (ids.length > 1) {
      console.log(`  ⚠ doublon (${k}) : ids ${ids.join(', ')}`);
      conflictsResolved += 1;
    }
  }

  console.log('\n✅ Backfill terminé');
  console.log(`  Updated  : ${updated}`);
  console.log(`  Inserted : ${inserted}`);
  console.log(`  Doublons : ${conflictsResolved}`);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
