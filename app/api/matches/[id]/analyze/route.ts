// Endpoint à la demande : génère (ou retourne le cache de) l'analyse IA d'un match.
//
// Auth requise (Supabase user). Retourne 401 si pas connecté.
//
// Body : { type: 'pre_match' | 'post_match', force?: boolean }
//   - Si analyse existe ET pas de force ET (pre_match : pas de nouvelle compo
//     depuis la dernière génération) → renvoie le cache (`was_cached: true`).
//   - Sinon génère via OpenAI, upsert dans match_analyses, renvoie.
//
// Pas de rate limit aujourd'hui : on est en pré-launch et auth obligatoire.
// À ajouter quand on activera le free/paid tier (3 analyses/jour pour le free).

import { NextResponse } from 'next/server';
import { buildDeepTeamContext } from '@/lib/api-football/deep-context';
import {
  fetchH2H,
  fetchMatchOdds,
  fetchMatchPrediction,
} from '@/lib/api-football/deep-stats';
import { getAnalysis, upsertAnalysis } from '@/lib/data/analysis';
import { getHeadToHead, getTeamForm } from '@/lib/data/match';
import {
  getStandingContext,
  getTeamScheduleContext,
  getTeamSeasonXG,
} from '@/lib/data/match-context';
import { getPostMatchPerformance } from '@/lib/data/match-performance';
import { getCoachesMap } from '@/lib/data/wc-extras';
import {
  generateDeepPreMatchAnalysis,
  generatePostMatchAnalysis,
  generatePreMatchAnalysis,
  type DeepPreMatchContext,
} from '@/lib/openai/analyses';
import { buildRichData } from '@/lib/openai/rich-data';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

type AnalysisType = 'pre_match' | 'post_match';

type Body = {
  type?: AnalysisType;
  force?: boolean;
  /** Mode "what-if" : exclut ces joueurs (par DB id) du contexte AF avant l'analyse */
  excluded_player_ids?: number[];
  /** Si false, on ne persiste pas l'analyse (utile pour what-if simulator) */
  save?: boolean;
};

const MATCH_SELECT = `
  id, kickoff_at, status, stage, matchday, score_home, score_away,
  half_time_home, half_time_away, api_football_fixture_id,
  venue, home_team_id, away_team_id,
  competition:competitions(id, name, api_football_league_id, current_season),
  home_team:teams!matches_home_team_id_fkey(id, name, country, api_football_id),
  away_team:teams!matches_away_team_id_fkey(id, name, country, api_football_id)
`;

type MatchRow = {
  id: number;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  stage: string | null;
  matchday: number | null;
  score_home: number | null;
  score_away: number | null;
  half_time_home: number | null;
  half_time_away: number | null;
  api_football_fixture_id: number | null;
  venue: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  competition: {
    id: number;
    name: string;
    api_football_league_id: number | null;
    current_season: string | null;
  } | null;
  home_team: {
    id: number;
    name: string;
    country: string | null;
    api_football_id: number | null;
  } | null;
  away_team: {
    id: number;
    name: string;
    country: string | null;
    api_football_id: number | null;
  } | null;
};

