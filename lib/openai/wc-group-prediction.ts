// Génération IA des prédictions de classement par groupe CDM 2026.
// Prend les 4 équipes d'un groupe et demande à GPT-4o-mini un classement
// final pronostiqué avec un court raisonnement par équipe.
// Enrichi avec les effectifs des sélections (alimentés depuis AF /players/squads).

import { DEFAULT_MODEL, getOpenAI } from './client.ts';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ranking', 'summary'],
  properties: {
    ranking: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['position', 'team_id', 'team_name', 'reasoning'],
        properties: {
          position: { type: 'integer', minimum: 1, maximum: 4 },
          team_id: { type: 'integer' },
          team_name: { type: 'string' },
          reasoning: { type: 'string' },
        },
      },
    },
    summary: { type: 'string' },
  },
} as const;

export type WCGroupPredictionTeam = {
  team_id: number;
  name: string;
  country: string | null;
  squad?: string; // String pré-formatée des joueurs clés (cf. formatSquadForPrompt)
  coach?: string; // String pré-formatée du sélectionneur (cf. formatCoach)
};

export type WCGroupPredictionInput = {
  group_letter: string;
  teams: WCGroupPredictionTeam[];
};

export type WCGroupPredictionContent = {
  ranking: Array<{
    position: number;
    team_id: number;
    team_name: string;
    reasoning: string;
  }>;
  summary: string;
};

const SYSTEM_PROMPT = `Tu es analyste football pour Tactuo, expert des grandes compétitions internationales.
Tu pronostiques le classement final d'un groupe de la Coupe du Monde 2026 (48 équipes, 12 groupes de 4, top 2 + 8 meilleurs 3e qualifiés).

Règles :
- Français, ton factuel et nuancé.
- Pour chaque équipe, en 2-3 phrases : pourquoi elle finit à cette place. Cite 1 à 2 joueurs clés réels parmi ceux fournis dans l'effectif (ne cite jamais un joueur qui n'apparaît pas dans la liste). Si le sélectionneur est fourni, tu peux le mentionner pour parler du style tactique. Mentionne aussi le profil de jeu, la dynamique générique, le niveau de la confédération.
- "summary" : 2-3 phrases qui décrivent comment ce groupe pourrait se dérouler, qui sont les favoris/outsiders, où réside l'incertitude principale.
- Pondère ton ranking avec le contexte historique (palmarès CDM, qualifications), la qualité du club d'appartenance des joueurs convoqués, l'expérience des cadres.
- ⚠ N'invente AUCUN nom de joueur en dehors de ceux explicitement listés dans l'effectif fourni. Si l'effectif est vide ("effectif non récupéré"), reste générique pour cette équipe.
- Reste mesuré, ce n'est pas du pari sportif. Tu peux dire "outsider crédible" ou "favori clair" mais reconnais l'incertitude pour les groupes équilibrés.

Format : JSON strict avec ranking[1→4] + summary.`;

function buildUserPrompt(input: WCGroupPredictionInput): string {
  const blocks = input.teams.map((t, i) => {
    const head = `${i + 1}. ${t.name}${t.country ? ` (${t.country})` : ''} — team_id ${t.team_id}`;
    const lines: string[] = [head];
    if (t.coach) lines.push(`   Sélectionneur : ${t.coach}`);
    if (t.squad) lines.push(`   Effectif clé : ${t.squad}`);
    return lines.join('\n');
  });
  return `Groupe ${input.group_letter} de la Coupe du Monde 2026 :

${blocks.join('\n\n')}

Produis le classement final pronostiqué (1 → 4) avec reasoning par équipe et un summary du groupe.`;
}

export async function generateWCGroupPrediction(
  input: WCGroupPredictionInput,
): Promise<{ content: WCGroupPredictionContent; model: string }> {
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'wc_group_prediction',
        strict: true,
        schema: SCHEMA,
      },
    },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    temperature: 0.4,
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('OpenAI returned empty content');
  const parsed = JSON.parse(raw) as WCGroupPredictionContent;
  return { content: parsed, model: completion.model };
}
