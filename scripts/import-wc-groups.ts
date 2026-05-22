// One-shot : importe le mapping team_id → groupe de la CDM 2026 depuis
// Football-Data. FD fournit `group: "GROUP_A"` dans la réponse standings,
// info qu'on n'exploitait pas dans le cron actuel.
//
// Usage : node --env-file=.env.local --experimental-strip-types scripts/import-wc-groups.ts

import { createFootballClient } from '../lib/football-api/client.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const supabase = createAdminClient();
const football = createFootballClient();

async function main() {
  console.log('▶ Fetch standings CDM 2026 depuis Football-Data...');
  const data = await football.getCompetitionStandings('WC');

  // FD : standings est un tableau avec un entry par groupe (12 entries CDM 2026)
  // Chaque entry a un champ "group" type "GROUP_A" et un "table" avec les 4 équipes
  const groupStandings = data.standings.filter(
    (s) => s.group && s.type === 'TOTAL',
  );
  console.log(`  Trouvé ${groupStandings.length} groupes`);

  if (groupStandings.length === 0) {
    console.error(
      '❌ Aucun groupe trouvé. Le tirage CDM 2026 est peut-être pas encore dans FD ?',
    );
    process.exit(1);
  }

  let totalInserts = 0;
  let notMapped = 0;
  const rows: { team_id: number; group_letter: string }[] = [];

  for (const standing of groupStandings) {
    // "GROUP_A" → "A"
    const letter = standing.group!.replace(/^GROUP_/i, '').toUpperCase();
    if (!/^[A-L]$/.test(letter)) {
      console.warn(`  ⚠ groupe ignoré (lettre invalide) : ${standing.group}`);
      continue;
    }
    for (const t of standing.table) {
      rows.push({ team_id: t.team.id, group_letter: letter });
    }
  }

  // Vérifie que les team_ids existent en DB avant l'insert
  const teamIds = rows.map((r) => r.team_id);
  const { data: existing } = await supabase
    .from('teams')
    .select('id, name')
    .in('id', teamIds);
  const existingSet = new Set((existing ?? []).map((t) => t.id));
  const filtered = rows.filter((r) => {
    if (!existingSet.has(r.team_id)) {
      notMapped += 1;
      return false;
    }
    return true;
  });

  // Upsert
  if (filtered.length > 0) {
    const { error } = await supabase
      .from('wc_group_assignments')
      .upsert(filtered, { onConflict: 'team_id' });
    if (error) {
      console.error('❌ Upsert error:', error.message);
      process.exit(1);
    }
    totalInserts = filtered.length;
  }

  console.log(`\n✅ ${totalInserts} équipes mappées sur 12 groupes`);
  if (notMapped > 0) {
    console.log(`   ⚠ ${notMapped} équipes FD non présentes en DB (ignorées)`);
  }

  // Récap par groupe
  console.log('\n📋 Récap :');
  for (const standing of groupStandings) {
    const letter = standing.group!.replace(/^GROUP_/i, '').toUpperCase();
    const names = standing.table.map((t) => t.team.name).join(', ');
    console.log(`  Groupe ${letter} : ${names}`);
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
