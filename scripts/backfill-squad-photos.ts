// Backfill photo_url + shirt_number + position sur les joueurs des équipes
// ayant api_football_id mappé. Match propre via players.api_football_id
// (plus aucune création de doublon).
//
// Lancer :
//   node --env-file=.env.local scripts/backfill-squad-photos.ts            # toutes
//   node --env-file=.env.local scripts/backfill-squad-photos.ts <dbTeamId> # une seule
//
// Quota AF : 1 req par équipe (≈ 109 req).

import { fetchSquad, fetchTopPerformers } from '../lib/api-football/deep-stats.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const supabase = createAdminClient();

// Saison utilisee pour le fallback /players (year-based)
function currentSeasonYear(): number {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  return month >= 7 ? year : year - 1;
}

async function backfillTeam(
  dbTeamId: number,
  afTeamId: number,
  teamName: string,
  afLeagueId: number | null,
) {
  console.log(`\n▶ ${teamName} (DB ${dbTeamId} → AF ${afTeamId})`);

  // Source primaire : /players/squads (couvre Top 5 + CDM)
  type Source = {
    player_id: number;
    name: string;
    photo: string | null;
    number: number | null;
    position: string | null;
  };
  let source: Source[] = [];

  const squad = await fetchSquad(afTeamId);
  if (squad.length > 0) {
    source = squad.map((s) => ({
      player_id: s.player_id,
      name: s.name,
      photo: s.photo,
      number: s.number,
      position: s.position ?? null,
    }));
    console.log(`  ${squad.length} joueurs via /squads`);
  } else if (afLeagueId) {
    // Fallback : /players?team=X&season=Y (couvre certaines competitions
    // hors /squads, ex saisons passees Jupiler League)
    const season = currentSeasonYear();
    try {
      const top = await fetchTopPerformers(afTeamId, afLeagueId, season, 100);
      source = top.map((p) => ({
        player_id: p.player_id,
        name: p.player_name,
        photo: p.photo,
        number: null,
        position: p.position ?? null,
      }));
      if (source.length > 0) {
        console.log(`  ${source.length} joueurs via /players (saison ${season})`);
      }
    } catch (e) {
      console.log(
        `  ⚠ /players fallback echec : ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  if (source.length === 0) {
    console.log('  Aucune source disponible');
    return { updated: 0, unmatched: 0 };
  }

  const afIds = source.map((s) => s.player_id);
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

  for (const s of source) {
    const dbId = afToDb.get(s.player_id);
    if (!dbId) {
      unmatched += 1;
      continue;
    }
    // Update : seulement les champs non-null (preserve les data existantes
    // si la source secondaire ne fournit pas le numero maillot par ex)
    const updates: {
      photo_url?: string;
      shirt_number?: number;
      position?: string;
    } = {};
    if (s.photo) updates.photo_url = s.photo;
    if (s.number != null) updates.shirt_number = s.number;
    if (s.position) updates.position = s.position;
    if (Object.keys(updates).length === 0) continue;

    const { error } = await supabase
      .from('players')
      .update(updates)
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

  // On recupere aussi la competition principale (la 1re alimentation
  // team_season_stats par equipe) pour avoir l'af_league_id du fallback
  let query = supabase
    .from('teams')
    .select(
      `id, name, api_football_id,
       team_season_stats!inner(competition:competitions(api_football_league_id))`,
    )
    .not('api_football_id', 'is', null)
    .order('id', { ascending: true });
  if (singleTeam) query = query.eq('id', singleTeam);

  const { data: teams } = await query;
  type TeamRow = {
    id: number;
    name: string;
    api_football_id: number;
    team_season_stats?: Array<{
      competition: { api_football_league_id: number | null } | null;
    }>;
  };
  const list = ((teams ?? []) as unknown as TeamRow[]).map((t) => ({
    id: t.id,
    name: t.name,
    api_football_id: t.api_football_id,
    af_league_id:
      t.team_season_stats?.[0]?.competition?.api_football_league_id ?? null,
  }));
  console.log(`▶ ${list.length} équipes à traiter`);

  let totalUpdated = 0;
  let totalUnmatched = 0;
  for (const t of list) {
    try {
      const r = await backfillTeam(
        t.id,
        t.api_football_id,
        t.name,
        t.af_league_id,
      );
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
