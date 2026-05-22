// Backfill du sélectionneur / entraîneur principal de chaque équipe.
// Source : API-Football /coachs?team=AF_ID.
//
// Par défaut cible les 48 sélections CDM 2026 (via wc_group_assignments).
// Quota AF : 1 req par équipe (~48 req).
//
// Lancer :
//   node --env-file=.env.local scripts/backfill-team-coaches.ts
//   node --env-file=.env.local scripts/backfill-team-coaches.ts <dbTeamId>
//   node --env-file=.env.local scripts/backfill-team-coaches.ts --all

import { fetchCurrentCoach } from '../lib/api-football/deep-stats.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const supabase = createAdminClient();

type TeamRow = {
  id: number;
  name: string;
  api_football_id: number;
};

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

async function backfillTeam(team: TeamRow) {
  process.stdout.write(`▶ ${team.name} (AF ${team.api_football_id}) ... `);
  try {
    const coach = await fetchCurrentCoach(team.api_football_id);
    if (!coach) {
      console.log('aucun coach');
      return false;
    }
    const { error } = await supabase.from('team_coaches').upsert(
      {
        team_id: team.id,
        af_coach_id: coach.af_coach_id,
        name: coach.name,
        nationality: coach.nationality,
        photo_url: coach.photo,
        in_charge_since: coach.in_charge_since,
        last_updated_at: new Date().toISOString(),
      },
      { onConflict: 'team_id' },
    );
    if (error) {
      console.log(`✗ ${error.message}`);
      return false;
    }
    console.log(`✅ ${coach.name}`);
    return true;
  } catch (e) {
    console.log(`✗ ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

async function main() {
  const arg = process.argv[2];
  const allMapped = arg === '--all';
  const singleTeam = arg && !allMapped ? Number(arg) : null;

  const targets = await loadTargets(singleTeam, allMapped);
  console.log(`▶ ${targets.length} équipe(s) à traiter\n`);

  let ok = 0;
  for (const t of targets) {
    if (await backfillTeam(t)) ok += 1;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`\n✅ ${ok}/${targets.length} coachs importés`);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
