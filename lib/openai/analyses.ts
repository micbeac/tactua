// Génération d'analyses pré-match via OpenAI gpt-4o-mini.
// Sortie strictement typée via response_format json_schema.

import { DEFAULT_MODEL, getOpenAI } from './client.ts';
import {
  DEEP_PRE_MATCH_JSON_SCHEMA,
  POST_MATCH_JSON_SCHEMA,
  PRE_MATCH_JSON_SCHEMA,
  type DeepPreMatchAnalysis,
  type PostMatchAnalysis,
  type PreMatchAnalysis,
  type TeamSide,
} from './types.ts';

export type FormResult = 'W' | 'D' | 'L';

export type TeamContext = {
  name: string;
  country: string | null;
  recent_form: FormResult[]; // 5 derniers résultats
  /** Liste des XI titulaires (si compo officielle dispo, sinon vide). */
  starting_eleven: string[];
};

export type H2HContext = {
  date: string; // YYYY-MM-DD
  home_team: string;
  away_team: string;
  score_home: number | null;
  score_away: number | null;
};

export type PreMatchContext = {
  competition: string;
  stage_or_matchday: string | null; // ex "Group Stage", "Journée 38"
  kickoff_at_iso: string;
  venue: string | null;
  home: TeamContext;
  away: TeamContext;
  head_to_head: H2HContext[]; // jusqu'à 5
};

const SYSTEM_PROMPT = `Tu es un analyste football francophone pour Tactuo, une webapp d'analyse augmentée par l'IA.
Tu écris pour des fans curieux qui veulent comprendre le match avant le coup d'envoi : tactique, forme, joueurs clés, points faibles.

Règles :
- Français exclusivement. Ton factuel mais engageant. Pas de jargon inutile.
- Reste concis : chaque champ texte fait 1 à 3 phrases max.
- Base-toi UNIQUEMENT sur le contexte fourni (formes, compositions, H2H). Pas d'invention de stats.
- Si tu n'as pas d'info pour un champ, dis-le sobrement (ex : "Composition non encore publiée").
- Pour la prédiction : reste mesurée, c'est une analyse pas un pronostic de paris. Le scoreline_guess doit être un score plausible (ex "1-1", "2-0 dom.", "0-1 ext.").`;

function buildUserPrompt(ctx: PreMatchContext): string {
  const fmtForm = (form: FormResult[]) =>
    form.length === 0 ? 'inconnue' : form.join('-');
  const fmtSquad = (squad: string[]) =>
    squad.length === 0 ? 'non publiée' : squad.join(', ');

  const h2hLines =
    ctx.head_to_head.length === 0
      ? 'Aucune confrontation passée enregistrée.'
      : ctx.head_to_head
          .map(
            (h) =>
              `- ${h.date} : ${h.home_team} ${h.score_home ?? '?'}-${h.score_away ?? '?'} ${h.away_team}`,
          )
          .join('\n');

  return `Contexte du match à venir :

Compétition : ${ctx.competition}${ctx.stage_or_matchday ? ` (${ctx.stage_or_matchday})` : ''}
Coup d'envoi : ${ctx.kickoff_at_iso}${ctx.venue ? ` — ${ctx.venue}` : ''}

Équipe à domicile : ${ctx.home.name}${ctx.home.country ? ` (${ctx.home.country})` : ''}
- Forme récente (5 derniers, du + récent au + ancien) : ${fmtForm(ctx.home.recent_form)}
- XI titulaire : ${fmtSquad(ctx.home.starting_eleven)}

Équipe à l'extérieur : ${ctx.away.name}${ctx.away.country ? ` (${ctx.away.country})` : ''}
- Forme récente : ${fmtForm(ctx.away.recent_form)}
- XI titulaire : ${fmtSquad(ctx.away.starting_eleven)}

Confrontations directes récentes :
${h2hLines}

Génère l'analyse pré-match en JSON selon le schéma fourni.`;
}

export async function generatePreMatchAnalysis(
  ctx: PreMatchContext,
  options: { model?: string } = {},
): Promise<{
  analysis: PreMatchAnalysis;
  model: string;
  usage: { input: number; output: number };
}> {
  const model = options.model ?? DEFAULT_MODEL;
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(ctx) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'pre_match_analysis',
        strict: true,
        // Le SDK exige `Record<string, unknown>`; on cast le const-tuple ici.
        schema: PRE_MATCH_JSON_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI a renvoyé une réponse vide.');
  }
  const analysis = JSON.parse(content) as PreMatchAnalysis;

  return {
    analysis,
    model,
    usage: {
      input: response.usage?.prompt_tokens ?? 0,
      output: response.usage?.completion_tokens ?? 0,
    },
  };
}

/** Petit helper exporté pour la lisibilité côté UI. */
export function teamSideLabel(side: TeamSide): string {
  return side === 'home' ? 'Domicile' : 'Extérieur';
}

