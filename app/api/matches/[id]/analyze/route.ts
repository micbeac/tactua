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
import { fetchH2H } from '@/lib/api-football/deep-stats';
import { getAnalysis, upsertAnalysis } from '@/lib/data/analysis';
import { getHeadToHead, getTeamForm } from '@/lib/data/match';
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
  half_time_home, half_time_away,
  venue, home_team_id, away_team_id,
  competition:competitions(id, name, api_football_league_id),
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
  venue: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  competition: {
    id: number;
    name: string;
    api_football_league_id: number | null;
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
        const [homeCtxR, awayCtxR, h2hAfR] = await Promise.allSettled([
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
            // Pour chaque équipe, retire les joueurs dont current_team_id != team
            for (const [ctx, teamDbId] of [
              [homeCtx, m.home_team_id!],
              [awayCtx, m.away_team_id!],
            ] as const) {
              const transferredOut: string[] = [];
              ctx.top_performers = ctx.top_performers.filter((p) => {
                const r = rosterByAfId.get(p.af_player_id);
                // Si on n'a pas le joueur en DB, on garde (incertitude → mieux que silence)
                if (!r) return true;
                // Si current_team_id ne match pas, c'est un transfert sortant
                if (r.current_team_id !== teamDbId) {
                  transferredOut.push(p.name);
                  return false;
                }
                return true;
              });
              if (transferredOut.length > 0) {
                console.log(
                  `[analyze ${m.id}] retire ${transferredOut.length} joueur(s) transferes : ${transferredOut.join(', ')}`,
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
                { player_name: name, reason: 'Simulation : absence supposée' },
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
      },
      away: {
        name: m.away_team.name,
        country: m.away_team.country,
        score: m.score_away,
        half_time_score: m.half_time_away,
        starting_eleven: awayXI,
      },
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
    return NextResponse.json(
      {
        error: 'Erreur de génération',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
