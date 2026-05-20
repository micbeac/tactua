// Génération d'analyses pré-match via OpenAI gpt-4o-mini.
// Sortie strictement typée via response_format json_schema.

import { DEFAULT_MODEL, getOpenAI } from './client.ts';
import {
  PRE_MATCH_JSON_SCHEMA,
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

const SYSTEM_PROMPT = `Tu es un analyste football francophone pour Tactua, une webapp d'analyse augmentée par l'IA.
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
