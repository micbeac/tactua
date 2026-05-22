// Réactualise les effectifs des 20 clubs de Jupiler Pro League.
//
// Contrairement à backfill-squad-photos (qui ne touchait que
// photo/numéro/poste), ce script MET À JOUR current_team_id : c'est ce qui
// permet de capter les transferts (un joueur passé d'un club JPL à un autre,
// ou arrivé/parti).
//
// 2 passes :
//   1. Pour chaque club JPL : /players/squads → upsert players avec
//      current_team_id = club JPL (+ photo, numéro, poste).
//   2. Nettoyage : un joueur encore rattaché à un club JPL en base mais
//      absent de son nouvel effectif a quitté le club → current_team_id = null.
//      (S'il a rejoint un autre club JPL, la passe 1 l'a déjà réaffecté.)
//
// Quota AF : 1 req par club = 20 req.
//
// Lancer : node --env-file=.env.local scripts/refresh-jpl-squads.ts

import { fetchSquad } from '../lib/api-football/deep-stats.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const JPL_COMPETITION_ID = 9001;
const supabase = createAdminClient();

type JplTeam = { id: number; name: string; api_football_id: number };

async function loadJplTeams(): Promise<JplTeam[]> {
  const { data: matches } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id')
    .eq('competition_id', JPL_COMPETITION_ID);

  const ids = new Set<number>();
  for (const m of (matches ?? []) as Array<{
    home_team_id: number | null;
    away_team_id: number | null;
  }>) {
    if (m.home_team_id) ids.add(m.home_team_id);
    if (m.away_team_id) ids.add(m.away_team_id);
  }

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, api_football_id')
    .in('id', [...ids])
    .not('api_football_id', 'is', null)
    .order('name', { ascending: true });

  return (teams ?? []) as JplTeam[];
}

async function main() {
  const teams = await loadJplTeams();
  console.log(`▶ ${teams.length} clubs JPL à réactualiser\n`);

  // freshSquads : team_id DB → set des api_football_id de l'effectif courant
  const freshSquads = new Map<number, Set<number>>();
  let totalInserted = 0;
  let totalUpdated = 0;

  // ── PASSE 1 : upsert effectifs + current_team_id ──────────────────────
  for (const team of teams) {
    process.stdout.write(`▶ ${team.name} (AF ${team.api_football_id}) ... `);
    let squad;
    try {
      squad = await fetchSquad(team.api_football_id);
    } catch (e) {
      console.log(`✗ ${e instanceof Error ? e.message : e}`);
      continue;
    }
    if (squad.length === 0) {
      console.log('⚠ effectif vide');
      continue;
    }

    const afIds = squad.map((s) => s.player_id);
    freshSquads.set(team.id, new Set(afIds));

    const { data: existing } = await supabase
      .from('players')
      .select('id, api_football_id')
      .in('api_football_id', afIds);
    const afToDb = new Map<number, number>();
    for (const p of (existing ?? []) as Array<{
      id: number;
      api_football_id: number;
    }>) {
      afToDb.set(p.api_football_id, p.id);
    }

    let inserted = 0;
    let updated = 0;
    for (const sp of squad) {
      const dbId = afToDb.get(sp.player_id);
      if (!dbId) {
        const { error } = await supabase.from('players').upsert(
          {
            id: sp.player_id,
            api_football_id: sp.player_id,
            name: sp.name,
            position: sp.position ?? null,
            photo_url: sp.photo ?? null,
            shirt_number: sp.number ?? null,
            current_team_id: team.id,
          },
          { onConflict: 'id' },
        );
        if (error) {
          console.log(`\n  ✗ insert ${sp.name}: ${error.message}`);
          continue;
        }
        inserted += 1;
      } else {
        const patch: {
          current_team_id: number;
          photo_url?: string;
          position?: string;
          shirt_number?: number;
        } = { current_team_id: team.id };
        if (sp.photo) patch.photo_url = sp.photo;
        if (sp.position) patch.position = sp.position;
        if (sp.number != null) patch.shirt_number = sp.number;
        const { error } = await supabase
          .from('players')
          .update(patch)
          .eq('id', dbId);
        if (error) {
          console.log(`\n  ✗ update ${sp.name}: ${error.message}`);
          continue;
        }
        updated += 1;
      }
    }
    totalInserted += inserted;
    totalUpdated += updated;
    console.log(`✅ ${squad.length} joueurs (${inserted} nouveaux)`);
    await new Promise((r) => setTimeout(r, 250));
  }

  // ── PASSE 2 : détacher les joueurs partis ─────────────────────────────
  console.log('\n▶ Nettoyage des départs...');
  let totalLeft = 0;
  for (const team of teams) {
    const fresh = freshSquads.get(team.id);
    if (!fresh) continue; // squad non récupérée → on ne touche à rien

    const { data: current } = await supabase
      .from('players')
      .select('id, name, api_football_id')
      .eq('current_team_id', team.id)
      .not('api_football_id', 'is', null);

    const left = ((current ?? []) as Array<{
      id: number;
      name: string;
      api_football_id: number;
    }>).filter((p) => !fresh.has(p.api_football_id));

    for (const p of left) {
      const { error } = await supabase
        .from('players')
        .update({ current_team_id: null })
        .eq('id', p.id);
      if (!error) {
        totalLeft += 1;
        console.log(`  ↪ ${p.name} a quitté ${team.name}`);
      }
    }
  }

  console.log(
    `\n✅ Terminé : ${totalInserted} nouveaux joueurs, ${totalUpdated} mis à jour, ${totalLeft} départs détachés`,
  );
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
