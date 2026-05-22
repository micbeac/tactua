// Backfill léger des stats équipe par match — en particulier le xG
// (expected_goals + goals_prevented), désormais extraits du mapper.
//
// 1 seul appel API par match (/fixtures/statistics) — contrairement à
// l'enrich complet (4 appels). Permet de couvrir de gros volumes (Top 5)
// sans exploser le quota. Idempotent.
//
// Lancer :
//   node --env-file=.env.local scripts/backfill-team-xg.ts            # toutes compét trackées
//   node --env-file=.env.local scripts/backfill-team-xg.ts 9001       # une compétition (JPL)

import { createApiFootballClient } from '../lib/api-football/client.ts';
import { mapApiFootballTeamStats } from '../lib/api-football/mappers.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const supabase = createAdminClient();
const client = createApiFootballClient();

type MatchRow = {
  id: number;
  api_football_fixture_id: number;
  home_team_id: number | null;
  away_team_id: number | null;
};

async function main() {
  const competitionId = process.argv[2] ? Number(process.argv[2]) : null;

  // Pagination : Supabase plafonne un select() à 1000 lignes.
  const matches: MatchRow[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    let query = supabase
      .from('matches')
      .select('id, api_football_fixture_id, home_team_id, away_team_id')
      .eq('status', 'finished')
      .not('api_football_fixture_id', 'is', null)
      .order('kickoff_at', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (competitionId != null) {
      query = query.eq('competition_id', competitionId);
    }
    const { data } = await query;
    const page = (data ?? []) as MatchRow[];
    matches.push(...page);
    if (page.length < PAGE) break;
  }
  console.log(`▶ ${matches.length} matchs à traiter\n`);

  // Map team_id DB → api_football_id, pour construire le teamIdMap AF→DB
  const { data: teams } = await supabase
    .from('teams')
    .select('id, api_football_id')
    .not('api_football_id', 'is', null);
  const dbToAf = new Map<number, number>();
  for (const t of (teams ?? []) as Array<{
    id: number;
    api_football_id: number;
  }>) {
    dbToAf.set(t.id, t.api_football_id);
  }

  let ok = 0;
  let withXg = 0;
  let failed = 0;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    try {
      // teamIdMap : AF team id → DB team id (pour ce match)
      const teamIdMap = new Map<number, number>();
      for (const dbId of [m.home_team_id, m.away_team_id]) {
        if (dbId == null) continue;
        const afId = dbToAf.get(dbId);
        if (afId != null) teamIdMap.set(afId, dbId);
      }
      if (teamIdMap.size === 0) {
        failed += 1;
        continue;
      }

      const resp = await client.getTeamStats(m.api_football_fixture_id);
      if (resp.response.length === 0) {
        ok += 1; // pas de stats côté AF, rien à faire
      } else {
        const rows = mapApiFootballTeamStats(resp, m.id, teamIdMap);
        if (rows.length > 0) {
          const { error } = await supabase
            .from('match_team_stats')
            .upsert(rows, { onConflict: 'match_id,team_id' });
          if (error) throw new Error(error.message);
          if (rows.some((r) => r.expected_goals != null)) withXg += 1;
        }
        ok += 1;
      }
      if ((i + 1) % 50 === 0) {
        console.log(`  … ${i + 1}/${matches.length} (${withXg} avec xG)`);
      }
    } catch (e) {
      failed += 1;
      console.log(
        `  match ${m.id} ✗ ${e instanceof Error ? e.message : e}`,
      );
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(
    `\n✅ Terminé : ${ok} matchs traités, ${withXg} avec xG, ${failed} échecs`,
  );
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
