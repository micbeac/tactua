// Smoke test du client Football-Data.org + des mappers.
// Pas d'écriture en DB, juste lecture API + mapping en mémoire.
// Lancer : node --env-file=.env.local scripts/test-football-api.ts

import { createFootballClient } from '../lib/football-api/client.ts';
import {
  mapCompetition,
  mapMatch,
  mapTeam,
  mapMatchStatus,
} from '../lib/football-api/mappers.ts';

const client = createFootballClient();

async function main() {
  console.log('▶ GET /competitions/WC');
  const wc = await client.getCompetition('WC');
  console.log('  raw:', {
    id: wc.id,
    name: wc.name,
    code: wc.code,
    area: wc.area.name,
  });
  const wcMapped = mapCompetition(wc);
  console.log('  mapped:', wcMapped);
  assert(wcMapped.id === wc.id, 'id mismatch');
  assert(wcMapped.code === 'WC', 'code mismatch');

  console.log('\n▶ GET /competitions/WC/teams');
  const teams = await client.getCompetitionTeams('WC');
  console.log(`  ${teams.count} équipes (CDM 2026 = 48)`);
  assert(teams.teams.length > 0, 'no teams returned');
  const sampleTeam = teams.teams[0];
  const teamMapped = mapTeam(sampleTeam);
  console.log('  sample mapped:', teamMapped);
  assert(teamMapped.id === sampleTeam.id, 'team id mismatch');

  console.log('\n▶ GET /competitions/WC/matches (1er match)');
  const matches = await client.getCompetitionMatches('WC');
  const count =
    matches.resultSet?.count ?? matches.count ?? matches.matches.length;
  console.log(`  ${count} matchs total`);
  assert(matches.matches.length > 0, 'no matches returned');
  const sampleMatch = matches.matches[0];
  const matchMapped = mapMatch(sampleMatch);
  console.log('  sample mapped:', matchMapped);
  assert(matchMapped.id === sampleMatch.id, 'match id mismatch');
  assert(
    ['scheduled', 'live', 'finished', 'postponed', 'cancelled'].includes(
      matchMapped.status,
    ),
    `unknown status: ${matchMapped.status}`,
  );

  console.log('\n▶ Vérification du status mapping');
  assert(mapMatchStatus('SCHEDULED') === 'scheduled', 'SCHEDULED');
  assert(mapMatchStatus('TIMED') === 'scheduled', 'TIMED');
  assert(mapMatchStatus('IN_PLAY') === 'live', 'IN_PLAY');
  assert(mapMatchStatus('FINISHED') === 'finished', 'FINISHED');
  assert(mapMatchStatus('POSTPONED') === 'postponed', 'POSTPONED');
  assert(mapMatchStatus('CANCELLED') === 'cancelled', 'CANCELLED');
  console.log('  OK');

  console.log('\n✅ Client + mappers validés sur la Coupe du Monde.');
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
