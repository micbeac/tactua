// Backfill des effectifs des sélections nationales engagées en CDM 2026.
//
// Stratégie multi-sources (AF /players/squads est très limité pour les
// sélections — souvent juste 2-3 joueurs de la dernière convocation) :
//
//   1) /players/squads?team=AF        → dernière liste appelée (avec
//                                         numéros maillots + position)
//   2) /players?team=AF&season=2026   → tous les joueurs apparus en 2026
//   3) /players?team=AF&season=2025   → fallback / complément 2025
//
// On fusionne (dedupe player_id), on UPSERT dans players (sans toucher
// current_team_id pour préserver l'affiliation club), puis on rebuild
// proprement national_team_squads pour la team.
//
// Quota AF : 3-4 req par équipe × 48 ≈ 200 req sur 7500/jour.
//
// Lancer :
//   node --env-file=.env.local scripts/backfill-national-team-squads.ts
//   node --env-file=.env.local scripts/backfill-national-team-squads.ts <dbTeamId>
//   node --env-file=.env.local scripts/backfill-national-team-squads.ts --all

import {
  fetchAggregatedTeamPerformers,
  fetchPlayersInLeague,
  fetchSquad,
} from '../lib/api-football/deep-stats.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

// CDM 2026 dans API-Football
const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;

// Nombre d'années calendaires agrégées pour les stats en sélection.
// 5 ans = bilan robuste, tolère les trous de données ponctuels d'AF.
const INTL_STAT_YEARS = 5;

const supabase = createAdminClient();

type TeamRow = {
  id: number;
  name: string;
  api_football_id: number;
};

type MergedPlayer = {
  player_id: number;
  name: string;
  position: string | null;
  photo: string | null;
  number: number | null;
  // Stats en sélection agrégées (5 dernières années calendaires, toutes
  // compétitions internationales). intl_caps sert aussi à trier les cadres.
  intl_caps: number;
  intl_goals: number;
  intl_assists: number;
  // true si le joueur fait partie du pool ACTUEL (liste CDM, dernière
  // convocation, ou apparu en sélection sur les 2 dernières années). Les
  // joueurs vus uniquement en 2022-2024 ne sont pas dans le groupe actuel.
  recent: boolean;
};

function currentCalendarYear(): number {
  return new Date().getUTCFullYear();
}

async function loadTargets(
  singleTeam: number | null,
  allMapped: boolean,
): Promise<TeamRow[]> {
  if (singleTeam) {
    const { data } = await supabase
      .from('teams')
      .select('id, name, api_football_id')
      .eq('id', singleTeam)
      .not('api_football_id', 'is', null);
    return ((data ?? []) as TeamRow[]).filter((t) => t.api_football_id != null);
  }

  if (allMapped) {
    const { data } = await supabase
      .from('teams')
      .select('id, name, api_football_id')
      .not('api_football_id', 'is', null)
      .order('id', { ascending: true });
    return (data ?? []) as TeamRow[];
  }

  const { data: assignments } = await supabase
    .from('wc_group_assignments')
    .select('team:teams(id, name, api_football_id)')
    .order('group_letter', { ascending: true });

  type Row = {
    team: { id: number; name: string; api_football_id: number | null } | null;
  };
  const out: TeamRow[] = [];
  for (const r of (assignments ?? []) as unknown as Row[]) {
    if (r.team?.api_football_id != null) {
      out.push({
        id: r.team.id,
        name: r.team.name,
        api_football_id: r.team.api_football_id,
      });
    }
  }
  return out;
}