// Détermine la saison API-Football à utiliser. WC=2026, autres compétitions=2025-26.
function afSeason(afLeagueId: number, kickoffIso: string): number {
  if (afLeagueId === 1) return 2026; // World Cup
  // Heuristique simple : saison déterminée par l'année de fin du championnat.
  // Saison 2025-26 court d'août 2025 à mai 2026.
  const year = new Date(kickoffIso).getUTCFullYear();
  const month = new Date(kickoffIso).getUTCMonth() + 1;
  return month >= 7 ? year : year - 1;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isFinite(matchId)) {
    return NextResponse.json({ error: 'Invalid match id' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const type = body.type;
  if (type !== 'pre_match' && type !== 'post_match') {
    return NextResponse.json(
      { error: 'type must be pre_match or post_match' },
      { status: 400 },
    );
  }
  const force = Boolean(body.force);
  const excludedPlayerIds = Array.isArray(body.excluded_player_ids)
    ? body.excluded_player_ids
    : [];
  const shouldSave = body.save !== false && excludedPlayerIds.length === 0;

  // Vérification d'auth via le client user-scoped (cookie)
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  // Ops DB via le client admin (RLS bypass). On a déjà validé l'auth ci-dessus.
  const supabase = createAdminClient();

  // Charge le match
  const { data: match } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('id', matchId)
    .maybeSingle();
  const m = match as unknown as MatchRow | null;
  if (!m) {
    return NextResponse.json({ error: 'Match introuvable' }, { status: 404 });
  }
  if (!m.home_team || !m.away_team || !m.home_team_id || !m.away_team_id) {
    return NextResponse.json(
      { error: 'Équipes du match pas encore définies' },
      { status: 422 },
    );
  }

  // Validation type vs statut
  if (type === 'post_match' && m.status !== 'finished') {
    return NextResponse.json(
      { error: 'Analyse post-match : le match doit être terminé' },
      { status: 422 },
    );
  }

  // Cache check — bypass en mode what-if (exclusions actives) car le résultat
  // dépend de la sélection live de l'utilisateur, pas du cache canonique.
  const existing = await getAnalysis(supabase, matchId, type);
  if (existing && !force && excludedPlayerIds.length === 0) {
    // Pour pre_match, regen si compo confirmée arrivée APRÈS la dernière analyse
    let shouldRegen = false;
    if (type === 'pre_match') {
      const { data: lastLineup } = await supabase
        .from('match_lineups')
        .select('created_at')
        .eq('match_id', matchId)
        .eq('is_confirmed', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (
        lastLineup &&
        new Date(lastLineup.created_at).getTime() >
          new Date(existing.generated_at).getTime()
      ) {
        shouldRegen = true;
      }
    }
    if (!shouldRegen) {
      return NextResponse.json({
        was_cached: true,
        analysis: existing.content_json,
        generated_at: existing.generated_at,
        ai_model: existing.ai_model,
      });
    }
  }

  // Génération
  try {
    if (type === 'pre_match') {
      // XI confirmé (commun aux 2 voies)
      const { data: lineupRowsData } = await supabase
        .from('match_lineups')
        .select('team_id, is_starter, is_confirmed, players(name)')
        .eq('match_id', m.id)
        .eq('is_confirmed', true)
        .eq('is_starter', true);

      type LineupRow = {
        team_id: number;
        is_starter: boolean;
        is_confirmed: boolean;
        players: { name: string } | null;
      };
      const rows = (lineupRowsData ?? []) as unknown as LineupRow[];
      const homeXI = rows
        .filter((r) => r.team_id === m.home_team_id)
        .map((r) => r.players?.name)
        .filter((n): n is string => Boolean(n));
      const awayXI = rows
        .filter((r) => r.team_id === m.away_team_id)
        .map((r) => r.players?.name)
        .filter((n): n is string => Boolean(n));

      // Voie deep : si toutes les données AF nécessaires sont disponibles
      const afLeagueId = m.competition?.api_football_league_id ?? null;
      const afHomeId = m.home_team.api_football_id;
      const afAwayId = m.away_team.api_football_id;
      const canDeep = Boolean(
        afLeagueId &&
          afHomeId &&
          afAwayId &&
          process.env.API_FOOTBALL_KEY,
      );

      if (canDeep) {
        const season = afSeason(afLeagueId!, m.kickoff_at);
        const matchDate = new Date(m.kickoff_at);
        console.log(
          `[analyze ${m.id}] deep mode AF league=${afLeagueId} season=${season} home=${afHomeId} away=${afAwayId}`,
        );
        const [homeCtxR, awayCtxR, h2hAfR, oddsR, predR] =
          await Promise.allSettled([
          buildDeepTeamContext({
            af_team_id: afHomeId!,
            af_league_id: afLeagueId!,
            season,
            team_name: m.home_team.name,
            team_country: m.home_team.country,
            starting_eleven: homeXI,
            match_date: matchDate,
          }),
          buildDeepTeamContext({
            af_team_id: afAwayId!,
            af_league_id: afLeagueId!,
            season,
            team_name: m.away_team.name,
            team_country: m.away_team.country,
            starting_eleven: awayXI,
            match_date: matchDate,
          }),
          fetchH2H(afHomeId!, afAwayId!, 10),
          // Cotes → consensus probabiliste (calibrage interne, non bloquant)
          m.api_football_fixture_id != null
            ? fetchMatchOdds(m.api_football_fixture_id)
            : Promise.resolve(null),
          // Prédiction statistique AF (calibrage interne, non bloquant)
          m.api_football_fixture_id != null
            ? fetchMatchPrediction(m.api_football_fixture_id)
            : Promise.resolve(null),
        ]);
        if (homeCtxR.status === 'rejected') {
          throw new Error(
            `Step home_context (${m.home_team.name}): ${homeCtxR.reason instanceof Error ? homeCtxR.reason.message : String(homeCtxR.reason)}`,
          );
        }
        if (awayCtxR.status === 'rejected') {
          throw new Error(
            `Step away_context (${m.away_team.name}): ${awayCtxR.reason instanceof Error ? awayCtxR.reason.message : String(awayCtxR.reason)}`,
          );
        }
        if (h2hAfR.status === 'rejected') {
          throw new Error(
            `Step h2h: ${h2hAfR.reason instanceof Error ? h2hAfR.reason.message : String(h2hAfR.reason)}`,
          );
        }
        const homeCtx = homeCtxR.value;
        const awayCtx = awayCtxR.value;
        const h2hAf = h2hAfR.value;
        // Cotes + prédiction AF : optionnelles, un échec ne bloque pas.
        const marketConsensus =
          oddsR.status === 'fulfilled' ? oddsR.value : null;
        if (oddsR.status === 'rejected') {
          console.warn(
            `[analyze ${m.id}] odds échec (non bloquant):`,
            oddsR.reason instanceof Error
              ? oddsR.reason.message
              : oddsR.reason,
          );
        }
        const afPrediction =
          predR.status === 'fulfilled' ? predR.value : null;
        if (predR.status === 'rejected') {
          console.warn(
            `[analyze ${m.id}] prediction échec (non bloquant):`,
            predR.reason instanceof Error
              ? predR.reason.message
              : predR.reason,
          );
        }

        // Fallback team_season_stats : si AF retourne des stats vides
        // (played.total === 0), on patche depuis Football-Data
        // (notre table team_season_stats). Couvre Jupiler League où
        // AF n'a pas la couverture saison 2025-26.
        async function patchFromTeamSeasonStats(
          ctx: typeof homeCtx,
          teamDbId: number,
        ): Promise<void> {
          if (ctx.played.total > 0) return; // AF avait des stats, rien à faire
          const { data: ts } = await supabase
            .from('team_season_stats')
            .select(
              'position, played, wins, draws, losses, goals_for, goals_against, form_last_5',
            )
            .eq('team_id', teamDbId)
            .order('points', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();
          if (!ts || !ts.played) return;
          const played = ts.played ?? 0;
          const wins = ts.wins ?? 0;
          const draws = ts.draws ?? 0;
          const losses = ts.losses ?? 0;
          const gf = ts.goals_for ?? 0;
          const ga = ts.goals_against ?? 0;
          ctx.played = { total: played, home: 0, away: 0 };
          ctx.wins = { total: wins, home: 0, away: 0 };
          ctx.draws = { total: draws, home: 0, away: 0 };
          ctx.loses = { total: losses, home: 0, away: 0 };
          if (played > 0) {
            const forAvg = (gf / played).toFixed(2);
            const againstAvg = (ga / played).toFixed(2);
            ctx.goals_for_avg = {
              total: forAvg,
              home: forAvg,
              away: forAvg,
            };
            ctx.goals_against_avg = {
              total: againstAvg,
              home: againstAvg,
              away: againstAvg,
            };
          }
          if (ts.form_last_5 && ts.form_last_5.length > 0) {
            ctx.form_long = ts.form_last_5.join('');
          }
          console.log(
            `[analyze ${matchId}] patched team ${teamDbId} from team_season_stats : ${played}p ${wins}V ${draws}N ${losses}D`,
          );
        }
        await Promise.all([
          patchFromTeamSeasonStats(homeCtx, m.home_team_id!),
          patchFromTeamSeasonStats(awayCtx, m.away_team_id!),
        ]);

        // Contexte calendrier (fraîcheur/congestion) + classement (enjeu)
        // + entraîneurs. 100% base de données, aucun appel API. Non bloquant.
        try {
          const compSeason = m.competition?.current_season ?? null;
          const compId = m.competition?.id ?? null;
          const [
            homeSched,
            awaySched,
            homeStand,
            awayStand,
            coaches,
            homeXg,
            awayXg,
          ] = await Promise.all([
            getTeamScheduleContext(supabase, m.home_team_id!, m.kickoff_at),
            getTeamScheduleContext(supabase, m.away_team_id!, m.kickoff_at),
            compId && compSeason
              ? getStandingContext(supabase, compId, compSeason, m.home_team_id!)
              : Promise.resolve(null),
            compId && compSeason
              ? getStandingContext(supabase, compId, compSeason, m.away_team_id!)
              : Promise.resolve(null),
            getCoachesMap(supabase, [m.home_team_id!, m.away_team_id!]),
            compId
              ? getTeamSeasonXG(supabase, m.home_team_id!, compId)
              : Promise.resolve(null),
            compId
              ? getTeamSeasonXG(supabase, m.away_team_id!, compId)
              : Promise.resolve(null),
          ]);
          homeCtx.rest_days = homeSched.rest_days;
          homeCtx.matches_last_14d = homeSched.matches_last_14d;
          homeCtx.standing = homeStand;
          homeCtx.coach = coaches.get(m.home_team_id!) ?? null;
          homeCtx.season_xg = homeXg;
          awayCtx.rest_days = awaySched.rest_days;
          awayCtx.matches_last_14d = awaySched.matches_last_14d;
          awayCtx.standing = awayStand;
          awayCtx.coach = coaches.get(m.away_team_id!) ?? null;
          awayCtx.season_xg = awayXg;
        } catch (e) {
          console.warn(
            `[analyze ${m.id}] contexte calendrier/classement échec:`,
            e instanceof Error ? e.message : e,
          );
        }

        // Fix anti-mercato : l'endpoint AF /players?team=X&season=Y retourne
        // TOUS les joueurs ayant joué cette saison, y compris ceux partis au
        // mercato. On filtre via notre DB pour ne garder que ceux dont
        // current_team_id correspond toujours à l'équipe analysée.
        try {
          const allAfIds = [
            ...homeCtx.top_performers.map((p) => p.af_player_id),
            ...awayCtx.top_performers.map((p) => p.af_player_id),
          ];
          if (allAfIds.length > 0) {
            const { data: rosterRows } = await supabase
              .from('players')
              .select('api_football_id, current_team_id, name')
              .in('api_football_id', allAfIds);
            type RR = {
              api_football_id: number;
              current_team_id: number | null;
              name: string;
            };
            const rosterByAfId = new Map<number, RR>();
            for (const r of (rosterRows ?? []) as RR[]) {
              rosterByAfId.set(r.api_football_id, r);
            }
            // Pour chaque équipe, identifie les joueurs dont current_team_id
            // != team du match. ABORT si on enlèverait > 50% (signe probable
            // d'un mismatch d'ID entre sources, pas un vrai exode mercato).
            for (const [ctx, teamDbId] of [
              [homeCtx, m.home_team_id!],
              [awayCtx, m.away_team_id!],
            ] as const) {
              const originalCount = ctx.top_performers.length;
              const candidates: typeof ctx.top_performers = [];
              const wouldRemove: string[] = [];

              for (const p of ctx.top_performers) {
                const r = rosterByAfId.get(p.af_player_id);
                if (!r) {
                  candidates.push(p);
                  continue;
                }
                if (r.current_team_id !== teamDbId) {
                  wouldRemove.push(p.name);
                } else {
                  candidates.push(p);
                }
              }

              const removeRatio =
                originalCount > 0 ? wouldRemove.length / originalCount : 0;

              if (removeRatio > 0.5) {
                console.warn(
                  `[analyze ${m.id}] filter transferred ABORT : aurait retiré ${wouldRemove.length}/${originalCount} joueurs (${Math.round(removeRatio * 100)}%) — probable mismatch ID, filtre désactivé`,
                );
                // On garde tous les top_performers tels quels (pas de transferred_out)
              } else if (wouldRemove.length > 0) {
                ctx.top_performers = candidates;
                ctx.transferred_out = wouldRemove;
                console.log(
                  `[analyze ${m.id}] retire ${wouldRemove.length} joueur(s) transferes : ${wouldRemove.join(', ')}`,
                );
              }
            }
          }
        } catch (e) {
          console.error(`[analyze ${m.id}] filter transferred failed:`, e);
        }

        // Mode what-if : exclut les joueurs spécifiés du contexte avant l'IA.
        // 1. Récupère leurs api_football_id depuis la DB
        // 2. Les retire des top_performers (pour ne plus apparaître dans l'analyse)
        // 3. Les ajoute aux active_injuries (l'IA en tient compte dans les scénarios)
        if (excludedPlayerIds.length > 0) {
          const { data: excludedRows } = await supabase
            .from('players')
            .select('id, name, api_football_id')
            .in('id', excludedPlayerIds);
          type ExRow = {
            id: number;
            name: string;
            api_football_id: number | null;
          };
          const excludedRowsList = (excludedRows ?? []) as ExRow[];
          const excludedAfIds = new Set(
            excludedRowsList
              .map((r) => r.api_football_id)
              .filter((x): x is number => x != null),
          );

          for (const ctx of [homeCtx, awayCtx]) {
            // Liste des noms exclus présents dans ce ctx avant filtrage
            const removedNames = ctx.top_performers
              .filter((p) => excludedAfIds.has(p.af_player_id))
              .map((p) => p.name);
            // Filtre les performers
            ctx.top_performers = ctx.top_performers.filter(
              (p) => !excludedAfIds.has(p.af_player_id),
            );
            // Ajoute aux indispos (raison "simulation absence")
            for (const name of removedNames) {
              ctx.active_injuries = [
                ...ctx.active_injuries,
                {
                  player_name: name,
                  reason: 'Simulation : absence supposée',
                  kind: 'other',
                },
              ];
            }
            // Retire aussi des compositions confirmées si présent
            ctx.starting_eleven = ctx.starting_eleven.filter(
              (n) => !removedNames.includes(n),
            );
          }
          console.log(
            `[analyze ${m.id}] what-if mode : ${excludedAfIds.size} joueur(s) exclu(s)`,
          );
        }

        // Charge les narratifs récents (scrapés via Apify) pour chaque équipe.
        // Permet d'ancrer l'analyse dans l'actu (transferts, blessures, etc.).
        const { data: narrativesRaw } = await supabase
          .from('team_narratives')
          .select('team_id, title, snippet')
          .in('team_id', [m.home_team_id, m.away_team_id])
          .order('scraped_at', { ascending: false })
          .limit(10);
        type NarrRow = {
          team_id: number;
          title: string;
          snippet: string | null;
        };
        const narrList = (narrativesRaw ?? []) as NarrRow[];
        const homeNarrs = narrList
          .filter((n) => n.team_id === m.home_team_id)
          .slice(0, 5)
          .map((n) => ({ title: n.title, snippet: n.snippet ?? '' }));
        const awayNarrs = narrList
          .filter((n) => n.team_id === m.away_team_id)
          .slice(0, 5)
          .map((n) => ({ title: n.title, snippet: n.snippet ?? '' }));

        const deepCtx: DeepPreMatchContext = {
          competition: m.competition?.name ?? 'Compétition',
          stage_or_matchday:
            m.stage ?? (m.matchday != null ? `Journée ${m.matchday}` : null),
          kickoff_at_iso: m.kickoff_at,
          venue: m.venue,
          home: homeCtx,
          away: awayCtx,
          head_to_head: h2hAf.map((h) => ({
            date: h.date,
            home_team: h.home_team,
            away_team: h.away_team,
            score_home: h.score_home,
            score_away: h.score_away,
          })),
          recent_narratives:
            homeNarrs.length > 0 || awayNarrs.length > 0
              ? { home: homeNarrs, away: awayNarrs }
              : undefined,
          market_consensus: marketConsensus ?? undefined,
          af_prediction: afPrediction ?? undefined,
        };

        const { analysis, model } = await generateDeepPreMatchAnalysis(deepCtx);

        // Construit le mapping AF player_id → DB player_id pour les top
        // performers (permet de linker vers /players/[id] depuis le popup).
        const afPlayerIds = [
          ...homeCtx.top_performers.map((p) => p.af_player_id),
          ...awayCtx.top_performers.map((p) => p.af_player_id),
        ];
        const afToDbPlayerId = new Map<number, number>();
        if (afPlayerIds.length > 0) {
          const { data: dbPlayers } = await supabase
            .from('players')
            .select('id, api_football_id')
            .in('api_football_id', afPlayerIds);
          for (const p of (dbPlayers ?? []) as Array<{
            id: number;
            api_football_id: number;
          }>) {
            afToDbPlayerId.set(p.api_football_id, p.id);
          }
        }

        // Enrichissement déterministe (chiffres exacts, pas d'IA) calculé
        // depuis les données API-Football. Permet d'afficher tableau comparatif,
        // radar, forme, joueurs avec stats détaillées, indispos, etc.
        const richData = buildRichData(deepCtx, afToDbPlayerId);
        const enrichedAnalysis = { ...analysis, rich_data: richData };

        // Persiste uniquement si pas de mode what-if (sinon l'analyse "scenario"
        // écraserait l'analyse canonique du match).
        if (shouldSave) {
          await upsertAnalysis(
            supabase,
            m.id,
            'pre_match',
            enrichedAnalysis,
            model,
          );
        }

        // Log l'événement (skip si mode what-if non-sauvé)
        if (shouldSave) {
          await supabase.from('user_match_analysis_events').insert({
            user_id: user.id,
            match_id: m.id,
            analysis_type: 'pre_match',
            action: existing ? 'refreshed' : 'generated',
          });
        }
        return NextResponse.json({
          was_cached: false,
          mode: 'deep',
          analysis: enrichedAnalysis,
          generated_at: new Date().toISOString(),
          ai_model: model,
        });
      }

      // Voie light : équipes/compétition pas (encore) mappées AF
      const [homeForm, awayForm, h2h] = await Promise.all([
        getTeamForm(supabase, m.home_team_id, m.id, 5),
        getTeamForm(supabase, m.away_team_id, m.id, 5),
        getHeadToHead(supabase, m.home_team_id, m.away_team_id, m.id, 5),
      ]);

      const { analysis, model } = await generatePreMatchAnalysis({
        competition: m.competition?.name ?? 'Compétition',
        stage_or_matchday:
          m.stage ?? (m.matchday != null ? `Journée ${m.matchday}` : null),
        kickoff_at_iso: m.kickoff_at,
        venue: m.venue,
        home: {
          name: m.home_team.name,
          country: m.home_team.country,
          recent_form: homeForm.map((f) => f.result),
          starting_eleven: homeXI,
        },
        away: {
          name: m.away_team.name,
          country: m.away_team.country,
          recent_form: awayForm.map((f) => f.result),
          starting_eleven: awayXI,
        },
        head_to_head: h2h
          .filter((h) => h.home_team_id != null && h.away_team_id != null)
          .map((h) => ({
            date: h.kickoff_at.slice(0, 10),
            home_team:
              h.home_team_id === m.home_team_id
                ? m.home_team!.name
                : m.away_team!.name,
            away_team:
              h.away_team_id === m.home_team_id
                ? m.home_team!.name
                : m.away_team!.name,
            score_home: h.score_home,
            score_away: h.score_away,
          })),
      });

      await upsertAnalysis(supabase, m.id, 'pre_match', analysis, model);
      await supabase.from('user_match_analysis_events').insert({
        user_id: user.id,
        match_id: m.id,
        analysis_type: 'pre_match',
        action: existing ? 'refreshed' : 'generated',
      });

      return NextResponse.json({
        was_cached: false,
        mode: 'light',
        analysis,
        generated_at: new Date().toISOString(),
        ai_model: model,
      });
    }

    // POST-MATCH
    if (m.score_home == null || m.score_away == null) {
      return NextResponse.json(
        { error: 'Score du match indisponible' },
        { status: 422 },
      );
    }

    const { data: postLineups } = await supabase
      .from('match_lineups')
      .select('team_id, is_starter, is_confirmed, players(name)')
      .eq('match_id', m.id)
      .eq('is_confirmed', true)
      .eq('is_starter', true);

    type LineupRow = {
      team_id: number;
      is_starter: boolean;
      is_confirmed: boolean;
      players: { name: string } | null;
    };
    const rows = (postLineups ?? []) as unknown as LineupRow[];
    const homeXI = rows
      .filter((r) => r.team_id === m.home_team_id)
      .map((r) => r.players?.name)
      .filter((n): n is string => Boolean(n));
    const awayXI = rows
      .filter((r) => r.team_id === m.away_team_id)
      .map((r) => r.players?.name)
      .filter((n): n is string => Boolean(n));

    // Notes des joueurs + buteurs → permet à l'IA de nommer l'homme du match
    const perf = await getPostMatchPerformance(
      supabase,
      m.id,
      m.home_team_id,
      m.away_team_id,
    );

    const { analysis, model } = await generatePostMatchAnalysis({
      competition: m.competition?.name ?? 'Compétition',
      stage_or_matchday:
        m.stage ?? (m.matchday != null ? `Journée ${m.matchday}` : null),
      kickoff_at_iso: m.kickoff_at,
      venue: m.venue,
      home: {
        name: m.home_team.name,
        country: m.home_team.country,
        score: m.score_home,
        half_time_score: m.half_time_home,
        starting_eleven: homeXI,
        top_performers: perf.home_performers,
      },
      away: {
        name: m.away_team.name,
        country: m.away_team.country,
        score: m.score_away,
        half_time_score: m.half_time_away,
        starting_eleven: awayXI,
        top_performers: perf.away_performers,
      },
      goal_events: perf.goal_events,
    });

    await upsertAnalysis(supabase, m.id, 'post_match', analysis, model);
    await supabase.from('user_match_analysis_events').insert({
      user_id: user.id,
      match_id: m.id,
      analysis_type: 'post_match',
      action: existing ? 'refreshed' : 'generated',
    });

    return NextResponse.json({
      was_cached: false,
      analysis,
      generated_at: new Date().toISOString(),
      ai_model: model,
    });
  } catch (e) {
    console.error('[/api/matches/[id]/analyze]', e);
    const raw = e instanceof Error ? e.message : String(e);
    // Erreur de quota API-Football → message clair, pas le détail technique
    const isQuota =
      /request limit|requests.*limit|rate.?limit/i.test(raw);
    if (isQuota) {
      return NextResponse.json(
        {
          error: 'Service de données momentanément saturé',
          message:
            "Trop de requêtes vers la base de données football aujourd'hui. " +
            'Réessaie dans quelques heures — aucune analyse incomplète ne sera enregistrée.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error: 'Erreur de génération',
        message: raw,
      },
      { status: 500 },
    );
  }
}