// ============================================================================
// DEEP PRE-MATCH (avec stats détaillées via API-Football)
// ============================================================================

export type DeepTeamContext = {
  name: string;
  country: string | null;
  // Stats globales saison
  form_long: string; // ex "LWLWDWWDDWWWLDLDLLDWLLLLWWWLWLWWLLDWW"
  played: { home: number; away: number; total: number };
  wins: { home: number; away: number; total: number };
  draws: { home: number; away: number; total: number };
  loses: { home: number; away: number; total: number };
  goals_for_avg: { home: string; away: string; total: string };
  goals_against_avg: { home: string; away: string; total: string };
  clean_sheets: number;
  failed_to_score: number;
  biggest_streak: { wins: number; loses: number };
  primary_formation: string | null;
  // Joueurs : top performers avec stats enrichies
  top_performers: Array<{
    name: string;
    position: string | null;
    is_captain: boolean;
    lineups: number;
    minutes: number;
    goals: number;
    assists: number;
    rating: number | null;
    shots_on_target: number | null;
    key_passes: number | null;
    passes_accuracy: number | null;
    duels_won_ratio: number | null;
    // Gardien (null sinon)
    saves: number | null;
    goals_conceded: number | null;
  }>;
  // Indisponibles
  active_injuries: Array<{ player_name: string; reason: string | null }>;
  // XI titulaire si dispo (sinon vide)
  starting_eleven: string[];
};

export type RecentNarrative = {
  title: string;
  snippet: string;
};

export type DeepPreMatchContext = {
  competition: string;
  stage_or_matchday: string | null;
  kickoff_at_iso: string;
  venue: string | null;
  home: DeepTeamContext;
  away: DeepTeamContext;
  head_to_head: Array<{
    date: string;
    home_team: string;
    away_team: string;
    score_home: number | null;
    score_away: number | null;
  }>;
  /** Narratifs récents par équipe (news scrapées via Apify). Facultatif. */
  recent_narratives?: {
    home: RecentNarrative[];
    away: RecentNarrative[];
  };
};

const DEEP_SYSTEM_PROMPT = `Tu es un analyste football francophone pour Tactuo, une webapp d'analyse augmentée par l'IA.
Tu rédiges une analyse pré-match approfondie en t'appuyant sur des STATISTIQUES DÉTAILLÉES.

Règles :
- Français exclusivement. Ton factuel, fondé sur les chiffres fournis. Aucune invention.
- Tu DOIS citer des chiffres précis dans tes paragraphes (ex : "Bologne marque 1,6 but/match à l'extérieur", "Inter a 12 clean sheets cette saison", "ratio victoires à domicile : X/Y").
- "data_insight" : 2-3 phrases qui synthétisent ce que les chiffres révèlent du match à venir (mismatch tactique, déséquilibre dom/ext, joueur clé absent, série en cours…).
- "scenarios" : exactement 3 scénarios narratifs du match, ORDONNÉS du plus probable au moins probable. Chacun :
  * "title" : 4-8 mots qui résument le scénario (ex : "Domination Inter, but tardif des visiteurs", "Match fermé décidé sur coup de pied arrêté").
  * "narrative" : 3-4 phrases qui racontent comment le match se déroule dans CE scénario — phases de jeu, joueurs impliqués, moments clés, score final implicite. Cite des chiffres précis (ex : "Profitant des 1,8 buts/match marqués à domicile…").
  * "likelihood" : "élevée" (scénario #1, le plus probable), "moyenne" (scénario #2, alternatif crédible), "faible" (scénario #3, retournement possible).
  Les 3 scénarios doivent être DIFFÉRENTS dans leur déroulé et leur issue (pas 3 variantes du même scénario).
- "prediction.probabilities" : pourcentages cohérents qui somment à 100. Base tes probas sur :
  * V/N/D historiques de chaque équipe (split home/away)
  * forme récente (longue série fournie, regarde les 10 derniers caractères)
  * H2H récent
  * impact des indisponibilités
- "prediction.btts" : "yes" si les 2 équipes marquent plus de 60% du temps en moyenne, sinon "no". Justifie en citant les chiffres "failed_to_score" et "clean_sheets".
- "prediction.over_2_5" : "yes" si la moyenne combinée des buts pour des 2 équipes > 2.5. Justifie.
- "prediction.scoreline_guess" : score plausible cohérent avec les probas et les moyennes de buts (ex "1-1", "2-1", "0-2").
- "prediction.confidence" : "high" si les indicateurs convergent, "medium" si mixtes, "low" si chaos.
- Si une section "Actu récente" est fournie, intègre les éléments d'actualité PERTINENTS (transferts, blessures fraîches, déclarations marquantes, dynamique de saison) dans tes narratifs et scénarios — sans inventer, en restant fidèle au contenu cité. Cela ancre l'analyse dans le contexte du moment, pas juste les stats.

Reste mesuré, c'est de l'analyse pas du pari sportif.`;

