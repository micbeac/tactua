// Backfill ponctuel : récupère un match via Football-Data /matches/{id}
// et persiste players + lineups en base. Utile pour valider l'UI fiche match
// avant que le cron matchday tourne en prod.
//
// Lancer : node --env-file=.env.local scripts/backfill-match-lineups.ts <matchId>

import { createFootballClient } from '../lib/football-api/client.ts';
import {
  mapLineupsFromMatch,
  mapMatch,
  mapPlayer,
} from '../lib/football-api/mappers.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const matchId = Number(process.argv[2]);
if (!Number.isFinite(matchId)) {
  console.error(
    'Usage: node --env-file=.env.local scripts/backfill-match-lineups.ts <matchId>',
  );
  process.exit(1);
}

const football = createFootballClient();
const supabase = createAdminClient();

async function main() {
  console.log(`▶ GET /matches/${matchId}`);
  const m = await football.getMatch(matchId);
  console.log(
    `  ${m.homeTeam.name} vs ${m.awayTeam.name} — status: ${m.status}`,
  );

  // 1. Upsert match (status + score actuels)
  const { error: mErr } = await supabase
    .from('matches')
    .upsert(mapMatch(m), { onConflict: 'id' });
  if (mErr) throw mErr;
  console.log('  match upserted');

  // 2. Upsert tous les joueurs listés (XI + bench), pour satisfaire la FK match_lineups → players.
  const allPlayers = [
    ...(m.homeTeam.lineup ?? []),
    ...(m.homeTeam.bench ?? []),
    ...(m.awayTeam.lineup ?? []),
    ...(m.awayTeam.bench ?? []),
  ];
  if (allPlayers.length) {
    const playerRows = allPlayers.map((p) => ({
      ...mapPlayer({
        id: p.id,
        name: p.name,
        position: p.position ?? null,
        currentTeam: null,
      }),
    }));
    const { error: pErr } = await supabase
      .from('players')
      .upsert(playerRows, { onConflict: 'id' });
    if (pErr) throw pErr;
    console.log(`  ${playerRows.length} joueurs upserted`);
  }

  // 3. Upsert lineups
  const lineups = mapLineupsFromMatch(m);
  if (lineups.length === 0) {
    console.log(
      "  ⚠ aucune lineup retournée par l'API (match pas encore commencé ?)",
    );
    return;
  }
  const { error: lErr } = await supabase
    .from('match_lineups')
    .upsert(lineups, { onConflict: 'match_id,team_id,player_id,is_confirmed' });
  if (lErr) throw lErr;
  console.log(`  ${lineups.length} lignes match_lineups upserted`);

  console.log('\n✅ Backfill terminé.');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
