// Rattrapage local : enrich les matchs finished qui n'ont pas encore
// été enrichis (lineups + stats + events).
//
// Le cron refresh-matchday ne touche que les matchs dans [-3h, +24h]
// du kickoff, donc les matchs plus anciens n'ont jamais été enrichis
// si on n'avait pas l'AF Pro à leur moment.
//
// Usage : node --env-file=.env.local --experimental-strip-types scripts/enrich-finished-matches.ts
//
// Variables d'env optionnelles :
//   ENRICH_LIMIT=20      # max de matchs à traiter (défaut 20)
//   ENRICH_DAYS=14       # matchs finished dans les N derniers jours (défaut 14)
//   ENRICH_FORCE=1       # re-enrich même les matchs déjà stats

import { enrichMatchFromApiFootball } from '../lib/api-football/enrich.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const LIMIT = Number(process.env.ENRICH_LIMIT ?? 20);
const DAYS = Number(process.env.ENRICH_DAYS ?? 14);
const FORCE = process.env.ENRICH_FORCE === '1';
const DELAY_MS = 800; // ~6 req par match × 1 match/0.8s = 7.5 req/s

const supabase = createAdminClient();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();

  console.log(`▶ Recherche matchs finished depuis ${since.slice(0, 10)}...`);

  // Récupère les matchs finished dans la fenêtre
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, kickoff_at, status, api_football_fixture_id')
    .eq('status', 'finished')
    .gte('kickoff_at', since)
    .order('kickoff_at', { ascending: false })
    .limit(LIMIT * 3);

  if (error) {
    console.error('❌ Supabase:', error.message);
    process.exit(1);
  }

  // Filtre : on saute ceux qui ont déjà des stats (sauf si FORCE)
  const matchIds = (matches ?? []).map((m) => m.id);
  let alreadySet = new Set<number>();
  if (!FORCE && matchIds.length > 0) {
    const { data: hasStats } = await supabase
      .from('match_team_stats')
      .select('match_id')
      .in('match_id', matchIds);
    alreadySet = new Set((hasStats ?? []).map((r) => r.match_id));
  }

  const targets = (matches ?? [])
    .filter((m) => !alreadySet.has(m.id))
    .slice(0, LIMIT);

  if (targets.length === 0) {
    console.log('✅ Tous les matchs récents ont déjà été enrichis.');
    return;
  }

  console.log(`  ${targets.length} matchs à enrichir\n`);

  let ok = 0;
  let errors = 0;
  let withEvents = 0;
  let withStats = 0;
  let withLineups = 0;
  const start = Date.now();

  for (let i = 0; i < targets.length; i++) {
    const m = targets[i]!;
    try {
      const r = await enrichMatchFromApiFootball(supabase, m.id);
      if (r.fixture_id) {
        ok += 1;
        if (r.events_upserted > 0) withEvents++;
        if (r.team_stats_upserted > 0) withStats++;
        if (r.lineups_upserted > 0) withLineups++;
        console.log(
          `  [${i + 1}/${targets.length}] match ${m.id} ${m.kickoff_at.slice(0, 10)} → events:${r.events_upserted} stats:${r.team_stats_upserted} lineups:${r.lineups_upserted} players:${r.player_stats_upserted}`,
        );
        if (r.notes.length > 0) {
          for (const n of r.notes) console.log(`     ⚠ ${n}`);
        }
      } else {
        console.log(
          `  [${i + 1}/${targets.length}] match ${m.id} → no fixture found`,
        );
        if (r.notes.length > 0) {
          for (const n of r.notes) console.log(`     ⚠ ${n}`);
        }
      }
    } catch (e) {
      errors++;
      console.error(
        `  ✗ match ${m.id}:`,
        e instanceof Error ? e.message : e,
      );
    }
    await sleep(DELAY_MS);
  }

  const elapsed = Math.round((Date.now() - start) / 1000);
  console.log(
    `\n✅ Terminé : ${ok}/${targets.length} OK en ${elapsed}s · events:${withEvents} stats:${withStats} lineups:${withLineups} · errors:${errors}`,
  );
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