function fmtSquad(squad: string[]): string {
  return squad.length === 0 ? 'non publiée' : squad.join(', ');
}

function fmtTop(performers: DeepTeamContext['top_performers']): string {
  if (performers.length === 0) return 'données non disponibles';
  return performers
    .map((p) => {
      const parts = [`${p.name}`];
      if (p.is_captain) parts.push('(C)');
      if (p.position) parts.push(`[${p.position}]`);
      const stats: string[] = [];
      stats.push(`${p.lineups} titu/${p.minutes}min`);
      if (p.goals || p.assists) stats.push(`${p.goals}b/${p.assists}a`);
      if (p.rating) stats.push(`note ${p.rating}`);
      if (p.shots_on_target != null)
        stats.push(`${p.shots_on_target} tirs cadrés`);
      if (p.key_passes != null) stats.push(`${p.key_passes} passes clés`);
      if (p.passes_accuracy != null)
        stats.push(`${Math.round(p.passes_accuracy)}% passes`);
      if (p.duels_won_ratio != null)
        stats.push(`${Math.round(p.duels_won_ratio * 100)}% duels gagnés`);
      if (p.saves != null) stats.push(`${p.saves} arrêts (G)`);
      if (p.goals_conceded != null) stats.push(`${p.goals_conceded} buts enc.`);
      return `${parts.join(' ')} — ${stats.join(', ')}`;
    })
    .join('\n  • ');
}

function fmtInjuries(list: DeepTeamContext['active_injuries']): string {
  if (list.length === 0) return 'aucune indispo connue';
  return list
    .map((i) => `${i.player_name}${i.reason ? ` (${i.reason})` : ''}`)
    .join(' · ');
}

function buildDeepPrompt(ctx: DeepPreMatchContext): string {
  const fmtTeam = (t: DeepTeamContext, side: 'Domicile' | 'Extérieur') =>
    `
[${side}] ${t.name}${t.country ? ` (${t.country})` : ''}
- Forme longue (W/D/L, du + ancien au + récent) : ${t.form_long}
- Bilan total : ${t.wins.total}V ${t.draws.total}N ${t.loses.total}D sur ${t.played.total} matchs
- À domicile : ${t.wins.home}V ${t.draws.home}N ${t.loses.home}D sur ${t.played.home} matchs
- À l'extérieur : ${t.wins.away}V ${t.draws.away}N ${t.loses.away}D sur ${t.played.away} matchs
- Buts marqués / match : home ${t.goals_for_avg.home}, away ${t.goals_for_avg.away}, total ${t.goals_for_avg.total}
- Buts encaissés / match : home ${t.goals_against_avg.home}, away ${t.goals_against_avg.away}, total ${t.goals_against_avg.total}
- Clean sheets : ${t.clean_sheets} / Failed to score : ${t.failed_to_score}
- Meilleure série victoires : ${t.biggest_streak.wins} / Pire série défaites : ${t.biggest_streak.loses}
- Formation principale : ${t.primary_formation ?? '—'}
- Top performers : ${fmtTop(t.top_performers)}
- Indisponibles récents : ${fmtInjuries(t.active_injuries)}
- XI titulaire annoncé : ${fmtSquad(t.starting_eleven)}`.trim();

  const h2hLines =
    ctx.head_to_head.length === 0
      ? 'Aucune confrontation passée enregistrée.'
      : ctx.head_to_head
          .map(
            (h) =>
              `- ${h.date} : ${h.home_team} ${h.score_home ?? '?'}-${h.score_away ?? '?'} ${h.away_team}`,
          )
          .join('\n');

  const fmtNarratives = (
    list: RecentNarrative[] | undefined,
    teamName: string,
  ) => {
    if (!list || list.length === 0) return '';
    const lines = list
      .slice(0, 5)
      .map((n) => `  - "${n.title.trim()}" → ${n.snippet.trim()}`)
      .join('\n');
    return `\nActu récente ${teamName} :\n${lines}`;
  };

  const narratives = ctx.recent_narratives
    ? fmtNarratives(ctx.recent_narratives.home, ctx.home.name) +
      fmtNarratives(ctx.recent_narratives.away, ctx.away.name)
    : '';

  return `Contexte du match à venir :

Compétition : ${ctx.competition}${ctx.stage_or_matchday ? ` (${ctx.stage_or_matchday})` : ''}
Coup d'envoi : ${ctx.kickoff_at_iso}${ctx.venue ? ` — ${ctx.venue}` : ''}

${fmtTeam(ctx.home, 'Domicile')}

${fmtTeam(ctx.away, 'Extérieur')}

Confrontations directes récentes :
${h2hLines}
${narratives}

Génère l'analyse pré-match enrichie en JSON selon le schéma fourni.`;
}