async function gatherPlayers(afTeamId: number): Promise<MergedPlayer[]> {
  const merged = new Map<number, MergedPlayer>();

  // 1. /players?league=1&season=2026 — liste officielle CDM (la meilleure
  // source dès que les sélectionneurs publient leur 26)
  try {
    const wcPlayers = await fetchPlayersInLeague(
      afTeamId,
      WC_LEAGUE_ID,
      WC_SEASON,
    );
    for (const p of wcPlayers) {
      // On NE compte PAS les stats CDM ici : elles sont déjà incluses dans
      // l'agrégat saison 2026 (sources 3+4), donc ça ferait double comptage.
      merged.set(p.player_id, {
        player_id: p.player_id,
        name: p.player_name,
        position: p.position,
        photo: p.photo,
        number: null,
        intl_caps: 0,
        intl_goals: 0,
        intl_assists: 0,
        recent: true,
      });
    }
    console.log(`  /players CDM 2026 : ${wcPlayers.length} joueurs`);
  } catch (e) {
    console.log(
      `  /players CDM 2026 échec : ${e instanceof Error ? e.message : e}`,
    );
  }

  // 2. /players/squads — dernière convocation (apporte les numéros maillots
  // quand /league=1 ne les a pas encore)
  try {
    const squad = await fetchSquad(afTeamId);
    for (const s of squad) {
      const existing = merged.get(s.player_id);
      if (existing) {
        if (existing.number == null && s.number != null) {
          existing.number = s.number;
        }
        if (!existing.photo && s.photo) existing.photo = s.photo;
        if (!existing.position && s.position) existing.position = s.position;
      } else {
        merged.set(s.player_id, {
          player_id: s.player_id,
          name: s.name,
          position: s.position,
          photo: s.photo,
          number: s.number,
          intl_caps: 0,
          intl_goals: 0,
          intl_assists: 0,
          recent: true,
        });
      }
    }
    console.log(`  /squads : ${squad.length} joueurs`);
  } catch (e) {
    console.log(`  /squads échec : ${e instanceof Error ? e.message : e}`);
  }

  // 3. /players agrégé sur les N dernières années. Sert à la fois à
  // compléter l'effectif ET à calculer les stats en sélection (caps + buts +
  // passes), sommées sur toutes les saisons.
  const year = currentCalendarYear();
  const seasons: number[] = [];
  for (let i = 0; i < INTL_STAT_YEARS; i++) seasons.push(year - i);
  for (const season of seasons) {
    // Un joueur vu dans une des 2 saisons les plus récentes fait partie du
    // pool actuel de la sélection.
    const isRecentSeason = season >= year - 1;
    try {
      const performers = await fetchAggregatedTeamPerformers(
        afTeamId,
        season,
        200,
      );
      for (const p of performers) {
        const existing = merged.get(p.player_id);
        if (existing) {
          if (!existing.photo && p.photo) existing.photo = p.photo;
          if (!existing.position && p.position) existing.position = p.position;
          // Somme des stats internationales sur toutes les saisons
          existing.intl_caps += p.appearances;
          existing.intl_goals += p.goals;
          existing.intl_assists += p.assists;
          if (isRecentSeason) existing.recent = true;
        } else {
          merged.set(p.player_id, {
            player_id: p.player_id,
            name: p.player_name,
            position: p.position,
            photo: p.photo,
            number: null,
            intl_caps: p.appearances,
            intl_goals: p.goals,
            intl_assists: p.assists,
            recent: isRecentSeason,
          });
        }
      }
      console.log(`  /players saison ${season} : ${performers.length} joueurs`);
    } catch (e) {
      console.log(
        `  /players ${season} échec : ${e instanceof Error ? e.message : e}`,
      );
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return Array.from(merged.values());
}

async function backfillTeam(team: TeamRow) {
  console.log(`\n▶ ${team.name} (DB ${team.id} → AF ${team.api_football_id})`);

  const players = await gatherPlayers(team.api_football_id);
  if (players.length === 0) {
    console.log('  ⚠ Aucune source ne renvoie de joueur');
    return { inserted: 0, updated: 0, mapped: 0 };
  }
  console.log(`  Total fusionné : ${players.length} joueurs uniques`);

  const afIds = players.map((p) => p.player_id);
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
  for (const p of players) {
    const dbId = afToDb.get(p.player_id);

    if (!dbId) {
      const { error } = await supabase.from('players').upsert(
        {
          id: p.player_id,
          api_football_id: p.player_id,
          name: p.name,
          position: p.position ?? null,
          photo_url: p.photo ?? null,
          shirt_number: p.number ?? null,
        },
        { onConflict: 'id' },
      );
      if (error) {
        console.error(`  ✗ insert ${p.name}: ${error.message}`);
        continue;
      }
      afToDb.set(p.player_id, p.player_id);
      inserted += 1;
    } else {
      const patch: {
        photo_url?: string;
        position?: string;
        shirt_number?: number;
      } = {};
      if (p.photo) patch.photo_url = p.photo;
      if (p.position) patch.position = p.position;
      if (p.number != null) patch.shirt_number = p.number;
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase
          .from('players')
          .update(patch)
          .eq('id', dbId);
        if (error) {
          console.error(`  ✗ update ${p.name}: ${error.message}`);
          continue;
        }
        updated += 1;
      }
    }
  }

  // Rebuild propre de national_team_squads
  const { error: delErr } = await supabase
    .from('national_team_squads')
    .delete()
    .eq('team_id', team.id);
  if (delErr) console.error(`  ✗ delete squad: ${delErr.message}`);

  // Seuls les joueurs du pool ACTUEL entrent dans national_team_squads
  // (les joueurs vus uniquement en 2022-2024 sont ignorés ici, mais leurs
  // stats restent disponibles dans players).
  const rows = players
    .filter((p) => p.recent)
    .map((p) => {
      const dbId = afToDb.get(p.player_id);
      if (!dbId) return null;
      return {
        team_id: team.id,
        player_id: dbId,
        position: p.position ?? null,
        shirt_number: p.number ?? null,
        intl_caps: p.intl_caps,
        intl_goals: p.intl_goals,
        intl_assists: p.intl_assists,
        source: 'api_football_squads',
        last_updated_at: new Date().toISOString(),
      };
    })
    .filter(<T,>(x: T | null): x is T => x != null);

  if (rows.length > 0) {
    const { error } = await supabase.from('national_team_squads').insert(rows);
    if (error) console.error(`  ✗ insert squad: ${error.message}`);
  }

  console.log(
    `  ✅ ${inserted} nouveaux, ${updated} mis à jour, ${rows.length} liés à la sélection`,
  );
  return { inserted, updated, mapped: rows.length };
}

async function main() {
  const arg = process.argv[2];
  const allMapped = arg === '--all';
  const singleTeam = arg && !allMapped ? Number(arg) : null;

  const targets = await loadTargets(singleTeam, allMapped);
  console.log(`▶ ${targets.length} équipe(s) à traiter`);

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalMapped = 0;
  for (const t of targets) {
    try {
      const r = await backfillTeam(t);
      totalInserted += r.inserted;
      totalUpdated += r.updated;
      totalMapped += r.mapped;
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {
      console.error(`  ✗ ${t.name} :`, e instanceof Error ? e.message : e);
    }
  }
  console.log(
    `\n✅ Total : ${totalInserted} nouveaux joueurs, ${totalUpdated} mis à jour, ${totalMapped} affectations sélections`,
  );
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
