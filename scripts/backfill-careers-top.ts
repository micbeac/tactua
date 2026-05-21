// Backfill transfers_json (+ bio physique) pour les top performers des équipes
// mappées AF. Cible : top 5 joueurs par équipe (par buts + assists) parmi les
// équipes ayant api_football_id non null.
//
// Lancer : node --env-file=.env.local --experimental-strip-types scripts/backfill-careers-top.ts
//
// Quota : 2 appels AF par joueur (profile + transfers) × ~500 joueurs ≈ 1000 req.
// Plan AF Pro = 7500/jour → OK.

import {
  fetchPlayerProfile,
  fetchPlayerTransfers,
} from '../lib/api-football/deep-stats.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const TOP_PER_TEAM = 5;
const supabase = createAdminClient();

async function main() {
  // 1. Cherche les top joueurs par équipe mappée
  console.log('▶ Sélection des top joueurs par équipe...');
  const { data: stats } = await supabase
    .from('player_season_stats')
    .select(
      `player_id, goals, assists,
       player:players!inner(id, name, api_football_id, current_team_id, transfers_json)`,
    )
    .not('player.api_football_id', 'is', null);

  type Row = {
    player_id: number;
    goals: number | null;
    assists: number | null;
    player: {
      id: number;
      name: string;
      api_football_id: number | null;
      current_team_id: number | null;
      transfers_json: unknown | null;
    } | null;
  };

  // Agrège par joueur (somme buts + passes sur toutes compétitions)
  type Agg = {
    player_id: number;
    name: string;
    af_id: number;
    team_id: number;
    score: number;
    hasTransfers: boolean;
  };
  const aggMap = new Map<number, Agg>();
  for (const s of (stats ?? []) as Row[]) {
    if (!s.player || !s.player.api_football_id || !s.player.current_team_id)
      continue;
    const score = (s.goals ?? 0) + (s.assists ?? 0);
    const existing = aggMap.get(s.player.id);
    if (existing) {
      existing.score += score;
    } else {
      aggMap.set(s.player.id, {
        player_id: s.player.id,
        name: s.player.name,
        af_id: s.player.api_football_id,
        team_id: s.player.current_team_id,
        score,
        hasTransfers: Boolean(s.player.transfers_json),
      });
    }
  }

  // Group by team
  const byTeam = new Map<number, Agg[]>();
  for (const a of aggMap.values()) {
    if (a.hasTransfers) continue; // skip déjà backfilled
    if (!byTeam.has(a.team_id)) byTeam.set(a.team_id, []);
    byTeam.get(a.team_id)!.push(a);
  }

  // Top N par équipe
  const targets: Agg[] = [];
  for (const list of byTeam.values()) {
    list.sort((a, b) => b.score - a.score);
    targets.push(...list.slice(0, TOP_PER_TEAM));
  }
  console.log(`  ${targets.length} joueurs à traiter`);

  // 2. Pour chaque cible, fetch profile + transfers puis upsert
  let ok = 0;
  let errors = 0;
  for (const t of targets) {
    try {
      const [profile, transfers] = await Promise.all([
        fetchPlayerProfile(t.af_id),
        fetchPlayerTransfers(t.af_id),
      ]);

      const updates: Record<string, unknown> = {};
      if (profile) {
        updates.height = profile.height_cm;
        updates.weight = profile.weight_kg;
        updates.birth_place = profile.birth_place;
        updates.birth_country = profile.birth_country;
        if (profile.birth_date) updates.date_of_birth = profile.birth_date;
      }
      updates.transfers_json = JSON.parse(JSON.stringify(transfers));

      const { error } = await supabase
        .from('players')
        .update(updates)
        .eq('id', t.player_id);
      if (error) throw error;
      ok += 1;
      if (ok % 20 === 0) console.log(`  ${ok}/${targets.length}`);
    } catch (e) {
      errors += 1;
      console.error(
        `  ✗ ${t.name} (AF ${t.af_id}) :`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  console.log(`\n✅ Termine : ${ok} OK / ${errors} erreurs`);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