export async function generateDeepPreMatchAnalysis(
  ctx: DeepPreMatchContext,
  options: { model?: string } = {},
): Promise<{
  analysis: DeepPreMatchAnalysis;
  model: string;
  usage: { input: number; output: number };
}> {
  const model = options.model ?? DEFAULT_MODEL;
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: DEEP_SYSTEM_PROMPT },
      { role: 'user', content: buildDeepPrompt(ctx) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'deep_pre_match_analysis',
        strict: true,
        schema: DEEP_PRE_MATCH_JSON_SCHEMA as unknown as Record<
          string,
          unknown
        >,
      },
    },
    temperature: 0.5,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI a renvoyé une réponse vide.');
  const analysis = JSON.parse(content) as DeepPreMatchAnalysis;

  return {
    analysis,
    model,
    usage: {
      input: response.usage?.prompt_tokens ?? 0,
      output: response.usage?.completion_tokens ?? 0,
    },
  };
}

// ============================================================================
// POST-MATCH
// ============================================================================

export type PostMatchContext = {
  competition: string;
  stage_or_matchday: string | null;
  kickoff_at_iso: string;
  venue: string | null;
  home: {
    name: string;
    country: string | null;
    score: number;
    half_time_score: number | null;
    starting_eleven: string[];
  };
  away: {
    name: string;
    country: string | null;
    score: number;
    half_time_score: number | null;
    starting_eleven: string[];
  };
};

const POST_SYSTEM_PROMPT = `Tu es un analyste football francophone pour Tactuo, une webapp d'analyse augmentée par l'IA.
Tu rédiges une lecture post-match factuelle et engageante : faits marquants, homme du match, performances notables, lecture tactique, moment-clé.

Règles :
- Français exclusivement. Ton factuel, mesuré, jamais sensationnaliste.
- Base-toi UNIQUEMENT sur les données fournies (score, score mi-temps, compositions si dispo). Pas d'invention de buteurs, passeurs, ou stats spécifiques.
- Si tu n'as pas les compositions, ne nomme pas de joueur spécifique pour l'homme du match : utilise un nom générique ("L'attaquant principal de X") ou indique que l'info manque.
- "facts" : 3 à 5 faits chiffrés ou notables (score final, score mi-temps, retournement, dynamique).
- "turning_point" : 1-2 phrases sur le moment qui a fait basculer le match (peut être déduit du score mi-temps vs final).
- "tactical_reading" : 2-3 phrases sur ce que le résultat révèle du jeu des deux équipes.`;

function buildPostMatchPrompt(ctx: PostMatchContext): string {
  const fmtSquad = (squad: string[]) =>
    squad.length === 0 ? 'non publiée' : squad.join(', ');
  const fmtHT = (n: number | null) => (n != null ? String(n) : '?');

  return `Contexte du match terminé :

Compétition : ${ctx.competition}${ctx.stage_or_matchday ? ` (${ctx.stage_or_matchday})` : ''}
Coup d'envoi : ${ctx.kickoff_at_iso}${ctx.venue ? ` — ${ctx.venue}` : ''}

Score final : ${ctx.home.name} ${ctx.home.score} - ${ctx.away.score} ${ctx.away.name}
Score mi-temps : ${fmtHT(ctx.home.half_time_score)} - ${fmtHT(ctx.away.half_time_score)}

Équipe à domicile : ${ctx.home.name}${ctx.home.country ? ` (${ctx.home.country})` : ''}
- XI titulaire : ${fmtSquad(ctx.home.starting_eleven)}

Équipe à l'extérieur : ${ctx.away.name}${ctx.away.country ? ` (${ctx.away.country})` : ''}
- XI titulaire : ${fmtSquad(ctx.away.starting_eleven)}

Génère l'analyse post-match en JSON selon le schéma fourni.`;
}

export async function generatePostMatchAnalysis(
  ctx: PostMatchContext,
  options: { model?: string } = {},
): Promise<{
  analysis: PostMatchAnalysis;
  model: string;
  usage: { input: number; output: number };
}> {
  const model = options.model ?? DEFAULT_MODEL;
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: POST_SYSTEM_PROMPT },
      { role: 'user', content: buildPostMatchPrompt(ctx) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'post_match_analysis',
        strict: true,
        schema: POST_MATCH_JSON_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    temperature: 0.5,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI a renvoyé une réponse vide.');
  }
  const analysis = JSON.parse(content) as PostMatchAnalysis;

  return {
    analysis,
    model,
    usage: {
      input: response.usage?.prompt_tokens ?? 0,
      output: response.usage?.completion_tokens ?? 0,
    },
  };
}
